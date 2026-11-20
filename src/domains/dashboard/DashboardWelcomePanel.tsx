import React, { useState, useCallback } from 'react';
import styles from './dashboardWelcomePanel.module.css';
import { useAuth } from '../../auth/AuthProvider';
import { resolveDisplayName } from '../../auth/userProfileStorage';
import { saveStoredProfileImage, deleteStoredProfileImage } from './profileImageStorage';
import { useProfileImage } from './useProfileImage';
import { ProfilePictureModal } from './ProfilePictureModal';
import { DashboardLiveClock } from './DashboardLiveClock';

function extractInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
  if (parts.length === 1 && parts[0].length >= 1) return parts[0].slice(0, 2).toUpperCase();
  return 'AD';
}

export const DashboardWelcomePanel: React.FC = () => {
  const { user } = useAuth();
  const displayName = resolveDisplayName(user?.name, user?.email);
  const initials = extractInitials(displayName);

  const profileImage = useProfileImage();
  const [isModalOpen, setIsModalOpen] = useState(false);

  const handleOpenModal = useCallback((e?: React.MouseEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    setIsModalOpen(true);
  }, []);

  const handleCloseModal = useCallback(() => {
    setIsModalOpen(false);
  }, []);

  const handleSaveImage = useCallback(async (dataUrl: string) => {
    await saveStoredProfileImage(dataUrl);
  }, []);

  const handleRemoveImage = useCallback(async () => {
    await deleteStoredProfileImage();
  }, []);

  return (
    <div className={styles.welcomeCard}>
      <div className={styles.welcomeBody}>
        {/* LEFT COLUMN: Profile picture & camera edit control */}
        <div className={styles.avatarContainer}>
          <button
            type="button"
            className={styles.avatarCircle}
            onClick={handleOpenModal}
            aria-label="View or change profile picture"
          >
            {profileImage ? (
              <img src={profileImage} alt={displayName} className={styles.avatarImg} />
            ) : (
              <span className={styles.avatarInitials}>{initials}</span>
            )}
          </button>
          <button
            type="button"
            className={styles.avatarEditBtn}
            onClick={handleOpenModal}
            aria-label="Edit profile picture"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
            </svg>
          </button>
        </div>

        {/* RIGHT COLUMN: Greeting, Subtitle, and Date/Time pill */}
        <div className={styles.contentColumn}>
          <div className={styles.greetingGroup}>
            <h2 className={styles.greetingTitle}>
              Welcome back, <span className={styles.userName}>{displayName}!</span>
            </h2>
            <p className={styles.supportingText}>Here&apos;s what&apos;s happening today.</p>
          </div>

          <div className={styles.clockRow}>
            <DashboardLiveClock />
          </div>
        </div>
      </div>

      <ProfilePictureModal
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        currentImage={profileImage}
        initials={initials}
        onSave={handleSaveImage}
        onRemove={handleRemoveImage}
      />
    </div>
  );
};
