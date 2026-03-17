"""
추출 MD 내 표/다이어그램 블록 구분자.
보고서 생성 시 이 구분자를 인식해 HTML <table> 또는 다이어그램 영역으로 렌더링할 수 있음.
"""

# 표 블록: [[TABLE]] ... [[/TABLE]] 사이는 마크다운 테이블(| ... |) 또는 CSV 성격의 텍스트.
BLOCK_TABLE_START = "[[TABLE]]"
BLOCK_TABLE_END = "[[/TABLE]]"

# 다이어그램 블록: [[DIAGRAM]] ... [[/DIAGRAM]] 사이는 차트/플로우 등 설명 또는 캡션.
BLOCK_DIAGRAM_START = "[[DIAGRAM]]"
BLOCK_DIAGRAM_END = "[[/DIAGRAM]]"

# Mermaid 블록: [[MERMAID]] ... [[/MERMAID]] 사이는 Mermaid 문법(flowchart, sequenceDiagram 등).
# 1차 추출 시 표/다이어그램을 Mermaid로 생성해 두면, 정리 md·뷰어에서 그대로 시각화 가능.
BLOCK_MERMAID_START = "[[MERMAID]]"
BLOCK_MERMAID_END = "[[/MERMAID]]"


def wrap_table(md_table_content: str) -> str:
    """마크다운 테이블 문자열을 [[TABLE]]...[[/TABLE]] 로 감싼다."""
    if not md_table_content.strip():
        return ""
    return f"{BLOCK_TABLE_START}\n{md_table_content.strip()}\n{BLOCK_TABLE_END}"


def wrap_diagram(description_or_caption: str) -> str:
    """다이어그램 설명을 [[DIAGRAM]]...[[/DIAGRAM]] 로 감싼다."""
    if not description_or_caption.strip():
        return ""
    return f"{BLOCK_DIAGRAM_START}\n{description_or_caption.strip()}\n{BLOCK_DIAGRAM_END}"


def wrap_mermaid(mermaid_code: str) -> str:
    """Mermaid 문법 문자열을 [[MERMAID]]...[[/MERMAID]] 로 감싼다. 뷰어에서 ```mermaid 로 변환해 렌더."""
    if not mermaid_code.strip():
        return ""
    return f"{BLOCK_MERMAID_START}\n{mermaid_code.strip()}\n{BLOCK_MERMAID_END}"


def _mermaid_sanitize_label(text: str, max_len: int = 40) -> str:
    """Mermaid 노드 라벨에 쓸 수 있게 따옴표·대괄호 제거, 길이 제한."""
    s = (text or "").replace('"', "'").replace("[", "(").replace("]", ")").strip()
    if len(s) > max_len:
        s = s[: max_len - 1] + "…"
    return s or "?"


def table_md_to_mermaid_flowchart(md_table: str) -> str:
    """
    마크다운 표 문자열을 Mermaid flowchart TD 로 변환.
    각 행을 한 노드로, 위에서 아래로 연결. (헤더 행 + 구분자 행 제외한 데이터 행만)
    """
    lines = [ln.strip() for ln in (md_table or "").strip().splitlines() if ln.strip()]
    if not lines:
        return "flowchart TD\n  A[내용 없음]"
    rows: list[list[str]] = []
    for line in lines:
        if line.startswith("|") and line.endswith("|"):
            cells = [c.strip() for c in line[1:-1].split("|")]
            # 구분자 행 | --- | --- | 스킵
            if cells and all(
                c.replace("-", "").replace(":", "").strip() == "" for c in cells
            ):
                continue
            if cells:
                rows.append(cells)
    if not rows:
        return "flowchart TD\n  A[표]"
    # 노드 id: n0, n1, ... / 라벨: 첫 셀 또는 셀 합침
    parts = ["flowchart TD"]
    for i, cells in enumerate(rows):
        label = " / ".join(c for c in cells[:3] if c)[:50] or f"행{i+1}"
        label = _mermaid_sanitize_label(label, 50)
        parts.append(f'  n{i}["{label}"]')
    for i in range(len(rows) - 1):
        parts.append(f"  n{i} --> n{i + 1}")
    return "\n".join(parts)


def caption_to_mermaid_node(caption: str) -> str:
    """캡션/설명 한 줄을 Mermaid flowchart 단일 노드로."""
    label = _mermaid_sanitize_label(caption or "다이어그램", 60)
    return f'flowchart TD\n  A["{label}"]'
