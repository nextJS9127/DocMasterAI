/**
 * 정리 md 아티팩트 뷰어.
 * 날것의 마크다운을 보기 좋게 렌더링하고, ```mermaid 블록 및 [[MERMAID]]...[[/MERMAID]] 는 Mermaid 다이어그램으로 시각화.
 */

/** 1차 추출(Python)에서 붙인 [[MERMAID]]...[[/MERMAID]] 를 ```mermaid ... ``` 로 변환해 react-markdown에서 인식되게 함. */
function normalizeMermaidBlocks(md: string): string {
  if (!md || typeof md !== 'string') return md;
  return md.replace(
    /\[\[MERMAID\]\]\s*([\s\S]*?)\s*\[\[\/MERMAID\]\]/g,
    (_, code) => '```mermaid\n' + (code || '').trim() + '\n```'
  );
}

import { useMemo, useRef, useEffect, useState, useId } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import mermaid from 'mermaid';
import type { Components } from 'react-markdown';

mermaid.initialize({
  startOnLoad: false,
  securityLevel: 'loose',
  theme: 'neutral',
});

/**
 * Mermaid 노드 라벨 내부의 파서 오류 유발 문자를 HTML 엔티티로 이스케이프.
 * 등호·괄호가 파서에 의해 문법으로 해석되는 것 방지.
 */
function sanitizeMermaidNodeLabels(code: string): string {
  return code.replace(/\[([^\]]*)\]/g, (_, label) => {
    const escaped = label
      .replace(/=/g, '#61;')   // =
      .replace(/\(/g, '#40;')  // (
      .replace(/\)/g, '#41;')  // )
      .replace(/\[/g, '#91;')  // [
      .replace(/\]/g, '#93;'); // ]
    return '[' + escaped + ']';
  });
}

function MermaidBlock({ code }: { code: string }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [svg, setSvg] = useState<string | null>(null);
  const [bindFns, setBindFns] = useState<((el: HTMLElement) => void) | null>(null);
  const [error, setError] = useState<string | null>(null);
  const id = useId().replace(/:/g, '-');

  useEffect(() => {
    let codeTrimmed = (code || '').trim();
    if (!codeTrimmed) {
      setSvg(null);
      setBindFns(null);
      setError(null);
      return;
    }
    setError(null);
    setSvg(null);
    setBindFns(null);
    codeTrimmed = sanitizeMermaidNodeLabels(codeTrimmed);
    const renderId = `mermaid-${id}-${Date.now()}`;
    mermaid
      .render(renderId, codeTrimmed)
      .then((result) => {
        setSvg(result.svg);
        if (typeof result.bindFunctions === 'function') setBindFns(() => result.bindFunctions!);
      })
      .catch((err) => {
        setError(err?.message ?? 'Mermaid 렌더 실패');
      });
  }, [code, id]);

  useEffect(() => {
    if (bindFns && containerRef.current) bindFns(containerRef.current);
  }, [bindFns, svg]);

  if (error) {
    return (
      <div className="my-4 p-4 rounded-lg bg-amber-50 border border-amber-200 text-amber-800 text-sm">
        <div className="font-semibold mb-1">Mermaid 다이어그램 오류</div>
        <pre className="whitespace-pre-wrap break-words text-xs">{error}</pre>
        <pre className="mt-2 text-xs opacity-70 overflow-x-auto">{code.slice(0, 300)}</pre>
      </div>
    );
  }

  return (
    <div ref={containerRef} className="my-4 flex justify-center overflow-x-auto">
      {svg ? (
        <div
          className="mermaid-svg-wrapper rounded-lg border border-slate-200 bg-white p-4"
          dangerouslySetInnerHTML={{ __html: svg }}
        />
      ) : (
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-slate-500 text-sm">다이어그램 생성 중...</div>
      )}
    </div>
  );
}

export interface MarkdownArtifactViewerProps {
  markdown: string;
  className?: string;
}

