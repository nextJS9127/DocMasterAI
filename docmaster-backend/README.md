# DocMaster AI — 파싱 백엔드

로컬에서 문서 파싱 서버를 띄우는 방법입니다.

## 로컬 실행 (필수)

프론트엔드에서 파일 업로드 시 **반드시** 이 백엔드를 먼저 실행해야 합니다.

```bash
# 1) 백엔드 디렉토리로 이동
cd docmaster-backend

# 2) 가상환경 활성화 (사용 중인 경우)
# source venv/bin/activate   # macOS/Linux
# .\venv\Scripts\activate    # Windows

# 3) 서버 실행 (포트 8001)
uvicorn main:app --reload --port 8001
```

**주의:** 반드시 `docmaster-backend` 폴더에서 실행하세요. 상위 폴더에서 실행하면 다른 `main` 모듈이 로드되어 `/api/parse`가 404가 될 수 있습니다.

## 동작 확인

서버가 떴다면 브라우저나 터미널에서 다음을 확인하세요.

- **상태 확인:**  
  http://localhost:8001/api/health  
  → JSON `{"status":"ok", ...}` 이 보이면 정상입니다.

- **404가 나오는 경우**
  - 8001 포트에 **다른 프로그램**이 떠 있을 수 있습니다. 해당 프로세스를 종료한 뒤 다시 실행하세요.
  - 터미널에서 **실행 위치**가 `docmaster-backend`인지 확인하세요 (`pwd` 또는 `cd docmaster-backend` 후 실행).

## API

| 메서드 | 경로 | 설명 |
|--------|------|------|
| GET | /api/health | 서버 상태 확인 |
| POST | /api/parse | PDF/PPTX 업로드 → 마크다운 추출 |
