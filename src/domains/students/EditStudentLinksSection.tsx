import React from 'react';
import { FormField } from '../../components/forms/FormField';
import { MeetingLinkButton } from '../meeting-links/MeetingLinkButton';
import formStyles from '../../components/forms/forms.module.css';

export interface EditStudentLinksSectionProps {
  meetingLink: string;
  errors?: Record<string, string>;
  onChange: (value: string) => void;
  disabled?: boolean;
}

export const EditStudentLinksSection: React.FC<EditStudentLinksSectionProps> = ({
  meetingLink,
  errors = {},
  onChange,
  disabled = false,
}) => {
  const cleanLink = meetingLink.trim();

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
      <div style={{ borderBottom: '1px solid var(--color-border-subtle)', paddingBottom: '6px' }}>
        <h4 style={{ margin: 0, fontSize: 'var(--font-size-sm)', fontWeight: 600, color: 'var(--color-text-main)' }}>
          2. Primary Meeting Link
        </h4>
        <p style={{ margin: '2px 0 0', fontSize: '11px', color: 'var(--color-text-muted)' }}>
          Configure the student's primary class video link (e.g. Google Meet or Zoom).
        </p>
      </div>

      <div>
        <FormField label="Primary Meeting Link" error={errors.primary_meeting_link || errors.meeting_link_1}>
          <input
            className={formStyles.input}
            type="url"
            value={meetingLink}
            onChange={(e) => onChange(e.target.value)}
            placeholder="https://meet.google.com/abc-xyz-pqr"
            disabled={disabled}
            aria-label="Primary Meeting Link"
          />
        </FormField>
        <div style={{ marginTop: '8px', minHeight: '28px', display: 'flex', alignItems: 'center' }}>
          <span style={{ fontSize: '11px', color: 'var(--color-text-subtle)', marginRight: '8px' }}>Preview:</span>
          {cleanLink ? (
            <MeetingLinkButton url={cleanLink} />
          ) : (
            <span style={{ fontSize: '12px', color: 'var(--color-text-muted)', fontStyle: 'italic' }}>
              No primary meeting link configured
            </span>
          )}
        </div>
      </div>
    </div>
  );
};
