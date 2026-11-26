import React, { useState, useEffect } from 'react';
import styles from '../../components/overlays/confirmDialog.module.css';
import { Button } from '../../components/buttons/Button';
import { formatDate } from '../../lib/dateFormat';
import { generatePackageClasses, GeneratePackageClassesResult } from './packageClassGeneratorApi';
import { invalidateAppData } from '../../context/AppDataContext';

export interface GeneratePackageClassesModalProps {
  isOpen: boolean;
  studentId: string;
  studentName?: string;
  token?: string | null;
  onClose: () => void;
  onGenerated: () => void;
}

export const GeneratePackageClassesModal: React.FC<GeneratePackageClassesModalProps> = ({
  isOpen, studentId, studentName, token, onClose, onGenerated,
}) => {
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [preview, setPreview] = useState<GeneratePackageClassesResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [executing, setExecuting] = useState(false);

  useEffect(() => {
    if (!isOpen || !studentId) {
      setPreview(null);
      setError(null);
      return;
    }
    let cancelled = false;
    setLoadingPreview(true);
    setError(null);

    generatePackageClasses(studentId, token, { dryRun: true })
      .then((res) => {
        if (!cancelled) setPreview(res);
      })
      .catch((err: unknown) => {
        if (!cancelled) setError((err as Error)?.message || 'Failed to check package schedule');
      })
      .finally(() => {
        if (!cancelled) setLoadingPreview(false);
      });

    return () => { cancelled = true; };
  }, [isOpen, studentId, token]);

  if (!isOpen) return null;

  const handleConfirm = async () => {
    setExecuting(true);
    setError(null);
    try {
      await generatePackageClasses(studentId, token);
      invalidateAppData('dashboard');
      onGenerated();
      onClose();
    } catch (err: unknown) {
      setError((err as Error)?.message || 'Failed to generate package classes');
    } finally {
      setExecuting(false);
    }
  };

  const count = preview?.count ?? 0;
  const lastDate = preview?.lastClassDate;

  return (
    <div className={styles.overlay} role="presentation">
      <div className={styles.dialog} role="dialog" aria-modal="true" aria-labelledby="generate-classes-title">
        <h3 id="generate-classes-title" className={styles.title}>
          Generate Package Classes
        </h3>

        {loadingPreview && (
          <p className={styles.message} style={{ color: 'var(--color-text-muted)' }}>
            Checking student package schedule and existing classes…
          </p>
        )}

        {error && (
          <div role="alert" style={{ color: 'var(--color-danger, #ef4444)', fontSize: 'var(--font-size-sm)', margin: 'var(--space-3) 0' }}>
            {error}
          </div>
        )}

        {!loadingPreview && preview && count === 0 && (
          <div className={styles.message}>
            <p style={{ margin: '0 0 var(--space-2) 0' }}>
              <strong>0 new classes to create.</strong>
            </p>
            <p style={{ margin: 0, color: 'var(--color-text-muted)', fontSize: 'var(--font-size-sm)' }}>
              All package classes ({preview.totalPurchased ?? preview.existingCount ?? 'all'}) are already scheduled in the system. Nothing will be duplicated.
            </p>
          </div>
        )}

        {!loadingPreview && preview && count > 0 && (
          <div className={styles.message}>
            <p style={{ margin: '0 0 var(--space-3) 0' }}>
              Generate dated class sessions for <strong>{studentName || 'this student'}</strong> according to their package schedule:
            </p>
            <div style={{ backgroundColor: 'var(--color-bg-subtle)', padding: 'var(--space-3)', borderRadius: 'var(--radius-md)', fontSize: 'var(--font-size-sm)', marginBottom: 'var(--space-3)' }}>
              <div>Classes to create: <strong style={{ color: 'var(--color-primary)' }}>{count} classes</strong></div>
              {lastDate && (
                <div style={{ marginTop: '4px' }}>
                  Last class date: <strong>{formatDate(lastDate)}</strong>
                </div>
              )}
            </div>
            <p style={{ margin: 0, fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)' }}>
              Classes will be created as Scheduled (deduct class: false). Existing classes will not be duplicated.
            </p>
          </div>
        )}

        <div className={styles.actions}>
          <Button variant="ghost" size="sm" onClick={onClose} disabled={executing}>
            Cancel
          </Button>
          {count > 0 && (
            <Button variant="primary" size="sm" onClick={handleConfirm} disabled={executing || loadingPreview}>
              {executing ? 'Generating…' : `Confirm & Generate (${count})`}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
};
