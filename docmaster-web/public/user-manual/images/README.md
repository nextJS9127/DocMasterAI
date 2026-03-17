# 사용자 메뉴얼 스크린샷

이 폴더에는 **docmaster-web/public/user-manual/user-manual.html**에서 참조하는 스크린샷 이미지가 저장됩니다.  
앱 서버(<code>npm run dev</code>) 실행 시 <code>http://localhost:5173/user-manual/user-manual.html</code> 로 열면 이미지가 <code>/user-manual/images/</code> 경로로 로드됩니다.

## 자동 생성 (Playwright)

**필수:** `docmaster-backend`(파싱 서버)와 `docmaster-web` 개발 서버가 실행 중이어야 업로드 후 Step 2 스크린샷까지 캡처됩니다.

1. **백엔드 실행** (docmaster-backend에서)
2. **프론트 개발 서버 실행** (docmaster-web 루트)
   ```bash
   npm run dev
   ```
3. **다른 터미널에서 캡처 스크립트 실행**
   ```bash
   cd docmaster-web
   node scripts/capture-manual-screenshots.mjs
   ```
   기본 URL: `http://localhost:5173`  
   샘플 파일: `docs/[FND] 모바일 판매자 구축.pptx` (없으면 업로드 단계 생략)

   맞춤 질문·보고서 뷰어까지 캡처하려면(실제 API 키 필요, 1~2분 소요):
   ```bash
   node scripts/capture-manual-screenshots.mjs http://localhost:5173 --with-report
   ```

### 생성되는 파일

| 파일 | 설명 |
|------|------|
| `img1.png` | 메인 화면 (우측 상단 Key 설정 버튼 포함) |
| `img2.png` | Key 설정 모달 (API 키 탭) |
| `img3.png` | 업로드 영역 |
| `img4.png` | Step 2 — 문서 유형 선택 카드 3종 (샘플 업로드 후) |
| `img5.png` | Step 2 — 보고서 옵션·생성 버튼 (샘플 업로드 후) |
| `img6.png` | 맞춤 질문 모달 (--with-report 시) |
| `img7.png` | 보고서 뷰어 (--with-report 시) |
| `img8.png` | 프롬프트 편집 모달 (샘플 업로드 후 카드에서 열기) |
| `img9.png` | 템플릿 관리 모달 |

## Playwright 브라우저 설치

최초 1회:

```bash
cd docmaster-web
npx playwright install chromium
```
