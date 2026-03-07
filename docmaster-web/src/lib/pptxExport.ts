import PptxGenJS from 'pptxgenjs';
import { PPTX_DS, type PptxSlideData } from './pptxDesignSystem';

/** 하위 호환: title + bullets만 있는 슬라이드 */
export type PptxSlide = { title: string; bullets?: string[] };

const H = PPTX_DS.slideH;
const C = PPTX_DS.color;
const M = PPTX_DS.marginLeft;
const CW = PPTX_DS.contentWidth;
const FS = PPTX_DS.fontSize;
const F = PPTX_DS.font;
const ACCENT_LINE = PPTX_DS.accentLineWidth;
const DIVIDER_H = PPTX_DS.dividerHeight;

function addAccentLine(
    slide: PptxGenJS.Slide,
    x: number,
    y: number,
    height: number
): void {
    slide.addShape('rect', {
        x,
        y,
        w: ACCENT_LINE,
        h: height,
        fill: { color: C.accent },
    });
}

/**
 * 디자인 시스템 규칙에 따라 PPTX 생성 후 다운로드.
 * slideType별 레이아웃: title, content, three_step_card, metric, grid_2x2 등.
 */
export function buildAndDownloadPptx(
    slides: PptxSlideData[] | PptxSlide[],
    baseFilename: string = 'report'
): void {
    const data: PptxSlideData[] = slides.map((s) => {
        if ('slideType' in s || 'headline' in s || 'cards' in s || 'metrics' in s) {
            return s as PptxSlideData;
        }
        const simple = s as PptxSlide;
        return {
            slideType: undefined,
            title: simple.title,
            bullets: simple.bullets ?? [],
        };
    });

    const pptx = new PptxGenJS();
    pptx.author = 'DocMaster AI';
    pptx.title = data[0]?.title ?? 'Presentation';
    pptx.layout = 'LAYOUT_16x9';

    for (let i = 0; i < data.length; i++) {
        const s = data[i];
        const slide = pptx.addSlide();
        slide.background = { color: C.background };

        const type = (i === 0 ? 'title' : s.slideType) || 'content';

        switch (type) {
            case 'title':
                renderTitleSlide(slide, s, data.length);
                break;
            case 'three_step_card':
                renderThreeStepCard(slide, s, i, data.length);
                break;
            case 'metric':
                renderMetricSlide(slide, s, i, data.length);
                break;
            case 'grid_2x2':
                renderGrid2x2(slide, s, i, data.length);
                break;
            default:
                renderContentSlide(slide, s, i, data.length);
        }
    }

    const filename = baseFilename.replace(/\.pptx$/i, '') + '.pptx';
    pptx.writeFile({ fileName: filename });
}

/** ① 타이틀 슬라이드: MainTitle + Tagline + Divider + BottomInfo */
function renderTitleSlide(
    slide: PptxGenJS.Slide,
    s: PptxSlideData,
    _total: number
): void {
    const cx = M + CW / 2;
    const mainTitle = s.title || 'Title';
    slide.addText(mainTitle, {
        x: M,
        y: 2.75,
        w: CW,
        h: 1,
        fontFace: F.titleEn,
        fontSize: FS.mainTitle,
        bold: true,
        color: C.primary,
        align: 'center',
        valign: 'middle',
    });
    if (s.tagline) {
        slide.addText(s.tagline, {
            x: M,
            y: 3.85,
            w: CW,
            h: 0.4,
            fontSize: FS.tagline,
            color: C.accent,
            align: 'center',
        });
    }
    const divY = 4.75;
    slide.addShape('rect', {
        x: cx - 1,
        y: divY,
        w: 2,
        h: DIVIDER_H,
        fill: { color: C.accent },
    });
    if (s.bottomInfo) {
        slide.addText(s.bottomInfo, {
            x: M,
            y: divY + 0.25,
            w: CW,
            h: 0.35,
            fontSize: FS.kicker,
            color: C.sub,
            align: 'center',
        });
    }
}

