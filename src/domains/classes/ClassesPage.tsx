import React, { useState, useEffect } from 'react';
import { usePageTitle } from '../../hooks/usePageTitle';
import { ClassSchedule } from './ClassSchedule';
import { ClassSessionForm } from './ClassSessionForm';
import { scheduleClass } from './classApi';
import { ClassSessionInput } from './classTypes';
import { fetchStudents } from '../students/studentApi';
import { Student } from '../students/studentTypes';
import { useAuth } from '../../auth/AuthProvider';
import { Button } from '../../components/buttons/Button';
import { PageHeader } from '../../layout/PageHeader';
import formStyles from '../../components/forms/forms.module.css';

export const ClassesPage: React.FC = () => {
  usePageTitle('Class Schedule & Attendance');
  const { token } = useAuth();
  const [isScheduling, setIsScheduling] = useState(false);
  const [formLoading, setFormLoading] = useState(false);
  const [scheduleError, setScheduleError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [students, setStudents] = useState<Student[]>([]);
  const [selectedStudentId, setSelectedStudentId] = useState('');

  useEffect(() => {
    fetchStudents({}, token).then(setStudents).catch(() => []);
  }, [token]);

  const handleScheduleSubmit = async (input: ClassSessionInput) => {
    setFormLoading(true);
    setScheduleError(null);
    try {
      await scheduleClass(input, token);
      setIsScheduling(false);
      setRefreshKey((k) => k + 1);
    } catch (err: unknown) {
      setScheduleError((err as Error).message || 'Failed to schedule class session');
    } finally {
      setFormLoading(false);
    }
  };

  const scheduleForm = isScheduling && (
    <div style={{
      backgroundColor: 'var(--color-bg-surface)',
      border: '1px solid var(--color-border-subtle)',
      borderRadius: 'var(--radius-xl)',
      padding: '1.5rem',
      marginBottom: 'var(--space-6)',
      boxShadow: 'var(--shadow-sm)',
    }}>
      <h3 style={{ margin: '0 0 var(--space-4)', fontSize: 'var(--font-size-base)', fontWeight: 600 }}>
        Schedule New Class Session
      </h3>
      {scheduleError && (
        <div style={{ padding: '0.75rem 1rem', backgroundColor: 'var(--color-danger-bg)', border: '1px solid var(--color-danger-border)', borderRadius: 'var(--radius-md)', color: 'var(--color-danger-text)', fontSize: 'var(--font-size-sm)', marginBottom: 'var(--space-3)' }}>
          ⚠️ {scheduleError}
        </div>
      )}
      <ClassSessionForm
        onSubmit={handleScheduleSubmit}
        onCancel={() => { setIsScheduling(false); setScheduleError(null); }}
        isLoading={formLoading}
      />
    </div>
  );

  const toolbarRight = (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 'var(--space-2)', flexWrap: 'wrap' }}>
      <select
        id="filter-schedule-student"
        className={formStyles.select}
        style={{
          width: 'auto',
          minWidth: '220px',
          maxWidth: '340px',
          height: '38px',
          padding: '0 2rem 0 0.75rem',
          borderRadius: 'var(--radius-md)',
          fontSize: 'var(--font-size-sm)',
          boxSizing: 'border-box',
        }}
        value={selectedStudentId}
        onChange={(e) => setSelectedStudentId(e.target.value)}
        aria-label="Filter schedule by student"
      >
        <option value="">All Students (Showing all classes)</option>
        {students.map((s) => (
          <option key={s.student_id} value={s.student_id}>
            {s.student_name || s.full_name} ({s.student_id})
          </option>
        ))}
      </select>
      {selectedStudentId && (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setSelectedStudentId('')}
          style={{ height: '38px', whiteSpace: 'nowrap' }}
        >
          ✕ Clear
        </Button>
      )}
      <Button
        variant="primary"
        size="md"
        onClick={() => setIsScheduling(!isScheduling)}
        style={{ height: '38px', whiteSpace: 'nowrap' }}
      >
        {isScheduling ? 'Cancel' : '+ Schedule Class'}
      </Button>
    </div>
  );

  return (
    <div>
      <PageHeader title="Class Schedule & Attendance" />
      <ClassSchedule
        key={`${refreshKey}_${selectedStudentId}`}
        studentId={selectedStudentId || undefined}
        onRefreshTrigger={refreshKey}
        toolbarRight={toolbarRight}
        scheduleForm={scheduleForm}
      />
    </div>
  );
};
