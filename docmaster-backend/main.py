"""
main.py
DocMaster AI (Local) - Python 문서 파싱 백엔드 서버
FastAPI 기반, POST /parse 엔드포인트 제공.

실행 방법:
  cd docmaster-backend
  source venv/bin/activate
  uvicorn main:app --reload --port 8001
"""

import os
import re
import tempfile
from datetime import datetime
from pathlib import Path

from fastapi import FastAPI, File, UploadFile, HTTPException, Body
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, PlainTextResponse
from fastapi import APIRouter

from app.pdf_utils import pdf_to_markdown
from app.pptx_utils import pptx_to_markdown
from app.md_refine import refine_extracted_markdown
from app.normalizer import apply_normalizations

app = FastAPI(
    title="DocMaster AI - Local Parsing Server",
    description="PDF/PPTX 문서를 마크다운으로 변환하는 로컬 파싱 서버",
    version="1.1.0",
)

# [CORS] Vite 개발 서버 + Vercel 배포 도메인에서 오는 요청 허용
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://localhost:5174",
        "http://localhost:5175",
        "http://localhost:5176",
        "https://doc-master-ai.vercel.app",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

SUPPORTED_EXTENSIONS = {".pdf", ".pptx"}

# Vercel 배포 시 공식 예제처럼 /api prefix 사용 (로컬도 동일하게 /api/parse, /api/health)
router = APIRouter(prefix="/api", tags=["api"])


# 추출 MD 1차 정제 사용 여부 (기본: True). False면 원문 그대로 반환·저장.
REFINE_MD = os.environ.get("REFINE_MD", "true").lower() in ("1", "true", "yes")

# 금액/날짜 정규화 적용 여부 (기본: True).
NORMALIZE_MD = os.environ.get("NORMALIZE_MD", "true").lower() in ("1", "true", "yes")

# 추출 결과 저장 디렉토리. Vercel 서버리스에서는 /tmp 사용 (쓰기 가능)
OUTPUTS_DIR = Path("/tmp/docmaster_outputs") if os.environ.get("VERCEL") else Path(__file__).parent / "outputs"
OUTPUTS_DIR.mkdir(exist_ok=True)

# HTML 템플릿 저장 디렉토리 (어드민에서 편집한 템플릿 저장). Vercel에서는 /tmp 사용 시 요청 간 유지되지 않음.
TEMPLATES_DIR = Path("/tmp/docmaster_templates") if os.environ.get("VERCEL") else Path(__file__).parent / "data" / "templates"
TEMPLATES_DIR.mkdir(parents=True, exist_ok=True)

# 허용된 템플릿 ID (path traversal 방지). pptx는 API에서 제외(별도 처리). testcases/features는 어드민에서 편집 가능.
ALLOWED_TEMPLATE_IDS = {"default", "phase1", "presentation2", "wiki", "preformat", "testcases", "features"}
# 추가 템플릿 ID: 영문·숫자·하이픈·언더스코어만 허용 (최대 64자)
SAFE_TEMPLATE_ID_PATTERN = re.compile(r"^[a-zA-Z0-9_-]{1,64}$")


@router.get("/health")
async def health_check():
    """서버 상태 확인 엔드포인트."""
    return {
        "status": "ok",
        "message": "DocMaster 로컬 파싱 서버가 실행 중입니다.",
        "outputs_dir": str(OUTPUTS_DIR),
    }


@router.post("/parse")
async def parse_document(file: UploadFile = File(...)):
    """
    업로드된 PDF 또는 PPTX 파일을 마크다운으로 변환합니다.
    """
    print(f"[DocMaster 백엔드] POST /api/parse 요청 수신 filename={file.filename}")
    if not file.filename:
        raise HTTPException(status_code=400, detail="파일 이름이 없습니다.")

    ext = Path(file.filename).suffix.lower()
    if ext not in SUPPORTED_EXTENSIONS:
        raise HTTPException(
            status_code=400,
            detail=f"지원하지 않는 파일 형식입니다: {ext}. PDF 또는 PPTX 파일만 업로드해주세요.",
        )

    # 임시 파일로 저장 후 처리
    with tempfile.NamedTemporaryFile(delete=False, suffix=ext) as tmp:
        content = await file.read()
        tmp.write(content)
        tmp_path = tmp.name

    try:
        parse_meta: dict = {}
        if ext == ".pdf":
            markdown_text = pdf_to_markdown(tmp_path, out_meta=parse_meta)
        else:  # .pptx
            markdown_text = pptx_to_markdown(tmp_path, out_meta=parse_meta)

        # 추출 MD 1차 정제 (슬라이드 잔재, 반복 푸터, 빈 불릿, 구분선 축소 등)
        if REFINE_MD:
            markdown_text = refine_extracted_markdown(markdown_text)

        # 금액/날짜 정규화 (보수적 적용)
        if NORMALIZE_MD:
            markdown_text = apply_normalizations(
                markdown_text,
                normalize_amount=True,
                normalize_date=True,
            )

        # 메타: 표 개수 (최종 MD 기준)
        parse_meta["table_count"] = markdown_text.count("[[TABLE]]")

        # 첨부 파일은 추출 후 즉시 삭제(finally에서 수행). 추출 결과는 서버에 저장하지 않고 응답으로만 반환.
        print(f"[DocMaster 백엔드] POST /api/parse 완료 filename={file.filename} len={len(markdown_text)}")
        return {
            "markdown": markdown_text,
            "filename": file.filename,
            "file_type": ext,
            "meta": parse_meta,
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"파싱 중 오류가 발생했습니다: {str(e)}")
    finally:
        # 임시 파일 정리
        os.unlink(tmp_path)


