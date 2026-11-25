import React from 'react';
import { SkeletonBone, SkeletonText, SkeletonTitle, SkeletonCircle, SkeletonCard } from './SkeletonPrimitives';
import styles from './skeleton.module.css';

export const DashboardSkeleton: React.FC = () => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }} aria-busy="true">
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 'var(--space-6)' }}>
      <SkeletonCard height={118} style={{ display: 'flex', alignItems: 'center', gap: '1.25rem' }}>
        <SkeletonCircle size={76} />
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', flex: 1 }}>
          <SkeletonTitle width="60%" />
          <SkeletonText width="40%" />
        </div>
      </SkeletonCard>
      <SkeletonCard height={118} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        <SkeletonTitle width="50%" />
        <div style={{ display: 'flex', gap: '8px' }}>
          <SkeletonBone width={80} height={32} />
          <SkeletonBone width={80} height={32} />
        </div>
      </SkeletonCard>
    </div>
    <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 0.8fr', gap: 'var(--space-6)' }}>
      <SkeletonCard height={340} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <SkeletonTitle width="40%" />
        <SkeletonBone height={80} style={{ borderRadius: 'var(--radius-lg)' }} />
        <SkeletonBone height={60} style={{ borderRadius: 'var(--radius-md)' }} />
      </SkeletonCard>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
        <SkeletonCard height={160} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <SkeletonTitle width="50%" />
          <SkeletonText width="90%" />
          <SkeletonText width="70%" />
        </SkeletonCard>
        <SkeletonCard height={280} style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <SkeletonTitle width="50%" />
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '6px', marginTop: '8px' }}>
            {Array.from({ length: 35 }).map((_, i) => (
              <SkeletonBone key={i} height={28} style={{ borderRadius: 'var(--radius-sm)' }} />
            ))}
          </div>
        </SkeletonCard>
      </div>
    </div>
  </div>
);

export const StudentsTableSkeleton: React.FC = () => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }} aria-busy="true">
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
      <SkeletonBone width={240} height={38} />
      <div style={{ display: 'flex', gap: '8px' }}>
        <SkeletonBone width={100} height={38} />
        <SkeletonBone width={110} height={38} />
      </div>
    </div>
    <div className={styles.tableContainer}>
      <div className={styles.tableHeader}>
        <SkeletonText width="22%" />
        <SkeletonText width="20%" />
        <SkeletonText width="22%" />
        <SkeletonText width="16%" />
        <SkeletonText width="20%" />
      </div>
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className={styles.tableRow}>
          <div style={{ width: '22%', display: 'flex', gap: '10px', alignItems: 'center' }}>
            <SkeletonCircle size={32} />
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <SkeletonText width="80%" />
              <SkeletonText width="50%" height="11px" />
            </div>
          </div>
          <div style={{ width: '20%' }}><SkeletonText width="70%" /></div>
          <div style={{ width: '22%' }}><SkeletonText width="85%" /></div>
          <div style={{ width: '16%' }}><SkeletonText width="60%" /></div>
          <div style={{ width: '20%' }}><SkeletonBone width={90} height={24} /></div>
        </div>
      ))}
    </div>
  </div>
);

export const CalendarSkeleton: React.FC = () => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }} aria-busy="true">
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
      <div style={{ display: 'flex', gap: '8px' }}>
        <SkeletonBone width={36} height={36} />
        <SkeletonBone width={60} height={36} />
        <SkeletonBone width={36} height={36} />
      </div>
      <div style={{ display: 'flex', gap: '8px' }}>
        <SkeletonBone width={160} height={36} />
        <SkeletonBone width={140} height={36} />
      </div>
    </div>
    <div className={styles.tableContainer}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', padding: '10px', gap: '8px', borderBottom: '1px solid var(--color-border-subtle)' }}>
        {Array.from({ length: 7 }).map((_, i) => (
          <SkeletonText key={i} width="50%" style={{ margin: '0 auto' }} />
        ))}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gridAutoRows: '96px', gap: '1px', backgroundColor: 'var(--color-border-subtle)' }}>
        {Array.from({ length: 35 }).map((_, i) => (
          <div key={i} style={{ backgroundColor: 'var(--color-bg-surface)', padding: '8px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <SkeletonBone width={20} height={20} style={{ borderRadius: 'var(--radius-full)' }} />
            {i % 3 === 0 && <SkeletonBone height={16} width="85%" />}
          </div>
        ))}
      </div>
    </div>
  </div>
);
