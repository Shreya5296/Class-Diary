import React, { useState } from 'react';
import { ClassSession } from './classTypes';
import { updateSessionNotes } from './classApi';
import { FormField } from '../../components/forms/FormField';
import { Button } from '../../components/buttons/Button';
import formStyles from '../../components/forms/forms.module.css';

export interface EditSessionNotesModalProps {
  session: ClassSession;
  token?: string | null;
  isOpen: boolean;
  onClose: () => void;
  onSaved: () => Promise<void>;
}

export const EditSessionNotesModal: React.FC<EditSessionNotesModalProps> = ({
  session,
  token,
  isOpen,
  onClose,
  onSaved,
}) => {
  const initialNotes = session.session_notes || session.notes || '';
  const [notes, setNotes] = useState(initialNotes);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setError(null);
    try {
      await updateSessionNotes(session.session_id, notes.trim(), token);
      await onSaved();
      onClose();
    } catch (err: unknown) {
      setError((err as Error).message || 'Failed to save session notes');
    } finally {
      setIsSaving(false);
    }
  };

  const handleClear = () => {
    setNotes('');
  };

  const dateStr = session.schedule_date || session.class_date || '';
  const timeStr = session.schedule_time || session.start_time || '';

  return (
    <div
      style={{
        position: 'fixed',
        top: 0, left: 0, right: 0, bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.45)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
        padding: '1rem',
      }}
      onClick={onClose}
    >
      <div
        style={{
          backgroundColor: 'var(--color-bg-surface)',
          borderRadius: 'var(--radius-xl)',
          border: '1px solid var(--color-border-subtle)',
          boxShadow: 'var(--shadow-lg)',
          width: '100%',
          maxWidth: '520px',
          padding: '1.5rem',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
          <div>
            <h3 style={{ margin: 0, fontSize: '1.125rem', fontWeight: 700, color: 'var(--color-text-main)' }}>
              Session Notes
            </h3>
            <p style={{ margin: '4px 0 0', fontSize: '12px', color: 'var(--color-text-muted)' }}>
              {session.student_name || session.student_id} • {dateStr} {timeStr}
            </p>
          </div>
          <Button variant="ghost" size="sm" onClick={onClose} aria-label="Close modal">✕</Button>
        </div>

        {error && (
          <div style={{ marginBottom: '12px', padding: '8px 12px', backgroundColor: 'var(--color-danger-bg)', border: '1px solid var(--color-danger-border)', borderRadius: 'var(--radius-md)', color: 'var(--color-danger-text)', fontSize: 'var(--font-size-xs)' }}>
            ⚠️ {error}
          </div>
        )}

        <form onSubmit={handleSave}>
          <FormField label="Session Notes">
            <textarea
              className={formStyles.textarea}
              style={{ width: '100%', minHeight: '120px', resize: 'vertical' }}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Record lesson coverage, story/topic covered, concept remarks, or contextual cancellation reasons..."
              disabled={isSaving}
              aria-label="Session Notes"
            />
          </FormField>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '1.25rem' }}>
            <Button
              variant="outline"
              size="sm"
              type="button"
              onClick={handleClear}
              disabled={isSaving || !notes}
            >
              Clear Notes
            </Button>
            <div style={{ display: 'flex', gap: '8px' }}>
              <Button variant="secondary" size="sm" type="button" onClick={onClose} disabled={isSaving}>
                Cancel
              </Button>
              <Button variant="primary" size="sm" type="submit" isLoading={isSaving}>
                Save Notes
              </Button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
