import { test, expect } from '@playwright/test';

test.describe('DocMaster smoke', () => {
  test('앱 로드 시 업로드 영역과 제목이 보인다', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { name: /DocMaster/i })).toBeVisible();
    await expect(page.getByText(/클릭하여 파일 선택|click.*select/i)).toBeVisible();
    await expect(page.getByText(/PDF|PPTX/)).toBeVisible();
  });

  test('설정 버튼으로 설정 모달을 열 수 있다', async ({ page }) => {
    await page.goto('/');
    const settingsButton = page.getByRole('button', { name: /설정|Settings|Key 설정/i }).first();
    await settingsButton.click();
    await expect(page.getByText(/API 키|API Key/i)).toBeVisible();
    await expect(page.getByRole('button', { name: /취소|cancel/i }).first()).toBeVisible();
  });
});
