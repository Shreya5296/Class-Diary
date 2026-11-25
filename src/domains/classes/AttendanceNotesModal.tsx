import React, { useState, useEffect } from 'react';
import styles from '../../components/overlays/confirmDialog.module.css';
import formStyles from '../../components/forms/forms.module.css';
import { Button } from '../../components/buttons/Button';
import { AttendanceStatus } from './classTypes';

export interface AttendanceNotesModalProps {
  isOpen: boolean;
  outcome: AttendanceStatus | null;
  isLoading?: boolean;
  onConfirm: (outcome: AttendanceStatus, notes: string) => Promise<void>;
  onCancel: () => void;
}

export const AttendanceNotesModal: React.FC<AttendanceNotesModalProps> = ({
  isOpen,
  outcome,
  isLoading = false,
  onConfirm,
  onCancel,
}) => {
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setNotes('');
      setError(null);
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isLoading) {
        onCancel();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, isLoading, onCancel]);

  if (!isOpen || !outcome) return null;

  const isAttended = outcome === 'PRESENT' || outcome === 'ATTENDED';
  const actionLabel = isAttended ? 'Attended' : 'No-Show';

  const handleConfirm = async () => {
    const trimmed = notes.trim();
    if (!trimmed) {
      setError('Please enter notes before marking attendance.');
      return;
    }
    setError(null);
    await onConfirm(outcome, trimmed);
  };

  return (
    <div
      className={styles.backdrop}
      role="dialog"
      aria-modal="true"
      aria-labelledby="attendance-notes-dialog-title"
      onClick={(e) => {
        if (e.target === e.currentTarget && !isLoading) onCancel();
      }}
    >
      <div className={styles.dialog} style={{ maxWidth: '440px', width: '90%' }}>
        <h2 id="attendance-notes-dialog-title" className={styles.title}>
          Mark Attendance: {actionLabel}
        </h2>
        <p className={styles.body} style={{ marginBottom: 'var(--space-3)' }}>
          Please enter attendance notes before marking the student as {actionLabel}.
        </p>

        <div style={{ marginBottom: 'var(--space-4)' }}>
          <label
            htmlFor="attendance-notes-input"
            style={{ display: 'block', fontSize: 'var(--font-size-xs)', fontWeight: 600, marginBottom: '4px', color: 'var(--color-text-main)' }}
          >
            Notes <span style={{ color: 'var(--color-danger)' }}>*</span>
          </label>
          <textarea
            id="attendance-notes-input"
            data-testid="attendance-notes-input"
            className={formStyles.textarea}
            rows={3}
            value={notes}
            onChange={(e) => {
              setNotes(e.target.value);
              if (error && e.target.value.trim()) setError(null);
            }}
            placeholder={isAttended ? 'e.g. Covered Chapter 4 exercises; completed homework.' : 'e.g. Student absent without prior notice.'}
            disabled={isLoading}
            autoFocus
          />
          {error && (
            <span role="alert" style={{ display: 'block', color: 'var(--color-danger)', fontSize: '11px', marginTop: '4px' }}>
              {error}
            </span>
          )}
        </div>

        <div className={styles.actions}>
          <Button variant="secondary" onClick={onCancel} disabled={isLoading}>
            Cancel
          </Button>
          <Button
            variant={isAttended ? 'primary' : 'danger'}
            onClick={handleConfirm}
            isLoading={isLoading}
            disabled={isLoading || !notes.trim()}
            data-testid="confirm-attendance-notes-button"
          >
            Confirm {actionLabel}
          </Button>
        </div>
      </div>
    </div>
  );
};
