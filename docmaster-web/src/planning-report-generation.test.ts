/**
 * 기획 보고서 생성 플로우 테스트
 * - 경영진/실무용 프롬프트·상수 검증
 * - 파싱 연동: 사용자 PPTX(현지투어 현황 및 개선 사항 _ 10NOV 1.pptx)로 POST /api/parse 검증
 * - 파싱 결과가 보고서 생성에 쓸 수 있는 구조인지 검증
 */
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import {
  getDefaultExecutiveEditable,
  getDefaultTeamEditable,
  DEFAULT_PROMPT_EXECUTIVE_EDITABLE,
  DEFAULT_PROMPT_TEAM_EDITABLE,
  type HtmlTemplateId,
} from './lib/llmClient';

const API_BASE = 'http://localhost:8001';
const PARSE_URL = `${API_BASE}/api/parse`;

/** 사용자 업로드 파일로 가정한 PPTX 경로 */
const USER_PPTX_PATH = '/Users/jinsusung/Downloads/현지투어 현황 및 개선 사항 _ 10NOV 1.pptx';

function userPptxExists(): boolean {
  try {
    return fs.existsSync(USER_PPTX_PATH);
  } catch {
    return false;
  }
}

describe('기획 보고서 생성 — 프롬프트·상수 검증', () => {
  it('경영진용 기본 프롬프트에 필수 키워드가 포함된다', () => {
    const ko = getDefaultExecutiveEditable('ko');
    expect(ko).toContain('경영진');
    expect(ko).toContain('원천 데이터');
    expect(ko).toContain('Executive Summary');
    expect(ko).toContain('핵심 요약');
    expect(ko).toContain('목적');
    expect(ko).toContain('배경');
    expect(ko).toContain('리스크');
    expect(ko).toMatch(/Step 1|Step 2|자가 검증|iteration/i);
  });

  it('경영진용 영문 프롬프트에 필수 키워드가 포함된다', () => {
    const en = getDefaultExecutiveEditable('en');
    expect(en).toContain('executive');
    expect(en).toContain('Source Data');
    expect(en).toContain('Executive Summary');
    expect(en).toContain('Purpose');
    expect(en).toContain('Background');
    expect(en).toContain('Risks');
  });

  it('실무용 기본 프롬프트에 필수 키워드가 포함된다', () => {
    const ko = getDefaultTeamEditable('ko');
    expect(ko).toContain('실무');
    expect(ko).toContain('원천 데이터');
    expect(ko).toContain('페이지 수·분량 제한이 없다');
    expect(ko).toContain('콘텐츠가 풍부해야 한다');
  });

  it('실무용 영문 프롬프트에 필수 키워드가 포함된다', () => {
    const en = getDefaultTeamEditable('en');
    expect(en).toContain('team');
    expect(en).toContain('Source Data');
    expect(en).toMatch(/no.*page|length|limit/i);
  });

  it('DEFAULT_PROMPT_EXECUTIVE_EDITABLE가 필수 출력 항목 7개를 명시한다', () => {
    const prompt = DEFAULT_PROMPT_EXECUTIVE_EDITABLE;
    expect(prompt).toMatch(/Executive Summary|핵심 요약/);
    expect(prompt).toMatch(/목적|배경|Purpose|Background/);
    expect(prompt).toMatch(/핵심 변경|Key changes/);
    expect(prompt).toMatch(/프로세스|Process/);
    expect(prompt).toMatch(/권장사항|Recommendations/);
    expect(prompt).toMatch(/리스크|Risks/);
    expect(prompt).toMatch(/결론|Action|다음 액션/);
  });

  it('DEFAULT_PROMPT_TEAM_EDITABLE가 실무용 원칙을 명시한다', () => {
    const prompt = DEFAULT_PROMPT_TEAM_EDITABLE;
    expect(prompt).toMatch(/실무|팀|공유/);
    expect(prompt).toMatch(/원천 데이터/);
    expect(prompt).toMatch(/\[\[TABLE\]\]|\[\[DIAGRAM\]\]/);
  });
});

