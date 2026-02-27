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
import tempfile
from datetime import datetime
from pathlib import Path

from fastapi import FastAPI, File, UploadFile, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, PlainTextResponse

from app.pdf_utils import pdf_to_markdown
from app.pptx_utils import pptx_to_markdown
from app.md_refine import refine_extracted_markdown
from app.normalizer import apply_normalizations

app = FastAPI(
    title="DocMaster AI - Local Parsing Server",
    description="PDF/PPTX 문서를 마크다운으로 변환하는 로컬 파싱 서버",
    version="1.1.0",
)

# [CORS] Vite 개발 서버에서 오는 요청 허용 (포트 범위 대응)
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://localhost:5174",
        "http://localhost:5175",
        "http://localhost:5176",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

SUPPORTED_EXTENSIONS = {".pdf", ".pptx"}

# 추출 MD 1차 정제 사용 여부 (기본: True). False면 원문 그대로 반환·저장.
REFINE_MD = os.environ.get("REFINE_MD", "true").lower() in ("1", "true", "yes")

# 금액/날짜 정규화 적용 여부 (기본: True).
NORMALIZE_MD = os.environ.get("NORMALIZE_MD", "true").lower() in ("1", "true", "yes")

# [NEW] 추출 결과 저장 디렉토리 (서버 실행 위치 기준)
OUTPUTS_DIR = Path(__file__).parent / "outputs"
OUTPUTS_DIR.mkdir(exist_ok=True)


@app.get("/health")
async def health_check():
    """서버 상태 확인 엔드포인트."""
    return {
        "status": "ok",
        "message": "DocMaster 로컬 파싱 서버가 실행 중입니다.",
        "outputs_dir": str(OUTPUTS_DIR),
    }


@app.post("/parse")
async def parse_document(file: UploadFile = File(...)):
    """
    업로드된 PDF 또는 PPTX 파일을 마크다운으로 변환합니다.
    첨부 파일은 추출 완료 후 즉시 삭제되며, 추출 결과는 서버에 저장하지 않고 응답으로만 반환합니다.

    Returns:
        {
          "markdown": "...",   # 추출된 마크다운 내용
          "filename": "...",   # 원본 파일명
          "file_type": "...",
          "meta": {...}
        }
    """
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


@app.get("/result/{file_id}")
async def get_result_markdown(file_id: str):
    """
    저장된 마크다운 파일을 텍스트로 반환합니다.
    같은 파일 재작업 시 재업로드 없이 이 엔드포인트로 내용을 다시 가져올 수 있습니다.
    """
    output_path = OUTPUTS_DIR / f"{file_id}.md"
    if not output_path.exists():
        raise HTTPException(status_code=404, detail=f"저장된 결과를 찾을 수 없습니다: {file_id}")
    return PlainTextResponse(content=output_path.read_text(encoding="utf-8"))


@app.get("/result/{file_id}/download")
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


@app.get("/results")
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
