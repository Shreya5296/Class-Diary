import React, { useMemo } from 'react';
import { FinancialSummary, FinancesSummaryData, Payment } from './financeTypes';
import { formatCurrency } from '../../lib/currencyFormat';
import { calculateMonthlyAndYearlyEarnings } from './financialCalculations';
import { getSavedTimezone } from '../../lib/userPreferences';
import styles from './financeSummaryCards.module.css';

export interface FinanceSummaryCardsProps {
  summary?: FinancialSummary | null;
  currencyTotals?: FinancesSummaryData;
  payments?: Payment[];
  timeZone?: string;
}

export const FinanceSummaryCards: React.FC<FinanceSummaryCardsProps> = ({
  summary,
  currencyTotals,
  payments = [],
  timeZone,
}) => {
  const activeTz = timeZone || getSavedTimezone();

  const { monthlyEarnings, yearlyEarnings } = useMemo(() => {
    return calculateMonthlyAndYearlyEarnings(payments, activeTz);
  }, [payments, activeTz]);

  const lifetimePackageValue = summary?.totalInvoiced ?? 0;
  const lifetimePaymentsReceived = summary?.totalCollected ?? 0;
  const recordedInrValue = currencyTotals?.totalRecordedInr ?? summary?.totalCollected ?? 0;

  return (
    <div data-testid="finance-summary-cards" className={styles.grid}>
      <div className={styles.card}>
        <span className={styles.label}>Lifetime Package Value</span>
        <div className={styles.amount}>
          {formatCurrency(lifetimePackageValue, true, 'INR')}
        </div>
      </div>

      <div className={styles.card}>
        <span className={styles.label}>Lifetime Payments Received</span>
        <div className={styles.amount} style={{ color: '#059669' }}>
          {formatCurrency(lifetimePaymentsReceived, true, 'INR')}
        </div>
      </div>

      <div className={styles.card}>
        <span className={styles.label}>Recorded INR Value</span>
        <div className={styles.amount} style={{ color: 'var(--color-primary)' }}>
          {formatCurrency(recordedInrValue, true, 'INR')}
        </div>
      </div>

      <div className={styles.card}>
        <span className={styles.label}>Monthly Earnings</span>
        <div className={styles.amount}>
          {formatCurrency(monthlyEarnings, true, 'INR')}
        </div>
      </div>

      <div className={styles.card}>
        <span className={styles.label}>Yearly Earnings</span>
        <div className={styles.amount}>
          {formatCurrency(yearlyEarnings, true, 'INR')}
        </div>
      </div>
    </div>
  );
};
