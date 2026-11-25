import React, { useState, useEffect } from 'react';
import { useAuth } from '../../auth/AuthProvider';
import { usePageTitle } from '../../hooks/usePageTitle';
import { PageHeader } from '../../layout/PageHeader';
import { FinancesSkeleton } from '../../components/feedback/Skeleton';
import { FinanceTab } from './financeTypes';
import { FinanceSummaryCards } from './FinanceSummaryCards';
import { FinanceToolbar } from './FinanceToolbar';
import { FinancialHistoryTable } from './FinancialHistoryTable';
import { StudentBalanceTable } from './StudentBalanceTable';
import { AddPaymentModal } from './AddPaymentModal';
import { useFinancesData } from './useFinancesData';
import { exportFinancesCsv } from './financeCsvExport';
import { getAllPendingPayments, getOtherAdminPendingCount, subscribePendingPayments } from './paymentIdempotency';
import { getAdminScope } from './paymentAdminScope';

export const FinancesPage: React.FC = () => {
  usePageTitle('Finances');
  const { token, user } = useAuth();
  const adminId = getAdminScope(user?.email);
  const [activeTab, setActiveTab] = useState<FinanceTab>('balances');
  const [isAddPaymentOpen, setIsAddPaymentOpen] = useState(false);
  const [successBanner, setSuccessBanner] = useState<string | null>(null);
  const [pendingCount, setPendingCount] = useState(() => getAllPendingPayments(adminId).length);
  const [otherAdminCount, setOtherAdminCount] = useState(() => getOtherAdminPendingCount(adminId));

  const {
    summary, packages, payments, filteredPayments, studentBalances, currencyTotals, loading, filter, setFilter, refresh,
  } = useFinancesData(token);

  useEffect(() => {
    const updateCounts = () => {
      setPendingCount(getAllPendingPayments(adminId).length);
      setOtherAdminCount(getOtherAdminPendingCount(adminId));
    };
    updateCounts();
    return subscribePendingPayments(updateCounts);
  }, [adminId]);

  if (loading && !summary && filteredPayments.length === 0) {
    return <FinancesSkeleton />;
  }

  const handlePaymentSuccess = async (msg: string) => {
    setIsAddPaymentOpen(false);
    setSuccessBanner(msg);
    setTimeout(() => setSuccessBanner(null), 5000);
    await refresh();
  };

  return (
    <div>
      <PageHeader title="Finances" subtitle="Unified ledger of agreed packages, received tuition, and student payment history." />
      {successBanner && <div style={successBannerStyle}>✓ {successBanner}</div>}
      {pendingCount > 0 && (
        <div style={pendingBannerStyle}>
          ⚠️ You have {pendingCount} unverified payment attempt{pendingCount > 1 ? 's' : ''} in progress.{' '}
          <button type="button" onClick={() => setIsAddPaymentOpen(true)} style={bannerLinkStyle}>
            Review &amp; Resolve Now →
          </button>
        </div>
      )}
      {otherAdminCount > 0 && (
        <div style={otherAdminBannerStyle}>
          ℹ️ {otherAdminCount} unverified payment attempt{otherAdminCount > 1 ? 's are' : ' is'} recorded by another administrator session on this device.
        </div>
      )}
      <FinanceSummaryCards summary={summary} currencyTotals={currencyTotals} payments={payments} />
      <FinanceToolbar
        filter={filter} onFilterChange={setFilter}
        onExportCsv={() => exportFinancesCsv(summary, filteredPayments, currencyTotals)}
        onAddPayment={() => setIsAddPaymentOpen(true)}
      />

      <div role="tablist" aria-label="Finances ledger views" style={tabContainerStyle}>
        <button
          type="button" role="tab" id="tab-balances"
          aria-selected={activeTab === 'balances'} aria-controls="panel-balances"
          tabIndex={activeTab === 'balances' ? 0 : -1} onClick={() => setActiveTab('balances')}
          style={getTabButtonStyle(activeTab === 'balances')}
        >
          <span>Student Balances</span>
          <span style={countBadgeStyle}>{studentBalances.length}</span>
        </button>
        <button
          type="button" role="tab" id="tab-history"
          aria-selected={activeTab === 'history'} aria-controls="panel-history"
          tabIndex={activeTab === 'history' ? 0 : -1} onClick={() => setActiveTab('history')}
          style={getTabButtonStyle(activeTab === 'history')}
        >
          <span>Payment History</span>
          <span style={countBadgeStyle}>{filteredPayments.length}</span>
        </button>
      </div>

      {activeTab === 'balances' ? (
        <div id="panel-balances" role="tabpanel" aria-labelledby="tab-balances">
          <StudentBalanceTable records={studentBalances} />
        </div>
      ) : (
        <div id="panel-history" role="tabpanel" aria-labelledby="tab-history">
          <FinancialHistoryTable payments={filteredPayments} />
        </div>
      )}

      <AddPaymentModal
        isOpen={isAddPaymentOpen} token={token} packages={packages}
        onClose={() => setIsAddPaymentOpen(false)} onSuccess={handlePaymentSuccess}
      />
    </div>
  );
};

const tabContainerStyle: React.CSSProperties = {
  display: 'flex', gap: 'var(--space-2)', borderBottom: '1px solid var(--color-border)', marginBottom: 'var(--space-4)',
};
const countBadgeStyle: React.CSSProperties = {
  fontSize: '11px', padding: '1px 6px', borderRadius: '10px', backgroundColor: 'var(--color-bg-subtle)', color: 'inherit', fontWeight: 600,
};
const successBannerStyle: React.CSSProperties = {
  padding: '10px 14px', backgroundColor: '#ecfdf5', color: '#065f46', border: '1px solid #a7f3d0',
  borderRadius: 'var(--radius-md)', marginBottom: 'var(--space-4)', fontSize: 'var(--font-size-sm)', fontWeight: 500,
};
const pendingBannerStyle: React.CSSProperties = {
  padding: '10px 14px', backgroundColor: '#fffbeb', color: '#92400e', border: '1px solid #fde68a',
  borderRadius: 'var(--radius-md)', marginBottom: 'var(--space-4)', fontSize: 'var(--font-size-sm)', fontWeight: 500,
};
const otherAdminBannerStyle: React.CSSProperties = {
  padding: '8px 12px', backgroundColor: '#f1f5f9', color: '#475569', border: '1px solid #cbd5e1',
  borderRadius: 'var(--radius-md)', marginBottom: 'var(--space-4)', fontSize: 'var(--font-size-xs)',
};
const bannerLinkStyle: React.CSSProperties = {
  background: 'none', border: 'none', color: '#b45309', fontWeight: 700, textDecoration: 'underline', cursor: 'pointer',
};
function getTabButtonStyle(isActive: boolean): React.CSSProperties {
  return {
    padding: '8px 16px', border: 'none', background: 'none',
    fontWeight: isActive ? 600 : 500, fontSize: 'var(--font-size-sm)',
    color: isActive ? 'var(--color-primary)' : 'var(--color-text-muted)',
    borderBottom: isActive ? '2px solid var(--color-primary)' : '2px solid transparent',
    cursor: 'pointer', transition: 'color 140ms ease, border-color 140ms ease',
    outline: 'none', display: 'inline-flex', alignItems: 'center', gap: '6px',
    borderRadius: 'var(--radius-sm) var(--radius-sm) 0 0',
  };
}
