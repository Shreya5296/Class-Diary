import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../../auth/AuthProvider';
import { usePageTitle } from '../../hooks/usePageTitle';
import { useDebouncedValue } from '../../hooks/useDebouncedValue';
import { Student } from './studentTypes';
import { fetchStudents } from './studentApi';
import { StudentToolbar } from './StudentToolbar';
import { StudentList } from './StudentList';
import { EditStudentModal } from './EditStudentModal';
import { AddStudentModal } from './AddStudentModal';
import { StudentProfilePage } from './StudentProfilePage';
import { StudentRenewalModal } from '../packages/StudentRenewalModal';
import { RenewalResult } from '../packages/packageRenewalTypes';
import { StudentsTableSkeleton } from '../../components/feedback/Skeleton';
import { ErrorState } from '../../components/feedback/ErrorState';
import { PageHeader } from '../../layout/PageHeader';
import { StudentStatusTab, filterStudentsByTab } from './studentStatusClassifier';
import { useStudentAggregates } from './useStudentAggregates';

export const StudentsPage: React.FC = () => {
  usePageTitle('Students Directory');
  const { token } = useAuth();
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const debouncedQuery = useDebouncedValue(searchQuery, 300);
  const [activeTab, setActiveTab] = useState<StudentStatusTab>('ACTIVE');
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [editingStudent, setEditingStudent] = useState<Student | null>(null);
  const [renewingStudent, setRenewingStudent] = useState<Student | null>(null);
  const [isRenewing, setIsRenewing] = useState(false);
  const [isCreating, setIsCreating] = useState(false);

  const studentIds = useMemo(() => students.map((s) => s.student_id), [students]);
  const aggregates = useStudentAggregates(studentIds, token);

  const loadStudents = async () => {
    setLoading(true);
    setError(null);
    try {
      setStudents(await fetchStudents({ query: debouncedQuery }, token));
    } catch (err: unknown) {
      setError((err as Error).message || 'Failed to load students');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadStudents(); }, [debouncedQuery, token]);

  const activeCount = useMemo(() => filterStudentsByTab(students, 'ACTIVE', aggregates.getStudentBalance).length, [students, aggregates.getStudentBalance]);
  const inactiveCount = students.length - activeCount;

  const handleStatusFilterChange = (val: string) => {
    setActiveTab(val === 'ACTIVE' ? 'ACTIVE' : val === 'INACTIVE' ? 'INACTIVE' : 'ALL');
  };

  const handleFeedback = (msg: string) => {
    setFeedback(msg);
    setRefreshKey((k) => k + 1);
    setTimeout(() => setFeedback(null), 4000);
    loadStudents();
  };

  const handleEditSuccess = async (updated: Student, msg: string) => {
    if (selectedStudent) setSelectedStudent(updated);
    setEditingStudent(null);
    handleFeedback(msg || 'Student details saved successfully');
  };

  const handleRegistrationSuccess = async (_s: Student, msg: string) => {
    setIsCreating(false);
    handleFeedback(msg);
  };

  const handleRenewalSuccess = async (_res: RenewalResult, msg: string) => {
    setIsRenewing(false);
    setRenewingStudent(null);
    handleFeedback(msg);
    if (selectedStudent) {
      const refreshed = await fetchStudents({ query: selectedStudent.student_id }, token);
      if (refreshed.length > 0) setSelectedStudent(refreshed[0]);
    }
  };

  const banner = feedback && (
    <div style={{ padding: '10px 14px', backgroundColor: '#ecfdf5', color: '#065f46', border: '1px solid #a7f3d0', borderRadius: 'var(--radius-md)', marginBottom: 'var(--space-4)', fontSize: 'var(--font-size-sm)' }}>
      ✓ {feedback}
    </div>
  );

  const closeRenewal = () => { setIsRenewing(false); setRenewingStudent(null); };

  if (selectedStudent) {
    return (
      <div>
        {banner}
        <StudentProfilePage student={selectedStudent} onBack={() => { setSelectedStudent(null); loadStudents(); }} onEdit={() => setEditingStudent(selectedStudent)} onRenew={() => { setRenewingStudent(selectedStudent); setIsRenewing(true); }} onUpdate={(u) => setSelectedStudent(u)} />
        {editingStudent && <EditStudentModal student={editingStudent} onSuccess={handleEditSuccess} onClose={() => setEditingStudent(null)} />}
        {isRenewing && <StudentRenewalModal initialStudent={renewingStudent} onSuccess={handleRenewalSuccess} onClose={closeRenewal} />}
      </div>
    );
  }

  const statusDropdownVal = activeTab === 'ACTIVE' ? 'ACTIVE' : activeTab === 'INACTIVE' ? 'INACTIVE' : '';

  return (
    <div>
      <PageHeader title="Students Directory" />
      {banner}
      <StudentToolbar
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        activeTab={activeTab}
        onTabChange={setActiveTab}
        activeCount={activeCount}
        inactiveCount={inactiveCount}
        allCount={students.length}
        statusFilter={statusDropdownVal}
        onStatusFilterChange={handleStatusFilterChange}
        onRenew={() => { setRenewingStudent(null); setIsRenewing(true); }}
        onAddStudent={() => setIsCreating(true)}
      />
      {isCreating && <AddStudentModal onSuccess={handleRegistrationSuccess} onClose={() => setIsCreating(false)} />}
      {editingStudent && <EditStudentModal student={editingStudent} onSuccess={handleEditSuccess} onClose={() => setEditingStudent(null)} />}
      {isRenewing && <StudentRenewalModal initialStudent={renewingStudent} onSuccess={handleRenewalSuccess} onClose={closeRenewal} />}
      {loading && students.length === 0 && <StudentsTableSkeleton />}
      {error && !loading && students.length === 0 && <ErrorState message={error} onRetry={loadStudents} />}
      {(!loading || students.length > 0) && (
        <StudentList
          key={refreshKey}
          students={students}
          activeTab={activeTab}
          onTabChange={setActiveTab}
          onSelectStudent={setSelectedStudent}
          onEditStudent={setEditingStudent}
          onRenewStudent={(s) => { setRenewingStudent(s); setIsRenewing(true); }}
          aggregates={aggregates}
        />
      )}
    </div>
  );
};
