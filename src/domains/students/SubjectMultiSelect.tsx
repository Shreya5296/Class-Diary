import React, { useState, useRef, useEffect } from 'react';
import formStyles from '../../components/forms/forms.module.css';
import { SubjectDropdownMenu } from './SubjectDropdownMenu';
import { SubjectBadge } from './SubjectBadge';
import { AVAILABLE_SUBJECTS } from './subjectConstants';
export { AVAILABLE_SUBJECTS, parseSubjectList } from './subjectConstants';

export interface SubjectMultiSelectProps {
  selectedSubjects: string[];
  onChange: (subjects: string[]) => void;
  disabled?: boolean;
  error?: string;
  id?: string;
}

export const SubjectMultiSelect: React.FC<SubjectMultiSelectProps> = ({
  selectedSubjects = [],
  onChange,
  disabled = false,
  error,
  id = 'subject_select',
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [customSubjects, setCustomSubjects] = useState<string[]>([]);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
        setSearchQuery('');
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  const allAvailable = Array.from(new Set([...AVAILABLE_SUBJECTS, ...customSubjects, ...selectedSubjects]));

  const handleToggle = (subject: string) => {
    if (disabled) return;
    const exists = selectedSubjects.some((s) => s.toLowerCase() === subject.toLowerCase());
    if (exists) {
      onChange(selectedSubjects.filter((s) => s.toLowerCase() !== subject.toLowerCase()));
    } else {
      onChange([...selectedSubjects, subject]);
    }
    setSearchQuery('');
  };

  const handleAddNewSubject = (newSubject: string) => {
    if (disabled) return;
    const trimmed = newSubject.trim();
    if (!trimmed) return;
    const existing = allAvailable.find((s) => s.toLowerCase() === trimmed.toLowerCase());
    const subjectToAdd = existing || trimmed;

    if (!customSubjects.some((s) => s.toLowerCase() === subjectToAdd.toLowerCase())) {
      setCustomSubjects((prev) => [...prev, subjectToAdd]);
    }
    if (!selectedSubjects.some((s) => s.toLowerCase() === subjectToAdd.toLowerCase())) {
      onChange([...selectedSubjects, subjectToAdd]);
    }
    setSearchQuery('');
  };

  const handleInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (disabled) return;
    if (e.key === 'Enter') {
      e.preventDefault();
      if (searchQuery.trim()) handleAddNewSubject(searchQuery.trim());
    } else if (e.key === 'Escape') {
      setIsOpen(false);
      setSearchQuery('');
    } else if (e.key === 'Backspace' && !searchQuery && selectedSubjects.length > 0) {
      onChange(selectedSubjects.slice(0, -1));
    }
  };

  return (
    <div ref={containerRef} style={{ position: 'relative', width: '100%' }}>
      <div
        id={id}
        role="combobox"
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        onClick={() => { if (!disabled) { setIsOpen(true); inputRef.current?.focus(); } }}
        className={`${formStyles.input} ${error ? formStyles.inputError : ''}`}
        style={{
          display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '4px',
          minHeight: '38px', padding: '0.3125rem 2.25rem 0.3125rem 0.625rem',
          cursor: disabled ? 'not-allowed' : 'text',
          backgroundColor: disabled ? 'var(--color-bg-subtle)' : 'var(--color-bg-surface)',
          position: 'relative',
        }}
      >
        {selectedSubjects.map((subj) => (
          <SubjectBadge
            key={subj}
            subject={subj}
            disabled={disabled}
            onRemove={(s, e) => { e.stopPropagation(); onChange(selectedSubjects.filter((x) => x.toLowerCase() !== s.toLowerCase())); }}
          />
        ))}
        <input
          ref={inputRef}
          type="text"
          value={searchQuery}
          onChange={(e) => { setSearchQuery(e.target.value); if (!isOpen) setIsOpen(true); }}
          onFocus={() => !disabled && setIsOpen(true)}
          onKeyDown={handleInputKeyDown}
          disabled={disabled}
          placeholder={selectedSubjects.length === 0 ? 'Select or type subjects…' : ''}
          style={{ border: 'none', outline: 'none', background: 'transparent', flex: '1 1 80px', minWidth: '60px', fontSize: 'var(--font-size-sm)', color: 'var(--color-text-main)', padding: 0 }}
          aria-label="Add or filter subjects"
        />
        <div style={{ position: 'absolute', right: '0.75rem', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', fontSize: '10px', color: 'var(--color-text-muted)' }}>
          ▼
        </div>
      </div>

      {isOpen && !disabled && (
        <SubjectDropdownMenu
          availableSubjects={allAvailable}
          selectedSubjects={selectedSubjects}
          searchQuery={searchQuery}
          onToggle={handleToggle}
          onAddNewSubject={handleAddNewSubject}
        />
      )}
    </div>
  );
};
