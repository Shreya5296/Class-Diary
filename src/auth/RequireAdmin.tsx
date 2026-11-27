import React, { useState } from 'react';
import { useAuth } from './AuthProvider';
import { getRuntimeConfig } from '../config/runtimeConfig';
import { sendApiRequest } from '../api/apiClient';
import { AuthUser } from './authState';
import { resolveDisplayName } from './userProfileStorage';
import { useOptionalAppData } from '../context/AppDataContext';
import { DashboardCombinedData } from '../api/combinedApi';
import { Button } from '../components/buttons/Button';
import formStyles from '../components/forms/forms.module.css';

type LoginPayload = { token?: string; sessionToken?: string; user: AuthUser; dashboard?: DashboardCombinedData };

export const RequireAdmin: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { status, user, signInWithToken } = useAuth();
  const appData = useOptionalAppData();
  const config = getRuntimeConfig();
  const [accessKey, setAccessKey] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);

  if (status === 'loading') {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', fontFamily: 'var(--font-sans)', color: 'var(--color-text-muted)' }}>
        <p>Loading application session…</p>
      </div>
    );
  }

  if (status === 'unauthenticated' || !user) {
    const handleLogin = async (e: React.FormEvent) => {
      e.preventDefault();
      const key = accessKey.trim();
      if (!key) return;
      setIsSubmitting(true);
      setLoginError(null);
      try {
        if (config.useMockData || (!config.appsScriptUrl && config.enableMockAuth)) {
          const email = 'ashreya0502@gmail.com';
          signInWithToken('mock_admin_token', { email, name: resolveDisplayName('Authorized Administrator', email), isAdmin: true });
          return;
        }
        let res = await sendApiRequest<LoginPayload>('auth.loginWithDashboard', { key }).catch(() => null);
        if (!res || (!res.ok && (res.error?.code === 'UNSUPPORTED_OPERATION' || res.error?.code === 'NOT_FOUND' || /unknown|unsupported/i.test(res.error?.message || '')))) {
          res = await sendApiRequest<LoginPayload>('auth.login', { key });
        }
        if (res?.ok && res.data) {
          if (res.data.dashboard && appData?.bootstrapDashboard) appData.bootstrapDashboard(res.data.dashboard);
          const token = res.data.token || res.data.sessionToken || '';
          signInWithToken(token, { ...res.data.user, name: resolveDisplayName(res.data.user.name, res.data.user.email) });
        } else {
          setLoginError(res?.error?.message || 'Invalid administrator access key');
        }
      } catch (err: unknown) {
        setLoginError((err as Error)?.message || 'Authentication request failed');
      } finally {
        setIsSubmitting(false);
      }
    };

    const isBtnDisabled = isSubmitting || !accessKey.trim();

    return (
      <div style={bgStyle}>
        <div style={cardStyle}>
          <div style={iconBoxStyle}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
              <path d="M7 11V7a5 5 0 0 1 10 0v4" />
            </svg>
          </div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 700, margin: '0 0 var(--space-5)', color: '#ffffff', letterSpacing: '-0.02em' }}>
            Class Diary
          </h1>

          <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)', position: 'relative', zIndex: 1 }}>
            <input
              type="password"
              placeholder="Administrator Access Key"
              value={accessKey}
              onChange={(e) => setAccessKey(e.target.value)}
              disabled={isSubmitting}
              autoFocus
              className={formStyles.input}
              style={{ height: '42px', fontSize: 'var(--font-size-sm)', borderRadius: 'var(--radius-md)', backgroundColor: '#ffffff', color: '#0f172a' }}
            />
            {loginError && (
              <div style={{ color: '#fca5a5', backgroundColor: 'rgba(239, 68, 68, 0.18)', padding: '0.625rem 0.875rem', borderRadius: 'var(--radius-md)', fontSize: 'var(--font-size-xs)', textAlign: 'left', border: '1px solid rgba(239, 68, 68, 0.35)' }}>
                {loginError}
              </div>
            )}
            <Button
              type="submit"
              variant="primary"
              disabled={isBtnDisabled}
              isLoading={isSubmitting}
              style={{
                width: '100%', height: '42px', fontSize: 'var(--font-size-sm)', fontWeight: 600,
                background: isBtnDisabled ? 'linear-gradient(135deg, rgba(37, 99, 235, 0.55) 0%, rgba(29, 78, 216, 0.55) 100%)' : 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)',
                color: isBtnDisabled ? 'rgba(255, 255, 255, 0.85)' : '#ffffff',
                border: '1px solid rgba(255, 255, 255, 0.22)',
                boxShadow: isBtnDisabled ? 'none' : '0 4px 12px rgba(37, 99, 235, 0.35), inset 0 1px 1px rgba(255, 255, 255, 0.3)',
                cursor: isBtnDisabled ? 'not-allowed' : 'pointer', opacity: isBtnDisabled ? 0.8 : 1, transition: 'all 140ms ease',
              }}
            >
              Sign In as Administrator
            </Button>
          </form>
        </div>
      </div>
    );
  }

  if (!user.isAdmin) {
    return (
      <div style={{ padding: 'var(--space-8)', textAlign: 'center' }}>
        <h2>Access Denied</h2>
        <p>Your identity ({user.email}) is not on the administrator allowlist.</p>
      </div>
    );
  }

  return <>{children}</>;
};

const bgStyle: React.CSSProperties = {
  display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', minHeight: '100vh',
  padding: 'var(--space-6)', boxSizing: 'border-box', backgroundColor: '#eef2ff',
  backgroundImage: 'radial-gradient(ellipse 700px 500px at 15% 10%, rgba(37, 99, 235, 0.16) 0%, transparent 65%), radial-gradient(ellipse 550px 450px at 85% 20%, rgba(139, 92, 246, 0.14) 0%, transparent 60%), radial-gradient(ellipse 500px 400px at 50% 85%, rgba(13, 148, 136, 0.10) 0%, transparent 60%)',
  fontFamily: 'var(--font-sans)',
};
const cardStyle: React.CSSProperties = {
  maxWidth: '420px', width: '100%', background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 52%, #1e3a8a 100%)',
  padding: '2.5rem 2rem', borderRadius: 'var(--radius-xl)',
  boxShadow: '0 20px 35px -5px rgba(15, 23, 42, 0.45), 0 8px 16px rgba(37, 99, 235, 0.2)',
  border: '1px solid rgba(255, 255, 255, 0.18)', textAlign: 'center', boxSizing: 'border-box', position: 'relative', overflow: 'hidden',
};
const iconBoxStyle: React.CSSProperties = {
  width: '52px', height: '52px', borderRadius: 'var(--radius-xl)', backgroundColor: 'rgba(255, 255, 255, 0.12)', color: '#38bdf8',
  display: 'inline-flex', alignItems: 'center', justifyContent: 'center', marginBottom: 'var(--space-4)',
  border: '1px solid rgba(255, 255, 255, 0.22)', boxShadow: '0 4px 12px rgba(37, 99, 235, 0.25)',
};