/** ② 콘텐츠 슬라이드: Label + Headline + (SubHook) + 구분선 + 카드(Accent Line) + Kicker — 레이블·구분선 항상 표시 */
function renderContentSlide(
    slide: PptxGenJS.Slide,
    s: PptxSlideData,
    idx: number,
    total: number
): void {
    let y = PPTX_DS.labelTop;
    const label = s.label || 'KEY POINTS';
    slide.addText(label.toUpperCase(), {
        x: M,
        y,
        w: CW,
        h: 0.28,
        fontFace: F.label,
        fontSize: FS.label,
        bold: true,
        color: C.accent,
    });
    y += 0.35;

    const headline = s.headline ?? s.title;
    slide.addText(headline, {
        x: M,
        y,
        w: CW,
        h: 0.5,
        fontFace: F.bodyKo,
        fontSize: FS.sectionHead,
        bold: true,
        color: C.primary,
    });
    y += 0.55;
    if (s.subHook) {
        slide.addText(s.subHook, {
            x: M,
            y,
            w: CW,
            h: 0.35,
            fontSize: FS.cardBody,
            color: C.muted,
        });
        y += 0.4;
    }

    const lineY = y;
    slide.addShape('rect', {
        x: M,
        y: lineY,
        w: CW,
        h: DIVIDER_H,
        fill: { color: C.accent },
    });
    y = lineY + DIVIDER_H + 0.06;

    const cardH = H - y - 0.5;
    let cardsToRender = s.cards && s.cards.length > 0
        ? s.cards
        : null;

    if (!cardsToRender && (s.bullets?.length ?? 0) >= 2) {
        const bullets = s.bullets ?? [];
        const mid = Math.max(1, Math.ceil(bullets.length / 2));
        cardsToRender = [
            { title: '핵심 요약', items: bullets.slice(0, mid) },
            { title: '상세', items: bullets.slice(mid) },
        ];
    }

    if (cardsToRender && cardsToRender.length > 0) {
        const count = cardsToRender.length;
        const ch = Math.min((cardH - (count - 1) * 0.08) / count, 2);
        for (const card of cardsToRender) {
            slide.addShape('rect', {
                x: M,
                y,
                w: ACCENT_LINE,
                h: ch,
                fill: { color: C.accent },
            });
            slide.addShape('rect', {
                x: M + ACCENT_LINE,
                y,
                w: CW - ACCENT_LINE,
                h: ch,
                fill: { color: C.cardDark },
            });
            slide.addText(card.title, {
                x: M + ACCENT_LINE + 0.15,
                y: y + 0.1,
                w: CW - ACCENT_LINE - 0.3,
                h: 0.28,
                fontFace: F.bodyKo,
                fontSize: FS.cardTitle,
                bold: true,
                color: C.primary,
            });
            const items = (card.items || []).filter(Boolean);
            if (items.length > 0) {
                const bulletProps = items.map((text) => ({
                    text,
                    options: { bullet: true, fontSize: 12, color: C.muted },
                }));
                slide.addText(bulletProps, {
                    x: M + ACCENT_LINE + 0.2,
                    y: y + 0.4,
                    w: CW - ACCENT_LINE - 0.4,
                    h: ch - 0.5,
                    fontFace: F.bodyEn,
                    fontSize: 12,
                    valign: 'top',
                    fill: { color: C.cardDark },
                });
            }
            y += ch + 0.08;
        }
    } else {
        const bullets = s.bullets ?? [];
        const singleCardH = Math.max(1.5, cardH);
        slide.addShape('rect', {
            x: M,
            y,
            w: ACCENT_LINE,
            h: singleCardH,
            fill: { color: C.accent },
        });
        slide.addShape('rect', {
            x: M + ACCENT_LINE,
            y,
            w: CW - ACCENT_LINE,
            h: singleCardH,
            fill: { color: C.cardDark },
        });
        if (bullets.length > 0) {
            const bulletProps = bullets.map((text) => ({
                text,
                options: { bullet: true, fontSize: FS.cardBody, color: C.muted },
            }));
            slide.addText(bulletProps, {
                x: M + ACCENT_LINE + 0.2,
                y: y + 0.15,
                w: CW - ACCENT_LINE - 0.4,
                h: singleCardH - 0.3,
                fontFace: F.bodyKo,
                valign: 'top',
                fill: { color: C.cardDark },
            });
        }
        y += singleCardH;
    }

    if (s.kicker) {
        slide.addText(s.kicker, {
            x: M,
            y: H - 0.5,
            w: CW,
            h: 0.3,
            fontSize: FS.kicker,
            color: C.sub,
        });
    }
    slide.addText(`${idx + 1} / ${total}`, {
        x: M,
        y: H - 0.4,
        w: CW,
        h: 0.25,
        fontSize: 10,
        color: C.sub,
        align: 'right',
    });
}

