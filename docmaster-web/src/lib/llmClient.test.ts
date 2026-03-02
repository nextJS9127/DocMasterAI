/**
 * 테스트 케이스(TC) 생성 기능 검증
 * - 프롬프트: testcases용 기본 프롬프트에 필수 구조가 포함되는지
 * - 연동: 백엔드 /parse 호출 시 PDF 업로드 → markdown 응답 (백엔드 기동 시)
 */
import { describe, it, expect } from 'vitest';
import {
  getDefaultTestcasesEditable,
  getDefaultFeaturesEditable,
  DEFAULT_PROMPT_TESTCASES_EDITABLE,
} from './llmClient';

describe('TC 생성 (테스트 케이스) 구현 검증', () => {
  it('testcases 기본 프롬프트에 필수 키워드가 포함된다', () => {
    const ko = getDefaultTestcasesEditable('ko');
    expect(ko).toContain('테스트 케이스');
    expect(ko).toContain('영역');
    expect(ko).toContain('단계');
    expect(ko).toContain('예상 결과');
    expect(ko).toContain('조치');
    expect(ko).toContain('```markdown');
    expect(ko).toContain('```html');
  });

  it('testcases 영문 프롬프트에 필수 키워드가 포함된다', () => {
    const en = getDefaultTestcasesEditable('en');
    expect(en).toContain('test case');
    expect(en).toContain('area');
    expect(en).toContain('step');
    expect(en).toContain('expected result');
    expect(en).toContain('action');
  });

  it('DEFAULT_PROMPT_TESTCASES_EDITABLE가 문서 개요·영역별 구조를 명시한다', () => {
    const prompt = DEFAULT_PROMPT_TESTCASES_EDITABLE;
    expect(prompt).toMatch(/문서 개요/);
    expect(prompt).toMatch(/영역별 테스트 케이스/);
    expect(prompt).toMatch(/전제조건|조치|예상 결과/);
  });

  it('features 기본 프롬프트와 구분된다 (카테고리 vs 영역)', () => {
    const features = getDefaultFeaturesEditable('ko');
    const testcases = getDefaultTestcasesEditable('ko');
    expect(features).toContain('카테고리');
    expect(features).toContain('개발 피쳐');
    expect(testcases).toContain('테스트 케이스');
    expect(testcases).toContain('예상 결과');
  });
});

describe('백엔드 /parse 연동 (백엔드 기동 시)', () => {
  const PARSE_URL = 'http://localhost:8001/parse';

  it('POST /parse with sample PDF returns markdown (백엔드 기동 시 실행)', async () => {
    const path = await import('node:path');
    const fs = await import('node:fs');
    const samplePath = path.default.resolve(
      path.default.join(process.cwd(), '../docmaster-backend/scripts/sample_for_tc_test.pdf'),
    );
    if (!fs.existsSync(samplePath)) {
      console.warn('샘플 PDF 없음:', samplePath);
      return;
    }
    const buf = fs.readFileSync(samplePath);
    const formData = new FormData();
    formData.append('file', new Blob([buf], { type: 'application/pdf' }), 'sample_for_tc_test.pdf');

    const res = await fetch(PARSE_URL, { method: 'POST', body: formData });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data).toHaveProperty('markdown');
    expect(typeof data.markdown).toBe('string');
    expect(data.markdown.length).toBeGreaterThan(0);
    expect(data).toHaveProperty('file_id');
  }, 15000);
});
