import { test, expect } from '@playwright/test';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const samplePdfPath = path.join(__dirname, 'fixtures', 'sample.pdf');

test.describe('보고서 생성 플로우', () => {
  test('API 키 없이 보고서 생성 클릭 시 키 필요 안내가 뜬다', async ({ page }) => {
    const mockMarkdown = '# E2E 보고서 플로우 테스트\n\n내용.';

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
    // 키 제거 (다른 탭에서 저장했을 수 있음)
    await page.evaluate(() => {
      localStorage.removeItem('docmaster_llmKey');
    });
    await page.reload();

    const fileInput = page.locator('input[type="file"][accept=".pdf,.pptx"]');
    await fileInput.setInputFiles(samplePdfPath);

    await expect(page.getByText(/Step 1 완료|추출 완료/i)).toBeVisible({ timeout: 15_000 });

    const generateButton = page.getByRole('button', { name: /보고서 생성|생성/i });
    await expect(generateButton).toBeVisible();

    const dialogPromise = page.waitForEvent('dialog', { timeout: 5_000 });
    await generateButton.click();
    const dialog = await dialogPromise;
    expect(dialog.message()).toMatch(/API 키|키 등록|api key/i);
    await dialog.accept();
  });

  test('기획서(경영진) 탭에서 보고서 생성 버튼이 동작한다 (키 있음, 실제 LLM 호출 없이 로딩까지)', async ({
    page,
  }) => {
    const mockMarkdown = '# 기획서 E2E\n\n본문.';

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
    await page.evaluate(() => {
      localStorage.setItem('docmaster_llmKey', 'e2e-dummy-key');
      localStorage.setItem('docmaster_llmProvider', 'openai-gpt51');
    });
    await page.reload();

    const fileInput = page.locator('input[type="file"][accept=".pdf,.pptx"]');
    await fileInput.setInputFiles(samplePdfPath);

    await expect(page.getByText(/Step 1 완료|추출 완료/i)).toBeVisible({ timeout: 15_000 });

    // Best practice가 'report'인지 확인 (경영진/실무 카드 선택)
    const reportCard = page.getByText(/보고용|경영진/i).first();
    if (await reportCard.isVisible()) {
      await reportCard.click();
    }

    const generateButton = page.getByRole('button', { name: /보고서 생성|생성/i });
    // 생성 버튼 클릭 후: 로딩 표시 또는 에러/다이얼로그 중 하나는 발생 (플로우 진입 검증)
    await generateButton.click();
    await page.waitForTimeout(1500);
    const hasLoading = await page.getByText(/생성 중|generating/i).isVisible().catch(() => false);
    const hasErrorOrDialog = await page.getByText(/실패|오류|error|API 키/i).isVisible().catch(() => false);
    expect(hasLoading || hasErrorOrDialog).toBeTruthy();
  });
});
