import React, { useState } from 'react';
import styles from './todayClassesSection.module.css';
import { ClassSession } from '../classes/classTypes';
import { Student } from '../students/studentTypes';
import { Package } from '../packages/packageTypes';
import { MeetingLink } from '../meeting-links/meetingLinkTypes';
import { toInputDateFormat } from '../../lib/dateFormat';
import { getSessionStartTime, getSessionDuration, formatSessionTimeRange, isSessionOnDate } from '../classes/sessionTimeNormalizer';
import { formatSelectedDateDisplay, formatEmptyStateDate } from './scheduleDateNavigation';
import { Button } from '../../components/buttons/Button';
import { CalendarIcon } from '../../components/icons/NavIcons';

export interface TodayClassesSectionProps {
  classes: ClassSession[];
  students?: Student[];
  packages?: Package[];
  meetingLinks?: MeetingLink[];
  activeTz?: string;
  selectedDateKey?: string;
  onSelectDateKey?: (dateKey: string) => void;
}

export const TodayClassesSection: React.FC<TodayClassesSectionProps> = ({
  classes, students = [], packages = [], meetingLinks = [], activeTz = 'Asia/Kolkata',
  selectedDateKey: propDateKey, onSelectDateKey,
}) => {
  const todayKey = toInputDateFormat(new Date(), activeTz);
  const [localDateKey, setLocalDateKey] = useState<string>(todayKey);
  const currentDateKey = propDateKey || localDateKey;
  const changeDate = (updater: string | ((p: string) => string)) => {
    const nextKey = typeof updater === 'function' ? updater(currentDateKey) : updater;
    if (onSelectDateKey) onSelectDateKey(nextKey);
    else setLocalDateKey(nextKey);
  };

  const getPkg = (id?: string) => packages.find((p) => p.student_id === id);
  const daySessions = classes
    .filter((c) => isSessionOnDate(c, currentDateKey, activeTz))
    .sort((a, b) => getSessionStartTime(a, activeTz).localeCompare(getSessionStartTime(b, activeTz)));

  const getMeetingUrl = (id?: string, url?: string) => {
    if (url) return url;
    const l = meetingLinks.find((link) => link.student_id === id);
    return l?.meeting_link_1 || l?.meeting_link_2 || '';
  };

  const getSubject = (c: ClassSession) => students.find((s) => s.student_id === c.student_id)?.subject || c.topic || c.class_title || 'General';
  const isEligible = (c?: ClassSession) => {
    if (!c) return false;
    const st = c.session_status || c.status;
    return st !== 'COMPLETED' && st !== 'CANCELLED' && Boolean(getMeetingUrl(c.student_id, c.meeting_url));
  };

  const imminent = daySessions[0], others = daySessions.slice(1);
  const imminentPkg = imminent ? getPkg(imminent.student_id) : undefined;

  return (
    <div className={styles.sectionCard}>
      <div className={styles.sectionHeader}>
        <h3 className={styles.title}>Class Schedule</h3>
        <div className={styles.navControls}>
          <span className={styles.selectedDateBadge}>{formatSelectedDateDisplay(currentDateKey)}</span>
          {currentDateKey !== todayKey && (
            <button type="button" className={styles.goToTodayBtn} onClick={() => changeDate(todayKey)}>Go to Today</button>
          )}
        </div>
      </div>

      {!imminent ? (
        <div className={styles.emptyState}>
          <div className={styles.emptyIconCircle}><CalendarIcon size={18} /></div>
          <span className={styles.emptyText}>
            {currentDateKey === todayKey ? 'No classes scheduled for today.' : `No classes scheduled for ${formatEmptyStateDate(currentDateKey)}.`}
          </span>
        </div>
      ) : (
        <div className={styles.classesList}>
          <div className={styles.imminentBanner}>
            <div>
              <div className={styles.imminentBadge}>Next Scheduled Class</div>
              <span className={styles.imminentTitle}>{imminent.student_name || imminent.student_id} — {getSubject(imminent)}</span>
              <span className={styles.imminentMeta}>{formatSessionTimeRange(imminent, imminentPkg, activeTz)} ({getSessionDuration(imminent, imminentPkg)} min)</span>
            </div>
            {isEligible(imminent) ? (
              <a href={getMeetingUrl(imminent.student_id, imminent.meeting_url)} target="_blank" rel="noopener noreferrer" style={{ textDecoration: 'none' }}>
                <Button variant="primary" size="md">Join Class ↗</Button>
              </a>
            ) : (
              <Button variant="secondary" size="md" disabled style={{ opacity: 0.6, cursor: 'not-allowed' }}>Join Class</Button>
            )}
          </div>

          {others.length > 0 && (
            <div className={styles.otherClassesWrapper}>
              {others.map((c, idx) => {
                const pkg = getPkg(c.student_id);
                const canJoin = isEligible(c);
                const joinUrl = getMeetingUrl(c.student_id, c.meeting_url);
                return (
                  <div key={`${c.session_id || idx}_${c.student_id}`} className={styles.otherClassRow}>
                    <div>
                      <span className={styles.otherClassName}>{c.student_name || c.student_id} — {getSubject(c)}</span>
                      <span className={styles.otherClassMeta}>{formatSessionTimeRange(c, pkg, activeTz)} • {c.session_status || c.status || 'SCHEDULED'}</span>
                    </div>
                    {canJoin ? (
                      <a href={joinUrl} target="_blank" rel="noopener noreferrer" style={{ textDecoration: 'none' }}>
                        <Button variant="secondary" size="sm">Join Class ↗</Button>
                      </a>
                    ) : (
                      <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-subtle)', fontStyle: 'italic' }}>
                        {joinUrl ? 'Scheduled' : 'No meeting link'}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export const ClassScheduleSection = TodayClassesSection;
