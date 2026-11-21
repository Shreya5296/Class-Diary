export const CLASS_TABLE_COLUMNS = {
  student: {
    key: 'student',
    header: 'Student Name',
    width: '20%',
    minWidth: '180px',
    maxWidth: '220px',
  },
  date: {
    key: 'date',
    header: 'Date',
    width: '15%',
    minWidth: '130px',
    maxWidth: '170px',
  },
  consumed: {
    key: 'consumed',
    header: 'Balance',
    width: '13%',
    minWidth: '100px',
    maxWidth: '130px',
  },
  attendance: {
    key: 'attendance',
    header: 'Status',
    width: '24%',
    minWidth: '220px',
  },
  notes: {
    key: 'notes',
    header: 'Notes',
    width: '28%',
    minWidth: '170px',
  },
} as const;

export type ClassTableColumnKey = keyof typeof CLASS_TABLE_COLUMNS;
