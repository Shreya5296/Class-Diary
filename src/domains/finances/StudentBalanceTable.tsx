import React from 'react';
import { StudentFinancialRecord } from './financeTypes';
import { DataTable, Column } from '../../components/tables/DataTable';
import { formatCurrency } from '../../lib/currencyFormat';
import { formatDate } from '../../lib/dateFormat';
import { EmptyState } from '../../components/feedback/EmptyState';

export interface StudentBalanceTableProps {
  records: StudentFinancialRecord[];
}

export const StudentBalanceTable: React.FC<StudentBalanceTableProps> = ({ records }) => {
  if (records.length === 0) {
    return (
      <EmptyState
        title="No student financial records"
        description="No student packages or transaction history found matching your filters."
      />
    );
  }

  const columns: Column<StudentFinancialRecord>[] = [
    {
      key: 'student_name',
      header: 'Student',
      width: '20%',
      render: (r) => (
        <div>
          <span style={{ fontWeight: 600, color: 'var(--color-text-main)', display: 'block' }}>{r.student_name}</span>
          <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-subtle)' }}>{r.student_id}</span>
        </div>
      ),
    },
    {
      key: 'perClassRate',
      header: 'Per Class Rate',
      width: '18%',
      render: (r) => {
        const rate = r.perClassRate;
        if (!rate || !rate.hasRate) return <span style={{ color: 'var(--color-text-muted)' }}>—</span>;
        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
            <span style={{ fontVariantNumeric: 'tabular-nums', fontWeight: 600, color: 'var(--color-text-main)' }}>
              {rate.inrDisplay || '—'}
            </span>
            {rate.localDisplay && (
              <span style={{ fontSize: '11px', color: 'var(--color-text-muted)', fontVariantNumeric: 'tabular-nums' }}>
                {rate.localDisplay}
              </span>
            )}
          </div>
        );
      },
    },
    {
      key: 'packageTotalsByCurrency',
      header: 'Lifetime Package Value',
      width: '16%',
      render: (r) => {
        const entries = Object.entries(r.packageTotalsByCurrency);
        if (entries.length === 0) return <span style={{ color: 'var(--color-text-muted)' }}>—</span>;
        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
            {entries.map(([cur, amt]) => (
              <span key={cur} style={{ fontVariantNumeric: 'tabular-nums', fontWeight: 600 }}>
                {formatCurrency(amt, true, cur)}
              </span>
            ))}
          </div>
        );
      },
    },
    {
      key: 'paymentTotalsByCurrency',
      header: 'Lifetime Payments Received',
      width: '16%',
      render: (r) => {
        const entries = Object.entries(r.paymentTotalsByCurrency);
        if (entries.length === 0) return <span style={{ color: 'var(--color-text-muted)' }}>—</span>;
        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
            {entries.map(([cur, amt]) => (
              <span key={cur} style={{ fontVariantNumeric: 'tabular-nums', fontWeight: 600, color: '#059669' }}>
                {formatCurrency(amt, true, cur)}
              </span>
            ))}
          </div>
        );
      },
    },
    {
      key: 'outstandingBalance',
      header: 'Outstanding Balance',
      width: '15%',
      render: (r) => {
        const allCurrencies = Array.from(new Set([...Object.keys(r.packageTotalsByCurrency), ...Object.keys(r.paymentTotalsByCurrency)]));
        if (allCurrencies.length === 0) return <span style={{ color: 'var(--color-text-muted)' }}>—</span>;
        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
            {allCurrencies.map((cur) => {
              const diff = (r.packageTotalsByCurrency[cur] || 0) - (r.paymentTotalsByCurrency[cur] || 0);
              if (diff > 0) return <span key={cur} style={{ fontVariantNumeric: 'tabular-nums', fontWeight: 600, color: '#dc2626' }}>{formatCurrency(diff, true, cur)} due</span>;
              if (diff === 0) return <span key={cur} style={{ fontVariantNumeric: 'tabular-nums', fontWeight: 500, color: '#16a34a' }}>✓ Settled</span>;
              return <span key={cur} style={{ fontVariantNumeric: 'tabular-nums', fontWeight: 500, color: '#2563eb' }}>{formatCurrency(Math.abs(diff), true, cur)} credit</span>;
            })}
          </div>
        );
      },
    },
    {
      key: 'paymentCount',
      header: 'Payment Activity',
      width: '15%',
      render: (r) => (
        <div>
          <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)', display: 'block' }}>
            {r.paymentCount} payment(s) {r.lastPaymentDate ? `• last: ${formatDate(r.lastPaymentDate)}` : ''}
          </span>
          {r.recordedInrEquivalent ? (
            <span style={{ fontSize: '11px', color: 'var(--color-text-subtle)' }}>
              Total INR: ₹{r.recordedInrEquivalent.toLocaleString('en-IN')}
            </span>
          ) : null}
        </div>
      ),
    },
  ];

  return (
    <div style={{ backgroundColor: 'var(--color-bg-surface)', border: '1px solid var(--color-border-subtle)', borderRadius: 'var(--radius-xl)', overflow: 'hidden' }}>
      <DataTable fixedLayout columns={columns} data={records} keyExtractor={(r) => r.student_id} />
    </div>
  );
};
