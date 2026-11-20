import React, { useState } from 'react';
import styles from './thingsThatNeedAttention.module.css';
import { NavSection } from '../../layout/Sidebar';
import { AttentionAlert, AttentionCategory } from './attentionAlertTypes';
import { AttentionSummaryChips } from './AttentionSummaryChips';
import { Button } from '../../components/buttons/Button';
import { CheckIcon, AlertIcon } from '../../components/icons/ActionIcons';
import { InlineAttendanceAlertRow } from './InlineAttendanceAlertRow';
import { useAuth } from '../../auth/AuthProvider';

export interface ThingsThatNeedAttentionProps {
  alerts: AttentionAlert[];
  onNavigate: (section: NavSection) => void;
  error?: string | null;
  onRefresh?: () => Promise<void>;
}

const CATEGORY_CONFIG: Array<{ key: AttentionCategory; title: string }> = [
  { key: 'renewal', title: 'Student Renewals' },
  { key: 'fee', title: 'Fee Reminders' },
  { key: 'attendance', title: 'Attendance Pending' },
  { key: 'schedule', title: 'Scheduling & Configuration' },
  { key: 'other', title: 'Other Operational Issues' },
];

export const ThingsThatNeedAttention: React.FC<ThingsThatNeedAttentionProps> = ({
  alerts,
  onNavigate,
  error,
  onRefresh,
}) => {
  const { token } = useAuth();
  const [expandedAlertId, setExpandedAlertId] = useState<string | null>(null);

  const criticalCount = alerts.filter((a) => a.urgency === 'critical').length;
  const pendingCount = alerts.filter((a) => a.urgency === 'pending').length;
  const upcomingCount = alerts.filter((a) => a.urgency === 'upcoming').length;

  const renderAlertRow = (alert: AttentionAlert) => {
    if (alert.category === 'attendance') {
      return (
        <InlineAttendanceAlertRow
          key={alert.id}
          alert={alert}
          isExpanded={expandedAlertId === alert.id}
          onToggle={() => setExpandedAlertId(expandedAlertId === alert.id ? null : alert.id)}
          token={token}
          onRefresh={onRefresh}
        />
      );
    }

    let dotClass = styles.dotPending;
    if (alert.urgency === 'critical') dotClass = styles.dotCritical;
    else if (alert.urgency === 'upcoming') dotClass = styles.dotUpcoming;

    return (
      <div key={alert.id} className={styles.alertRow}>
        <div className={styles.alertInfo}>
          <span className={dotClass} aria-hidden="true" />
          <div className={styles.alertDetails}>
            <span className={styles.alertStudent}>{alert.studentName}</span>
            <span className={styles.alertReason}>{alert.reason}</span>
          </div>
        </div>
        <Button
          variant={alert.severity === 'danger' ? 'primary' : 'secondary'}
          size="sm"
          onClick={() => onNavigate(alert.targetSection)}
        >
          {alert.actionLabel} →
        </Button>
      </div>
    );
  };

  return (
    <section className={styles.container} aria-label="Things That Need Attention">
      <div className={styles.header}>
        <div className={styles.titleGroup}>
          <h3 className={styles.title}>Things That Need Attention</h3>
          {alerts.length > 0 && <span className={styles.badge}>{alerts.length}</span>}
        </div>
        <div className={styles.headerIcon}>
          {alerts.length > 0 ? <AlertIcon size={22} /> : <CheckIcon size={22} />}
        </div>
      </div>

      <AttentionSummaryChips
        criticalCount={criticalCount}
        pendingCount={pendingCount}
        upcomingCount={upcomingCount}
      />

      {error ? (
        <div className={styles.errorBox}>⚠️ Failed to load attention alerts: {error}</div>
      ) : alerts.length === 0 ? (
        <div className={styles.zeroState}>
          <div className={styles.zeroIcon}><CheckIcon size={16} /></div>
          <div>
            <h4 className={styles.zeroTitle}>You&apos;re all caught up!</h4>
            <p className={styles.zeroSubtitle}>No pending administrative actions.</p>
          </div>
        </div>
      ) : (
        <div className={styles.alertList}>
          {CATEGORY_CONFIG.map(({ key, title }) => {
            const groupAlerts = alerts.filter((a) =>
              key === 'other'
                ? a.category === 'other' || !CATEGORY_CONFIG.some((c) => c.key === a.category)
                : a.category === key
            );
            if (groupAlerts.length === 0) return null;
            return (
              <div key={key} className={styles.categoryGroup}>
                <div className={styles.categoryHeader}>
                  <span className={styles.categoryName}>{title}</span>
                  <span className={styles.categoryCount}>({groupAlerts.length})</span>
                </div>
                <div className={styles.alertList}>
                  {groupAlerts.map(renderAlertRow)}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
};
