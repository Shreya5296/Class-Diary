import React from 'react';
import { CalendarViewMode } from './calendarTypes';
import { Button } from '../../components/buttons/Button';
import styles from './calendarControlsBar.module.css';

export interface CalendarControlsBarProps {
  viewMode: CalendarViewMode;
  onChangeViewMode: (mode: CalendarViewMode) => void;
  titleText: string;
  countLabel?: string;
  onPrev: () => void;
  onNext: () => void;
  onToday: () => void;
  onRefresh: () => void;
}

export const CalendarControlsBar: React.FC<CalendarControlsBarProps> = ({
  viewMode,
  onChangeViewMode,
  titleText,
  countLabel,
  onPrev,
  onNext,
  onToday,
  onRefresh,
}) => {
  const prevLabel = viewMode === 'day' ? '‹ Prev Day' : viewMode === 'week' ? '‹ Prev Week' : '‹ Prev Month';
  const nextLabel = viewMode === 'day' ? 'Next Day ›' : viewMode === 'week' ? 'Next Week ›' : 'Next Month ›';
  const todayLabel = viewMode === 'day' ? 'Today' : viewMode === 'week' ? 'This Week' : 'This Month';

  return (
    <div className={styles.controlsWrapper}>
      <div className={styles.topRow}>
        <div className={styles.segmentedControl} role="tablist">
          {(['day', 'week', 'month'] as CalendarViewMode[]).map((mode) => (
            <button
              key={mode}
              type="button"
              role="tab"
              aria-selected={viewMode === mode}
              onClick={() => onChangeViewMode(mode)}
              className={`${styles.tabBtn} ${viewMode === mode ? styles.tabBtnActive : ''}`}
            >
              {mode}
            </button>
          ))}
        </div>

        <div className={styles.navGroup}>
          <Button variant="secondary" size="sm" onClick={onRefresh} aria-label="Refresh calendar">
            ↻ Refresh
          </Button>
          <div className={styles.navButtonGroup} role="group" aria-label="Date navigation controls">
            <button type="button" onClick={onPrev} aria-label={prevLabel} title={prevLabel} className={styles.navArrowBtn}>‹</button>
            <button type="button" onClick={onToday} aria-label={todayLabel} className={styles.navTodayBtn}>{todayLabel}</button>
            <button type="button" onClick={onNext} aria-label={nextLabel} title={nextLabel} className={styles.navArrowBtn}>›</button>
          </div>
        </div>
      </div>

      <div className={styles.titleRow}>
        <div className={styles.titleWrapper}>
          <span className={styles.titleText}>{titleText}</span>
          {countLabel && <span className={styles.countLabel}>({countLabel})</span>}
        </div>

        {viewMode === 'week' && (
          <div className={styles.legendWrapper}>
            <div className={styles.legendItem}>
              <span className={styles.legendDotDated} />
              <span style={{ color: 'var(--color-text-muted)', fontWeight: 500 }}>Dated Session</span>
            </div>
            <div className={styles.legendItem}>
              <span className={styles.legendDotRecurring} />
              <span style={{ color: 'var(--color-text-muted)', fontWeight: 500 }}>Recurring Slot (dashed)</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
