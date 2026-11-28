import React, { useMemo } from 'react';
import { Payment } from './financeTypes';
import { formatCurrency } from '../../lib/currencyFormat';
import { calculateFinanceEarnings } from './financialCalculations';
import { FinanceRangeType } from './financeDateRanges';
import { getSavedTimezone } from '../../lib/userPreferences';
import styles from './financeSummaryCards.module.css';

export interface FinanceSummaryCardsProps {
  payments?: Payment[];
  selectedMonth?: string;
  rangeType?: FinanceRangeType;
  timeZone?: string;
  summary?: any;
  currencyTotals?: any;
}

export const FinanceSummaryCards: React.FC<FinanceSummaryCardsProps> = ({
  payments = [],
  selectedMonth,
  rangeType = 'month',
  timeZone,
}) => {
  const activeTz = timeZone || getSavedTimezone();

  const { lifetimeEarnings, yearlyEarnings, monthlyEarnings } = useMemo(() => {
    return calculateFinanceEarnings(payments, activeTz, selectedMonth, new Date(), rangeType);
  }, [payments, activeTz, selectedMonth, rangeType]);

  const periodLabel = rangeType === 'financial_year'
    ? 'Financial Year Earnings'
    : rangeType === 'last_3_months'
    ? 'Last 3 Months Earnings'
    : 'Monthly Earnings';

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
        <span className={styles.label}>{periodLabel}</span>
        <div className={styles.amount} style={{ color: '#059669' }}>
          {formatCurrency(monthlyEarnings, true, 'INR')}
        </div>
      </div>
    </div>
  );
};
