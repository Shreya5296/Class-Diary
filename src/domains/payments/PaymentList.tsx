import React, { useState, useEffect } from 'react';
import { useAuth } from '../../auth/AuthProvider';
import { Payment } from './paymentTypes';
import { fetchPayments } from './paymentApi';
import { DataTable, Column } from '../../components/tables/DataTable';
import { formatCurrency } from '../../lib/currencyFormat';
import { formatDate } from '../../lib/dateFormat';
import { StudentsTableSkeleton } from '../../components/feedback/Skeleton';
import { EmptyState } from '../../components/feedback/EmptyState';

export const PaymentList: React.FC<{ studentId?: string }> = ({ studentId }) => {
  const { token } = useAuth();
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);

  const loadData = async () => {
    setLoading(true);
    try {
      const data = await fetchPayments(studentId, undefined, token);
      setPayments(data);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [studentId, token]);

  const columns: Column<Payment>[] = [
    { key: 'payment_date', header: 'Date', width: '22%', render: (p) => formatDate(p.payment_date) },
    {
      key: 'amount',
      header: 'Amount',
      width: '28%',
      render: (p) => (
        <span style={{ fontVariantNumeric: 'tabular-nums', fontWeight: 600, color: 'var(--color-success)' }}>
          {formatCurrency(p.amount, true, p.currency || 'INR')}
        </span>
      ),
    },
    {
      key: 'currency',
      header: 'Currency',
      width: '22%',
      render: (p) => (
        <span style={{ fontSize: 'var(--font-size-xs)', fontWeight: 600, color: 'var(--color-text-muted)' }}>
          {String(p.currency || 'INR').toUpperCase()}
        </span>
      ),
    },
    {
      key: 'in_inr',
      header: 'Recorded INR Equivalent',
      width: '28%',
      render: (p) => {
        const hasInr = p.in_inr !== undefined && p.in_inr !== null && Number(p.in_inr) > 0;
        return hasInr ? (
          <span style={{ fontVariantNumeric: 'tabular-nums' }}>₹{Number(p.in_inr).toLocaleString('en-IN')}</span>
        ) : (
          <span style={{ color: 'var(--color-text-muted)' }}>—</span>
        );
      },
    },
  ];

  if (loading) return <StudentsTableSkeleton />;
  if (payments.length === 0) return <EmptyState title="No payments recorded" description="No transactions in the ledger." />;

  return (
    <DataTable
      columns={columns}
      data={payments}
      keyExtractor={(p: Payment, idx?: number) => `${p.student_id || 'stu'}_${p.payment_date || 'date'}_${p.amount || 0}_${idx ?? 0}`}
    />
  );
};
