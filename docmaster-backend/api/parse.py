"""
Vercel 서버리스: /api/parse → 이 파일로 라우팅됨. FastAPI 앱을 노출.
"""
import sys
from pathlib import Path

_root = Path(__file__).resolve().parent.parent
if str(_root) not in sys.path:
    sys.path.insert(0, str(_root))

from main import app

__all__ = ["app"]
