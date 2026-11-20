import React from 'react';
import styles from './topBar.module.css';
import { useAuth } from '../auth/AuthProvider';
import { MenuIcon } from '../components/icons/ActionIcons';
import { NavSection } from './Sidebar';
import { useLiveHeaderTime } from './useLiveHeaderTime';
import { resolveDisplayName } from '../auth/userProfileStorage';

export interface TopBarProps {
  activeSection?: NavSection;
  onToggleMenu?: () => void;
  onNavigate?: (section: NavSection) => void;
}

export const TopBar: React.FC<TopBarProps> = ({ activeSection, onToggleMenu }) => {
  const { user } = useAuth();
  const { dateStr, timeStr } = useLiveHeaderTime();
  const displayName = resolveDisplayName(user?.name, user?.email);
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
          <div className={styles.welcomeContainer}>
            <span className={styles.welcomeGreeting}>Welcome back,</span>
            <span className={styles.welcomeName}>{displayName}!</span>
          </div>
        )}
      </div>

      <div className={styles.rightGroup}>
        {!isDashboard && (
          <div className={styles.dateTimeWrapper} aria-label="Current date and time">
            <span className={styles.dateLabel}>{dateStr}</span>
            <span className={styles.dateDot}>•</span>
            <span className={styles.timeValue}>{timeStr}</span>
            <span className={styles.tzBadge}>IST</span>
          </div>
        )}
      </div>
    </header>
  );
};