@router.get("/result/{file_id}")
async def get_result_markdown(file_id: str):
    """
    저장된 마크다운 파일을 텍스트로 반환합니다.
    같은 파일 재작업 시 재업로드 없이 이 엔드포인트로 내용을 다시 가져올 수 있습니다.
    """
    output_path = OUTPUTS_DIR / f"{file_id}.md"
    if not output_path.exists():
        raise HTTPException(status_code=404, detail=f"저장된 결과를 찾을 수 없습니다: {file_id}")
    return PlainTextResponse(content=output_path.read_text(encoding="utf-8"))


@router.get("/result/{file_id}/download")
async def download_result_markdown(file_id: str):
    """
    저장된 마크다운 파일을 .md 파일로 다운로드합니다.
    """
    output_path = OUTPUTS_DIR / f"{file_id}.md"
    if not output_path.exists():
        raise HTTPException(status_code=404, detail=f"저장된 결과를 찾을 수 없습니다: {file_id}")
    return FileResponse(
        path=str(output_path),
        media_type="text/markdown",
        filename=f"{file_id}.md",
    )


@router.get("/results")
async def list_results():
    """
    저장된 추출 결과 파일 목록을 반환합니다.
    """
    files = sorted(OUTPUTS_DIR.glob("*.md"), key=lambda f: f.stat().st_mtime, reverse=True)
    return {
        "results": [
            {
                "file_id": f.stem,
                "size_kb": round(f.stat().st_size / 1024, 1),
                "created_at": datetime.fromtimestamp(f.stat().st_mtime).strftime("%Y-%m-%d %H:%M:%S"),
            }
            for f in files
        ]
    }


# ─── HTML 템플릿 API (어드민 에디터용) ─────────────────────────────────────────
@router.get("/templates")
async def list_templates():
    """
    편집 가능한 HTML 템플릿 목록을 반환합니다.
    기본 ID + 저장소에 있는 .html 파일(커스텀)을 모두 반환합니다.
    """
    seen = set(ALLOWED_TEMPLATE_IDS)
    items = [{"id": tid, "exists": (TEMPLATES_DIR / f"{tid}.html").exists()} for tid in sorted(seen)]
    for path in TEMPLATES_DIR.glob("*.html"):
        tid = path.stem
        if tid not in seen:
            seen.add(tid)
            items.append({"id": tid, "exists": True})
    items.sort(key=lambda x: x["id"])
    return {"templates": items}


@router.get("/templates/{template_id}")
async def get_template(template_id: str):
    """
    지정한 ID의 HTML 템플릿 내용을 반환합니다.
    testcases/features는 파일이 없어도 반드시 200 + 빈 본문 (프론트가 로컬 기본값 사용).
    """
    print(f"[DocMaster 백엔드] GET /api/templates/{template_id} 요청 수신")
    path = TEMPLATES_DIR / f"{template_id}.html"

    # testcases/features: 파일 없으면 무조건 200 빈 본문 (404 방지)
    if template_id in ("testcases", "features"):
        if not path.exists():
            print(f"[DocMaster 백엔드] GET /api/templates/{template_id} → 200 (빈 본문, TC/FE 기본값)")
            return PlainTextResponse(content="")
        print(f"[DocMaster 백엔드] GET /api/templates/{template_id} → 200 (파일 반환)")
        return PlainTextResponse(content=path.read_text(encoding="utf-8"))

    if template_id not in ALLOWED_TEMPLATE_IDS and not SAFE_TEMPLATE_ID_PATTERN.match(template_id):
        raise HTTPException(status_code=400, detail=f"허용되지 않은 템플릿 ID: {template_id}")
    if not path.exists():
        if template_id in ALLOWED_TEMPLATE_IDS:
            print(f"[DocMaster 백엔드] GET /api/templates/{template_id} → 200 (빈 본문, 기본값 사용)")
            return PlainTextResponse(content="")
        raise HTTPException(status_code=404, detail=f"템플릿을 찾을 수 없습니다: {template_id}")
    print(f"[DocMaster 백엔드] GET /api/templates/{template_id} → 200 (파일 반환)")
    return PlainTextResponse(content=path.read_text(encoding="utf-8"))


@router.put("/templates/{template_id}")
async def put_template(template_id: str, payload: dict = Body(...)):
    """
    지정한 ID의 HTML 템플릿을 저장합니다.
    기본 ID 또는 안전한 커스텀 ID(영문·숫자·하이픈·언더스코어) 허용.
    Body: JSON { "content": "HTML 또는 스타일 가이드 문자열" }
    """
    if template_id not in ALLOWED_TEMPLATE_IDS and not SAFE_TEMPLATE_ID_PATTERN.match(template_id):
        raise HTTPException(status_code=400, detail=f"허용되지 않은 템플릿 ID: {template_id}")
    content = payload.get("content")
    if content is None:
        raise HTTPException(status_code=400, detail="content 필드가 필요합니다.")
    path = TEMPLATES_DIR / f"{template_id}.html"
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(content if isinstance(content, str) else str(content), encoding="utf-8")
    return {"ok": True, "id": template_id}


@router.delete("/templates/{template_id}")
async def delete_template(template_id: str):
    """
    지정한 ID의 저장된 템플릿 파일을 삭제합니다.
    기본 ID는 삭제 시 다음 로드에서 코드 기본값이 사용됩니다.
    """
    if template_id not in ALLOWED_TEMPLATE_IDS and not SAFE_TEMPLATE_ID_PATTERN.match(template_id):
        raise HTTPException(status_code=400, detail=f"허용되지 않은 템플릿 ID: {template_id}")
    path = TEMPLATES_DIR / f"{template_id}.html"
    if not path.exists():
        raise HTTPException(status_code=404, detail=f"템플릿을 찾을 수 없습니다: {template_id}")
    path.unlink()
    return {"ok": True, "id": template_id}


app.include_router(router)
