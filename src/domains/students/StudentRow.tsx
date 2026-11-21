import React from 'react';
import { Student } from './studentTypes';
import { WeeklyScheduleEntry } from '../classes/scheduleApi';
import { Package } from '../packages/packageTypes';
import { StudentFinancialInfo } from './useStudentAggregates';
import { formatClassBalance, formatRemainingClasses } from './classBalanceFormatter';
import { formatScheduleLines } from './scheduleFormatter';
import { StudentCell } from './StudentCell';
import { StudentExpandedDetails } from './StudentExpandedDetails';
import { MeetingLinkButton } from '../meeting-links/MeetingLinkButton';
import { STUDENT_TABLE_COLUMNS, STUDENT_TABLE_GRID_TEMPLATE } from './studentTableLayout';
import rowStyles from './studentRow.module.css';

export interface StudentRowProps {
  student: Student;
  isExpanded: boolean;
  isActive?: boolean;
  onToggleExpand: (studentId: string) => void;
  onSelectStudent: (student: Student) => void;
  onEditStudent: (student: Student) => void;
  onRenewStudent?: (student: Student) => void;
  schedule: WeeklyScheduleEntry[];
  balance: { totalPurchased: number; totalConsumed: number; packages: Package[] };
  financials: StudentFinancialInfo;
  meetingLink?: any;
}

export const StudentRow: React.FC<StudentRowProps> = ({
  student, isExpanded, isActive, onToggleExpand, onSelectStudent,
  onEditStudent, onRenewStudent, schedule, balance, financials, meetingLink,
}) => {
  const scheduleLines = formatScheduleLines(schedule);
  const scheduleTooltip = scheduleLines.join('\n') || 'No configured schedule';
  const classBalanceText = formatClassBalance(balance.totalConsumed, balance.totalPurchased);
  const remainingCount = Math.max(0, (balance.totalPurchased || 0) - (balance.totalConsumed || 0));
  const remainingText = formatRemainingClasses(balance.totalConsumed, balance.totalPurchased);
  const effectiveActive = isActive !== undefined ? isActive : (student.status || '').trim().toUpperCase() === 'ACTIVE';
  const primaryLink = (student.primary_meeting_link || meetingLink?.meeting_link_1 || meetingLink?.meeting_url || '').trim();
  const rowClass = `${rowStyles.row} ${isExpanded ? rowStyles.rowExpanded : ''}`.trim();

  const gridRowStyle: React.CSSProperties = {
    display: 'grid',
    gridTemplateColumns: STUDENT_TABLE_GRID_TEMPLATE,
    alignItems: 'center',
    width: '100%',
  };

  return (
    <>
      <tr onClick={() => onToggleExpand(student.student_id)} className={rowClass} style={gridRowStyle} data-status={effectiveActive ? 'active' : 'inactive'} aria-expanded={isExpanded}>
        <td style={STUDENT_TABLE_COLUMNS.student}>
          <StudentCell student={student} onSelect={onSelectStudent} />
        </td>

        <td style={STUDENT_TABLE_COLUMNS.subject}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '4px', maxWidth: '100%', alignItems: 'start' }}>
            {(student.subject ? student.subject.split(',') : ['General']).map((subj, i) => (
              <span key={i} title={subj.trim()} style={{ fontSize: 'var(--font-size-xs)', fontWeight: 500, padding: '2px 6px', borderRadius: 'var(--radius-sm)', backgroundColor: 'var(--color-bg-subtle)', color: 'var(--color-text-muted)', border: '1px solid var(--color-border-subtle)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', textAlign: 'left', display: 'block' }}>
                {subj.trim()}
              </span>
            ))}
          </div>
        </td>

        <td style={STUDENT_TABLE_COLUMNS.schedule}>
          {scheduleLines.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', width: '100%' }}>
              {scheduleLines.map((line, idx) => (
                <span key={idx} title={line} style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-main)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'block', lineHeight: 1.3 }}>
                  {line}
                </span>
              ))}
            </div>
          ) : (
            <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-subtle)', fontStyle: 'italic', width: '100%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'block' }} title={scheduleTooltip}>
              No configured schedule
            </span>
          )}
        </td>

        <td style={STUDENT_TABLE_COLUMNS.classes}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
            <span style={{ fontFamily: 'monospace', fontSize: 'var(--font-size-xs)', fontWeight: 600, color: 'var(--color-text-main)', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }} title={`${balance.totalConsumed} of ${balance.totalPurchased} classes consumed (${remainingCount} remaining)`}>
              {classBalanceText}
            </span>
            <span style={{ fontSize: '11px', fontWeight: 500, color: remainingCount > 0 ? 'var(--color-success-text)' : 'var(--color-text-muted)', whiteSpace: 'nowrap' }}>
              {remainingText}
            </span>
          </div>
        </td>

        <td style={STUDENT_TABLE_COLUMNS.meetingLink}>
          {primaryLink ? (
            <MeetingLinkButton url={primaryLink} compact />
          ) : (
            <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-subtle)', fontStyle: 'italic' }}>
              No link configured
            </span>
          )}
        </td>
      </tr>

      {isExpanded && (
        <tr style={{ display: 'block', width: '100%' }}>
          <td colSpan={5} style={{ display: 'block', width: '100%', padding: 0 }}>
            <StudentExpandedDetails
              student={student} meetingLink={meetingLink} balance={balance}
              financials={financials} schedule={schedule} onEditStudent={onEditStudent}
              onSelectStudent={onSelectStudent} onRenewStudent={onRenewStudent}
            />
          </td>
        </tr>
      )}
    </>
  );
};
