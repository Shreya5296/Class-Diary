import React from 'react';
import { NavSection } from '../../layout/Sidebar';
import { ClassSession } from '../classes/classTypes';
import { formatDateTime } from '../../lib/dateFormat';
import { Button } from '../../components/buttons/Button';

export interface DashboardFollowUpsProps {
  classes: ClassSession[];
  onNavigate: (section: NavSection) => void;
}

export const DashboardFollowUps: React.FC<DashboardFollowUpsProps> = ({
  classes,
  onNavigate,
}) => {
  const upcomingClasses = classes
    .filter((c) => c.status === 'SCHEDULED')
    .slice(0, 4);

  const cardStyle: React.CSSProperties = {
    backgroundColor: 'var(--color-bg-surface)',
    border: '1px solid var(--color-border-subtle)',
    borderRadius: 'var(--radius-xl)',
    padding: '1.25rem 1.5rem',
    boxShadow: 'var(--shadow-xs)',
    display: 'flex',
    flexDirection: 'column',
  };

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 'var(--space-4)', marginTop: 'var(--space-6)' }}>
      <div style={cardStyle}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-3)' }}>
          <h3 style={{ margin: 0, fontSize: 'var(--font-size-base)', fontWeight: 600 }}>Upcoming Classes</h3>
          <Button variant="ghost" size="sm" onClick={() => onNavigate('classes')}>View All →</Button>
        </div>
        {upcomingClasses.length === 0 ? (
          <p style={{ margin: 0, color: 'var(--color-text-muted)', fontSize: 'var(--font-size-sm)', padding: 'var(--space-4) 0' }}>
            No upcoming sessions scheduled this week.
          </p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
            {upcomingClasses.map((c, idx) => (
              <div key={`${c.session_id || 'cls'}_${c.student_id || ''}_${idx}`} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.5rem 0', borderBottom: '1px solid var(--color-border-subtle)' }}>
                <div>
                  <span style={{ fontWeight: 600, fontSize: 'var(--font-size-sm)', display: 'block', color: 'var(--color-text-main)' }}>
                    {c.topic || 'Class Session'}
                  </span>
                  <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)' }}>
                    {formatDateTime(c.start_time)} ({c.duration_minutes} min)
                  </span>
                </div>
                {c.meeting_url && (
                  <a href={c.meeting_url} target="_blank" rel="noopener noreferrer" style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-primary)', fontWeight: 600 }}>
                    Join ↗
                  </a>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
