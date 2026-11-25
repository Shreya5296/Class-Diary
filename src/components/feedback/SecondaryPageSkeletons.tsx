import React from 'react';
import { SkeletonBone, SkeletonText, SkeletonTitle, SkeletonCard } from './SkeletonPrimitives';
import styles from './skeleton.module.css';

export const ClassScheduleSkeleton: React.FC = () => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }} aria-busy="true">
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
      <SkeletonBone width={240} height={38} />
      <SkeletonBone width={140} height={38} />
    </div>
    <div className={styles.tableContainer}>
      <div className={styles.tableHeader}>
        <SkeletonText width="25%" />
        <SkeletonText width="25%" />
        <SkeletonText width="25%" />
        <SkeletonText width="25%" />
      </div>
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className={styles.tableRow}>
          <div style={{ width: '25%' }}><SkeletonText width="80%" /></div>
          <div style={{ width: '25%' }}><SkeletonText width="60%" /></div>
          <div style={{ width: '25%' }}><SkeletonText width="70%" /></div>
          <div style={{ width: '25%' }}><SkeletonBone width={80} height={24} /></div>
        </div>
      ))}
    </div>
  </div>
);

export const FinancesSkeleton: React.FC = () => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-5)' }} aria-busy="true">
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 'var(--space-4)' }}>
      {Array.from({ length: 3 }).map((_, i) => (
        <SkeletonCard key={i} height={108} style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <SkeletonText width="45%" height="13px" />
          <SkeletonTitle width="60%" height="28px" />
        </SkeletonCard>
      ))}
    </div>
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px' }}>
      <SkeletonBone width={200} height={36} />
      <div style={{ display: 'flex', gap: '8px' }}>
        <SkeletonBone width={110} height={36} />
        <SkeletonBone width={120} height={36} />
      </div>
    </div>
    <div style={{ display: 'flex', gap: '16px', borderBottom: '1px solid var(--color-border)' }}>
      <SkeletonBone width={130} height={32} style={{ borderRadius: '4px 4px 0 0' }} />
      <SkeletonBone width={130} height={32} style={{ borderRadius: '4px 4px 0 0' }} />
    </div>
    <div className={styles.tableContainer}>
      <div className={styles.tableHeader}>
        <SkeletonText width="20%" />
        <SkeletonText width="18%" />
        <SkeletonText width="20%" />
        <SkeletonText width="20%" />
        <SkeletonText width="22%" />
      </div>
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className={styles.tableRow}>
          <div style={{ width: '20%' }}><SkeletonText width="75%" /></div>
          <div style={{ width: '18%' }}><SkeletonText width="60%" /></div>
          <div style={{ width: '20%' }}><SkeletonText width="65%" /></div>
          <div style={{ width: '20%' }}><SkeletonText width="65%" /></div>
          <div style={{ width: '22%' }}><SkeletonText width="80%" /></div>
        </div>
      ))}
    </div>
  </div>
);

export const FormSkeleton: React.FC = () => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)', padding: 'var(--space-4)' }} aria-busy="true">
    <SkeletonTitle width="50%" />
    <SkeletonBone height={40} />
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
      <SkeletonBone height={40} />
      <SkeletonBone height={40} />
    </div>
    <SkeletonBone height={40} />
    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '12px' }}>
      <SkeletonBone width={90} height={36} />
      <SkeletonBone width={110} height={36} />
    </div>
  </div>
);
