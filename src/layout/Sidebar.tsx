import React from 'react';
import styles from './layout.module.css';
import footerStyles from './sidebarFooter.module.css';
import { useAuth } from '../auth/AuthProvider';
import {
  DashboardIcon,
  CalendarIcon,
  StudentsIcon,
  FeesIcon,
  ClassesIcon,
  SettingsIcon,
} from '../components/icons/NavIcons';
import { CloseIcon, LogOutIcon } from '../components/icons/ActionIcons';
import { useProfileImage } from '../domains/dashboard/useProfileImage';
import { getUserProfileIdentity } from '../auth/userProfileStorage';
import { DashboardLiveClock } from '../domains/dashboard/DashboardLiveClock';

export type NavSection =
  | 'dashboard'
  | 'calendar'
  | 'students'
  | 'finances'
  | 'classes'
  | 'settings'
  | 'fees'
  | 'reports';

export interface SidebarProps {
  activeSection: NavSection;
  onNavigate: (section: NavSection) => void;
  isOpen?: boolean;
  onClose?: () => void;
  profileImage?: string | null;
  initials?: string;
  displayName?: string;
}

const navItems = [
  { id: 'dashboard' as NavSection, label: 'Dashboard', Icon: DashboardIcon },
  { id: 'calendar' as NavSection, label: 'Calendar', Icon: CalendarIcon },
  { id: 'students' as NavSection, label: 'Students', Icon: StudentsIcon },
  { id: 'classes' as NavSection, label: 'Class Schedule', Icon: ClassesIcon },
  { id: 'finances' as NavSection, label: 'Finances', Icon: FeesIcon },
];

export const Sidebar: React.FC<SidebarProps> = ({
  activeSection,
  onNavigate,
  isOpen = true,
  onClose,
  profileImage: propProfileImage,
  initials: propInitials,
  displayName: propDisplayName,
}) => {
  const { user, signOut } = useAuth();
  const fallbackIdentity = getUserProfileIdentity(user?.name, user?.email);
  const displayName = propDisplayName ?? fallbackIdentity.displayName;
  const initials = propInitials ?? fallbackIdentity.initials;
  const hookImage = useProfileImage();
  const profileImage = propProfileImage !== undefined ? propProfileImage : hookImage;

  const handleNav = (section: NavSection) => {
    onNavigate(section);
    if (onClose) onClose();
  };

  return (
    <>
      {isOpen && onClose && (
        <div className={styles.sidebarBackdrop} onClick={onClose} aria-hidden="true" />
      )}
      <aside className={`${styles.sidebar} ${!isOpen ? styles.sidebarClosed : ''}`}>
        <div className={styles.sidebarHeader}>
          <div className={styles.brandWrapper}>
            <span className={styles.brandAccent} aria-hidden="true" />
            <span className={styles.brandTitle}>Class Diary</span>
          </div>
          {onClose && (
            <button type="button" className={styles.menuToggle} onClick={onClose} aria-label="Close sidebar">
              <CloseIcon size={18} />
            </button>
          )}
        </div>

        <nav className={styles.nav} aria-label="Main Navigation">
          {navItems.map(({ id, label, Icon }) => {
            const isActive = activeSection === id;
            return (
              <button
                key={id}
                type="button"
                className={`${styles.navItem} ${isActive ? styles.navItemActive : ''}`}
                onClick={() => handleNav(id)}
              >
                <Icon size={18} />
                <span>{label}</span>
              </button>
            );
          })}
        </nav>

        {user && (
          <div className={footerStyles.sidebarFooter}>
            <div className={footerStyles.userProfileRow}>
              <div className={footerStyles.userAvatar} aria-hidden="true">
                {profileImage ? (
                  <img src={profileImage} alt={displayName} className={footerStyles.userAvatarImg} />
                ) : (
                  initials
                )}
              </div>
              <div className={footerStyles.userInfo}>
                <span className={footerStyles.userName} title={displayName}>{displayName}</span>
                <span className={footerStyles.userEmail}>{user.email || 'Administrator'}</span>
                <DashboardLiveClock variant="sidebar" />
              </div>
            </div>
            <div className={footerStyles.sidebarActions}>
              <button
                type="button"
                className={`${footerStyles.settingsAction} ${activeSection === 'settings' ? footerStyles.settingsActionActive : ''}`}
                onClick={() => handleNav('settings')}
                title="Settings & Regional Preferences"
                aria-label="Settings & Regional Preferences"
              >
                <SettingsIcon size={16} />
              </button>
              <button
                type="button"
                className={footerStyles.logoutAction}
                onClick={signOut}
                title="Log out of session"
                aria-label="Log out of session"
              >
                <LogOutIcon size={16} />
              </button>
            </div>
          </div>
        )}
      </aside>
    </>
  );
};
