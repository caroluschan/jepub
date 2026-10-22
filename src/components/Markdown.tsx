import DOMPurify from 'dompurify';
import { marked } from 'marked';
import { useMemo } from 'react';

interface MarkdownProps {
  source: string;
  className?: string;
}

export function Markdown({ source, className }: MarkdownProps) {
  const html = useMemo(() => {
    const rendered = marked.parse(source, {
      async: false,
      breaks: true,
      gfm: true,
    });
    return DOMPurify.sanitize(typeof rendered === 'string' ? rendered : '', {
      USE_PROFILES: { html: true },
    });
  }, [source]);

  return (
    <div
      className={className === undefined ? 'markdown-body' : `markdown-body ${className}`}
      dir="auto"
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
