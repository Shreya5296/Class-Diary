import React from 'react';
import styles from './dashboardLiveClock.module.css';
import { useLiveHeaderTime } from '../../layout/useLiveHeaderTime';

export interface DashboardLiveClockProps {
  className?: string;
  variant?: 'pill' | 'sidebar';
}

export const DashboardLiveClock: React.FC<DashboardLiveClockProps> = ({
  className,
  variant = 'pill',
}) => {
  const { dateStr, timeStr, tzAbbr = 'IST' } = useLiveHeaderTime();

  if (variant === 'sidebar') {
    return (
      <div
        className={`${styles.sidebarClock} ${className || ''}`}
        aria-label="Current date, time, and timezone"
      >
        <span className={styles.sidebarClockDate}>{dateStr}</span>
        <div className={styles.sidebarClockTimeRow}>
          <span className={styles.sidebarClockTime}>{timeStr}</span>
          <span className={styles.sidebarClockTz}>{tzAbbr}</span>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`${styles.liveClockPill} ${className || ''}`}
      aria-label="Current date, time, and timezone"
    >
      <span className={styles.liveDate}>{dateStr}</span>
      <span className={styles.dotSeparator}>•</span>
      <span className={styles.liveTime}>{timeStr}</span>
      <span className={styles.tzBadge}>{tzAbbr}</span>
    </div>
  );
};
