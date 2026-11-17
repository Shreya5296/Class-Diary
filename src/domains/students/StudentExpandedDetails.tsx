import React from 'react';
import styles from './studentExpandedDetails.module.css';
import { Student } from './studentTypes';
import { MeetingLink } from '../meeting-links/meetingLinkTypes';
import { Package } from '../packages/packageTypes';
import { StudentFinancialInfo } from './useStudentAggregates';
import { WeeklyScheduleEntry, cleanTime } from '../classes/scheduleApi';
import { MeetingLinkButton } from '../meeting-links/MeetingLinkButton';
import { Button } from '../../components/buttons/Button';
import { formatCurrency } from '../../lib/currencyFormat';
import { formatDate } from '../../lib/dateFormat';
import { formatTimeTo12Hour } from '../../lib/time12Format';

export interface StudentExpandedDetailsProps {
  student: Student;
  meetingLink?: MeetingLink;
  balance: { totalPurchased: number; totalConsumed: number; packages: Package[] };
  financials: StudentFinancialInfo;
  schedule?: WeeklyScheduleEntry[];
  onEditStudent: (student: Student) => void;
  onSelectStudent: (student: Student) => void;
  onRenewStudent?: (student: Student) => void;
}

export const StudentExpandedDetails: React.FC<StudentExpandedDetailsProps> = ({
  student, meetingLink, balance, financials, schedule = [], onEditStudent, onSelectStudent, onRenewStudent,
}) => {
  const primaryUrl = student.primary_meeting_link || meetingLink?.meeting_link_1 || meetingLink?.meeting_url || '';
  const remaining = Math.max(0, balance.totalPurchased - balance.totalConsumed);
  const primaryPkg = balance.packages[0];
  const inrEquiv = financials.currency !== 'INR'
    ? (financials.inInr && financials.inInr > 0 ? formatCurrency(financials.inInr, true, 'INR') : 'Not available')
    : null;

  return (
    <div className={styles.container} onClick={(e) => e.stopPropagation()}>
      <div className={styles.identityBanner}>
        <div className={styles.studentMeta}>
          <span className={styles.studentName}>{student.student_name || student.full_name}</span>
          <span className={styles.idBadge}>{student.student_id}</span>
          {student.subject && <span className={styles.subjectBadge}>{student.subject}</span>}
        </div>
        <span style={{ fontSize: '11px', fontWeight: 700, padding: '2px 8px', borderRadius: 'var(--radius-full)', backgroundColor: student.status === 'ACTIVE' ? '#dcfce7' : '#fee2e2', color: student.status === 'ACTIVE' ? '#15803d' : '#b91c1c' }}>
          {student.status || 'ACTIVE'}
        </span>
      </div>

      <div className={styles.detailsGrid}>
        <div className={styles.section}>
          <div className={styles.heading}>Parent / Guardian</div>
          <div style={{ color: 'var(--color-text-main)', fontWeight: 600 }}>{student.parent_name || '—'}</div>
          <div className={styles.textWrap}>Phone: {student.parent_phone || student.phone || '—'}</div>
          <div className={styles.textWrap}>Email: {student.parent_email || '—'}</div>
        </div>

        <div className={styles.section}>
          <div className={styles.heading}>Student Contact</div>
          <div className={styles.textWrap}>Email: <strong style={{ color: 'var(--color-text-main)' }}>{student.student_email || '—'}</strong></div>
          <div className={styles.textWrap}>Phone: <strong style={{ color: 'var(--color-text-main)' }}>{student.student_phone || '—'}</strong></div>
          <div style={{ color: 'var(--color-text-subtle)' }}>Subject: {student.subject || '—'}</div>
        </div>

        <div className={styles.section}>
          <div className={styles.heading}>Class Schedule</div>
          {schedule.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
              {schedule.map((slot, i) => {
                const day = slot.day_of_week.charAt(0).toUpperCase() + slot.day_of_week.slice(1).toLowerCase();
                const s12 = formatTimeTo12Hour(cleanTime(slot.start_time));
                const e12 = slot.end_time ? formatTimeTo12Hour(cleanTime(slot.end_time)) : '';
                return (
                  <div key={i} style={{ color: 'var(--color-text-main)', fontSize: '12px', fontWeight: 500 }}>
                    {day} — {e12 ? `${s12}–${e12}` : s12}
                  </div>
                );
              })}
              <div style={{ color: 'var(--color-text-muted)', fontSize: '11px', marginTop: '2px' }}>
                {schedule.length} recurring {schedule.length === 1 ? 'slot' : 'slots'}/week
              </div>
            </div>
          ) : (
            <div style={{ color: 'var(--color-text-subtle)', fontStyle: 'italic', fontSize: '12px' }}>
              No configured schedule
            </div>
          )}
        </div>

        <div className={styles.section}>
          <div className={styles.heading}>Primary Meeting Link</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
            <div>
              {primaryUrl ? <MeetingLinkButton url={primaryUrl} /> : <span style={{ color: 'var(--color-text-subtle)', fontStyle: 'italic' }}>No link configured</span>}
            </div>
          </div>
        </div>

        <div className={styles.section}>
          <div className={styles.heading}>Package Details</div>
          <div style={{ color: 'var(--color-text-main)', fontWeight: 600 }}>
            {primaryPkg?.plan_type || primaryPkg?.package_name || 'No active plan'}
            {primaryPkg?.class_duration ? ` (${primaryPkg.class_duration} min)` : ''}
          </div>
          <div style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>
            Classes: <strong style={{ color: 'var(--color-text-main)' }}>{balance.totalPurchased}</strong> purchased · <strong>{balance.totalConsumed}</strong> consumed · <strong style={{ color: remaining > 0 ? 'var(--color-success-text)' : 'var(--color-danger-text)' }}>{remaining} remaining</strong>
          </div>
          <div style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>
            Dates: {primaryPkg?.start_date ? formatDate(primaryPkg.start_date) : '—'} – {primaryPkg?.end_date ? formatDate(primaryPkg.end_date) : '—'}
          </div>
        </div>

        <div className={styles.section}>
          <div className={styles.heading}>Financial Records</div>
          <div className={styles.textWrap}>Agreed Value: <strong style={{ color: 'var(--color-text-main)' }}>{formatCurrency(financials.totalInvoiced, true, financials.currency)}</strong></div>
          <div className={styles.textWrap}>Received Total: <strong style={{ color: 'var(--color-success)' }}>{formatCurrency(financials.totalPaid, true, financials.currency)}</strong></div>
          <div className={styles.textWrap}>Outstanding: <strong style={{ color: financials.outstanding > 0 ? '#dc2626' : 'var(--color-success)' }}>{financials.outstanding > 0 ? `${formatCurrency(financials.outstanding, true, financials.currency)} due` : '✓ Settled'}</strong></div>
          {financials.availableCredit && financials.availableCredit > 0 ? (
            <div className={styles.textWrap} style={{ color: '#2563eb' }}>Excess Credit: <strong>{formatCurrency(financials.availableCredit, true, financials.currency)}</strong></div>
          ) : null}
          {inrEquiv && <div className={styles.textWrap} style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>Recorded INR: {inrEquiv}</div>}
        </div>
      </div>

      <div className={styles.actionsRow}>
        <Button variant="secondary" size="sm" onClick={() => onSelectStudent(student)}>View Full Profile</Button>
        <Button variant="outline" size="sm" onClick={() => onEditStudent(student)}>Edit Details</Button>
        {onRenewStudent && <Button variant="primary" size="sm" onClick={() => onRenewStudent(student)}>Renew Package</Button>}
      </div>
    </div>
  );
};
