import React, { useMemo } from 'react';
import { Payment } from './financeTypes';
import { formatCurrency } from '../../lib/currencyFormat';
import { calculateFinanceEarnings } from './financialCalculations';
import { getSavedTimezone } from '../../lib/userPreferences';
import styles from './financeSummaryCards.module.css';

export interface FinanceSummaryCardsProps {
  payments?: Payment[];
  selectedMonth?: string;
  timeZone?: string;
  summary?: any;
  currencyTotals?: any;
}

export const FinanceSummaryCards: React.FC<FinanceSummaryCardsProps> = ({
  payments = [],
  selectedMonth,
  timeZone,
}) => {
  const activeTz = timeZone || getSavedTimezone();

  const { lifetimeEarnings, yearlyEarnings, monthlyEarnings } = useMemo(() => {
    return calculateFinanceEarnings(payments, activeTz, selectedMonth);
  }, [payments, activeTz, selectedMonth]);

  return (
    <div data-testid="finance-summary-cards" className={styles.grid}>
      <div className={styles.card}>
        <span className={styles.label}>Lifetime Earnings</span>
        <div className={styles.amount} style={{ color: 'var(--color-primary)' }}>
          {formatCurrency(lifetimeEarnings, true, 'INR')}
        </div>
      </div>

      <div className={styles.card}>
        <span className={styles.label}>Yearly Earnings</span>
        <div className={styles.amount}>
          {formatCurrency(yearlyEarnings, true, 'INR')}
        </div>
      </div>

      <div className={styles.card}>
        <span className={styles.label}>Monthly Earnings</span>
        <div className={styles.amount} style={{ color: '#059669' }}>
          {formatCurrency(monthlyEarnings, true, 'INR')}
        </div>
      </div>
    </div>
  );
};
