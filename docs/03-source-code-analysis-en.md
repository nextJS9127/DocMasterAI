# DocMaster AI — Source Code Analysis (English)

This document describes the DocMaster AI frontend and backend source code at the module/file level.

---

## 1. Frontend Entry and State

### 1.1 `main.tsx` / `App.tsx`

- **main.tsx**: Mounts `App` on `#root` with `createRoot` and imports `index.css`.
- **App.tsx** holds all state and handlers for the two-step flow.

**State variables**

| State | Type | Purpose |
|-------|------|---------|
| `appStep` | `'idle' \| 'parsing' \| 'parsed' \| 'generating'` | Pipeline step |
| `parsedMarkdown` | `string \| null` | Step 1 extracted Markdown |
| `parsedFileName` | `string` | Original uploaded file name |
| `reportHtml` | `string \| null` | LLM-generated HTML from Step 2 |
| `reportMarkdown` | `string \| null` | LLM output Markdown block |
| `reportUsage` | `ReportUsage \| null` | Token counts and estimated cost |
| `lang` | `'ko' \| 'en'` | UI language (synced with localStorage `docmaster_lang`) |
| `showReportPopup` | `boolean` | Whether report viewer popup is open |

**Main handlers**

- **handleFileSelect(file)**: Sets `appStep = 'parsing'`, sends `FormData` to `POST http://localhost:8001/parse`, then sets `parsedMarkdown`, `parsedFileName` and `appStep = 'parsed'` on success. On failure, resets `appStep = 'idle'` and shows an alert.
- **handleGenerateReport(reportType, templateId)**: Returns if no `parsedMarkdown`. Reads `docmaster_llmProvider` and `docmaster_llmKey` from localStorage, calls `generateReportClient`, then sets `reportHtml`, `reportMarkdown`, `reportUsage`. Handles missing key or 401/403 with alert or toast and optional settings open.
- **handleReset**: Sets `appStep = 'idle'` and clears all parsing and report-related state.

Layout: left sidebar (progress steps tree, core capabilities, data notice, developer info) + main area (upload zone or `ParsedResultPanel`). Top bar: settings, help, language toggle.

---

## 2. LLM Integration and Report Generation — Module Layout

Report **type (domain)** logic is split by module: prompts and first-step config live under `lib/prompts/`, and `lib/llmClient.ts` orchestrates calls and parsing.

### 2.1 Directory structure

| Path | Role |
|------|------|
| **`lib/llmClient.ts`** | LLM API calls (OpenAI / Claude / Gemini). Loads **config from domain modules** in `generateReportClient` etc., then performs the call and response parsing. Also holds shared types, utils, and template API (fetch/save). |
| **`lib/prompts/executiveTeam.ts`** | Executive/Team editable prompts (KO/EN), fixed HTML rules (`HTML_FIXED_EXECUTIVE`/`TEAM`), template style guides (phase1, presentation2, wiki, preformat), PPTX prompts, **getReportGenerationConfig**, **getTemplateForApi**, customization-question/refine prompts, C-style skeleton, section keys, quality rubric, etc. |
| **`lib/prompts/features.ts`** | Development-features editable prompts (KO/EN), `HTML_FIXED_FEATURES`, **getReportGenerationConfig** (wiki template fixed). |
| **`lib/prompts/testcases.ts`** | Test-case editable prompts (KO/EN), `HTML_FIXED_TESTCASES`, **getReportGenerationConfig** (wiki template fixed). |

Prompts, style guides, and first-step assembly logic for executive/team, features, and testcases are defined in the above `prompts/*.ts` files; `llmClient.ts` imports and re-exports them as needed.

### 2.2 Prompt assembly (Executive / Team)

- **Editable block**: `DEFAULT_PROMPT_EXECUTIVE_EDITABLE` / `DEFAULT_PROMPT_TEAM_EDITABLE` (KO), `*_EN` (EN). Defined in **`prompts/executiveTeam.ts`**. Role, input rules, required sections, Execution Steps, etc.
- **Fixed block**: `HTML_FIXED_EXECUTIVE` / `HTML_FIXED_TEAM`. Same file. "Return only raw HTML", variable 1:1 mapping, dynamic format (user-added variables/sections), etc.
- **getDefaultExecutiveEditable(lang)** / **getDefaultTeamEditable(lang)**: Defined in `executiveTeam.ts`. Return default editable prompt for the UI language. At runtime, localStorage overrides when present.

### 2.3 Templates and style guides

