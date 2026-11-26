import React, { useState } from 'react';
import { useAuth } from '../../auth/AuthProvider';
import { Student } from './studentTypes';
import { StudentSummary } from './StudentSummary';
import { StudentFinancialSummaryCard } from './StudentFinancialSummaryCard';
import { Button } from '../../components/buttons/Button';
import { ArrowLeftIcon } from '../../components/icons/ActionIcons';
import { PackageList } from '../packages/PackageList';
import { PaymentList } from '../payments/PaymentList';
import { ClassSchedule } from '../classes/ClassSchedule';
import { GeneratePackageClassesModal } from '../classes/GeneratePackageClassesModal';

export interface StudentProfilePageProps {
  student: Student;
  onBack: () => void;
  onEdit: () => void;
  onRenew?: () => void;
  onUpdate?: (updated: Student) => void;
}

type TabType = 'packages' | 'payments' | 'classes';

export const StudentProfilePage: React.FC<StudentProfilePageProps> = ({
  student, onBack, onEdit, onRenew,
}) => {
  const { token } = useAuth();
  const [activeTab, setActiveTab] = useState<TabType>('packages');
  const [showGenerateModal, setShowGenerateModal] = useState(false);
  const [scheduleVersion, setScheduleVersion] = useState(0);

  const tabs: { id: TabType; label: string }[] = [
    { id: 'packages', label: 'Packages & Balances' },
    { id: 'payments', label: 'Payment History' },
    { id: 'classes', label: 'Classes & Attendance' },
  ];

  return (
    <div style={{ paddingTop: '1.75rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-4)' }}>
        <Button variant="outline" size="sm" onClick={onBack}>
          <ArrowLeftIcon size={14} /> Back to Directory
        </Button>
        <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
          {onRenew && <Button variant="secondary" size="sm" onClick={onRenew}>Renew Package</Button>}
          <Button variant="primary" size="sm" onClick={onEdit}>Edit Profile</Button>
        </div>
      </div>

      <StudentSummary student={student} />
      <StudentFinancialSummaryCard studentId={student.student_id} token={token} />

      <div style={{ display: 'flex', gap: 'var(--space-1)', borderBottom: '1px solid var(--color-border-subtle)', marginBottom: 'var(--space-5)', overflowX: 'auto' }}>
        {tabs.map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              style={{
                padding: '0.625rem 1rem', border: 'none', background: 'none',
                fontWeight: isActive ? 600 : 500, fontSize: 'var(--font-size-sm)',
                color: isActive ? 'var(--color-primary)' : 'var(--color-text-muted)',
                borderBottom: isActive ? '2px solid var(--color-primary)' : '2px solid transparent',
                cursor: 'pointer', whiteSpace: 'nowrap',
              }}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      <div>
        {activeTab === 'packages' && <PackageList studentId={student.student_id} onRenew={onRenew} />}
        {activeTab === 'payments' && <PaymentList studentId={student.student_id} />}
        {activeTab === 'classes' && (
          <ClassSchedule
            key={scheduleVersion}
            studentId={student.student_id}
            toolbarRight={
              <Button variant="outline" size="sm" onClick={() => setShowGenerateModal(true)}>
                Generate classes
              </Button>
            }
          />
        )}
      </div>

      <GeneratePackageClassesModal
        isOpen={showGenerateModal}
        studentId={student.student_id}
        studentName={student.student_name || student.full_name}
        token={token}
        onClose={() => setShowGenerateModal(false)}
        onGenerated={() => setScheduleVersion((v) => v + 1)}
      />
    </div>
  );
};
