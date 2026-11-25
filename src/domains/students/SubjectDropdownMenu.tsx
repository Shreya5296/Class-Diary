import React from 'react';

export interface SubjectDropdownMenuProps {
  availableSubjects: string[];
  selectedSubjects: string[];
  searchQuery: string;
  onToggle: (subject: string) => void;
  onAddNewSubject: (subject: string) => void;
}

export const SubjectDropdownMenu: React.FC<SubjectDropdownMenuProps> = ({
  availableSubjects,
  selectedSubjects,
  searchQuery,
  onToggle,
  onAddNewSubject,
}) => {
  const queryTrimmed = searchQuery.trim();
  const lowerQuery = queryTrimmed.toLowerCase();

  const filtered = availableSubjects.filter((subj) =>
    subj.toLowerCase().includes(lowerQuery)
  );

  const exactMatchExists = availableSubjects.some(
    (subj) => subj.toLowerCase() === lowerQuery
  );
  const showAddOption = queryTrimmed.length > 0 && !exactMatchExists;

  return (
    <div
      role="listbox"
      aria-multiselectable="true"
      style={{
        position: 'absolute',
        top: 'calc(100% + 4px)',
        left: 0,
        right: 0,
        backgroundColor: 'var(--color-bg-surface)',
        border: '1px solid var(--color-border)',
        borderRadius: 'var(--radius-md)',
        boxShadow: 'var(--shadow-md)',
        zIndex: 1000,
        maxHeight: '220px',
        overflowY: 'auto',
        padding: '4px 0',
      }}
    >
      {showAddOption && (
        <div
          role="button"
          tabIndex={0}
          onClick={() => onAddNewSubject(queryTrimmed)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              onAddNewSubject(queryTrimmed);
            }
          }}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '7px 12px',
            fontSize: 'var(--font-size-sm)',
            cursor: 'pointer',
            backgroundColor: 'var(--color-bg-subtle)',
            color: 'var(--color-primary)',
            fontWeight: 600,
            borderBottom: '1px solid var(--color-border)',
          }}
        >
          <span>＋ Add &ldquo;{queryTrimmed}&rdquo;</span>
        </div>
      )}

      {filtered.map((subj) => {
        const isSelected = selectedSubjects.some(
          (s) => s.toLowerCase() === subj.toLowerCase()
        );
        return (
          <div
            key={subj}
            role="option"
            aria-selected={isSelected}
            tabIndex={0}
            onClick={() => onToggle(subj)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onToggle(subj);
              }
            }}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '7px 12px',
              fontSize: 'var(--font-size-sm)',
              cursor: 'pointer',
              backgroundColor: isSelected ? 'var(--color-primary-bg)' : 'transparent',
              color: isSelected ? 'var(--color-primary)' : 'var(--color-text-main)',
              fontWeight: isSelected ? 500 : 400,
            }}
            onMouseEnter={(e) => {
              if (!isSelected) e.currentTarget.style.backgroundColor = 'var(--color-bg-subtle)';
            }}
            onMouseLeave={(e) => {
              if (!isSelected) e.currentTarget.style.backgroundColor = 'transparent';
            }}
          >
            <input
              type="checkbox"
              checked={isSelected}
              onChange={() => {}}
              style={{ cursor: 'pointer', accentColor: 'var(--color-primary)' }}
            />
            <span>{subj}</span>
          </div>
        );
      })}

      {filtered.length === 0 && !showAddOption && (
        <div style={{ padding: '8px 12px', fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)', textAlign: 'center' }}>
          No matching subjects
        </div>
      )}
    </div>
  );
};
