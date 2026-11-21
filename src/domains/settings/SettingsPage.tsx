import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../auth/AuthProvider';
import { usePageTitle } from '../../hooks/usePageTitle';
import { PageHeader } from '../../layout/PageHeader';
import { Button } from '../../components/buttons/Button';
import { InlineNotice } from '../../components/feedback/InlineNotice';
import { AdminProfileCard } from './AdminProfileCard';
import { RegionalPreferencesCard } from './RegionalPreferencesCard';
import { useProfileImage } from '../dashboard/useProfileImage';
import { saveStoredProfileImage, deleteStoredProfileImage } from '../dashboard/profileImageStorage';
import { ProfilePictureModal } from '../dashboard/ProfilePictureModal';
import { getSavedTimezone, saveTimezone, getSavedCurrency, saveCurrency } from '../../lib/userPreferences';

function getInitials(name?: string, email?: string): string {
  if (name && name.trim()) {
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
    return name.slice(0, 2).toUpperCase();
  }
  if (email && email.trim()) return email.slice(0, 2).toUpperCase();
  return 'AA';
}

export const SettingsPage: React.FC = () => {
  usePageTitle('Profile & Preferences');
  const { user, updateDisplayName } = useAuth();
  const profileImage = useProfileImage();

  const [nameInput, setNameInput] = useState(user?.name || '');
  const [timezone, setTimezone] = useState(getSavedTimezone());
  const [currency, setCurrency] = useState(getSavedCurrency());
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isPhotoModalOpen, setIsPhotoModalOpen] = useState(false);

  useEffect(() => {
    if (user?.name) setNameInput(user.name);
  }, [user?.name]);

  const initialName = user?.name || '';
  const initialTz = getSavedTimezone();
  const initialCur = getSavedCurrency();
  const isUnchanged = nameInput.trim() === initialName && timezone === initialTz && currency === initialCur;

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = nameInput.trim();
    if (!trimmed) {
      setErrorMessage('Display name cannot be empty.');
      return;
    }
    setErrorMessage(null);
    let updated = false;
    if (trimmed !== initialName) {
      updateDisplayName(trimmed);
      updated = true;
    }
    if (timezone !== initialTz || currency !== initialCur) {
      saveTimezone(timezone);
      saveCurrency(currency);
      updated = true;
    }
    if (updated) {
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3500);
    }
  };

  const handleSaveImage = useCallback(async (dataUrl: string) => {
    await saveStoredProfileImage(dataUrl);
  }, []);

  const handleRemoveImage = useCallback(async () => {
    await deleteStoredProfileImage();
  }, []);

  const initials = getInitials(nameInput, user?.email);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-5)', width: '100%' }}>
      <PageHeader title="Profile & Preferences" />

      {saveSuccess && (
        <InlineNotice type="success" message="Settings saved successfully." onDismiss={() => setSaveSuccess(false)} />
      )}
      {errorMessage && (
        <InlineNotice type="danger" message={errorMessage} onDismiss={() => setErrorMessage(null)} />
      )}

      <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-5)', width: '100%' }}>
        <div style={{
          display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
          gap: 'var(--space-5)', alignItems: 'start', width: '100%',
        }}>
          <AdminProfileCard
            name={nameInput}
            onNameChange={(val) => { setNameInput(val); setSaveSuccess(false); setErrorMessage(null); }}
            email={user?.email || 'ashreya0502@gmail.com'}
            profileImage={profileImage}
            initials={initials}
            onOpenPhotoModal={() => setIsPhotoModalOpen(true)}
            onRemovePhoto={handleRemoveImage}
          />
          <RegionalPreferencesCard
            timezone={timezone}
            onTimezoneChange={(val) => { setTimezone(val); setSaveSuccess(false); setErrorMessage(null); }}
            currency={currency}
            onCurrencyChange={(val) => { setCurrency(val); setSaveSuccess(false); setErrorMessage(null); }}
          />
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-start', paddingTop: 'var(--space-2)' }}>
          <Button type="submit" variant="primary" disabled={isUnchanged || !nameInput.trim()} style={{ height: '38px', minWidth: '140px' }}>
            Save Changes
          </Button>
        </div>
      </form>

      <ProfilePictureModal
        isOpen={isPhotoModalOpen}
        onClose={() => setIsPhotoModalOpen(false)}
        currentImage={profileImage}
        initials={initials}
        onSave={handleSaveImage}
        onRemove={handleRemoveImage}
      />
    </div>
  );
};
