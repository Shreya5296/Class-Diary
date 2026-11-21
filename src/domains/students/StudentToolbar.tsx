import React from 'react';
import { Button } from '../../components/buttons/Button';
import { StudentTabs } from './StudentTabs';
import { StudentStatusTab } from './studentStatusClassifier';
import formStyles from '../../components/forms/forms.module.css';
import styles from './studentToolbar.module.css';

export interface StudentToolbarProps {
  searchQuery: string;
  onSearchChange: (query: string) => void;
  activeTab: StudentStatusTab;
  onTabChange: (tab: StudentStatusTab) => void;
  activeCount: number;
  inactiveCount: number;
  allCount: number;
  statusFilter: string;
  onStatusFilterChange: (status: string) => void;
  onRenew: () => void;
  onAddStudent: () => void;
}

export const StudentToolbar: React.FC<StudentToolbarProps> = ({
  searchQuery,
  onSearchChange,
  activeTab,
  onTabChange,
  activeCount,
  inactiveCount,
  allCount,
  statusFilter,
  onStatusFilterChange,
  onRenew,
  onAddStudent,
}) => {
  return (
    <div className={styles.toolbar}>
      <div className={styles.leftGroup}>
        <StudentTabs
          activeTab={activeTab}
          activeCount={activeCount}
          inactiveCount={inactiveCount}
          allCount={allCount}
          onTabChange={onTabChange}
          style={{ flexShrink: 0 }}
        />
      </div>

      <div className={styles.rightGroup}>
        <div className={styles.searchWrapper}>
          <input
            type="text"
            placeholder="Search by student name"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className={`${formStyles.input} ${styles.searchInput}`}
            style={{
              width: '100%',
              height: '38px',
              padding: '0 0.75rem',
              borderRadius: 'var(--radius-md)',
              fontSize: 'var(--font-size-sm)',
              boxSizing: 'border-box',
              textAlign: 'left',
            }}
          />
        </div>

        <select
          value={statusFilter}
          onChange={(e) => onStatusFilterChange(e.target.value)}
          aria-label="Filter students by status"
          className={formStyles.select}
          style={{
            width: 'auto',
            minWidth: '135px',
            height: '38px',
            padding: '0 2rem 0 0.75rem',
            borderRadius: 'var(--radius-md)',
            fontSize: 'var(--font-size-sm)',
            boxSizing: 'border-box',
            flexShrink: 0,
          }}
        >
          <option value="">All Statuses</option>
          <option value="ACTIVE">Active Only</option>
          <option value="INACTIVE">Inactive Only</option>
        </select>

        <div className={styles.actions}>
          <Button
            variant="secondary"
            onClick={onRenew}
            style={{ height: '38px', whiteSpace: 'nowrap', flexShrink: 0 }}
          >
            Renew Package
          </Button>
          <Button
            variant="primary"
            onClick={onAddStudent}
            style={{ height: '38px', whiteSpace: 'nowrap', flexShrink: 0 }}
          >
            + Add Student
          </Button>
        </div>
      </div>
    </div>
  );
};
