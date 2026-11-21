import React from 'react';
import styles from './topBar.module.css';
import { useAuth } from '../auth/AuthProvider';
import { MenuIcon } from '../components/icons/ActionIcons';
import { NavSection } from './Sidebar';
import { getUserProfileIdentity } from '../auth/userProfileStorage';
import { useProfileImage } from '../domains/dashboard/useProfileImage';
import { DashboardLiveClock } from '../domains/dashboard/DashboardLiveClock';

export interface TopBarProps {
  activeSection?: NavSection;
  onToggleMenu?: () => void;
  onNavigate?: (section: NavSection) => void;
  profileImage?: string | null;
  initials?: string;
  displayName?: string;
}

export const TopBar: React.FC<TopBarProps> = ({
  activeSection,
  onToggleMenu,
  profileImage: propProfileImage,
  initials: propInitials,
  displayName: propDisplayName,
}) => {
  const { user } = useAuth();
  const fallbackIdentity = getUserProfileIdentity(user?.name, user?.email);
  const displayName = propDisplayName ?? fallbackIdentity.displayName;
  const initials = propInitials ?? fallbackIdentity.initials;
  const hookImage = useProfileImage();
  const profileImage = propProfileImage !== undefined ? propProfileImage : hookImage;
  const isDashboard = activeSection === 'dashboard';

  return (
    <header className={`${styles.topBar} ${isDashboard ? styles.topBarDashboard : ''}`}>
      <div className={styles.leftGroup}>
        {onToggleMenu && (
          <button
            type="button"
            className={styles.menuToggle}
            onClick={onToggleMenu}
            aria-label="Toggle navigation menu"
          >
            <MenuIcon size={20} />
          </button>
        )}

        {!isDashboard && (
          <div className={styles.welcomeBanner}>
            <div className={styles.avatarContainer}>
              <div className={styles.avatarCircle} aria-hidden="true">
                {profileImage ? (
                  <img src={profileImage} alt={displayName} className={styles.avatarImg} />
                ) : (
                  <span className={styles.avatarInitials}>{initials}</span>
                )}
              </div>
            </div>

            <div className={styles.contentColumn}>
              <div className={styles.greetingGroup}>
                <span className={styles.welcomeGreeting}>Welcome back,</span>
                <span className={styles.welcomeName}>{displayName}!</span>
              </div>
              <p className={styles.supportingText}>Here&apos;s what&apos;s happening today.</p>
            </div>
          </div>
        )}
      </div>

      <div className={styles.rightGroup}>
        {!isDashboard && (
          <div className={styles.clockRow}>
            <DashboardLiveClock />
          </div>
        )}
      </div>
    </header>
  );
};
