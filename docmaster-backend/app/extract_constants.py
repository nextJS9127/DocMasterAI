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
