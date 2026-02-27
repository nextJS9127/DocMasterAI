"""
Vercel 진입점. 공식 지원 진입점 목록(index.py)에 맞추어 main의 app을 노출.
로컬에서는 uvicorn main:app 사용, Vercel에서는 이 파일을 자동 인식.
"""
from main import app

__all__ = ["app"]
