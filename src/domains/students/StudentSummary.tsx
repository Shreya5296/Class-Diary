import React from 'react';
import { Student } from './studentTypes';
import { formatStatusBadge } from '../../lib/textFormat';
import { formatDate } from '../../lib/dateFormat';
import { MeetingLinkButton } from '../meeting-links/MeetingLinkButton';

export interface StudentSummaryProps {
  student: Student;
}

export const StudentSummary: React.FC<StudentSummaryProps> = ({ student }) => {
  const badge = formatStatusBadge(student.status);
  const name = student.student_name || student.full_name || 'Unnamed Student';
  const initial = name.charAt(0).toUpperCase();

  return (
    <div
      style={{
        backgroundColor: 'var(--color-bg-surface)',
        border: '1px solid var(--color-border-subtle)',
        borderRadius: 'var(--radius-xl)',
        padding: '1.5rem',
        marginBottom: 'var(--space-6)',
        boxShadow: 'var(--shadow-xs)',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 'var(--space-4)', marginBottom: 'var(--space-5)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-4)', minWidth: 0 }}>
          <div
            style={{
              width: '52px',
              height: '52px',
              borderRadius: 'var(--radius-full)',
              backgroundColor: 'var(--color-primary-bg)',
              color: 'var(--color-primary)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '1.25rem',
              fontWeight: 700,
              border: '1.5px solid var(--color-primary-border)',
              flexShrink: 0,
            }}
          >
            {initial}
          </div>
          <div style={{ minWidth: 0 }}>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 700, margin: 0, color: 'var(--color-text-main)', letterSpacing: '-0.01em', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {name}
            </h2>
            <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)', marginTop: '2px', display: 'block' }}>
              Student ID: <code>{student.student_id}</code> • Registered {formatDate(student.created_at)}
            </span>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', flexShrink: 0 }}>
          <span
            data-testid="student-status-badge"
            style={{
              padding: '5px 12px',
              borderRadius: 'var(--radius-full)',
              fontSize: 'var(--font-size-xs)',
              fontWeight: 600,
              backgroundColor: badge.tone === 'success' ? 'var(--color-success-bg)' : 'var(--color-bg-subtle)',
              color: badge.tone === 'success' ? 'var(--color-success-text)' : 'var(--color-text-muted)',
              border: `1px solid ${badge.tone === 'success' ? 'var(--color-success-border)' : 'var(--color-border)'}`,
            }}
          >
            {badge.label}
          </span>
        </div>
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
          gap: 'var(--space-4) var(--space-6)',
          paddingTop: 'var(--space-4)',
          borderTop: '1px solid var(--color-border-subtle)',
          fontSize: 'var(--font-size-sm)',
        }}
      >
        <div style={{ minWidth: 0 }}>
          <span style={labelStyle}>Subject / Curriculum</span>
          <strong style={{ ...valueStyle, overflowWrap: 'anywhere' }}>{student.subject || '—'}</strong>
        </div>
        <div style={{ minWidth: 0 }}>
          <span style={labelStyle}>Student Email</span>
          <strong style={{ ...valueStyle, overflowWrap: 'anywhere', wordBreak: 'break-word' }}>
            {student.student_email || student.email || '—'}
          </strong>
        </div>
        <div style={{ minWidth: 0 }}>
          <span style={labelStyle}>Parent / Guardian</span>
          <strong style={{ ...valueStyle, overflowWrap: 'anywhere' }}>
            {student.parent_name || '—'} {student.parent_phone ? `(${student.parent_phone})` : ''}
          </strong>
        </div>
        <div style={{ minWidth: 0 }}>
          <span style={labelStyle}>Parent Email</span>
          <strong style={{ ...valueStyle, overflowWrap: 'anywhere', wordBreak: 'break-word' }}>
            {student.parent_email || '—'}
          </strong>
        </div>
        <div style={{ minWidth: 0 }}>
          <span style={labelStyle}>Primary Meeting Link</span>
          {student.primary_meeting_link ? (
            <div style={{ marginTop: '2px', maxWidth: '100%', overflow: 'hidden' }}>
              <MeetingLinkButton url={student.primary_meeting_link} compact />
            </div>
          ) : (
            <span style={{ color: 'var(--color-text-subtle)', fontStyle: 'italic' }}>None</span>
          )}
        </div>
      </div>
    </div>
  );
};

const labelStyle: React.CSSProperties = {
  color: 'var(--color-text-muted)',
  fontSize: 'var(--font-size-xs)',
  display: 'block',
  marginBottom: '4px',
};

const valueStyle: React.CSSProperties = {
  color: 'var(--color-text-main)',
  lineHeight: 1.45,
  display: 'block',
};
