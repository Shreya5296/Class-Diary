import React from 'react';
import styles from './activeStudentsCard.module.css';
import { DashboardOverviewData } from './dashboardTypes';
import { Student } from '../students/studentTypes';
import { StudentsIcon } from '../../components/icons/NavIcons';

export interface ActiveStudentsCardProps {
  overview: DashboardOverviewData;
  students?: Student[];
  loading?: boolean;
}

const CIRCUMFERENCE = 150.8;

export const ActiveStudentsCard: React.FC<ActiveStudentsCardProps> = ({
  overview,
  students,
  loading = false,
}) => {
  const isDataLoading = loading || students === undefined;
  let activeStudents = 0, totalStudents = 0, pct = 0;

  if (!isDataLoading && students) {
    totalStudents = students.length;
    const activeFromList = students.filter((s) => (s.status || 'ACTIVE').toUpperCase() === 'ACTIVE').length;
    const rawActive = overview.activeStudentsCount !== undefined ? overview.activeStudentsCount : activeFromList;
    activeStudents = totalStudents > 0 ? Math.min(Math.max(0, rawActive), totalStudents) : 0;
    pct = totalStudents > 0 ? Math.min(100, Math.max(0, Math.round((activeStudents / totalStudents) * 100))) : 0;
  }

  const strokeOffset = isDataLoading || totalStudents === 0 ? CIRCUMFERENCE : Math.max(0, CIRCUMFERENCE - (CIRCUMFERENCE * pct) / 100);

  return (
    <div className={styles.featuredCard}>
      <div className={styles.featuredHeader}>
        <span className={styles.featuredLabel}>Active Students</span>
        <div className={styles.featuredIconWrapper}><StudentsIcon size={16} /></div>
      </div>

      <div className={styles.featuredBody}>
        <div className={styles.featuredMetricGroup}>
          {isDataLoading ? (
            <div className={styles.skeletonFeaturedRatio} aria-label="Loading student ratio" />
          ) : (
            <div className={styles.ratioValueWrapper}>
              <span className={styles.featuredValue}>{activeStudents.toLocaleString()}</span>
              <span className={styles.featuredTotal}>/ {totalStudents.toLocaleString()}</span>
            </div>
          )}
          <p className={styles.featuredSubtext}>
            {totalStudents === 0 ? 'No registered students yet' : `${pct}% of total students are active`}
          </p>
        </div>

        <div className={styles.ringWrapper} aria-hidden="true">
          <svg className={styles.ringSvg} width="58" height="58" viewBox="0 0 58 58">
            <circle className={styles.ringBg} cx="29" cy="29" r="24" />
            <circle
              className={styles.ringFill}
              cx="29"
              cy="29"
              r="24"
              style={{ strokeDasharray: CIRCUMFERENCE, strokeDashoffset: strokeOffset }}
            />
          </svg>
          <span className={styles.ringText}>{isDataLoading ? '—' : `${pct}%`}</span>
        </div>
      </div>
    </div>
  );
};
