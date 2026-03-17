#!/usr/bin/env node
/**
 * DocMaster AI 사용자 메뉴얼용 스크린샷 캡처 (Playwright)
 *
 * 사용법:
 *   1. docmaster-backend(파싱 서버) 실행
 *   2. docmaster-web 개발 서버 실행: npm run dev
 *   3. node scripts/capture-manual-screenshots.mjs [baseURL] [samplePptxPath]
 *      또는 npm run screenshots
 *
 * baseURL 기본값: http://localhost:5173
 * samplePptxPath 기본값: ../docs/[FND] 모바일 판매자 구축.pptx
 * 스크린샷 저장 위치: docmaster-web/public/user-manual/images/ (앱 서버에서 /user-manual/images/ 로 제공)
 *
 * 옵션 --with-report: API 키가 이미 설정된 상태에서 보고서 생성까지 진행해
 *   맞춤 질문 모달·보고서 뷰어 스크린샷도 캡처 (LLM 호출로 1~2분 소요)
 */

import { chromium } from 'playwright';
import { fileURLToPath } from 'url';
import path from 'path';
import fs from 'fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const WEB_ROOT = path.resolve(__dirname, '..');
const ROOT = path.resolve(__dirname, '../..');
const IMAGE_DIR = path.join(WEB_ROOT, 'public', 'user-manual', 'images');
const DEFAULT_PPTX = path.join(ROOT, 'docs', '[FND] 모바일 판매자 구축.pptx');
const BASE_URL = process.argv[2] || 'http://localhost:5173';
const SAMPLE_PPTX = process.argv[3] ? path.resolve(process.cwd(), process.argv[3]) : DEFAULT_PPTX;
const WITH_REPORT = process.argv.includes('--with-report');

async function main() {
  if (!fs.existsSync(IMAGE_DIR)) {
    fs.mkdirSync(IMAGE_DIR, { recursive: true });
  }

  if (!fs.existsSync(SAMPLE_PPTX)) {
    console.warn('샘플 PPTX 없음:', SAMPLE_PPTX, '→ 업로드 단계 생략');
  }

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1280, height: 900 },
    locale: 'ko-KR',
  });
  const page = await context.newPage();

  try {
    await page.goto(BASE_URL, { waitUntil: 'domcontentloaded', timeout: 10000 });
    await page.waitForTimeout(800);
  } catch (e) {
    console.error('페이지 로드 실패. 개발 서버 실행 여부 확인: npm run dev');
    console.error(e.message);
    await browser.close();
    process.exit(1);
  }

  const save = (name) => page.screenshot({ path: path.join(IMAGE_DIR, name), fullPage: false });
  const saveFull = (name) => page.screenshot({ path: path.join(IMAGE_DIR, name), fullPage: true });

  try {
    // 업로드 가능하도록 더미 키 설정 (파싱만 할 때 사용)
    await page.evaluate(() => {
      localStorage.setItem('docmaster_llmKey', 'dummy-for-screenshot');
      localStorage.setItem('docmaster_llmProvider', 'openai-gpt51');
    });
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1200);

    // 1) 메인 화면
    await save('img1.png');
    console.log('저장: img1.png');
    await save('img3.png');
    console.log('저장: img3.png');

    // 2) Key 설정 모달
    const keyBtn = page.getByRole('button', { name: /Key 설정|API 키 설정/ });
    await keyBtn.click();
    await page.waitForTimeout(500);
    await save('img2.png');
    console.log('저장: img2.png');
    await page.keyboard.press('Escape');
    await page.waitForTimeout(300);

    // 3) 템플릿 관리 모달
    const templateBtn = page.getByRole('button', { name: '템플릿 관리' });
    await templateBtn.click();
    await page.waitForTimeout(500);
    await save('img9.png');
    console.log('저장: img9.png');
    await page.keyboard.press('Escape');
    await page.waitForTimeout(300);

    // 4) 샘플 PPTX 업로드 → Step 2
    if (fs.existsSync(SAMPLE_PPTX)) {
      const input = page.locator('input[type=file][accept*=".pptx"]');
      await input.setInputFiles(SAMPLE_PPTX);
      console.log('업로드:', SAMPLE_PPTX);
      // 파싱 완료 대기 (Step 2 영역 표시, 백엔드 실행 필요)
      try {
        await page.getByText('어떤 문서를 만들까요').waitFor({ timeout: 60000 });
      } catch {
        try {
          await page.getByText('기획서 기반 보고서').first().waitFor({ timeout: 8000 });
        } catch {
          console.warn('Step 2 대기 시간 초과(백엔드 실행 여부 확인). 카드/패널 스크린샷은 스킵.');
        }
      }
      await page.waitForTimeout(1500);

      // Step 2 — 문서 유형 카드
      await saveFull('img4.png');
      console.log('저장: img4.png');

      // Step 2 패널 (스크롤 후 뷰포트에 맞춰 캡처)
      await page.evaluate(() => window.scrollTo(0, 400));
      await page.waitForTimeout(400);
      await save('img5.png');
      console.log('저장: img5.png');
      await page.evaluate(() => window.scrollTo(0, 0));
      await page.waitForTimeout(200);

      // 프롬프트 편집 모달 (기획서 카드에서 열기)
      const promptEditBtn = page.getByRole('button', { name: '프롬프트 편집' }).first();
      if (await promptEditBtn.isVisible().catch(() => false)) {
        await promptEditBtn.click();
        await page.waitForTimeout(600);
        await save('img8.png');
        console.log('저장: img8.png');
        await page.keyboard.press('Escape');
        await page.waitForTimeout(300);
      }

      // --with-report: 보고서 생성 → 맞춤 질문 → 뷰어 (실제 API 키 필요)
      if (WITH_REPORT) {
        const reportBtn = page.getByRole('button', { name: /보고서 생성/ });
        if (await reportBtn.isVisible().catch(() => false)) {
          await reportBtn.click();
          await page.waitForTimeout(500);
          // 맞춤 질문 모달 또는 완료 대기
          try {
            await page.getByRole('button', { name: '건너뛰기' }).waitFor({ timeout: 120000 });
            await page.waitForTimeout(500);
            await save('img6.png');
            console.log('저장: img6.png');
            await page.getByRole('button', { name: '건너뛰기' }).click();
          } catch {
            // 질문 없이 완료된 경우
          }
          try {
            await page.getByRole('button', { name: '만들어진 보고서 보기' }).waitFor({ timeout: 180000 });
            await page.waitForTimeout(1000);
            await page.getByRole('button', { name: '만들어진 보고서 보기' }).click();
            await page.waitForTimeout(1500);
            await save('img7.png');
            console.log('저장: img7.png');
            await page.keyboard.press('Escape');
          } catch (e) {
            console.warn('보고서 뷰어 캡처 스킵:', e.message);
          }
        }
      }
    } else {
      console.log('img-cards, img-step2-panel, img-prompt-modal 등은 샘플 PPTX 업로드 후 생성됩니다.');
    }
  } catch (e) {
    console.error('캡처 중 오류:', e.message);
  } finally {
    await browser.close();
  }

  console.log('\n완료. 저장 위치:', IMAGE_DIR);
  if (!WITH_REPORT && fs.existsSync(SAMPLE_PPTX)) {
    console.log('맞춤 질문·보고서 뷰어 스크린샷은 --with-report 옵션으로 캡처 (API 키 필요, 1~2분 소요).');
  }
}

main();