/** ③ 3단 스텝 카드: Label + Headline + SubHook + 구분선 + 카드 3개 + Kicker */
function renderThreeStepCard(
    slide: PptxGenJS.Slide,
    s: PptxSlideData,
    idx: number,
    total: number
): void {
    let y = PPTX_DS.labelTop;
    if (s.label) {
        slide.addText(s.label.toUpperCase(), {
            x: M,
            y,
            w: CW,
            h: 0.25,
            fontFace: F.label,
            fontSize: FS.label,
            bold: true,
            color: C.accent,
        });
        y += 0.32;
    }
    slide.addText(s.headline ?? s.title, {
        x: M,
        y,
        w: CW,
        h: 0.5,
        fontFace: F.bodyKo,
        fontSize: FS.sectionHead,
        bold: true,
        color: C.primary,
    });
    y += 0.55;
    if (s.subHook) {
        slide.addText(s.subHook, {
            x: M,
            y,
            w: CW,
            h: 0.35,
            fontSize: FS.cardBody,
            color: C.muted,
        });
        y += 0.45;
    }
    slide.addShape('rect', {
        x: M,
        y: y,
        w: CW,
        h: DIVIDER_H,
        fill: { color: C.accent },
    });
    y += 0.12;

    const cardW = (CW - 0.22) / 3;
    const cardH = 3.55;
    const cards = (s.cards ?? []).slice(0, 3);
    const positions = [M, M + cardW + 0.11, M + (cardW + 0.11) * 2];
    for (let i = 0; i < 3; i++) {
        const x = positions[i];
        const card = cards[i] ?? { title: '', items: [] };
        addAccentLine(slide, x, y, cardH);
        slide.addShape('rect', {
            x: x + ACCENT_LINE,
            y,
            w: cardW - ACCENT_LINE,
            h: cardH,
            fill: { color: C.cardDark },
        });
        slide.addText(String(i + 1), {
            x: x + ACCENT_LINE + 0.1,
            y: y + 0.1,
            w: cardW - ACCENT_LINE - 0.2,
            h: 0.4,
            fontSize: FS.sectionHead,
            bold: true,
            color: C.accent,
        });
        slide.addText(card.title, {
            x: x + ACCENT_LINE + 0.1,
            y: y + 0.5,
            w: cardW - ACCENT_LINE - 0.2,
            h: 0.35,
            fontFace: F.bodyKo,
            fontSize: FS.cardTitle,
            bold: true,
            color: C.primary,
        });
        const items = (card.items ?? []).filter(Boolean);
        if (items.length > 0) {
            const bulletProps = items.map((text) => ({
                text,
                options: { bullet: true, fontSize: 12, color: C.sub },
            }));
            slide.addText(bulletProps, {
                x: x + ACCENT_LINE + 0.15,
                y: y + 0.95,
                w: cardW - ACCENT_LINE - 0.3,
                h: cardH - 1.1,
                fontFace: F.bodyEn,
                valign: 'top',
                fill: { color: C.cardDark },
            });
        }
    }

    if (s.kicker) {
        slide.addText(s.kicker, {
            x: M,
            y: H - 0.5,
            w: CW,
            h: 0.3,
            fontSize: FS.kicker,
            color: C.sub,
        });
    }
    slide.addText(`${idx + 1} / ${total}`, {
        x: M,
        y: H - 0.4,
        w: CW,
        h: 0.25,
        fontSize: 10,
        color: C.sub,
        align: 'right',
    });
}

