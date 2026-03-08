"""
Vercel 서버리스: /api/templates, /api/templates/:id (목록·조회·저장·삭제) 전부 이 파일로 라우팅.
FastAPI 앱을 노출하여 main의 templates 라우트가 처리하도록 함.
"""
import sys
from pathlib import Path

_root = Path(__file__).resolve().parent.parent
if str(_root) not in sys.path:
    sys.path.insert(0, str(_root))

from main import app

__all__ = ["app"]
