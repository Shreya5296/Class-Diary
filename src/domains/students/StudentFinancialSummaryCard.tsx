import React, { useState, useEffect } from 'react';
import { fetchPackages } from '../packages/packageApi';
import { fetchPayments } from '../payments/paymentApi';
import { calculateStudentFinancialBalances, CurrencyFinancialBalance } from '../finances/studentFinancialAccounting';
import { calculateStudentPerClassRate, StudentPerClassRateResult } from '../finances/packageRateCalculator';
import { StudentFinancialCardView } from './StudentFinancialCardView';

export interface StudentFinancialSummaryCardProps {
  studentId: string;
  token?: string | null;
  refreshKey?: number;
}

export const StudentFinancialSummaryCard: React.FC<StudentFinancialSummaryCardProps> = ({
  studentId, token, refreshKey,
}) => {
  const [loading, setLoading] = useState(true);
  const [balances, setBalances] = useState<CurrencyFinancialBalance[]>([]);
  const [rateResult, setRateResult] = useState<StudentPerClassRateResult | null>(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    Promise.all([
      fetchPackages(studentId, token).catch(() => []),
      fetchPayments(studentId, undefined, token).catch(() => []),
    ]).then(([pkgs, pays]) => {
      if (!active) return;
      const calculated = calculateStudentFinancialBalances(pkgs, pays, studentId);
      const rate = calculateStudentPerClassRate(studentId, pkgs, pays);
      setBalances(calculated);
      setRateResult(rate);
      setLoading(false);
    });
    return () => { active = false; };
  }, [studentId, token, refreshKey]);

  return <StudentFinancialCardView balances={balances} rateResult={rateResult} loading={loading} />;
};
