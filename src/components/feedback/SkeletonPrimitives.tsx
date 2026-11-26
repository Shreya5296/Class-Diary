import React from 'react';
import styles from './skeleton.module.css';

export interface SkeletonProps {
  width?: string | number;
  height?: string | number;
  className?: string;
  style?: React.CSSProperties;
}

export const SkeletonBone: React.FC<SkeletonProps> = ({ width, height, className = '', style }) => {
  return (
    <div
      aria-hidden="true"
      className={`${styles.bone} ${className}`.trim()}
      style={{ width, height, ...style }}
    />
  );
};

export const SkeletonText: React.FC<SkeletonProps> = ({ width = '100%', height = '14px', style }) => {
  return <SkeletonBone width={width} height={height} className={styles.text} style={style} />;
};

export const SkeletonTitle: React.FC<SkeletonProps> = ({ width = '50%', height = '22px', style }) => {
  return <SkeletonBone width={width} height={height} className={styles.title} style={style} />;
};

export const SkeletonCircle: React.FC<{ size?: number | string; style?: React.CSSProperties }> = ({
  size = 40,
  style,
}) => {
  return (
    <SkeletonBone
      width={size}
      height={size}
      className={styles.circle}
      style={{ minWidth: size, minHeight: size, ...style }}
    />
  );
};

export const SkeletonCard: React.FC<{
  height?: string | number;
  children?: React.ReactNode;
  style?: React.CSSProperties;
}> = ({ height, children, style }) => {
  return (
    <div aria-hidden="true" className={styles.card} style={{ height, ...style }}>
      {children}
    </div>
  );
};
