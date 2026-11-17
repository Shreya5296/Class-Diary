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
      if (e.key === 'Escape' && !isLoading) {
        onCancel();
      }
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
      <div className={styles.dialog} style={{ maxWidth: '440px', width: '90%' }}>
        <h2 id="cancel-dialog-title" className={styles.title}>
          Cancel Class Session
        </h2>
        <p className={styles.body} style={{ marginBottom: 'var(--space-3)' }}>
          Please specify the reason for cancelling this session. The reason will be recorded on the session history.
        </p>

        <div style={{ marginBottom: 'var(--space-4)' }}>
          <label
            htmlFor="cancellation-reason-input"
            style={{ display: 'block', fontSize: 'var(--font-size-xs)', fontWeight: 600, marginBottom: '4px', color: 'var(--color-text-main)' }}
          >
            Cancellation Reason <span style={{ color: 'var(--color-danger)' }}>*</span>
          </label>
          <textarea
            id="cancellation-reason-input"
            data-testid="cancellation-reason-input"
            className={formStyles.textarea}
            rows={3}
            value={reason}
            onChange={(e) => {
              setReason(e.target.value);
              if (error && e.target.value.trim()) setError(null);
            }}
            placeholder="e.g. Student ill, Family emergency, Scheduling conflict..."
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