- **HtmlTemplateId**: `'default' | 'phase1' | 'presentation2' | 'wiki' | 'preformat' | 'pptx'`. Type defined in **`prompts/executiveTeam.ts`**.
- **getTemplateForApi(templateId)** / **getTemplateContentById(id)**: Defined in **`prompts/executiveTeam.ts`**. `pptx` returns empty string; `default` uses `DEFAULT_HTML_STYLE_GUIDE`; `phase1`/`presentation2`/`wiki`/`preformat` use the corresponding style-guide constants. Features and testcases use the wiki template.

### 2.4 `generateReportClient(markdownData, selection, apiKey, reportType, templateId)`

1. **getReportGenerationConfig** is called from the **domain module** according to **reportType** (features → `prompts/features.ts`, testcases → `prompts/testcases.ts`, executive/team → `prompts/executiveTeam.ts`). It returns **SYSTEM_PROMPT** and **buildUserPrompt(markdownData[, templateContent])**.
2. **userPrompt** = result of **buildUserPrompt** from that config. For executive/team, `templateContent` is fetched from API or **getTemplateForApi(templateId)**.
3. **Provider-specific call**: Send system/user messages to OpenAI / Claude / Gemini.
4. **Response parsing**: Extract markdown/html blocks from `fullBody`, or slide JSON for pptx.
5. **usage**: Build `ReportUsage` from provider response; `estimateCostUsd` for estimated cost.

Returns: `{ html, markdown?, usage?, slides? }`.

---


## 3. Component Details

### 3.1 `UploadZone.tsx`

- **Props**: `onFileSelect`, `disabled`, `isProcessing`, `lang`, `onNoKeyAttempt?`.
- **Behavior**: File selection via drag-and-drop or click. Only `application/pdf` or `.pptx`; others trigger `t.onlyFile` alert. If `disabled` and `onNoKeyAttempt` is set, upload attempt calls `onNoKeyAttempt()` (e.g. API key toast). While `isProcessing`, shows spinner and "Python server is extracting..." message.
- **File input**: Hidden `<input type="file" accept=".pdf,.pptx">` with ref; zone click triggers `fileInputRef.current?.click()`.

### 3.2 `ParsedResultPanel.tsx`

- **Props**: `parsedMarkdown`, `parsedFileName`, `onGenerateReport(reportType, templateId)`, `onReset`, `reportReady`, `reportMarkdown`, `reportUsage`, `onViewReport`, `lang`.
- **Local state**: `reportType` ('executive'|'team'), `htmlTemplateId` (HtmlTemplateId), `isGenerating`.
- **Features**:
  - **Step 1 done banner**: "Step 1 Done — Document Extraction Result", parsed file name.
  - **Preview**: First portion of extracted Markdown; "more lines" hint with download CTA.
  - **Download extraction**: `handleDownloadMd` — blob from `parsedMarkdown`, download as `{basename}_extracted.md`.
  - **Report format**: Radio for Executive / Team.
  - **HTML format**: Select for default / phase1 / presentation2 / wiki / preformat.
  - **Generate report**: Button calls `onGenerateReport(reportType, htmlTemplateId)`; loading state via `isGenerating`.
  - **Report ready**: "Report generation complete" + token/cost + "Download report (MD)" + "View Generated Report". `handleDownloadReportMd` saves `reportMarkdown` as `{basename}_report.md`.
- **Reset**: "Analyze another file" calls `onReset()`.

### 3.3 `ReportViewer.tsx`

- **Props**: `htmlContent`, `onClose`, `lang`, `variant?` ('popup' | 'fullscreen').
- **stripDuplicateCheckmarks(html)**: Removes leading `✓` inside `<li>` (check-list uses CSS ::before for checkmark).
- **Rendering**: Header (title, HTML download button, close / analyze new) + `<iframe srcDoc={processedHtml} sandbox="allow-scripts allow-same-origin" />`. If `variant === 'popup'`, wraps in modal overlay; background click calls `onClose`.

### 3.4 `SettingsModal.tsx`

- **Props**: `onClose`, `onSave`, `lang`.
- **Tabs**: API Key / Executive / Team. API tab: LLM select (openai-gpt52, openai-gpt51, openai, claude, claude-opus, gemini3, gemini-25-pro), API key input (password type). Executive/Team tabs: editable prompt textarea, "Reset to default", read-only fixed HTML rules.
- **Save**: `handleSave` writes `docmaster_llmProvider`, `docmaster_llmKey`, `docmaster_promptExecutiveEditable`, `docmaster_promptTeamEditable` to localStorage, then calls `onSave()`.
- **Language switch**: When `lang` changes, if current prompt text equals the "other language" default, it is replaced with the default for the selected language.

### 3.5 `OnboardingManualModal.tsx`

- **Props**: `onClose`, `lang`.
- **Content**: Usage steps (usageStep1–4), cautions (caution1–5), usage guide (guideTitle, guideMdTip, guideItem1–3) from `translations[lang].onboarding`. Used as help/onboarding modal.

