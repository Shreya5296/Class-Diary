import React from 'react';
import { FinanceFilter } from './financeTypes';
import { Button } from '../../components/buttons/Button';

export interface FinanceToolbarProps {
  filter: FinanceFilter;
  onFilterChange: (newFilter: FinanceFilter) => void;
  onExportCsv?: () => void;
  onAddPayment?: () => void;
  onRecordPayment?: () => void;
  isExporting?: boolean;
}

export const FinanceToolbar: React.FC<FinanceToolbarProps> = ({
  filter,
  onFilterChange,
  onAddPayment,
  onRecordPayment,
}) => {
  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        gap: 'var(--space-3)',
        marginBottom: 'var(--space-4)',
        flexWrap: 'wrap',
      }}
    >
      <div style={{ display: 'flex', gap: 'var(--space-3)', alignItems: 'center', flexWrap: 'wrap', flex: 1, minWidth: '280px' }}>
        <input
          type="search"
          placeholder="Search by student name or reference…"
          value={filter.search || ''}
          onChange={(e) => onFilterChange({ ...filter, search: e.target.value })}
          style={{
            padding: '0.45rem 0.75rem',
            borderRadius: 'var(--radius-md)',
            border: '1px solid var(--color-border)',
            fontSize: 'var(--font-size-sm)',
            backgroundColor: 'var(--color-bg-surface)',
            color: 'var(--color-text-main)',
            minWidth: '220px',
            flex: '1 1 220px',
          }}
        />

        <div style={{ display: 'flex', gap: 'var(--space-2)', alignItems: 'center' }}>
          <label style={{ fontSize: 'var(--font-size-xs)', display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--color-text-muted)', fontWeight: 500 }}>
            <span>Month:</span>
            <input
              type="month"
              aria-label="Filter payments by month"
              value={filter.selectedMonth || ''}
              onChange={(e) => onFilterChange({ ...filter, selectedMonth: e.target.value })}
              style={monthInputStyle}
            />
          </label>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 'var(--space-2)', alignItems: 'center' }}>
        {(onAddPayment || onRecordPayment) && (
          <Button variant="primary" size="sm" onClick={onAddPayment || onRecordPayment}>
            + Add Payment
          </Button>
        )}
      </div>
    </div>
  );
};

const monthInputStyle: React.CSSProperties = {
  padding: '0.45rem 0.65rem',
  borderRadius: 'var(--radius-md)',
  border: '1px solid var(--color-border)',
  fontSize: 'var(--font-size-sm)',
  backgroundColor: 'var(--color-bg-surface)',
  color: 'var(--color-text-main)',
  cursor: 'pointer',
  minWidth: '150px',
};
