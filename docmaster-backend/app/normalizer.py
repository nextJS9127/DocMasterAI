"""
추출된 마크다운 정규화 모듈 (MD 유지).

금액·날짜·예약코드 등을 보수적으로 정규화합니다.
원문 훼손 최소: [[TABLE]]/[[DIAGRAM]] 블록은 그대로 두고, 명확한 패턴만 치환합니다.
"""

import re
from typing import List


# 금액: 1,000원 / 1,000 원 / 1.000원 / 1000원 → 숫자 + " KRW" 보조 표기 (원본 유지 시 괄호)
CURRENCY_PATTERN = re.compile(
    r"(\d{1,3}(?:[,\.]\d{3})*(?:[,\.]\d+)?)\s*(원|KRW|₩)?",
    re.IGNORECASE,
)

# 날짜: YYYY-MM-DD, YYYY.MM.DD, YYYY/MM/DD, YYYY년 M월 D일 등 → ISO (YYYY-MM-DD)
DATE_PATTERNS = [
    (re.compile(r"(\d{4})[-\./](\d{1,2})[-\./](\d{1,2})"), lambda m: f"{m.group(1)}-{m.group(2).zfill(2)}-{m.group(3).zfill(2)}"),
    (re.compile(r"(\d{4})년\s*(\d{1,2})월\s*(\d{1,2})일?"), lambda m: f"{m.group(1)}-{m.group(2).zfill(2)}-{m.group(3).zfill(2)}"),
]

# 예약코드: PZ + 숫자 8~12자 등 (도메인 패턴, 필요 시 확장)
RESERVATION_CODE_PATTERN = re.compile(
    r"\b(PZ\d{8,12})\b",
    re.IGNORECASE,
)
# H로 시작 예약코드 (예: HP2500000002)
RESERVATION_CODE_H_PATTERN = re.compile(
    r"\b(H[PX]\d{8,12})\b",
    re.IGNORECASE,
)


def normalize_amounts(text: str, append_krw: bool = True) -> str:
    """
    금액 표기 정규화: 숫자+원/KRW/₩ → 숫자(쉼표 제거) + " KRW".
    원/KRW/₩가 있거나 숫자에 쉼표가 있을 때만 치환 (버전 번호 등 오인 최소화).
    """
    def repl(m: re.Match) -> str:
        num_raw = m.group(1)
        has_unit = m.group(2) is not None
        has_comma = "," in num_raw or ("." in num_raw and len(num_raw) > 4)
        if not has_unit and not has_comma:
            return m.group(0)
        num_clean = num_raw.replace(",", "").replace(".", "")
        if not num_clean.isdigit():
            return m.group(0)
        if append_krw:
            return f"{num_clean} KRW"
        return num_clean

    return CURRENCY_PATTERN.sub(repl, text)


def normalize_dates(text: str) -> str:
    """
    날짜 패턴을 ISO (YYYY-MM-DD) 형태로 통일.
    이미 ISO 형태는 유지, 한글/다른 구분자만 치환.
    """
    for pattern, replacer in DATE_PATTERNS:
        text = pattern.sub(replacer, text)
    return text


def extract_reservation_codes(text: str) -> List[str]:
    """예약코드 패턴 추출 (PZ..., HP..., HX...)."""
    codes: List[str] = []
    for pat in (RESERVATION_CODE_PATTERN, RESERVATION_CODE_H_PATTERN):
        codes.extend(pat.findall(text))
    return list(dict.fromkeys(codes))


def apply_normalizations(
    text: str,
    *,
    normalize_amount: bool = True,
    normalize_date: bool = True,
) -> str:
    """
    정규화 옵션에 따라 금액·날짜만 적용.
    예약코드는 추출만 하고 치환하지 않음 (원문 유지).
    """
    if not text or not text.strip():
        return text

    if normalize_amount:
        text = normalize_amounts(text, append_krw=True)
    if normalize_date:
        text = normalize_dates(text)

    return text
