import React, { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import styles from './profilePictureModal.module.css';
import { validateImageFile } from './profileImageStorage';
import { Button } from '../../components/buttons/Button';

export interface ProfilePictureModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentImage: string | null;
  initials: string;
  onSave: (dataUrl: string) => Promise<void>;
  onRemove: () => Promise<void>;
}

export const ProfilePictureModal: React.FC<ProfilePictureModalProps> = ({
  isOpen, onClose, currentImage, initials, onSave, onRemove,
}) => {
  const [previewUrl, setPreviewUrl] = useState<string | null>(currentImage);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setPreviewUrl(currentImage);
      setErrorMessage(null);
      setSaving(false);
    }
  }, [currentImage, isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.stopPropagation(); onClose(); }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  const handleBackdropClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) onClose();
  }, [onClose]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const check = validateImageFile(file);
    if (!check.valid) {
      setErrorMessage(check.error || 'Invalid file');
      return;
    }
    setErrorMessage(null);
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') setPreviewUrl(reader.result);
    };
    reader.readAsDataURL(file);
  };

  const triggerFileInput = (e: React.MouseEvent) => {
    e.preventDefault(); e.stopPropagation();
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
      fileInputRef.current.click();
    }
  };

  const handleSave = async (e: React.MouseEvent) => {
    e.preventDefault(); e.stopPropagation();
    if (!previewUrl || previewUrl === currentImage) { onClose(); return; }
    setSaving(true);
    try { await onSave(previewUrl); onClose(); } finally { setSaving(false); }
  };

  const handleRemove = async (e: React.MouseEvent) => {
    e.preventDefault(); e.stopPropagation();
    setSaving(true);
    try { await onRemove(); setPreviewUrl(null); onClose(); } finally { setSaving(false); }
  };

  if (!isOpen || typeof document === 'undefined') return null;
  const isDirty = Boolean(previewUrl && previewUrl !== currentImage);

  return createPortal(
    <div className={styles.backdrop} role="dialog" aria-modal="true" aria-labelledby="picModalTitle" onClick={handleBackdropClick}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.modalHeader}>
          <h3 id="picModalTitle" className={styles.modalTitle}>Change Profile Picture</h3>
          <button type="button" className={styles.closeBtn} onClick={onClose} aria-label="Close modal">×</button>
        </div>

        <div className={styles.previewArea}>
          <div className={styles.previewCircle}>
            {previewUrl ? (
              <img src={previewUrl} alt="Profile preview" className={styles.previewImg} />
            ) : (
              <span className={styles.initialsFallback}>{initials}</span>
            )}
          </div>
          <p className={styles.previewHelp}>PNG, JPG, or WebP up to 5 MB.</p>
          {errorMessage && <div className={styles.errorMessage}>{errorMessage}</div>}
          <input
            ref={fileInputRef} type="file" accept="image/png, image/jpeg, image/jpg, image/webp"
            style={{ display: 'none' }} onChange={handleFileChange}
          />
          <Button variant="secondary" size="sm" onClick={triggerFileInput}>
            {previewUrl ? 'Choose Different Image' : 'Select Image File'}
          </Button>
        </div>

        <div className={styles.actionsRow}>
          {currentImage && (
            <button type="button" className={styles.removeBtn} onClick={handleRemove} disabled={saving}>
              Remove Picture
            </button>
          )}
          <Button variant="secondary" size="sm" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button variant="primary" size="sm" onClick={handleSave} disabled={!isDirty || saving}>
            {saving ? 'Saving…' : 'Apply Picture'}
          </Button>
        </div>
      </div>
    </div>,
    document.body
  );
};
