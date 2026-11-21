import React from 'react';
import { StudentStatusTab } from './studentStatusClassifier';

export interface StudentTabsProps {
  activeTab: StudentStatusTab;
  allCount: number;
  activeCount: number;
  inactiveCount: number;
  onTabChange: (tab: StudentStatusTab) => void;
  style?: React.CSSProperties;
}

const tabContainerStyle: React.CSSProperties = {
  display: 'flex',
  gap: 'var(--space-1)',
  alignItems: 'center',
};

const getTabStyle = (isSelected: boolean): React.CSSProperties => ({
  height: '38px',
  padding: '0 12px',
  background: 'none',
  border: 'none',
  borderBottom: isSelected ? '2px solid var(--color-primary)' : '2px solid transparent',
  color: isSelected ? 'var(--color-primary)' : 'var(--color-text-muted)',
  fontWeight: isSelected ? 600 : 500,
  fontSize: 'var(--font-size-sm)',
  cursor: 'pointer',
  transition: 'color 140ms ease, border-color 140ms ease, background-color 140ms ease',
  outline: 'none',
  display: 'inline-flex',
  alignItems: 'center',
  gap: '6px',
  borderRadius: 'var(--radius-sm) var(--radius-sm) 0 0',
  whiteSpace: 'nowrap',
  boxSizing: 'border-box',
});

const countBadgeStyle: React.CSSProperties = {
  fontSize: '11px',
  padding: '1px 6px',
  borderRadius: '10px',
  backgroundColor: 'var(--color-bg-subtle)',
  color: 'inherit',
  fontWeight: 600,
};

export const StudentTabs: React.FC<StudentTabsProps> = ({
  activeTab,
  allCount,
  activeCount,
  inactiveCount,
  onTabChange,
  style,
}) => {
  return (
    <div role="tablist" aria-label="Student directory tabs" style={{ ...tabContainerStyle, ...style }}>
      <button
        type="button"
        role="tab"
        id="student-tab-active"
        aria-selected={activeTab === 'ACTIVE'}
        aria-controls="student-panel-active"
        tabIndex={activeTab === 'ACTIVE' ? 0 : -1}
        onClick={() => onTabChange('ACTIVE')}
        style={getTabStyle(activeTab === 'ACTIVE')}
      >
        Active <span style={countBadgeStyle}>{activeCount}</span>
      </button>

      <button
        type="button"
        role="tab"
        id="student-tab-inactive"
        aria-selected={activeTab === 'INACTIVE'}
        aria-controls="student-panel-inactive"
        tabIndex={activeTab === 'INACTIVE' ? 0 : -1}
        onClick={() => onTabChange('INACTIVE')}
        style={getTabStyle(activeTab === 'INACTIVE')}
      >
        Inactive <span style={countBadgeStyle}>{inactiveCount}</span>
      </button>

      <button
        type="button"
        role="tab"
        id="student-tab-all"
        aria-selected={activeTab === 'ALL'}
        aria-controls="student-panel-all"
        tabIndex={activeTab === 'ALL' ? 0 : -1}
        onClick={() => onTabChange('ALL')}
        style={getTabStyle(activeTab === 'ALL')}
      >
        All Students <span style={countBadgeStyle}>{allCount}</span>
      </button>
    </div>
  );
};
