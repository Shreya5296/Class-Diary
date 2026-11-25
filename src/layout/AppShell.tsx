import React, { useState } from 'react';
import styles from './layout.module.css';
import { Sidebar, NavSection } from './Sidebar';
import { MenuIcon } from '../components/icons/ActionIcons';
import { SchedulingProgressToast } from '../components/feedback/SchedulingProgressToast';
import { useAuth } from '../auth/AuthProvider';
import { getUserProfileIdentity } from '../auth/userProfileStorage';
import { useProfileImage } from '../domains/dashboard/useProfileImage';

const SIDEBAR_COLLAPSED_KEY = 'classdiary_sidebar_collapsed';

export interface AppShellProps {
  activeSection: NavSection;
  onNavigate: (section: NavSection) => void;
  children: React.ReactNode;
}

export const AppShell: React.FC<AppShellProps> = ({
  activeSection,
  onNavigate,
  children,
}) => {
  const { user } = useAuth();
  const profileImage = useProfileImage();
  const { displayName, initials } = getUserProfileIdentity(user?.name, user?.email);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState<boolean>(() => {
    try {
      return localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === 'true';
    } catch {
      return false;
    }
  });

  const toggleCollapse = () => {
    setIsCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(SIDEBAR_COLLAPSED_KEY, String(next));
      } catch {
        // Safe fallback in restricted environments
      }
      return next;
    });
  };

  return (
    <div className={styles.shell}>
      <Sidebar
        activeSection={activeSection}
        onNavigate={onNavigate}
        isOpen={mobileMenuOpen}
        onClose={() => setMobileMenuOpen(false)}
        profileImage={profileImage}
        initials={initials}
        displayName={displayName}
        isCollapsed={isCollapsed}
        onToggleCollapse={toggleCollapse}
      />
      <div className={styles.mainArea}>
        <button
          type="button"
          className={styles.mobileMenuToggle}
          onClick={() => setMobileMenuOpen(true)}
          aria-label="Toggle navigation menu"
        >
          <MenuIcon size={20} />
        </button>
        <main className={styles.content}>{children}</main>
        <SchedulingProgressToast />
      </div>
    </div>
  );
};
