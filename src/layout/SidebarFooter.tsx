import React from 'react';
import footerStyles from './sidebarFooter.module.css';
import { AuthUser } from '../auth/authState';
import { NavSection } from './Sidebar';
import { SettingsIcon } from '../components/icons/NavIcons';
import { LogOutIcon } from '../components/icons/ActionIcons';
import { DashboardLiveClock } from '../domains/dashboard/DashboardLiveClock';

export interface SidebarFooterProps {
  user: AuthUser;
  profileImage?: string | null;
  displayName: string;
  initials: string;
  activeSection: NavSection;
  isCollapsed: boolean;
  onNavigate: (section: NavSection) => void;
  onSignOut: () => void;
}

export const SidebarFooter: React.FC<SidebarFooterProps> = ({
  user,
  profileImage,
  displayName,
  initials,
  activeSection,
  isCollapsed,
  onNavigate,
  onSignOut,
}) => {
  return (
    <div className={`${footerStyles.sidebarFooter} ${isCollapsed ? footerStyles.sidebarFooterCollapsed : ''}`}>
      <div className={footerStyles.userProfileRow} title={displayName}>
        <div className={footerStyles.userAvatar} aria-hidden="true">
          {profileImage ? (
            <img src={profileImage} alt={displayName} className={footerStyles.userAvatarImg} />
          ) : (
            initials
          )}
        </div>
        <div className={`${footerStyles.userInfo} ${isCollapsed ? footerStyles.userInfoCollapsed : ''}`}>
          <span className={footerStyles.userName} title={displayName}>{displayName}</span>
          <span className={footerStyles.userEmail}>{user.email || 'Administrator'}</span>
          <DashboardLiveClock variant="sidebar" />
        </div>
      </div>
      <div className={`${footerStyles.sidebarActions} ${isCollapsed ? footerStyles.sidebarActionsCollapsed : ''}`}>
        <button
          type="button"
          className={`${footerStyles.settingsAction} ${activeSection === 'settings' ? footerStyles.settingsActionActive : ''}`}
          onClick={() => onNavigate('settings')}
          title="Settings & Regional Preferences"
          aria-label="Settings & Regional Preferences"
        >
          <SettingsIcon size={16} />
        </button>
        <button
          type="button"
          className={footerStyles.logoutAction}
          onClick={onSignOut}
          title="Log out of session"
          aria-label="Log out of session"
        >
          <LogOutIcon size={16} />
        </button>
      </div>
    </div>
  );
};
