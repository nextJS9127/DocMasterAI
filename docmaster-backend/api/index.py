"""
Vercel 서버리스 함수: /api/* 요청을 FastAPI 앱으로 전달.
api/index.py → /api 경로로 노출되며, FastAPI가 /api/parse, /api/health 등 하위 경로 라우팅.
"""
import sys
from pathlib import Path

# 프로젝트 루트(docmaster-backend)를 path에 추가 (api/ 폴더에서 main import 가능하도록)
_root = Path(__file__).resolve().parent.parent
if str(_root) not in sys.path:
    sys.path.insert(0, str(_root))

from main import app

__all__ = ["app"]
