import React from 'react';
import { Payment } from './financeTypes';
import { DataTable, Column } from '../../components/tables/DataTable';
import { formatCurrency } from '../../lib/currencyFormat';
import { formatDate } from '../../lib/dateFormat';
import { EmptyState } from '../../components/feedback/EmptyState';

export interface FinancialHistoryTableProps {
  payments: Payment[];
}

export const FinancialHistoryTable: React.FC<FinancialHistoryTableProps> = ({ payments }) => {
  if (payments.length === 0) {
    return (
      <EmptyState
        title="No payment records found"
        description="No transaction records matched your search or date filter."
      />
    );
  }

  const columns: Column<Payment>[] = [
    {
      key: 'payment_date',
      header: 'Payment Date',
      width: '18%',
      render: (p) => formatDate(p.payment_date),
    },
    {
      key: 'student_name',
      header: 'Student',
      width: '28%',
      render: (p) => (
        <div>
          <span style={{ fontWeight: 600, color: 'var(--color-text-main)', display: 'block' }}>
            {p.student_name || p.student_id || '—'}
          </span>
          <span style={{ fontSize: 'var(--font-size-xs)', fontFamily: 'monospace', color: 'var(--color-text-subtle)' }}>
            {p.student_id || ''}
          </span>
        </div>
      ),
    },
    {
      key: 'amount',
      header: 'Amount',
      width: '18%',
      render: (p) => (
        <span style={{ fontVariantNumeric: 'tabular-nums', fontWeight: 600, color: 'var(--color-success)' }}>
          {formatCurrency(p.amount, true, p.currency || 'INR')}
        </span>
      ),
    },
    {
      key: 'currency',
      header: 'Currency',
      width: '16%',
      render: (p) => (
        <span style={{ fontSize: 'var(--font-size-xs)', fontWeight: 600, color: 'var(--color-text-muted)' }}>
          {String(p.currency || 'INR').toUpperCase()}
        </span>
      ),
    },
    {
      key: 'in_inr',
      header: 'Recorded INR Equivalent',
      width: '20%',
      render: (p) => {
        const hasInr = p.in_inr !== undefined && p.in_inr !== null && Number(p.in_inr) > 0;
        if (!hasInr) {
          return <span style={{ color: 'var(--color-text-muted)' }}>—</span>;
        }
        return (
          <span style={{ fontVariantNumeric: 'tabular-nums', color: 'var(--color-text-main)' }}>
            ₹{Number(p.in_inr).toLocaleString('en-IN')}
          </span>
        );
      },
    },
  ];

  return (
    <div style={{ backgroundColor: 'var(--color-bg-surface)', border: '1px solid var(--color-border-subtle)', borderRadius: 'var(--radius-xl)', overflow: 'hidden' }}>
      <DataTable
        fixedLayout
        columns={columns}
        data={payments}
        keyExtractor={(p: Payment, idx?: number) => `${p.student_id || 'stu'}_${p.payment_date || 'date'}_${p.amount || 0}_${idx ?? 0}`}
      />
    </div>
  );
};
