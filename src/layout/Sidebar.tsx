import React, { useState } from 'react';
import styles from './layout.module.css';
import { useAuth } from '../auth/AuthProvider';
import {
  DashboardIcon,
  CalendarIcon,
  StudentsIcon,
  FeesIcon,
  ClassesIcon,
} from '../components/icons/NavIcons';
import { CloseIcon, ChevronLeftIcon, ChevronRightIcon } from '../components/icons/ActionIcons';
import { useProfileImage } from '../domains/dashboard/useProfileImage';
import { getUserProfileIdentity } from '../auth/userProfileStorage';
import { SidebarFooter } from './SidebarFooter';

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
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
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
  isCollapsed: propIsCollapsed,
  onToggleCollapse,
}) => {
  const { user, signOut } = useAuth();
  const fallbackIdentity = getUserProfileIdentity(user?.name, user?.email);
  const displayName = propDisplayName ?? fallbackIdentity.displayName;
  const initials = propInitials ?? fallbackIdentity.initials;
  const hookImage = useProfileImage();
  const profileImage = propProfileImage !== undefined ? propProfileImage : hookImage;

  const [internalCollapsed, setInternalCollapsed] = useState(false);
  const isCollapsed = propIsCollapsed !== undefined ? propIsCollapsed : internalCollapsed;

  const handleToggle = () => {
    if (onToggleCollapse) {
      onToggleCollapse();
    } else {
      setInternalCollapsed((prev) => !prev);
    }
  };

  const handleNav = (section: NavSection) => {
    onNavigate(section);
    if (onClose) onClose();
  };

  return (
    <>
      {isOpen && onClose && (
        <div className={styles.sidebarBackdrop} onClick={onClose} aria-hidden="true" />
      )}
      <aside className={`${styles.sidebar} ${!isOpen ? styles.sidebarClosed : ''} ${isCollapsed ? styles.sidebarCollapsed : ''}`}>
        <div className={styles.sidebarHeader}>
          <div className={styles.brandWrapper}>
            <span className={styles.brandAccent} aria-hidden="true" />
            <span className={styles.brandTitle}>Class Diary</span>
          </div>
          <button
            type="button"
            className={styles.desktopCollapseToggle}
            onClick={handleToggle}
            aria-label={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            title={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {isCollapsed ? <ChevronRightIcon size={16} /> : <ChevronLeftIcon size={16} />}
          </button>
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
                title={label}
                aria-label={label}
              >
                <Icon size={18} />
                <span className={styles.navLabel}>{label}</span>
              </button>
            );
          })}
        </nav>

        {user && (
          <SidebarFooter
            user={user}
            profileImage={profileImage}
            displayName={displayName}
            initials={initials}
            activeSection={activeSection}
            isCollapsed={isCollapsed}
            onNavigate={handleNav}
            onSignOut={signOut}
          />
        )}
      </aside>
    </>
  );
};
