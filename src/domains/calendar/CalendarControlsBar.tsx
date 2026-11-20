import React from 'react';
import { CalendarViewMode } from './calendarTypes';
import { Button } from '../../components/buttons/Button';
import styles from './calendarControlsBar.module.css';

export interface CalendarControlsBarProps {
  viewMode: CalendarViewMode;
  onChangeViewMode: (mode: CalendarViewMode) => void;
  titleText?: string;
  countLabel?: string;
  showTitle?: boolean;
  onPrev: () => void;
  onNext: () => void;
  onToday: () => void;
  onScheduleExtraClass?: () => void;
  onRefresh?: () => void;
}

export const CalendarControlsBar: React.FC<CalendarControlsBarProps> = ({
  viewMode,
  onChangeViewMode,
  titleText,
  countLabel,
  showTitle = true,
  onPrev,
  onNext,
  onToday,
  onScheduleExtraClass,
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
          {onScheduleExtraClass && (
            <Button
              variant="primary"
              size="sm"
              onClick={onScheduleExtraClass}
              aria-label="Schedule Extra Class"
            >
              + Schedule Extra Class
            </Button>
          )}
          <div className={styles.navButtonGroup} role="group" aria-label="Date navigation controls">
            <button type="button" onClick={onPrev} aria-label={prevLabel} title={prevLabel} className={styles.navArrowBtn}>‹</button>
            <button type="button" onClick={onToday} aria-label={todayLabel} className={styles.navTodayBtn}>{todayLabel}</button>
            <button type="button" onClick={onNext} aria-label={nextLabel} title={nextLabel} className={styles.navArrowBtn}>›</button>
          </div>
        </div>
      </div>

      {showTitle && titleText && (
        <div className={styles.titleRow}>
          <div className={styles.titleWrapper}>
            <span className={styles.titleText}>{titleText}</span>
            {countLabel && <span className={styles.countLabel}>({countLabel})</span>}
          </div>
        </div>
      )}
    </div>
  );
};
