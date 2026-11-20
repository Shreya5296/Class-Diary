import React from 'react';
import styles from './attentionSummaryChips.module.css';

export interface AttentionSummaryChipsProps {
  criticalCount: number;
  pendingCount: number;
  upcomingCount: number;
}

export const AttentionSummaryChips: React.FC<AttentionSummaryChipsProps> = ({
  criticalCount,
  pendingCount,
  upcomingCount,
}) => {
  return (
    <div className={styles.chipsContainer} aria-label="Attention issues summary">
      <div className={`${styles.chip} ${criticalCount > 0 ? styles.chipCritical : styles.chipZero}`}>
        <span className={styles.chipDot} />
        <span className={styles.chipLabel}>Critical</span>
        <span className={styles.chipCount}>{criticalCount}</span>
      </div>

      <div className={`${styles.chip} ${pendingCount > 0 ? styles.chipPending : styles.chipZero}`}>
        <span className={styles.chipDot} />
        <span className={styles.chipLabel}>Pending</span>
        <span className={styles.chipCount}>{pendingCount}</span>
      </div>

      <div className={`${styles.chip} ${upcomingCount > 0 ? styles.chipUpcoming : styles.chipZero}`}>
        <span className={styles.chipDot} />
        <span className={styles.chipLabel}>Upcoming</span>
        <span className={styles.chipCount}>{upcomingCount}</span>
      </div>
    </div>
  );
};
