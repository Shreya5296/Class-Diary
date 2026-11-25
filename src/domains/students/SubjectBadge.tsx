import React from 'react';

export interface SubjectBadgeProps {
  subject: string;
  disabled?: boolean;
  onRemove: (subject: string, e: React.MouseEvent) => void;
}

export const SubjectBadge: React.FC<SubjectBadgeProps> = ({
  subject,
  disabled,
  onRemove,
}) => (
  <span
    style={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: '4px',
      padding: '2px 8px',
      backgroundColor: 'var(--color-primary-bg)',
      color: 'var(--color-primary)',
      border: '1px solid var(--color-primary-border)',
      borderRadius: 'var(--radius-sm)',
      fontSize: 'var(--font-size-xs)',
      fontWeight: 500,
    }}
  >
    {subject}
    {!disabled && (
      <button
        type="button"
        aria-label={`Remove ${subject}`}
        onClick={(e) => onRemove(subject, e)}
        style={{
          border: 'none',
          background: 'transparent',
          color: 'var(--color-primary)',
          cursor: 'pointer',
          padding: 0,
          fontSize: '11px',
          lineHeight: 1,
          display: 'flex',
          alignItems: 'center',
        }}
      >
        ✕
      </button>
    )}
  </span>
);
