import React from 'react';
import { FinancialSummary, FinancesSummaryData } from './financeTypes';
import { formatCurrency } from '../../lib/currencyFormat';

export interface FinanceSummaryCardsProps {
  summary?: FinancialSummary | null;
  currencyTotals?: FinancesSummaryData;
}

export const FinanceSummaryCards: React.FC<FinanceSummaryCardsProps> = ({ summary, currencyTotals }) => {
  const pkgCurrencies = Object.keys(currencyTotals?.packagesByCurrency || {});
  const payCurrencies = Object.keys(currencyTotals?.paymentsByCurrency || {});

  const renderCurrencyEntries = (totals?: Record<string, number>) => {
    if (!totals || Object.keys(totals).length === 0) {
      return <div style={amountStyle}>{formatCurrency(0, true, 'INR')}</div>;
    }
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
        {Object.entries(totals).map(([cur, amt]) => (
          <div key={cur} style={amountStyle}>
            {formatCurrency(amt, true, cur)}
          </div>
        ))}
      </div>
    );
  };

  return (
    <div
      data-testid="finance-summary-cards"
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
        gap: 'var(--space-4)',
        marginBottom: 'var(--space-6)',
      }}
    >
      <div style={cardStyle}>
        <span style={labelStyle}>Lifetime Package Value</span>
        {pkgCurrencies.length > 0 ? (
          renderCurrencyEntries(currencyTotals?.packagesByCurrency)
        ) : (
          <div style={amountStyle}>{formatCurrency(summary?.totalInvoiced || 0, true, summary?.currency || 'INR')}</div>
        )}
        <p style={descStyle}>Total agreed value by package currency</p>
      </div>

      <div style={cardStyle}>
        <span style={labelStyle}>Lifetime Payments Received</span>
        {payCurrencies.length > 0 ? (
          renderCurrencyEntries(currencyTotals?.paymentsByCurrency)
        ) : (
          <div style={{ ...amountStyle, color: '#059669' }}>
            {formatCurrency(summary?.totalCollected || 0, true, summary?.currency || 'INR')}
          </div>
        )}
        <p style={descStyle}>Total collected by payment currency</p>
      </div>

      <div style={cardStyle}>
        <span style={labelStyle}>Recorded INR Value</span>
        <div style={{ ...amountStyle, color: 'var(--color-primary)' }}>
          {formatCurrency(currencyTotals?.totalRecordedInr || summary?.totalCollected || 0, true, 'INR')}
        </div>
        <p style={descStyle}>Total Recorded INR Equivalent across all transactions</p>
      </div>
    </div>
  );
};

const cardStyle: React.CSSProperties = {
  padding: '1.25rem 1.5rem',
  backgroundColor: 'var(--color-bg-surface)',
  border: '1px solid var(--color-border-subtle)',
  borderRadius: 'var(--radius-xl)',
  boxShadow: 'var(--shadow-xs)',
};

const labelStyle: React.CSSProperties = {
  fontSize: 'var(--font-size-sm)',
  color: 'var(--color-text-muted)',
  fontWeight: 500,
};

const amountStyle: React.CSSProperties = {
  fontSize: '1.5rem',
  fontWeight: 700,
  margin: '4px 0 2px',
  color: 'var(--color-text-main)',
  fontVariantNumeric: 'tabular-nums',
};

const descStyle: React.CSSProperties = {
  margin: 0,
  fontSize: 'var(--font-size-xs)',
  color: 'var(--color-text-subtle)',
};
