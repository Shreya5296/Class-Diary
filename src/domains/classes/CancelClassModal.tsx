import React, { useState, useEffect } from 'react';
import styles from '../../components/overlays/confirmDialog.module.css';
import formStyles from '../../components/forms/forms.module.css';
import { Button } from '../../components/buttons/Button';

export interface CancelClassModalProps {
  isOpen: boolean;
  isLoading?: boolean;
  onConfirm: (reason: string) => Promise<void>;
  onCancel: () => void;
}

export const CancelClassModal: React.FC<CancelClassModalProps> = ({
  isOpen,
  isLoading = false,
  onConfirm,
  onCancel,
}) => {
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setReason('');
      setError(null);
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isLoading) onCancel();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, isLoading, onCancel]);

  if (!isOpen) return null;

  const handleConfirm = async () => {
    const trimmed = reason.trim();
    if (!trimmed) {
      setError('Please provide a cancellation reason.');
      return;
    }
    setError(null);
    await onConfirm(trimmed);
  };

  const isBlank = !reason.trim();

  return (
    <div
      className={styles.backdrop}
      role="dialog"
      aria-modal="true"
      aria-labelledby="cancel-dialog-title"
      onClick={(e) => {
        if (e.target === e.currentTarget && !isLoading) onCancel();
      }}
    >
      <div
        className={styles.dialog}
        style={{
          maxWidth: '560px',
          width: '92%',
          padding: '1.75rem 2rem',
          boxSizing: 'border-box',
          textAlign: 'left',
        }}
      >
        <h2 id="cancel-dialog-title" className={styles.title} style={{ textAlign: 'left', margin: '0 0 var(--space-2)' }}>
          Cancel Class Session
        </h2>
        <p
          className={styles.body}
          style={{
            textAlign: 'left',
            margin: '0 0 var(--space-5)',
            lineHeight: 1.5,
            width: '100%',
            maxWidth: '100%',
            minWidth: 0,
            overflowWrap: 'break-word',
            wordBreak: 'normal',
            whiteSpace: 'normal',
            boxSizing: 'border-box',
          }}
        >
          Please specify the reason for cancelling this session. The reason will be recorded on the session history.
        </p>

        <div style={{ marginBottom: 'var(--space-5)', width: '100%' }}>
          <label
            htmlFor="cancellation-reason-input"
            style={{
              display: 'block',
              fontSize: 'var(--font-size-sm)',
              fontWeight: 600,
              marginBottom: '6px',
              color: 'var(--color-text-main)',
              textAlign: 'left',
            }}
          >
            Cancellation Reason <span style={{ color: 'var(--color-danger)' }}>*</span>
          </label>
          <textarea
            id="cancellation-reason-input"
            data-testid="cancellation-reason-input"
            className={formStyles.textarea}
            rows={4}
            value={reason}
            onChange={(e) => {
              setReason(e.target.value);
              if (error && e.target.value.trim()) setError(null);
            }}
            placeholder="e.g. Student ill, Family emergency, Scheduling conflict..."
            disabled={isLoading}
            autoFocus
            style={{ width: '100%', minHeight: '90px', boxSizing: 'border-box', display: 'block' }}
          />
          {error && (
            <span role="alert" style={{ display: 'block', color: 'var(--color-danger)', fontSize: '11px', marginTop: '4px' }}>
              {error}
            </span>
          )}
        </div>

        <div className={styles.actions} style={{ display: 'flex', justifyContent: 'flex-end', gap: 'var(--space-3)', width: '100%' }}>
          <Button variant="secondary" onClick={onCancel} disabled={isLoading}>
            Cancel
          </Button>
          <Button
            variant="danger"
            onClick={handleConfirm}
            isLoading={isLoading}
            disabled={isLoading || isBlank}
            data-testid="confirm-cancel-class-button"
          >
            Confirm Cancellation
          </Button>
        </div>
      </div>
    </div>
  );
};
