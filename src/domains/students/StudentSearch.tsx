import React from 'react';
import { SearchIcon } from '../../components/icons/ActionIcons';
import formStyles from '../../components/forms/forms.module.css';

export interface StudentSearchProps {
  query: string;
  statusFilter: string;
  onQueryChange: (query: string) => void;
  onStatusFilterChange: (status: string) => void;
}

export const StudentSearch: React.FC<StudentSearchProps> = ({
  query,
  statusFilter,
  onQueryChange,
  onStatusFilterChange,
}) => {
  return (
    <div
      style={{
        display: 'flex',
        gap: 'var(--space-2)',
        alignItems: 'center',
        flex: '1 1 280px',
        minWidth: '240px',
      }}
    >
      <div style={{ position: 'relative', flex: 1, minWidth: '160px' }}>
        <div
          style={{
            position: 'absolute',
            left: '12px',
            top: '50%',
            transform: 'translateY(-50%)',
            color: 'var(--color-text-subtle)',
            display: 'flex',
            alignItems: 'center',
            pointerEvents: 'none',
          }}
        >
          <SearchIcon size={16} />
        </div>
        <input
          type="text"
          placeholder="Search by student name"
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
          className={formStyles.input}
          style={{
            width: '100%',
            height: '38px',
            padding: '0 0.75rem 0 2.25rem',
            borderRadius: 'var(--radius-md)',
            fontSize: 'var(--font-size-sm)',
            boxSizing: 'border-box',
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
          minWidth: '140px',
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
    </div>
  );
};
