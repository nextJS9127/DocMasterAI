/**
 * PPTX 디자인 시스템 — 규칙 정의
 * 720pt × 540pt (16:9), 72pt = 1 inch → 10" × 7.5"
 */

export const PPTX_DS = {
    /** 슬라이드 크기 (inch) */
    slideW: 10,
    slideH: 7.5,

    /** 색상 팔레트 (hex, # 제외) */
    color: {
        background: '0A0E1A',
        accent: '4F8CFF',
        primary: 'FFFFFF',
        sub: '8090A8',
        muted: 'C0C8D8',
        gold: 'FFD93D',
        cardDark: '0D1626',
        cardDarkAlt: '111827',
        divider: '2A3A5C',
    },

    /** 여백 (pt → inch: /72) */
    marginLeftPt: 54,
    contentWidthPt: 612,
    marginLeft: 54 / 72,
    contentWidth: 612 / 72,

    labelTop: 18 / 72,
    headlineTop: 45 / 72,
    sectionHeadTop: 34 / 72,

    /** 폰트 (시스템에 없으면 대체 폰트 사용) */
    font: {
        titleEn: 'Raleway',
        bodyKo: 'KoPub Dotum',
        bodyEn: 'Open Sans',
        label: 'Raleway',
    },
    /** 폰트 크기 (pt). pptxgenjs는 pt 사용 */
    fontSize: {
        mainTitle: 44,
        tagline: 20,
        label: 14,
        sectionHead: 24,
        cardTitle: 16,
        cardBody: 14,
        kicker: 14,
        metricValue: 28,
    },

    /** Accent Line: 세로선 두께 (inch). 1pt는 너무 얇아 3pt로 표시 */
    accentLineWidth: 3 / 72,
    /** 구분선(가로 Divider) 두께 (inch) */
    dividerHeight: 2 / 72,
} as const;

/** 슬라이드 유형 (디자인 시스템 레이아웃) */
export type PptxSlideType =
    | 'title'
    | 'content'
    | 'three_step_card'
    | 'metric'
    | 'grid_2x2'
    | 'three_column'
    | 'numbered_flow'
    | 'vertical_steps'
    | 'five_grid'
    | 'tier_compare';

/** 카드 한 개 (제목 + 항목들) */
export interface PptxCard {
    title: string;
    items: string[];
}

/** 지표 한 개 (숫자/값 + 레이블) */
export interface PptxMetric {
    value: string;
    label: string;
}

/** 확장 슬라이드 데이터 — slideType에 따라 필드 사용 */
export interface PptxSlideData {
    slideType?: PptxSlideType;
    title: string;
    bullets?: string[];
    tagline?: string;
    label?: string;
    headline?: string;
    subHook?: string;
    kicker?: string;
    bottomInfo?: string;
    cards?: PptxCard[];
    metrics?: PptxMetric[];
    /** 2x2 그리드용 4개 카드 제목/요약 */
    gridTitles?: [string, string, string, string];
    gridBodies?: [string[], string[], string[], string[]];
}
