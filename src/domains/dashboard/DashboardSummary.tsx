import React from 'react';
import styles from './dashboardSummary.module.css';
import { DashboardOverviewData } from './dashboardTypes';
import { Student } from '../students/studentTypes';
import { DashboardWelcomePanel } from './DashboardWelcomePanel';
import { ActiveStudentsCard } from './ActiveStudentsCard';

export interface DashboardSummaryProps {
  overview: DashboardOverviewData;
  students?: Student[];
  loading?: boolean;
}

export const DashboardSummary: React.FC<DashboardSummaryProps> = ({
  overview,
  students,
  loading = false,
}) => {
  return (
    <section className={styles.container} aria-label="Welcome and Student Overview">
      <DashboardWelcomePanel />
      <ActiveStudentsCard overview={overview} students={students} loading={loading} />
    </section>
  );
};
