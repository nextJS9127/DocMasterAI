"""TC 테스트용 최소 기획서 PDF 1페이지 생성 (pymupdf 사용)."""
import sys
from pathlib import Path

try:
    import fitz  # pymupdf
except ImportError:
    print("pip install pymupdf4llm", file=sys.stderr)
    sys.exit(1)

out = Path(__file__).resolve().parent / "sample_for_tc_test.pdf"
doc = fitz.open()
page = doc.new_page(width=595, height=842)
page.insert_text((72, 72), "기획서: 로그인/회원가입 기능", fontsize=14)
page.insert_text((72, 100), "1. 로그인: ID/비밀번호 입력 후 제출 시 서버 검증.", fontsize=10)
page.insert_text((72, 120), "2. 회원가입: 이메일, 비밀번호, 이름 입력 후 약관 동의 필수.", fontsize=10)
page.insert_text((72, 140), "3. 예상 결과: 로그인 성공 시 대시보드(/dashboard)로 이동.", fontsize=10)
doc.save(str(out))
doc.close()
print(str(out))
