import React, { useState, useEffect } from 'react';
import styles from '../../components/overlays/confirmDialog.module.css';
import formStyles from '../../components/forms/forms.module.css';
import { Button } from '../../components/buttons/Button';
import { Student } from '../students/studentTypes';
import { Package } from '../packages/packageTypes';
import { ClassSession } from '../classes/classTypes';
import { scheduleClass } from '../classes/classApi';
import { getPackageRemainingCredits } from './extraClassAccounting';
import { makeIsoInTz } from '../dashboard/calendarEventGenerator';
import { invalidateAppData } from '../../context/AppDataContext';

export interface ScheduleExtraClassModalProps {
  isOpen: boolean;
  onClose: () => void;
  onScheduled: () => void;
  students: Student[];
  packages: Package[];
  classes: ClassSession[];
  initialDate?: string;
  token?: string | null;
  activeTz?: string;
}

export const ScheduleExtraClassModal: React.FC<ScheduleExtraClassModalProps> = ({
  isOpen, onClose, onScheduled, students, packages, classes, initialDate, token, activeTz = 'Asia/Kolkata',
}) => {
  const activeStudents = students.filter((s) => s.status !== 'ARCHIVED');
  const [studentId, setStudentId] = useState(activeStudents[0]?.student_id || '');
  const [date, setDate] = useState(initialDate || new Date().toISOString().slice(0, 10));
  const [startTime, setStartTime] = useState('17:00');
  const [duration, setDuration] = useState(60);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const studentPkgs = packages.filter((p) => p.student_id === studentId);
  const activePkg = studentPkgs.find((p) => p.status === 'ACTIVE') || studentPkgs[0];
  const remaining = activePkg ? getPackageRemainingCredits(activePkg, classes, packages) : 0;

  useEffect(() => {
    if (activePkg?.class_duration) setDuration(Number(activePkg.class_duration) || 60);
  }, [studentId, activePkg?.class_duration]);

  useEffect(() => {
    if (isOpen) {
      if (!studentId && activeStudents[0]) setStudentId(activeStudents[0].student_id);
      if (initialDate) setDate(initialDate);
      setError(null);
    }
  }, [isOpen, initialDate]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;
    if (!studentId) { setError('Please select a student.'); return; }
    if (!activePkg) { setError('Selected student has no active package.'); return; }
    if (remaining <= 0) { setError('Package has no remaining credits. Cannot schedule extra class.'); return; }
    if (!date || !startTime) { setError('Please select a valid date and start time.'); return; }

    setIsSubmitting(true);
    setError(null);
    try {
      const selectedStu = students.find((s) => s.student_id === studentId);
      const startIso = makeIsoInTz(date, startTime, activeTz);
      const endMins = Number(startTime.slice(0, 2)) * 60 + Number(startTime.slice(3, 5)) + duration;
      const endHH = String(Math.floor(endMins / 60)).padStart(2, '0');
      const endMM = String(endMins % 60).padStart(2, '0');
      const endIso = makeIsoInTz(date, `${endHH}:${endMM}`, activeTz);

      await scheduleClass({
        student_id: studentId,
        student_name: selectedStu?.student_name || selectedStu?.full_name || studentId,
        package_id: activePkg.package_id,
        schedule_date: date,
        schedule_time: startTime,
        class_date: date,
        start_time: startTime,
        scheduled_start: startIso,
        scheduled_end: endIso,
        duration_minutes: duration,
        topic: `${selectedStu?.subject || 'Class'} (Extra Class)`,
        class_title: `${selectedStu?.subject || 'Class'} (Extra Class)`,
      }, token);

      invalidateAppData('dashboard');
      onScheduled();
      onClose();
    } catch (err: unknown) {
      setError((err as Error).message || 'Failed to schedule extra class.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className={styles.backdrop} role="dialog" aria-modal="true" aria-labelledby="sec-title" onClick={(e) => { if (e.target === e.currentTarget && !isSubmitting) onClose(); }}>
      <div className={styles.dialog} style={{ maxWidth: '480px' }}>
        <h2 id="sec-title" className={styles.title}>Schedule Extra Class</h2>
        <p className={styles.body} style={{ marginBottom: 'var(--space-3)' }}>Schedule a one-time dated session using an active package credit without altering recurring schedules.</p>
        {error && <div style={{ color: '#dc2626', fontSize: 'var(--font-size-xs)', marginBottom: 'var(--space-3)' }}>{error}</div>}
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
          <div>
            <label className={formStyles.label} htmlFor="sec-student">Student</label>
            <select id="sec-student" className={formStyles.select} value={studentId} onChange={(e) => setStudentId(e.target.value)} disabled={isSubmitting}>
              {activeStudents.map((s) => <option key={s.student_id} value={s.student_id}>{s.student_name || s.full_name} ({s.student_id})</option>)}
            </select>
          </div>
          {activePkg ? (
            <div style={{ background: '#f8fafc', padding: '8px 12px', borderRadius: 'var(--radius-md)', fontSize: 'var(--font-size-xs)', border: '1px solid #e2e8f0' }}>
              <strong>Active Package:</strong> {activePkg.package_id} ({remaining} remaining credit{remaining === 1 ? '' : 's'})
            </div>
          ) : <div style={{ color: '#dc2626', fontSize: 'var(--font-size-xs)' }}>No package found for student.</div>}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-2)' }}>
            <div>
              <label className={formStyles.label} htmlFor="sec-date">Class Date</label>
              <input id="sec-date" className={formStyles.input} type="date" value={date} onChange={(e) => setDate(e.target.value)} disabled={isSubmitting} />
            </div>
            <div>
              <label className={formStyles.label} htmlFor="sec-time">Start Time</label>
              <input id="sec-time" className={formStyles.input} type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} disabled={isSubmitting} />
            </div>
          </div>
          <div>
            <label className={formStyles.label} htmlFor="sec-duration">Duration (Minutes)</label>
            <select id="sec-duration" className={formStyles.select} value={duration} onChange={(e) => setDuration(Number(e.target.value))} disabled={isSubmitting}>
              <option value={30}>30 minutes</option><option value={45}>45 minutes</option><option value={60}>60 minutes</option><option value={90}>90 minutes</option>
            </select>
          </div>
          <div className={styles.actions} style={{ marginTop: 'var(--space-3)' }}>
            <Button variant="secondary" type="button" onClick={onClose} disabled={isSubmitting}>Cancel</Button>
            <Button variant="primary" type="submit" disabled={isSubmitting || remaining <= 0}>{isSubmitting ? 'Scheduling…' : 'Confirm Extra Class'}</Button>
          </div>
        </form>
      </div>
    </div>
  );
};