---

## 4. Translations and Routing

### 4.1 `lib/translations.ts`

- **Language**: `'ko' | 'en'`.
- **translations**: Objects under `ko` / `en` with namespaces (workspace, docAnalysis, config, upload, settings, parsedPanel, reportError, sidebar, onboarding, etc.). UI uses `t = translations[lang]` and then e.g. `t.parsedPanel.stepLabel`.

### 4.2 Routing

- Single-page app. `react-router-dom` is installed but there may be no route definitions; all screen changes are driven by `appStep` and conditional rendering.

---

## 5. Backend Details

### 5.1 `main.py` — FastAPI app

- **CORS**: Allows `localhost:5173`–`5176` (Vite dev server).
- **GET /health**: Returns server status and `outputs_dir`.
- **POST /parse**: Accepts `UploadFile`, checks extension `.pdf`/`.pptx`, writes to temp file, calls `pdf_to_markdown` or `pptx_to_markdown`. Optionally runs `refine_extracted_markdown` and `apply_normalizations`. In **finally**, removes temp file with `os.unlink`. Response: `{ markdown, filename, file_type, meta }`. (Extraction result is not stored on server.)
- **GET /result/{file_id}**, **GET /result/{file_id}/download**, **GET /results**: Legacy for previous "save" mode; not used in current default flow.

### 5.2 `app/pdf_utils.py`

- **pymupdf4llm.to_markdown(pdf_path, page_chunks=True)**: Returns list of page-level Markdown chunks.
- **extract_tables_from_pdf(pdf_path)**: Uses pdfplumber to get per-page tables → Markdown table strings.
- **pdf_to_markdown**: For each page, extracts body text; if empty, calls `_ocr_page_fallback` (pytesseract+PIL, optional). For pages with tables, merges table Markdown wrapped with `extract_constants.wrap_table` (`[[TABLE]]...[[/TABLE]]`). Fills `out_meta` with `page_count`, `ocr_pages`.

### 5.3 `app/pptx_utils.py`

- **_flatten_shapes(shapes)**: Recursively flattens group shapes.
- **_collect_from_shapes(shapes, title_holder)**: After flattening, sorts by top/left and iterates. Tables → `wrap_table` for Markdown table inside `[[TABLE]]`. Charts → `wrap_diagram`(caption). SmartArt etc. (GraphicFrame) → `wrap_diagram("SmartArt/다이어그램")`. Text: placeholder title goes to title_holder; rest as indented bullets.
- **pptx_to_markdown(pptx_path, out_meta)**: Per slide, builds "## 🖼 Slide N" or "## Title" and appends collected body. Sets `out_meta['slide_count']`.

### 5.4 `app/md_refine.py`

- **refine_extracted_markdown(raw_md)**: Applies in order: slide header normalization, empty bullet removal, collapse repeated `---`, remove repeated footer lines (e.g. ≥3 occurrences) at block ends, collapse version-only blocks, limit consecutive blank lines to two. Does not modify `[[TABLE]]`/`[[DIAGRAM]]` blocks.

### 5.5 `app/normalizer.py`

- **apply_normalizations(text, normalize_amount, normalize_date)**: Amount patterns (number + 원/KRW/₩) → "number KRW"; date patterns → ISO YYYY-MM-DD. Conservative; does not alter content inside `[[TABLE]]`/`[[DIAGRAM]]`.

### 5.6 `app/extract_constants.py`

- **BLOCK_TABLE_START/END**, **BLOCK_DIAGRAM_START/END**: `[[TABLE]]`/`[[/TABLE]]`, `[[DIAGRAM]]`/`[[/DIAGRAM]]`.
- **wrap_table(md_table_content)**, **wrap_diagram(description_or_caption)**: Wrap given string with the delimiters. Used so PDF/PPTX extraction marks tables and diagrams for the LLM to render in HTML.

---

## 6. Data Flow Summary

1. **Settings**: User saves API key, LLM, prompts in settings modal → localStorage.
2. **Step 1**: File selected → `POST /parse` → backend extracts and deletes file, returns Markdown only → frontend sets `parsedMarkdown`, etc.
3. **Step 2**: User chooses report format and HTML template → [Generate Report] → `generateReportClient` reads prompts and key from localStorage, calls LLM → parses markdown/html blocks from response → sets `reportHtml`, `reportMarkdown`, `reportUsage`.
4. **Result**: "View Generated Report" shows `reportHtml` in ReportViewer; "Download report (MD)" saves `reportMarkdown` to a file.

In this flow, the original file exists only temporarily on the backend and is then deleted; only the extracted Markdown is sent to the client and to the LLM.