export function MarkdownArtifactViewer({ markdown, className = '' }: MarkdownArtifactViewerProps) {
  const normalizedMarkdown = useMemo(
    () => normalizeMermaidBlocks(markdown || ''),
    [markdown]
  );
  const components: Components = useMemo(() => ({
    code({ node, className: codeClassName, children, ...props }) {
      const match = /language-(\w+)/.exec(codeClassName || '');
      const isMermaid = match && match[1] === 'mermaid';
      const code = String(children).replace(/\n$/, '');
      if (isMermaid) {
        return <MermaidBlock code={code} />;
      }
      return (
        <code className={codeClassName} {...props}>
          {children}
        </code>
      );
    },
    pre({ children }) {
      const child = Array.isArray(children) ? children[0] : children;
      const isMermaid = child && typeof child === 'object' && 'props' in child && (child as { props?: { code?: string } }).props?.code !== undefined;
      if (isMermaid) return <>{children}</>;
      return (
        <pre className="bg-slate-100 border border-slate-200 rounded-lg p-4 overflow-x-auto text-sm my-3">
          {children}
        </pre>
      );
    },
    h1: ({ children }) => <h1 className="text-2xl font-bold text-slate-800 mt-6 mb-3 pb-2 border-b border-slate-200">{children}</h1>,
    h2: ({ children }) => <h2 className="text-xl font-bold text-slate-800 mt-5 mb-2">{children}</h2>,
    h3: ({ children }) => <h3 className="text-lg font-semibold text-slate-700 mt-4 mb-2">{children}</h3>,
    p: ({ children }) => <p className="text-slate-700 leading-relaxed my-2">{children}</p>,
    ul: ({ children }) => <ul className="markdown-list-ul my-2 space-y-1 text-slate-700">{children}</ul>,
    ol: ({ children }) => <ol className="markdown-list-ol my-2 space-y-1 text-slate-700">{children}</ol>,
    li: ({ children }) => <li className="ml-2 pl-0.5">{children}</li>,
    table: ({ children }) => (
      <div className="my-4 overflow-x-auto rounded-lg border border-slate-200 shadow-sm">
        <table className="min-w-full border-collapse text-sm">{children}</table>
      </div>
    ),
    thead: ({ children }) => <thead className="bg-slate-100">{children}</thead>,
    tbody: ({ children }) => <tbody className="divide-y divide-slate-200">{children}</tbody>,
    tr: ({ children }) => <tr className="border-b border-slate-200 last:border-b-0">{children}</tr>,
    th: ({ children }) => (
      <th className="border-b border-slate-200 border-r border-slate-200 last:border-r-0 bg-slate-100 px-4 py-2.5 text-left font-semibold text-slate-700 whitespace-nowrap">
        {children}
      </th>
    ),
    td: ({ children }) => (
      <td className="border-b border-slate-100 border-r border-slate-100 last:border-r-0 px-4 py-2.5 text-slate-700 align-top">
        {children}
      </td>
    ),
    blockquote: ({ children }) => (
      <blockquote className="border-l-4 border-indigo-300 pl-4 py-1 my-2 text-slate-600 italic">{children}</blockquote>
    ),
    strong: ({ children }) => <strong className="font-semibold text-slate-800">{children}</strong>,
  }), []);

  return (
    <article className={`prose prose-slate max-w-none markdown-artifact-root ${className}`}>
      <style>{`
        /* 뎁스별 블릿 구분: 1단계 ●, 2단계 ○, 3단계 ■ → 상·하위 구분 명확 */
        .markdown-artifact-root .markdown-list-ul { list-style-type: disc; list-style-position: outside; margin-left: 1.25rem; }
        .markdown-artifact-root .markdown-list-ul .markdown-list-ul { list-style-type: circle; margin-left: 1.25rem; }
        .markdown-artifact-root .markdown-list-ul .markdown-list-ul .markdown-list-ul { list-style-type: square; margin-left: 1.25rem; }
        .markdown-artifact-root .markdown-list-ol { list-style-type: decimal; list-style-position: outside; margin-left: 1.5rem; }
        .markdown-artifact-root .markdown-list-ol .markdown-list-ol { list-style-type: lower-alpha; margin-left: 1.5rem; }
        .markdown-artifact-root .markdown-list-ol .markdown-list-ol .markdown-list-ol { list-style-type: lower-roman; margin-left: 1.5rem; }
      `}</style>
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>{normalizedMarkdown}</ReactMarkdown>
    </article>
  );
}