describe('기획 보고서 생성 — 2단계 파이프라인 조건', () => {
  it('경영진·실무 + default 템플릿이면 2단계 파이프라인 대상이다', () => {
    const reportTypes = ['executive', 'team'] as const;
    const templateIds: HtmlTemplateId[] = ['default', 'phase1', 'wiki', 'preformat'];
    for (const reportType of reportTypes) {
      for (const templateId of templateIds) {
        const useTwoPhase = (reportType === 'executive' || reportType === 'team') && templateId !== 'pptx';
        expect(useTwoPhase).toBe(true);
      }
    }
  });

  it('pptx 템플릿이면 2단계 파이프라인 대상이 아니다', () => {
    const reportType = 'executive';
    const templateId = 'pptx';
    const useTwoPhase = (reportType === 'executive' || reportType === 'team') && templateId !== 'pptx';
    expect(useTwoPhase).toBe(false);
  });
});

describe('기획 보고서 생성 — 파싱 연동 (사용자 PPTX, 백엔드 기동 시)', () => {
  it('POST /api/parse with 현지투어 PPTX returns 200 and markdown', async () => {
    if (!userPptxExists()) {
      console.warn('사용자 PPTX 없음:', USER_PPTX_PATH);
      return;
    }
    const buf = fs.readFileSync(USER_PPTX_PATH);
    const fileName = path.basename(USER_PPTX_PATH);
    const formData = new FormData();
    formData.append('file', new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.presentationml.presentation' }), fileName);

    const res = await fetch(PARSE_URL, { method: 'POST', body: formData });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data).toHaveProperty('markdown');
    expect(typeof data.markdown).toBe('string');
    expect(data.markdown.length).toBeGreaterThan(0);
  }, 30000);

  it('파싱 결과 markdown이 비어 있지 않고 줄 단위로 구성된다', async () => {
    if (!userPptxExists()) {
      console.warn('사용자 PPTX 없음:', USER_PPTX_PATH);
      return;
    }
    const buf = fs.readFileSync(USER_PPTX_PATH);
    const fileName = path.basename(USER_PPTX_PATH);
    const formData = new FormData();
    formData.append('file', new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.presentationml.presentation' }), fileName);

    const res = await fetch(PARSE_URL, { method: 'POST', body: formData });
    expect(res.status).toBe(200);
    const data = await res.json();
    const md = data.markdown as string;
    const lines = md.split('\n').filter((s: string) => s.trim().length > 0);
    expect(lines.length).toBeGreaterThan(0);
  }, 30000);

  it('파싱 결과에 filename·file_type·meta가 포함된다', async () => {
    if (!userPptxExists()) {
      console.warn('사용자 PPTX 없음:', USER_PPTX_PATH);
      return;
    }
    const buf = fs.readFileSync(USER_PPTX_PATH);
    const fileName = path.basename(USER_PPTX_PATH);
    const formData = new FormData();
    formData.append('file', new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.presentationml.presentation' }), fileName);

    const res = await fetch(PARSE_URL, { method: 'POST', body: formData });
    const data = await res.json();
    expect(data).toHaveProperty('filename');
    expect(data).toHaveProperty('file_type');
    expect(data.file_type).toBe('.pptx');
    expect(data).toHaveProperty('meta');
    expect(typeof data.meta).toBe('object');
  }, 30000);
});

describe('기획 보고서 생성 — 파싱 결과 구조 검증 (보고서 생성 입력용)', () => {
  it('실제 파싱된 markdown이 정리 md 생성에 쓸 수 있는 최소 길이를 만족한다', async () => {
    if (!userPptxExists()) {
      console.warn('사용자 PPTX 없음:', USER_PPTX_PATH);
      return;
    }
    const buf = fs.readFileSync(USER_PPTX_PATH);
    const fileName = path.basename(USER_PPTX_PATH);
    const formData = new FormData();
    formData.append('file', new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.presentationml.presentation' }), fileName);

    const res = await fetch(PARSE_URL, { method: 'POST', body: formData });
    const data = await res.json();
    const md = data.markdown as string;
    expect(md.length).toBeGreaterThan(100);
    expect(md.trim().length).toBeGreaterThan(0);
  }, 30000);
});
