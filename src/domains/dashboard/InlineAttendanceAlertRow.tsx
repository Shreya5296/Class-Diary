import React, { useState } from 'react';
import styles from './inlineAttendanceAlertRow.module.css';
import { AttentionAlert } from './attentionAlertTypes';
import { Button } from '../../components/buttons/Button';
import { recordAttendance, cancelClass, scheduleClass } from '../classes/classApi';
import { invalidateAppData } from '../../context/AppDataContext';

export interface InlineAttendanceAlertRowProps {
  alert: AttentionAlert; isExpanded: boolean; onToggle: () => void;
  token?: string | null; onRefresh?: () => Promise<void>;
}

export const InlineAttendanceAlertRow: React.FC<InlineAttendanceAlertRowProps> = ({
  alert, isExpanded, onToggle, token, onRefresh,
}) => {
  const [isRescheduling, setIsRescheduling] = useState(false);
  const [rescheduleDate, setRescheduleDate] = useState(() => new Date(Date.now() + 86400000).toISOString().slice(0, 10));
  const [rescheduleTime, setRescheduleTime] = useState(() => alert.session?.schedule_time || alert.session?.start_time?.slice(11, 16) || '10:00');
  const [notes, setNotes] = useState('');
  const [validationErr, setValidationErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const sessionId = alert.sessionId || alert.id.replace('alert_att_', '');
  const handleCancel = () => { setIsRescheduling(false); setValidationErr(null); setNotes(''); onToggle(); };

  const getValidNotes = () => {
    const t = notes.trim();
    if (!t) { setValidationErr('Attendance notes are required.'); return null; }
    return t;
  };

  const submitStatus = async (outcome: 'PRESENT' | 'NO_SHOW', label: string) => {
    if (loading) return;
    const vNotes = getValidNotes();
    if (!vNotes) return;
    setLoading(true); setErrorMsg(null);
    try {
      await recordAttendance(sessionId, outcome, token, undefined, vNotes);
      invalidateAppData('dashboard');
      setSuccessMsg(`✓ Marked ${label}`);
      if (onRefresh) await onRefresh();
    } catch (err: unknown) {
      setErrorMsg((err as Error).message || `Failed to mark ${label}`);
    } finally { setLoading(false); }
  };

  const handleConfirmReschedule = async () => {
    if (loading) return;
    const vNotes = getValidNotes();
    if (!vNotes) return;
    if (!rescheduleDate || !rescheduleTime) { setValidationErr('Specify both date and time.'); return; }
    setLoading(true); setErrorMsg(null);
    try {
      const [y, m, d] = rescheduleDate.split('-').map(Number), [sh, sm] = rescheduleTime.split(':').map(Number);
      const startDt = new Date(Date.UTC(y, m - 1, d, sh, sm, 0)), dur = Number(alert.session?.duration_minutes) || 60;
      const endDt = new Date(startDt.getTime() + dur * 60000);
      await cancelClass(sessionId, `${vNotes} (Rescheduled to ${rescheduleDate} at ${rescheduleTime})`, token);
      await scheduleClass({
        student_id: alert.studentId, student_name: alert.studentName, schedule_date: rescheduleDate,
        schedule_time: rescheduleTime, start_time: startDt.toISOString(), scheduled_start: startDt.toISOString(),
        scheduled_end: endDt.toISOString(), duration_minutes: dur, topic: `${alert.studentName} - Rescheduled Class`,
        class_title: `${alert.studentName} - Rescheduled Class`, deduct_class: false,
        session_notes: `${vNotes} (Rescheduled from ${alert.formattedClassDate || alert.classDate || 'previous session'})`,
      }, token);
      invalidateAppData('dashboard');
      setSuccessMsg(`✓ Rescheduled to ${rescheduleDate}`);
      if (onRefresh) await onRefresh();
    } catch (err: unknown) {
      setErrorMsg((err as Error).message || 'Failed to reschedule class');
    } finally { setLoading(false); }
  };

  const dateLabel = alert.formattedClassDate ? `Class date: ${alert.formattedClassDate}` : (alert.classDate ? `Class date: ${alert.classDate}` : 'Class date: Date unavailable');

  return (
    <div className={styles.row}>
      <div className={styles.unexpandedHeader}>
        <div className={styles.alertInfo}>
          <span className={styles.dotPending} aria-hidden="true" />
          <div className={styles.alertDetails}>
            <span className={styles.alertStudent}>{alert.studentName}</span>
            <span className={styles.classDate}>{dateLabel}</span>
            <span className={styles.alertReason}>{alert.reason}</span>
          </div>
        </div>
        {!isExpanded ? (
          <Button variant="secondary" size="sm" onClick={onToggle} aria-expanded={false}>{`${alert.actionLabel} →`}</Button>
        ) : !isRescheduling ? (
          <div className={styles.actionButtonsRow}>
            <button type="button" className={styles.btnPresent} onClick={() => submitStatus('PRESENT', 'Present')} disabled={loading}>{loading ? 'Marking…' : 'Present'}</button>
            <button type="button" className={styles.btnAbsent} onClick={() => submitStatus('NO_SHOW', 'Absent')} disabled={loading}>{loading ? 'Marking…' : 'Absent'}</button>
            <button type="button" className={styles.btnRescheduled} onClick={() => { setIsRescheduling(true); setValidationErr(null); }} disabled={loading}>Rescheduled</button>
            <button type="button" className={styles.btnCancel} onClick={handleCancel} disabled={loading}>Cancel</button>
          </div>
        ) : null}
      </div>

      {isExpanded && !isRescheduling && (
        <div className={styles.notesContainer}>
          <input type="text" className={`${styles.notesInput} ${validationErr ? styles.inputError : ''}`} placeholder="Enter attendance notes..." value={notes} onChange={(e) => { setNotes(e.target.value); setValidationErr(null); }} disabled={loading} aria-label="Attendance notes" />
          {validationErr && <span className={styles.validationText}>{validationErr}</span>}
        </div>
      )}
      {successMsg && <div className={styles.feedbackSuccess}>{successMsg}</div>}
      {errorMsg && <div className={styles.feedbackError}>⚠️ {errorMsg}</div>}

      {isExpanded && isRescheduling && (
        <div className={styles.rescheduleSection}>
          <div className={styles.rescheduleInputs}>
            <label className={styles.inputGroup}><span className={styles.inputLabel}>New Date</span><input type="date" className={styles.inputField} value={rescheduleDate} onChange={(e) => setRescheduleDate(e.target.value)} disabled={loading} /></label>
            <label className={styles.inputGroup}><span className={styles.inputLabel}>New Time</span><input type="time" className={styles.inputField} value={rescheduleTime} onChange={(e) => setRescheduleTime(e.target.value)} disabled={loading} /></label>
            <label className={`${styles.inputGroup} ${styles.inputGroupGrow}`}><span className={styles.inputLabel}>Reason / Notes</span><input type="text" className={`${styles.inputField} ${validationErr ? styles.inputError : ''}`} placeholder="Enter attendance notes..." value={notes} onChange={(e) => { setNotes(e.target.value); setValidationErr(null); }} disabled={loading} /></label>
          </div>
          {validationErr && <span className={styles.validationText}>{validationErr}</span>}
          <div className={styles.actionButtonsRow}>
            <button type="button" className={styles.btnRescheduled} onClick={handleConfirmReschedule} disabled={loading}>{loading ? 'Rescheduling…' : 'Confirm Reschedule'}</button>
            <button type="button" className={styles.btnCancel} onClick={() => { setIsRescheduling(false); setValidationErr(null); }} disabled={loading}>Back</button>
            <button type="button" className={styles.btnCancel} onClick={handleCancel} disabled={loading}>Cancel</button>
          </div>
        </div>
      )}
    </div>
  );
};
