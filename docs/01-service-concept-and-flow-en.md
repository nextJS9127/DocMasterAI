# DocMaster AI — Service Concept and Flow (English)

## 1. Service Intent

DocMaster AI is a **local-first document analysis and report generation tool** that **extracts text and tables from PDF/PPTX files** and **generates executive or team-oriented reports** using the user’s chosen LLM (Large Language Model).

### Goals

- **Automate extraction**: Convert PDF/PPTX with complex tables and charts into Markdown to reduce manual copy-paste and formatting.
- **Consistent report quality**: Provide two report types—Executive (1-Pager, conclusion and action focused) and Team (collaboration, action plan, owners, schedule)—with prompts and HTML templates so the LLM produces a consistent structure.
- **Privacy and cost control**: Uploaded files are deleted immediately after extraction and are not stored on the server. Only the extracted text is sent to the user-configured LLM API (OpenAI, Anthropic, Google, etc.) when generating a report, minimizing exposure of original documents.

### Target Users

- Practitioners who need a concise one-page report for leadership
- Teams that need to quickly summarize or restructure proposals, plans, or meeting materials
- Users who want PDF/PPTX content as Markdown for reuse in Notion, wikis, or other LLM tools

---

## 2. Service Concept

### 2.1 Local Parsing + Cloud LLM Hybrid

- **Parsing (extraction)**: Done by a local Python backend (localhost:8001). PDF uses pymupdf4llm and pdfplumber; PPTX uses python-pptx to convert text, tables, and diagrams into Markdown.
- **Report generation**: The browser sends **only the extracted Markdown** to the user’s chosen LLM (OpenAI, Claude, Gemini, etc.) using the API key entered in settings. The original file has already been deleted and is never sent.

### 2.2 Two Report Types

| Type | Audience | Focus |
|------|-----------|--------|
| **Executive** | Leadership | 1-Pager: summary, conclusion, approval ask, next actions. Logic refined via self-review (2-round iteration). |
| **Team** | Collaboration & execution | Sections, tables, checklists, owners, schedules. Implementation and action plans. |

### 2.3 Language and Settings

- UI language: Korean / English. Settings (API key, prompts) are stored in the browser’s Local Storage.
- Prompts: Each report type has an editable block (role, rules, steps) and a fixed block for HTML output format.

---

## 3. Service Flow

### 3.1 End-to-End Flow

```
[User] → Settings (API key, LLM choice, optional prompt review)
    ↓
[Step 1] Upload file (PDF or PPTX)
    ↓
[Local backend] POST /parse → Extract (Markdown) → Delete file immediately → Return result in response only
    ↓
[Frontend] Show extraction result; choose report format and HTML template
    ↓
[Step 2] Click [Generate Report]
    ↓
[2-phase pipeline] For Executive/Team reports:
  Phase 1: Extracted md → LLM → Refined report Markdown (2nd-stage)
  Phase 2: Refined md + selected template → LLM → Final HTML
  (If refined md already exists and report type is unchanged, only Phase 2 runs when user changes HTML format.)
    ↓
[Frontend] View generated HTML / Download refined Markdown (.md)
```

### 3.2 Step 1: Upload and Extract

1. User enters API key in **Settings** (top right) and optionally reviews Executive/Team prompts.
2. User uploads a **PDF or PPTX** file via drag-and-drop or file picker.
3. Frontend sends the file to `POST http://localhost:8001/parse`.
4. Backend runs `pdf_to_markdown` or `pptx_to_markdown`, then optionally `refine_extracted_markdown` and `apply_normalizations` (amount/date).
5. **After extraction, the original file is deleted**; the backend does **not** persist the result—it is returned only in the response body.
6. UI shows “Step 1 Done — Document Extraction Result” with a preview and “Download Extraction Result (.md).”

### 3.3 Step 2: Choose Format and Generate Report

1. User selects **Report format** (Executive / Team) and **HTML format** (default, proposal style, presentation slides, wiki style, preformat, etc.).
2. Clicking **[Generate Report]** runs the **2-phase pipeline** for Executive/Team reports:
   - **Phase 1** `generateRefinedMarkdownClient`: Extracted Markdown → LLM (editable prompt + quality rubric) → **Refined report Markdown (2nd-stage)**.
   - **Phase 2** `generateHtmlFromMarkdownClient`: Refined md + chosen template → LLM (editable prompt + HTML fixed rules + dynamic format guidance) → **Final HTML**.
3. If the user **only changes the HTML format** and clicks [Generate Report] again, and refined md already exists for the same report type, **Phase 1 is skipped** and only Phase 2 runs (HTML is regenerated from the existing refined md).
4. The default HTML template has 7 slides (7 variables 1:1): summary, purpose_background, key_changes, process_flow, recommendations, risks, action_item. User-added variables/sections in the prompt can be reflected by extending slides/sections in the same style (dynamic format).
5. User can open "View Generated Report" in a popup and download HTML or refined Markdown as needed.

### 3.4 Data and Security Flow

- **Uploaded file**: Exists only as a temporary file on the local backend → deleted with `os.unlink` after extraction. Not stored on disk.
- **Extraction result**: Delivered only in the `/parse` response to the client. Backend does not store it by default.
- **API key**: Stored only in the browser’s Local Storage and sent only when generating a report to the selected LLM API.
- **Report generation**: Only the extracted text (Markdown) is sent to the LLM provider. Original PDF/PPTX are no longer present.

---

## 4. Summary

| Item | Description |
|------|-------------|
| **Intent** | PDF/PPTX → extract → LLM-based Executive/Team report generation; local extraction and no server storage for privacy |
| **Concept** | Local parsing + cloud LLM; two report types (Executive / Team); localized UI and editable prompts |
| **Flow** | Settings → Upload → Step 1 extract (then delete) → Choose format → Step 2 LLM report → View / Download |
