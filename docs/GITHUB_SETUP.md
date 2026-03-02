# GitHub 저장소 설정 체크리스트

스타·검색 노출을 위해 GitHub에서 한 번만 설정하면 좋은 항목입니다.

## 1. About (저장소 메인 페이지 오른쪽)

- [ ] **Description**  
  예: `DocMaster AI – PDF/PPTX를 실행 요약·팀 문서로. 로컬 파싱, 자체 LLM 연동`

- [ ] **Topics** (복수 선택)  
  예: `document-ai`, `pdf`, `pptx`, `llm`, `openai`, `claude`, `gemini`, `react`, `vite`, `fastapi`, `executive-summary`

**설정 방법**: 저장소 페이지 → 오른쪽 **About** → 연필 아이콘 클릭 후 입력.

---

## 2. 첫 Release

- [ ] **Releases** → **Create a new release**
- [ ] Tag: `v0.1.0` (또는 `v1.0.0`)
- [ ] 제목/설명: 예) "Initial release – PDF/PPTX 파싱, Executive/Team 보고서 생성"

로컬에서 태그만 푸시할 경우:

```bash
git tag v0.1.0
git push origin v0.1.0
```

이후 GitHub **Releases**에서 해당 태그로 릴리스 생성 및 노트 작성.

---

## 3. (선택) 스크린샷

- [ ] README의 **Screenshots** 섹션에 앱 화면 캡처 또는 GIF 추가  
  → 업로드 화면, 생성된 보고서 화면 등.

---

자세한 내용은 루트 [README.md](../README.md)의 "Repository setup", "Releases" 섹션을 참고하세요.
