import React, { useState } from 'react';
import formStyles from '../../components/forms/forms.module.css';

export interface AdminProfileCardProps {
  name: string;
  onNameChange: (val: string) => void;
  email: string;
  profileImage: string | null;
  initials: string;
  onOpenPhotoModal: () => void;
  onRemovePhoto?: () => Promise<void>;
}

const labelStyle: React.CSSProperties = {
  marginBottom: 0,
  whiteSpace: 'nowrap',
  minWidth: '105px',
  flexShrink: 0,
};

const rowStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 'var(--space-3)',
  flexWrap: 'wrap',
};

export const AdminProfileCard: React.FC<AdminProfileCardProps> = ({
  name,
  onNameChange,
  email,
  profileImage,
  initials,
  onOpenPhotoModal,
}) => {
  const [isHovered, setIsHovered] = useState(false);

  return (
    <div style={{
      backgroundColor: 'var(--color-bg-surface)',
      padding: '1.5rem',
      borderRadius: 'var(--radius-xl)',
      border: '1px solid var(--color-border-subtle)',
      boxShadow: 'var(--shadow-xs)',
      display: 'flex',
      flexDirection: 'column',
      gap: 'var(--space-4)',
      height: '100%',
      boxSizing: 'border-box',
    }}>
      <h3 style={{ margin: 0, fontSize: 'var(--font-size-base)', fontWeight: 600, color: 'var(--color-text-main)' }}>
        Administrator Profile
      </h3>

      <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem', flexWrap: 'wrap', flex: 1 }}>
        {/* Left: Avatar with subtle hover edit overlay (~30% bigger: 110px) */}
        <div
          role="button"
          tabIndex={0}
          onClick={onOpenPhotoModal}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onOpenPhotoModal(); } }}
          onMouseEnter={() => setIsHovered(true)}
          onMouseLeave={() => setIsHovered(false)}
          aria-label="Change profile picture"
          style={{
            position: 'relative',
            width: '110px',
            height: '110px',
            borderRadius: '50%',
            overflow: 'hidden',
            flexShrink: 0,
            cursor: 'pointer',
            border: '2px solid rgba(255, 255, 255, 0.45)',
            boxShadow: '0 2px 10px rgba(37, 99, 235, 0.35)',
            background: 'linear-gradient(135deg, #1e3a8a, #3b82f6)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'transform 160ms ease, box-shadow 160ms ease',
            transform: isHovered ? 'scale(1.02)' : 'none',
          }}
        >
          {profileImage ? (
            <img src={profileImage} alt="Profile photo" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
          ) : (
            <span style={{ fontSize: '2.25rem', fontWeight: 700, color: '#ffffff', letterSpacing: '-0.02em', userSelect: 'none' }}>
              {initials}
            </span>
          )}

          <div style={{
            position: 'absolute',
            inset: 0,
            backgroundColor: 'rgba(15, 23, 42, 0.55)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            opacity: isHovered ? 1 : 0,
            transition: 'opacity 160ms ease',
            color: '#ffffff',
            gap: '3px',
          }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
            </svg>
            <span style={{ fontSize: '11px', fontWeight: 600 }}>Edit</span>
          </div>
        </div>

        {/* Right: Administrator display name and email rows */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)', flex: 1, minWidth: '240px' }}>
          {/* Row 1: Name Label & Input */}
          <div style={rowStyle}>
            <label htmlFor="displayNameInput" className={formStyles.label} style={labelStyle}>
              Display Name
            </label>
            <input
              id="displayNameInput"
              type="text"
              value={name}
              onChange={(e) => onNameChange(e.target.value)}
              placeholder="e.g. Ashreya"
              className={formStyles.input}
              style={{ height: '38px', borderRadius: 'var(--radius-md)', flex: 1, minWidth: '160px', boxSizing: 'border-box' }}
            />
          </div>

          {/* Row 2: Email Label & Value */}
          <div style={{ ...rowStyle, minHeight: '38px', fontSize: 'var(--font-size-sm)' }}>
            <span style={{ ...labelStyle, fontWeight: 500, color: 'var(--color-text-muted)' }}>
              Email
            </span>
            <span style={{ color: 'var(--color-text-main)', fontWeight: 600, wordBreak: 'break-all' }}>
              {email}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
