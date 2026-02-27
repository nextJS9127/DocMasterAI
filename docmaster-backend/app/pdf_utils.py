"""
app/pdf_utils.py
PDF 파일을 마크다운으로 변환하는 유틸리티 모듈.
- pymupdf4llm : 본문 텍스트 → LLM/RAG용 마크다운 변환
- pdfplumber  : 표(테이블) 추출 → 마크다운 테이블 형식으로 병합
- OCR fallback: 페이지 텍스트가 비었을 때만 해당 페이지에 OCR 적용 (pytesseract 선택 의존)
- 표 블록은 [[TABLE]]...[[/TABLE]] 구분자로 감싸 보고서 생성 시 표로 렌더 가능하도록 함.
"""

import logging
from pathlib import Path
from typing import Any

import pymupdf4llm
import pdfplumber

from app.extract_constants import wrap_table

logger = logging.getLogger(__name__)

# OCR fallback: pytesseract + PIL 선택 사용 (미설치 시 빈 페이지는 그대로 둠)
_ocr_available: bool | None = None

def _ocr_page_fallback(pdf_path: str, page_index_0: int, dpi: int = 300) -> str:
    """해당 PDF 페이지를 이미지로 렌더 후 OCR. 실패 시 빈 문자열."""
    global _ocr_available
    if _ocr_available is False:
        return ""
    try:
        if _ocr_available is None:
            import pytesseract  # noqa: F401
            from PIL import Image
            import pymupdf
            _ocr_available = True
    except ImportError as e:
        logger.debug("OCR fallback 비활성화(의존성 없음): %s", e)
        _ocr_available = False
        return ""

    try:
        import pymupdf  # pymupdf4llm 의존성으로 이미 설치됨
        from PIL import Image
        import pytesseract

        doc = pymupdf.open(pdf_path)
        page = doc[page_index_0]
        pix = page.get_pixmap(dpi=dpi, alpha=False)
        img = Image.frombytes("RGB", [pix.width, pix.height], pix.samples)
        doc.close()
        text = pytesseract.image_to_string(img, lang="kor+eng")
        return (text or "").strip()
    except Exception as e:
        logger.warning("OCR fallback 실패 (page %s): %s", page_index_0 + 1, e)
        return ""


def extract_tables_from_pdf(pdf_path: str) -> dict[int, list[str]]:
    """pdfplumber로 페이지별 표를 추출해 마크다운 테이블 문자열 리스트로 반환."""
    tables_by_page: dict[int, list[str]] = {}

    with pdfplumber.open(pdf_path) as pdf:
        for page_num, page in enumerate(pdf.pages, start=1):
            raw_tables = page.extract_tables()
            if not raw_tables:
                continue

            md_tables: list[str] = []
            for table in raw_tables:
                if not table or not table[0]:
                    continue

                # 헤더 행
                header = table[0]
                header_row = "| " + " | ".join(str(cell or "") for cell in header) + " |"
                separator = "| " + " | ".join(["---"] * len(header)) + " |"
                rows = [header_row, separator]

                # 데이터 행
                for row in table[1:]:
                    rows.append("| " + " | ".join(str(cell or "") for cell in row) + " |")

                md_tables.append("\n".join(rows))

            if md_tables:
                tables_by_page[page_num] = md_tables

    return tables_by_page


def pdf_to_markdown(pdf_path: str, out_meta: dict[str, Any] | None = None) -> str:
    """
    PDF 파일을 마크다운으로 변환.
    - pymupdf4llm 으로 본문 추출
    - 페이지 텍스트가 비었으면 OCR fallback 적용
    - pdfplumber 로 표 추출 후 해당 페이지 마크다운에 병합
    - out_meta 가 주어지면 page_count, ocr_pages 를 채움.
    """
    # 1) 본문 마크다운 추출 (페이지별)
    pages_md: list[dict] = pymupdf4llm.to_markdown(pdf_path, page_chunks=True)

    # 2) 표 추출
    tables_by_page = extract_tables_from_pdf(pdf_path)

    ocr_pages: list[int] = []

    # 3) 병합 (빈 페이지는 OCR fallback)
    result_parts: list[str] = []
    for i, page_info in enumerate(pages_md):
        page_num: int = page_info.get("metadata", {}).get("page", i + 1)
        page_text: str = (page_info.get("text") or "").strip()

        if not page_text:
            fallback = _ocr_page_fallback(pdf_path, i, dpi=300)
            if fallback:
                page_text = fallback
                ocr_pages.append(page_num)
                logger.info("OCR fallback 적용: Page %s", page_num)

        result_parts.append(f"## 📄 Page {page_num}\n")
        result_parts.append(page_text)

        if page_num in tables_by_page:
            result_parts.append("\n\n### 📊 Tables\n")
            for table_md in tables_by_page[page_num]:
                result_parts.append(wrap_table(table_md))
                result_parts.append("\n")

        result_parts.append("\n\n---\n\n")

    if out_meta is not None:
        out_meta["page_count"] = len(pages_md)
        out_meta["ocr_pages"] = ocr_pages

    return "\n".join(result_parts)
