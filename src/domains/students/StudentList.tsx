import React, { useState, useEffect } from 'react';
import { Student } from './studentTypes';
import { useAuth } from '../../auth/AuthProvider';
import { useStudentAggregates } from './useStudentAggregates';
import { StudentRow } from './StudentRow';
import { StudentStatusTab, filterStudentsByTab } from './studentStatusClassifier';
import { EmptyState } from '../../components/feedback/EmptyState';
import { STUDENT_TABLE_COLUMNS, STUDENT_TABLE_GRID_TEMPLATE } from './studentTableLayout';
import styles from '../../components/tables/tables.module.css';

export interface StudentListProps {
  students: Student[];
  onSelectStudent: (student: Student) => void;
  onEditStudent: (student: Student) => void;
  onRenewStudent?: (student: Student) => void;
  activeTab?: StudentStatusTab;
  onTabChange?: (tab: StudentStatusTab) => void;
  onDisplayedCountChange?: (count: number) => void;
  aggregates?: ReturnType<typeof useStudentAggregates>;
}

export const StudentList: React.FC<StudentListProps> = ({
  students,
  onSelectStudent,
  onEditStudent,
  onRenewStudent,
  activeTab: controlledTab,
  onTabChange,
  onDisplayedCountChange,
  aggregates,
}) => {
  const { token } = useAuth();
  const [internalTab, setInternalTab] = useState<StudentStatusTab>('ACTIVE');
  const activeTab = controlledTab ?? internalTab;
  const [expandedStudentId, setExpandedStudentId] = useState<string | null>(null);
  void setInternalTab;
  void onTabChange;

  const studentIds = students.map((s) => s.student_id);
  const internalAggregates = useStudentAggregates(aggregates ? [] : studentIds, token);
  const {
    getStudentBalance,
    getStudentLastCompletedDate,
    getStudentSchedule,
    getStudentFinancials,
  } = aggregates || internalAggregates;

  const displayedStudents = filterStudentsByTab(
    students,
    activeTab,
    getStudentBalance,
    getStudentLastCompletedDate
  );

  useEffect(() => {
    onDisplayedCountChange?.(displayedStudents.length);
  }, [displayedStudents.length, onDisplayedCountChange]);

  const handleToggleExpand = (sid: string) => {
    setExpandedStudentId((prev) => (prev === sid ? null : sid));
  };

  if (displayedStudents.length === 0) {
    return (
      <EmptyState
        title={activeTab === 'ACTIVE' ? 'No active students' : activeTab === 'INACTIVE' ? 'No inactive students' : 'No students found'}
        description={
          activeTab === 'ACTIVE'
            ? 'No registered students have remaining classes available.'
            : activeTab === 'INACTIVE'
            ? 'No students currently have exhausted or inactive packages.'
            : 'No records match your search or filters.'
        }
      />
    );
  }

  return (
    <div className={styles.tableWrapper}>
      <table className={styles.table} style={{ display: 'block', width: '100%', minWidth: '820px' }}>
        <thead style={{ display: 'block', width: '100%' }}>
          <tr style={{ display: 'grid', gridTemplateColumns: STUDENT_TABLE_GRID_TEMPLATE, width: '100%', borderBottom: '1px solid var(--color-border-subtle)', alignItems: 'stretch' }}>
            <th style={{ ...STUDENT_TABLE_COLUMNS.student, borderBottom: 'none', display: 'flex', alignItems: 'center', width: '100%', boxSizing: 'border-box' }}>Student Name</th>
            <th style={{ ...STUDENT_TABLE_COLUMNS.subject, borderBottom: 'none', display: 'flex', alignItems: 'center', width: '100%', boxSizing: 'border-box' }}>Subject</th>
            <th style={{ ...STUDENT_TABLE_COLUMNS.schedule, borderBottom: 'none', display: 'flex', alignItems: 'center', width: '100%', boxSizing: 'border-box' }}>Class Schedule</th>
            <th style={{ ...STUDENT_TABLE_COLUMNS.classes, borderBottom: 'none', display: 'flex', alignItems: 'center', width: '100%', boxSizing: 'border-box' }}>Classes</th>
            <th style={{ ...STUDENT_TABLE_COLUMNS.meetingLink, borderBottom: 'none', display: 'flex', alignItems: 'center', width: '100%', boxSizing: 'border-box' }}>Meeting Link</th>
          </tr>
        </thead>
        <tbody style={{ display: 'block', width: '100%' }}>
          {displayedStudents.map((student) => {
            const bal = getStudentBalance(student.student_id);
            const isAct = (student.status || '').trim().toUpperCase() === 'ACTIVE';
            return (
              <StudentRow
                key={student.student_id}
                student={student}
                isActive={isAct}
                isExpanded={expandedStudentId === student.student_id}
                onToggleExpand={handleToggleExpand}
                onSelectStudent={onSelectStudent}
                onEditStudent={onEditStudent}
                onRenewStudent={onRenewStudent}
                schedule={getStudentSchedule(student.student_id)}
                balance={bal}
                financials={getStudentFinancials(student.student_id)}
                meetingLink={{ meeting_link_1: student.primary_meeting_link }}
              />
            );
          })}
        </tbody>
      </table>
    </div>
  );
};
