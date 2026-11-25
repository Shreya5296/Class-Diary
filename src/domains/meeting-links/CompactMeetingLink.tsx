import React, { useState } from 'react';

export interface CompactMeetingLinkProps {
  cleanUrl: string;
  platform: string;
  stylesByPlatform: { bg: string; color: string; border: string };
  isCopied: boolean;
  onCopyClick: (e: React.MouseEvent) => void;
}

export const CompactMeetingLink: React.FC<CompactMeetingLinkProps> = ({
  cleanUrl,
  platform,
  stylesByPlatform,
  isCopied,
  onCopyClick,
}) => {
  const [isHovered, setIsHovered] = useState(false);

  return (
    <div
      title={cleanUrl}
      role="group"
      aria-label={`Meeting link for ${platform}`}
      style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', maxWidth: '100%', minWidth: 0 }}
      onClick={(e) => e.stopPropagation()}
    >
      <a
        href={cleanUrl}
        target="_blank"
        rel="noopener noreferrer"
        title={cleanUrl}
        onClick={(e) => e.stopPropagation()}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        style={{
          fontFamily: 'monospace',
          fontSize: '11px',
          color: stylesByPlatform.color,
          backgroundColor: stylesByPlatform.bg,
          border: `1px solid ${stylesByPlatform.border}`,
          padding: '2px 6px',
          borderRadius: 'var(--radius-sm)',
          textDecoration: isHovered ? 'underline' : 'none',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
          maxWidth: '140px',
          display: 'inline-block',
          fontWeight: 600,
          cursor: 'pointer',
          transition: 'background-color 140ms ease, border-color 140ms ease',
        }}
      >
        {cleanUrl.replace(/^https?:\/\//i, '')}
      </a>
      <button
        type="button"
        onClick={onCopyClick}
        aria-label="Copy meeting link"
        style={{
          fontSize: '10px',
          fontWeight: 700,
          color: isCopied ? 'var(--color-success, #059669)' : 'var(--color-text-muted, #64748b)',
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          padding: '2px 4px',
          whiteSpace: 'nowrap',
          flexShrink: 0,
        }}
      >
        {isCopied ? '✓ Copied' : 'Copy'}
      </button>
    </div>
  );
};
