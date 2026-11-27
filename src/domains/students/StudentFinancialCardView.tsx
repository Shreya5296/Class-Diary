import React from 'react';
import { CurrencyFinancialBalance } from '../finances/studentFinancialAccounting';
import { StudentPerClassRateResult } from '../finances/packageRateCalculator';
import { formatCurrency } from '../../lib/currencyFormat';

export interface StudentFinancialCardViewProps {
  balances: CurrencyFinancialBalance[];
  rateResult?: StudentPerClassRateResult | null;
  loading?: boolean;
}

export const StudentFinancialCardView: React.FC<StudentFinancialCardViewProps> = ({
  balances,
  rateResult,
  loading = false,
}) => {
  if (loading) {
    return (
      <div style={{ padding: '1rem', backgroundColor: 'var(--color-bg-surface)', border: '1px solid var(--color-border-subtle)', borderRadius: 'var(--radius-lg)', marginBottom: 'var(--space-5)', fontSize: 'var(--font-size-sm)', color: 'var(--color-text-muted)' }}>
        Loading student financial balances…
      </div>
    );
  }

  if (balances.length === 0) {
    return (
      <div style={{ padding: '0.875rem 1.25rem', backgroundColor: 'var(--color-bg-surface)', border: '1px solid var(--color-border-subtle)', borderRadius: 'var(--radius-lg)', marginBottom: 'var(--space-5)', fontSize: 'var(--font-size-sm)', color: 'var(--color-text-muted)' }}>
        ℹ️ No package obligations or payment records found for this student.
      </div>
    );
  }

  const renderRateDisplay = (b: CurrencyFinancialBalance) => {
    if (!rateResult || !rateResult.hasRate) {
      return '—';
    }
    const isForeign = b.currency !== 'INR';
    if (isForeign) {
      if (rateResult.localDisplay && rateResult.localDisplay !== '—') {
        return rateResult.inrDisplay && rateResult.inrDisplay !== '—'
          ? `${rateResult.localDisplay} (${rateResult.inrDisplay})`
          : rateResult.localDisplay;
      }
      return '—';
    }
    return rateResult.inrDisplay || '—';
  };

  return (
    <div
      data-testid="student-financial-summary-card"
      style={{
        backgroundColor: 'var(--color-bg-surface)',
        border: '1px solid var(--color-border-subtle)',
        borderRadius: 'var(--radius-xl)',
        padding: '1.25rem 1.5rem',
        marginBottom: 'var(--space-5)',
        boxShadow: 'var(--shadow-xs)',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-3)' }}>
        <h3 style={{ margin: 0, fontSize: 'var(--font-size-sm)', fontWeight: 700, color: 'var(--color-text-main)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
          Financial Summary &amp; Outstanding Balance
        </h3>
        <span style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>
          Calculated across all historical and current packages
        </span>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
        {balances.map((b) => {
          if (!b.isReliable) {
            return (
              <div key={b.currency} style={{ padding: '0.75rem', backgroundColor: 'var(--color-danger-bg)', border: '1px solid var(--color-danger-border)', borderRadius: 'var(--radius-md)', color: 'var(--color-danger-text)', fontSize: 'var(--font-size-xs)' }}>
                ⚠️ Financial calculation unavailable for {b.currency}: Incomplete or non-numeric transaction values detected.
              </div>
            );
          }

          return (
            <div
              key={b.currency}
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                gap: 'var(--space-3)',
                padding: '0.875rem 1rem',
                backgroundColor: 'var(--color-bg-subtle)',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--color-border-subtle)',
                alignItems: 'center',
              }}
            >
              <div>
                <span style={{ color: 'var(--color-text-muted)', fontSize: '11px', display: 'block', textTransform: 'uppercase', fontWeight: 600 }}>
                  Total Package Payable ({b.currency})
                </span>
                <strong style={{ fontSize: 'var(--font-size-md)', fontVariantNumeric: 'tabular-nums', color: 'var(--color-text-main)' }}>
                  {formatCurrency(b.totalPayable, true, b.currency)}
                </strong>
              </div>

              <div>
                <span style={{ color: 'var(--color-text-muted)', fontSize: '11px', display: 'block', textTransform: 'uppercase', fontWeight: 600 }}>
                  Total Payments Received ({b.currency})
                </span>
                <strong style={{ fontSize: 'var(--font-size-md)', fontVariantNumeric: 'tabular-nums', color: '#059669' }}>
                  {formatCurrency(b.totalPaid, true, b.currency)}
                </strong>
              </div>

              <div>
                <span style={{ color: 'var(--color-text-muted)', fontSize: '11px', display: 'block', textTransform: 'uppercase', fontWeight: 600 }}>
                  Outstanding Amount ({b.currency})
                </span>
                <strong style={{ fontSize: 'var(--font-size-md)', fontVariantNumeric: 'tabular-nums', color: b.outstanding > 0 ? '#dc2626' : '#16a34a' }}>
                  {b.outstanding > 0 ? `${formatCurrency(b.outstanding, true, b.currency)} due` : '₹0.00 (Settled)'.replace('₹', b.currency === 'INR' ? '₹' : `${b.currency} `)}
                </strong>
              </div>

              <div>
                <span style={{ color: 'var(--color-text-muted)', fontSize: '11px', display: 'block', textTransform: 'uppercase', fontWeight: 600 }}>
                  Rate per class / Per-Class Rate ({b.currency})
                </span>
                <strong style={{ fontSize: 'var(--font-size-md)', fontVariantNumeric: 'tabular-nums', color: 'var(--color-text-main)' }}>
                  {renderRateDisplay(b)}
                </strong>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
