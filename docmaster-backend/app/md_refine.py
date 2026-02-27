"""
추출된 마크다운 1차 정제 모듈.

PDF/PPTX 추출 직후 적용하여 슬라이드 잔재, 반복 푸터, 빈 불릿, 과다 구분선 등을
규칙 기반으로 제거·정규화합니다. 원문 훼손 최소 원칙으로 확실한 노이즈만 제거합니다.
[[TABLE]]...[[/TABLE]], [[DIAGRAM]]...[[/DIAGRAM]] 블록은 삭제·합치지 않고 그대로 유지합니다.
"""

import re
from typing import List


def _normalize_slide_headers(text: str) -> str:
    """## 🖼 Slide N: - N - → ## Slide N, ## 🖼 Slide N: 제목 → ## 제목"""
    # ## 🖼 Slide 3: - 3 -  → ## Slide 3
    text = re.sub(
        r"^(\s*)##\s*🖼\s*Slide\s+(\d+)\s*:\s*-\s*\d+\s*-\s*$",
        r"\1## Slide \2",
        text,
        flags=re.MULTILINE,
    )
    # ## 🖼 Slide 1: 실제제목  → ## 실제제목 (의미 있는 제목 유지)
    text = re.sub(
        r"^(\s*)##\s*🖼\s*Slide\s+\d+\s*:\s*(.+?)\s*$",
        r"\1## \2",
        text,
        flags=re.MULTILINE,
    )
    return text


def _collapse_repeated_hr(text: str) -> str:
    """연속된 --- + 빈 줄을 하나의 --- 로 축소."""
    # \n---\n\n---\n... → \n---\n (반복)
    while re.search(r"(\n---\s*\n)(\s*\n)*---", text):
        text = re.sub(r"(\n---\s*\n)(\s*\n)*---", r"\n---", text)
    return text


def _remove_empty_bullets(text: str) -> str:
    """빈 불릿 또는 점 하나만 있는 불릿 제거."""
    lines = text.split("\n")
    out: List[str] = []
    for line in lines:
        if re.match(r"^\s*-\s*\.\s*$", line):
            continue
        if re.match(r"^\s*-\s*$", line):
            continue
        out.append(line)
    return "\n".join(out)


def _find_repeated_footer_candidates(text: str, min_occurrences: int = 3) -> set:
    """문서 전역에서 min_occurrences회 이상 나오는 줄을 푸터 후보로 반환."""
    lines = [ln.strip() for ln in text.split("\n") if ln.strip()]
    from collections import Counter

    counts = Counter(lines)
    return {ln for ln, c in counts.items() if c >= min_occurrences}


def _remove_repeated_footer_at_block_ends(text: str, footer_candidates: set) -> str:
    """각 블록(## 또는 --- 구간) 끝에 있는 푸터 후보 줄만 제거."""
    if not footer_candidates:
        return text

    blocks: List[str] = []
    # ## 로 시작하는 줄 기준으로 블록 분리 (첫 블록은 헤더 없을 수 있음)
    parts = re.split(r"(?=^##\s)", text, flags=re.MULTILINE)
    for part in parts:
        part = part.strip()
        if not part:
            continue
        lines = part.split("\n")
        # 끝에서부터 푸터 후보인 줄만 제거 (연속으로 있을 수 있음)
        while lines and lines[-1].strip() in footer_candidates:
            lines.pop()
        # 빈 줄만 남은 끝도 정리
        while lines and not lines[-1].strip():
            lines.pop()
        if lines:
            blocks.append("\n".join(lines))
    return "\n\n".join(blocks) if blocks else text


def _collapse_version_only_blocks(text: str, min_consecutive: int = 5) -> str:
    """연속된 - V0.x 형태만 있는 블록을 한 줄로 축소."""
    lines = text.split("\n")
    version_line = re.compile(r"^\s*-\s*V\d+\.\d+\s*$")
    out: List[str] = []
    i = 0
    while i < len(lines):
        line = lines[i]
        # 연속된 버전 줄 찾기
        if version_line.match(line):
            run = [line]
            j = i + 1
            while j < len(lines) and version_line.match(lines[j]):
                run.append(lines[j])
                j += 1
            if len(run) >= min_consecutive:
                # V0.2 ~ V1.0 형태로 축약
                first = run[0].strip().replace("-", "").strip()
                last = run[-1].strip().replace("-", "").strip()
                out.append(f"- 버전: {first} ~ {last}")
                i = j
                continue
        out.append(line)
        i += 1
    return "\n".join(out)


def _trim_excessive_blank_lines(text: str, max_consecutive: int = 2) -> str:
    """연속 빈 줄을 max_consecutive개로 제한."""
    pattern = r"\n{" + str(max_consecutive + 1) + r",}"
    return re.sub(pattern, "\n" * max_consecutive, text)


def refine_extracted_markdown(raw_md: str) -> str:
    """
    추출된 마크다운에 1차 정제 규칙을 적용합니다.

    적용 순서:
    1. 슬라이드 제목 정규화 (🖼 Slide N: - N - → Slide N 등)
    2. 빈/의미 없는 불릿 제거
    3. 연속 구분선(---) 축소
    4. 반복 푸터 후보 식별 후 블록 끝에서만 제거
    5. 버전만 나열된 블록 축약
    6. 과다 빈 줄 정리

    원문 훼손 최소: 확실한 노이즈만 제거하고 애매하면 유지합니다.
    """
    if not raw_md or not raw_md.strip():
        return raw_md

    text = raw_md

    text = _normalize_slide_headers(text)
    text = _remove_empty_bullets(text)
    text = _collapse_repeated_hr(text)

    footer_candidates = _find_repeated_footer_candidates(text, min_occurrences=3)
    text = _remove_repeated_footer_at_block_ends(text, footer_candidates)

    text = _collapse_version_only_blocks(text, min_consecutive=5)
    text = _trim_excessive_blank_lines(text, max_consecutive=2)

    return text.strip()
