export interface ColumnStyle {
  minWidth: string;
  maxWidth?: string;
  whiteSpace?: 'nowrap' | 'normal';
}

export const STUDENT_TABLE_GRID_TEMPLATE =
  'minmax(180px, 220px) minmax(200px, 1.5fr) minmax(170px, 1.2fr) minmax(85px, 105px) minmax(190px, 1.3fr)';

export const STUDENT_TABLE_COLUMNS = {
  student: {
    minWidth: '180px',
    maxWidth: '220px',
  },
  subject: {
    minWidth: '150px',
  },
  schedule: {
    minWidth: '170px',
    whiteSpace: 'nowrap' as const,
  },
  classes: {
    minWidth: '85px',
    maxWidth: '105px',
    whiteSpace: 'nowrap' as const,
  },
  meetingLink: {
    minWidth: '190px',
    whiteSpace: 'nowrap' as const,
  },
} as const;

export type StudentTableColumnKey = keyof typeof STUDENT_TABLE_COLUMNS;

