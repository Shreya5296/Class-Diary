import React from 'react';
import styles from './dashboardLiveClock.module.css';
import { useLiveHeaderTime } from '../../layout/useLiveHeaderTime';

export const DashboardLiveClock: React.FC = () => {
  const { dateStr, timeStr } = useLiveHeaderTime();

  return (
    <div className={styles.liveClockPill} aria-label="Current date, time, and timezone">
      <span className={styles.liveDate}>{dateStr}</span>
      <span className={styles.dotSeparator}>•</span>
      <span className={styles.liveTime}>{timeStr}</span>
      <span className={styles.tzBadge}>IST</span>
    </div>
  );
};
