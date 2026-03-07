import { test, expect } from '@playwright/test';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const samplePdfPath = path.join(__dirname, 'fixtures', 'sample.pdf');

test.describe('파싱 플로우', () => {
  test('파일 업로드 시 파싱 API 호출 후 추출 결과 패널이 표시된다 (API 모킹)', async ({ page }) => {
    const mockMarkdown = '# 테스트 문서\n\n추출된 내용입니다.\n- 항목 1\n- 항목 2';

    await page.route('**/api/parse', async (route) => {
      if (route.request().method() === 'POST') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ markdown: mockMarkdown }),
        });
      } else {
        await route.continue();
      }
    });

    await page.goto('/');

    // API 키가 없으면 업로드 시 키 안내가 뜰 수 있음 → 테스트용 더미 키 설정
    await page.evaluate(() => {
      localStorage.setItem('docmaster_llmKey', 'test-key-for-e2e');
      localStorage.setItem('docmaster_llmProvider', 'openai-gpt51');
    });
    await page.reload();

    const fileInput = page.locator('input[type="file"][accept=".pdf,.pptx"]');
    await fileInput.setInputFiles(samplePdfPath);

    // 파싱 완료 후: "Step 1 완료" 배너 및 추출 결과 미리보기
    await expect(page.getByText(/Step 1 완료|추출 완료|파일 레이블/i)).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText(mockMarkdown.split('\n')[0])).toBeVisible({ timeout: 5_000 });
    await expect(page.getByRole('button', { name: /보고서 생성|생성/i })).toBeVisible();
  });
});
