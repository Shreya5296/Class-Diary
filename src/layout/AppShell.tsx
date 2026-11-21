import React, { useState } from 'react';
import styles from './layout.module.css';
import { Sidebar, NavSection } from './Sidebar';
import { TopBar } from './TopBar';
import { SchedulingProgressToast } from '../components/feedback/SchedulingProgressToast';
import { useAuth } from '../auth/AuthProvider';
import { getUserProfileIdentity } from '../auth/userProfileStorage';
import { useProfileImage } from '../domains/dashboard/useProfileImage';

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
      />
      <div className={styles.mainArea}>
        <TopBar
          activeSection={activeSection}
          onToggleMenu={() => setMobileMenuOpen((open) => !open)}
          onNavigate={onNavigate}
          profileImage={profileImage}
          initials={initials}
          displayName={displayName}
        />
        <main className={styles.content}>{children}</main>
        <SchedulingProgressToast />
      </div>
    </div>
  );
};
