import React, { useState } from 'react';
import { detectMeetingPlatform } from './platformDetector';

export interface MeetingLinkButtonProps {
  url?: string | null;
  onCopy?: (url: string) => void;
  onDelete?: () => void | Promise<void>;
  isCopied?: boolean;
  disabled?: boolean;
  compact?: boolean;
}

export const MeetingLinkButton: React.FC<MeetingLinkButtonProps> = ({
  url, onCopy, onDelete, isCopied: parentCopied, disabled = false, compact = false,
}) => {
  const [localCopied, setLocalCopied] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const cleanUrl = (url || '').trim();
  if (!cleanUrl || cleanUrl === '-' || cleanUrl === '—') return null;

  const platformInfo = detectMeetingPlatform(cleanUrl);
  const platform = platformInfo?.platform || 'OTHER';
  const isCopied = parentCopied !== undefined ? parentCopied : localCopied;

  const stylesByPlatform = {
    GOOGLE_MEET: { bg: isHovered ? '#d1fae5' : '#ecfdf5', color: '#065f46', border: isHovered ? '#059669' : '#a7f3d0' },
    ZOOM: { bg: isHovered ? '#dbeafe' : '#eff6ff', color: '#1d4ed8', border: isHovered ? '#2563eb' : '#bfdbfe' },
    OTHER: { bg: isHovered ? '#ede9fe' : '#f5f3ff', color: '#6d28d9', border: isHovered ? '#7c3aed' : '#ddd6fe' },
  }[platform];

  const handleCopyClick = (e: React.MouseEvent) => {
    e.preventDefault(); e.stopPropagation();
    if (navigator?.clipboard?.writeText) navigator.clipboard.writeText(cleanUrl).catch(() => {});
    setLocalCopied(true);
    setTimeout(() => setLocalCopied(false), 2000);
    if (onCopy) onCopy(cleanUrl);
  };

  const handleDeleteClick = async (e: React.MouseEvent) => {
    e.preventDefault(); e.stopPropagation();
    if (disabled || isDeleting || !onDelete) return;
    setIsDeleting(true);
    try { await onDelete(); } finally { setIsDeleting(false); }
  };

  if (compact) {
    return (
      <div title={cleanUrl} role="group" aria-label={`Meeting link for ${platform}`} style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', maxWidth: '100%', minWidth: 0 }} onClick={(e) => e.stopPropagation()}>
        <a href={cleanUrl} target="_blank" rel="noopener noreferrer" title={cleanUrl} style={{ fontFamily: 'monospace', fontSize: '11px', color: stylesByPlatform.color, backgroundColor: stylesByPlatform.bg, border: `1px solid ${stylesByPlatform.border}`, padding: '2px 6px', borderRadius: 'var(--radius-sm)', textDecoration: 'none', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '120px', display: 'inline-block', fontWeight: 600 }}>
          {cleanUrl.replace(/^https?:\/\//i, '')}
        </a>
        <a href={cleanUrl} target="_blank" rel="noopener noreferrer" aria-label="Open meeting link" style={{ fontSize: '10px', fontWeight: 700, color: 'var(--color-primary, #2563eb)', padding: '2px 4px', textDecoration: 'none', whiteSpace: 'nowrap', flexShrink: 0 }}>
          Open ↗
        </a>
        <button type="button" onClick={handleCopyClick} aria-label="Copy meeting link" style={{ fontSize: '10px', fontWeight: 700, color: isCopied ? 'var(--color-success, #059669)' : 'var(--color-text-muted, #64748b)', background: 'none', border: 'none', cursor: 'pointer', padding: '2px 4px', whiteSpace: 'nowrap', flexShrink: 0 }}>
          {isCopied ? '✓ Copied' : 'Copy'}
        </button>
      </div>
    );
  }

  return (
    <div
      onMouseEnter={() => setIsHovered(true)} onMouseLeave={() => setIsHovered(false)}
      title={cleanUrl} tabIndex={0} role="group" aria-label={`Meeting link for ${platform}`}
      style={{
        display: 'flex', flexDirection: 'column', gap: '6px', fontSize: 'var(--font-size-xs)',
        fontWeight: 600, fontFamily: 'monospace', backgroundColor: stylesByPlatform.bg,
        color: stylesByPlatform.color, border: `1px solid ${stylesByPlatform.border}`,
        padding: '6px 10px', borderRadius: 'var(--radius-md)', maxWidth: '100%', minWidth: 0,
        boxSizing: 'border-box', transition: 'background-color 140ms ease, border-color 140ms ease',
        cursor: 'default', position: 'relative',
      }}
    >
      <a
        href={cleanUrl} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()}
        style={{ wordBreak: 'break-all', overflowWrap: 'anywhere', whiteSpace: 'normal', color: stylesByPlatform.color, textDecoration: 'none', lineHeight: '1.4' }}
      >
        {isCopied ? '✓ Copied!' : cleanUrl}
      </a>

      <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
        <a
          href={cleanUrl} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()}
          aria-label="Open meeting link in new tab"
          style={{
            border: `1px solid ${stylesByPlatform.border}`, background: 'rgba(255, 255, 255, 0.85)',
            color: stylesByPlatform.color, borderRadius: 'var(--radius-sm)', padding: '2px 7px',
            fontSize: '11px', fontWeight: 700, cursor: 'pointer', lineHeight: 1.2,
            textDecoration: 'none', display: 'inline-flex', alignItems: 'center',
          }}
        >
          Open ↗
        </a>
        <button
          type="button" onClick={handleCopyClick} aria-label="Copy meeting link"
          style={{
            border: `1px solid ${stylesByPlatform.border}`, background: 'rgba(255, 255, 255, 0.85)',
            color: stylesByPlatform.color, borderRadius: 'var(--radius-sm)', padding: '2px 7px',
            fontSize: '11px', fontWeight: 700, cursor: 'pointer', lineHeight: 1.2,
          }}
        >
          {isCopied ? 'Copied!' : 'Copy'}
        </button>
        {onDelete && (
          <button
            type="button" onClick={handleDeleteClick} disabled={disabled || isDeleting}
            aria-label="Delete meeting link"
            style={{
              border: '1px solid #f87171', background: 'rgba(254, 242, 242, 0.9)', color: '#dc2626',
              borderRadius: 'var(--radius-sm)', padding: '2px 7px', fontSize: '11px', fontWeight: 700,
              cursor: disabled || isDeleting ? 'not-allowed' : 'pointer', lineHeight: 1.2, opacity: disabled || isDeleting ? 0.6 : 1,
            }}
          >
            {isDeleting ? 'Deleting…' : 'Delete'}
          </button>
        )}
      </div>
    </div>
  );
};
