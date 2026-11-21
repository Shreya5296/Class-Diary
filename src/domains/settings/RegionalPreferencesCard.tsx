import React from 'react';
import {
  SUPPORTED_TIMEZONES,
  SUPPORTED_CURRENCIES,
} from '../../lib/userPreferences';
import formStyles from '../../components/forms/forms.module.css';

export interface RegionalPreferencesCardProps {
  timezone: string;
  onTimezoneChange: (tz: string) => void;
  currency: string;
  onCurrencyChange: (cur: string) => void;
}

export const RegionalPreferencesCard: React.FC<RegionalPreferencesCardProps> = ({
  timezone,
  onTimezoneChange,
  currency,
  onCurrencyChange,
}) => {
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
    }}>
      <h3 style={{ margin: 0, fontSize: 'var(--font-size-base)', fontWeight: 600, color: 'var(--color-text-main)' }}>
        Regional Defaults & Preferences
      </h3>

      <div className={formStyles.field} style={{ marginBottom: 0 }}>
        <label htmlFor="timezoneSelect" className={formStyles.label} style={{ marginBottom: '4px' }}>
          Application Timezone
        </label>
        <select
          id="timezoneSelect"
          value={timezone}
          onChange={(e) => onTimezoneChange(e.target.value)}
          className={formStyles.select}
          style={{ height: '38px', borderRadius: 'var(--radius-md)' }}
        >
          {SUPPORTED_TIMEZONES.map((tz) => (
            <option key={tz.value} value={tz.value}>
              {tz.label}
            </option>
          ))}
        </select>
      </div>

      <div className={formStyles.field} style={{ marginBottom: 0 }}>
        <label htmlFor="currencySelect" className={formStyles.label} style={{ marginBottom: '4px' }}>
          Display Currency Preference
        </label>
        <select
          id="currencySelect"
          value={currency}
          onChange={(e) => onCurrencyChange(e.target.value)}
          className={formStyles.select}
          style={{ height: '38px', borderRadius: 'var(--radius-md)' }}
        >
          {SUPPORTED_CURRENCIES.map((c) => (
            <option key={c.code} value={c.code}>
              {c.label}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
};
