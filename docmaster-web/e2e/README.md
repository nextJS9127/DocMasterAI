# DocMaster E2E 테스트 (Playwright)

레포트를 일일이 생성하지 않고, 자동으로 **업로드 → 파싱 → 보고서 생성 플로우**가 정상 동작하는지 검증하는 모듈입니다.

## 사전 준비

1. **Playwright 브라우저 설치** (최초 1회, 필수)

   ```bash
   cd docmaster-web
   npx playwright install
   ```
   또는 Chromium만: `npx playwright install chromium`

2. **프론트/백엔드 실행**  
   `npm run test:e2e` 실행 시 `playwright.config.ts`의 `webServer`가 `npm run dev`로 프론트를 띄우므로, **별도로 터미널에서 `npm run dev`를 켤 필요는 없습니다.**  
   실제 파싱 API를 쓰는 테스트를 돌리려면 **백엔드 서버**(`docmaster-backend`)를 미리 띄워 두세요.

## 실행 방법

| 명령 | 설명 |
|------|------|
| `npm run test:e2e` | E2E 전체 실행 (Chromium, 헤드리스) |
| `npm run test:e2e:ui` | Playwright UI 모드로 실행 |
| `npm run test:e2e:headed` | 브라우저 창을 띄운 채 실행 |
| `npm run test:e2e:report` | 마지막 실행 결과 HTML 리포트 열기 |

## 시나리오 구성

- **smoke.spec.ts**  
  - 앱 로드, 업로드 영역·제목 노출  
  - 설정 버튼으로 설정 모달 열기  

- **parsing.spec.ts**  
  - `POST /api/parse` **모킹** 후 파일 업로드  
  - Step 1 완료 배너, 추출 결과 미리보기, "보고서 생성" 버튼 노출 확인  
  - 백엔드 없이 프론트 플로우만 검증  

- **report-flow.spec.ts**  
  - **API 키 없을 때**: 보고서 생성 클릭 → "API 키 등록" 안내 다이얼로그 확인  
  - **API 키 있을 때**: 파싱 모킹 후 보고서 생성 클릭 → 로딩 또는 에러 메시지 중 하나 발생 (실제 LLM 호출은 하지 않아도 됨)  

## 실제 백엔드로 파싱 테스트 (선택)

파싱만 **실제 백엔드**로 검증하려면:

1. `docmaster-backend`에서 `uvicorn main:app --reload --port 8001` 실행  
2. `e2e/parsing.spec.ts`에서 `page.route('**/api/parse', ...)` 모킹을 제거하고, `e2e/fixtures/sample.pdf`를 그대로 업로드하는 테스트를 추가하거나, 기존 테스트를 분리해 실서버 전용 스펙으로 두면 됩니다.

## 환경 변수

- `PLAYWRIGHT_BASE_URL`: 앱 URL (기본 `http://localhost:5173`)  
- `CI`: 설정 시 재시도 2회, HTML 리포트 등 CI용 설정 적용  

## 참고

- 테스트는 **파싱 API 모킹**으로 대부분 동작하므로, 백엔드가 꺼져 있어도 smoke / parsing / report-flow(키 없음)는 통과할 수 있습니다.  
- 실제 **LLM까지 포함한 전체 플로우**를 자동 검증하려면, CI 또는 로컬에서 유효한 API 키를 환경/로컬 스토리지에 넣고, 타임아웃을 넉넉히 주는 별도 스펙을 두는 방식을 권장합니다.