/** ④ 3열 지표: Label + Headline + 메트릭 카드 3개 + Kicker */
function renderMetricSlide(
    slide: PptxGenJS.Slide,
    s: PptxSlideData,
    idx: number,
    total: number
): void {
    let y = PPTX_DS.labelTop;
    if (s.label) {
        slide.addText(s.label.toUpperCase(), {
            x: M,
            y,
            w: CW,
            h: 0.25,
            fontFace: F.label,
            fontSize: FS.label,
            bold: true,
            color: C.accent,
        });
        y += 0.32;
    }
    slide.addText(s.headline ?? s.title, {
        x: M,
        y,
        w: CW,
        h: 0.45,
        fontFace: F.bodyKo,
        fontSize: FS.sectionHead,
        bold: true,
        color: C.primary,
    });
    y += 0.55;

    const cardW = (CW - 0.22) / 3;
    const cardH = 2.4;
    const metrics = (s.metrics ?? []).slice(0, 3);
    const positions = [M, M + cardW + 0.11, M + (cardW + 0.11) * 2];
    for (let i = 0; i < 3; i++) {
        const x = positions[i];
        const m = metrics[i] ?? { value: '—', label: '' };
        addAccentLine(slide, x, y, cardH);
        slide.addShape('rect', {
            x: x + ACCENT_LINE,
            y,
            w: cardW - ACCENT_LINE,
            h: cardH,
            fill: { color: C.cardDark },
        });
        slide.addText(m.value, {
            x: x + ACCENT_LINE + 0.1,
            y: y + 0.3,
            w: cardW - ACCENT_LINE - 0.2,
            h: 0.6,
            fontSize: FS.metricValue,
            bold: true,
            color: C.accent,
        });
        slide.addText(m.label, {
            x: x + ACCENT_LINE + 0.1,
            y: y + 1,
            w: cardW - ACCENT_LINE - 0.2,
            h: 0.8,
            fontSize: FS.cardBody,
            color: C.sub,
        });
    }

    if (s.kicker) {
        slide.addShape('rect', {
            x: M,
            y: H - 1.65,
            w: CW,
            h: 1.1,
            fill: { color: C.cardDarkAlt },
        });
        slide.addText(s.kicker, {
            x: M + 0.2,
            y: H - 1.55,
            w: CW - 0.4,
            h: 0.9,
            fontSize: FS.kicker,
            color: C.sub,
            valign: 'middle',
        });
    }
    slide.addText(`${idx + 1} / ${total}`, {
        x: M,
        y: H - 0.4,
        w: CW,
        h: 0.25,
        fontSize: 10,
        color: C.sub,
        align: 'right',
    });
}

/** ⑤ 2×2 그리드: Label + Headline + 카드 4개 + Kicker */
function renderGrid2x2(
    slide: PptxGenJS.Slide,
    s: PptxSlideData,
    idx: number,
    total: number
): void {
    let y = PPTX_DS.labelTop;
    if (s.label) {
        slide.addText(s.label.toUpperCase(), {
            x: M,
            y,
            w: CW,
            h: 0.25,
            fontFace: F.label,
            fontSize: FS.label,
            bold: true,
            color: C.accent,
        });
        y += 0.32;
    }
    slide.addText(s.headline ?? s.title, {
        x: M,
        y,
        w: CW,
        h: 0.45,
        fontFace: F.bodyKo,
        fontSize: FS.sectionHead,
        bold: true,
        color: C.primary,
    });
    y += 0.6;

    const gap = 0.12;
    const cardW = (CW - gap) / 2;
    const cardH = 2.1;
    const cards = s.cards ?? [];
    const gridTitles = s.gridTitles ?? ['', '', '', ''];
    const gridBodies = s.gridBodies ?? [[], [], [], []];
    for (let row = 0; row < 2; row++) {
        for (let col = 0; col < 2; col++) {
            const k = row * 2 + col;
            const x = M + col * (cardW + gap);
            const cy = y + row * (cardH + gap);
            const card = cards[k] ?? {
                title: gridTitles[k] || `Card ${k + 1}`,
                items: gridBodies[k] ?? [],
            };
            addAccentLine(slide, x, cy, cardH);
            slide.addShape('rect', {
                x: x + ACCENT_LINE,
                y: cy,
                w: cardW - ACCENT_LINE,
                h: cardH,
                fill: { color: C.cardDark },
            });
            slide.addText(card.title, {
                x: x + ACCENT_LINE + 0.12,
                y: cy + 0.12,
                w: cardW - ACCENT_LINE - 0.24,
                h: 0.35,
                fontFace: F.bodyKo,
                fontSize: FS.cardTitle,
                bold: true,
                color: C.primary,
            });
            const items = (card.items ?? []).filter(Boolean);
            if (items.length > 0) {
                const bulletProps = items.map((text) => ({
                    text,
                    options: { bullet: true, fontSize: 11, color: C.muted },
                }));
                slide.addText(bulletProps, {
                    x: x + ACCENT_LINE + 0.15,
                    y: cy + 0.5,
                    w: cardW - ACCENT_LINE - 0.3,
                    h: cardH - 0.6,
                    fontFace: F.bodyEn,
                    valign: 'top',
                    fill: { color: C.cardDark },
                });
            }
        }
    }

    slide.addShape('rect', {
        x: M,
        y: H - 0.25,
        w: CW,
        h: DIVIDER_H,
        fill: { color: PPTX_DS.color.divider },
    });
    slide.addText(`${idx + 1} / ${total}`, {
        x: M,
        y: H - 0.35,
        w: CW,
        h: 0.25,
        fontSize: 10,
        color: C.sub,
        align: 'right',
    });
}
