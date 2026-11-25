import React, { useState } from 'react';
import { useAuth } from './AuthProvider';
import { getRuntimeConfig } from '../config/runtimeConfig';
import { sendApiRequest } from '../api/apiClient';
import { AuthUser } from './authState';
import { resolveDisplayName } from './userProfileStorage';
import { Button } from '../components/buttons/Button';
import formStyles from '../components/forms/forms.module.css';

export const RequireAdmin: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { status, user, signInWithToken } = useAuth();
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
      if (!accessKey.trim()) return;

      setIsSubmitting(true);
      setLoginError(null);

      try {
        if (config.useMockData || (!config.appsScriptUrl && config.enableMockAuth)) {
          const email = 'ashreya0502@gmail.com';
          signInWithToken('mock_admin_token', {
            email,
            name: resolveDisplayName('Authorized Administrator', email),
            isAdmin: true,
          });
          return;
        }

        const res = await sendApiRequest<{ token: string; user: AuthUser }>('auth.login', {
          key: accessKey.trim(),
        });

        if (res.ok && res.data) {
          const resolvedUser: AuthUser = {
            ...res.data.user,
            name: resolveDisplayName(res.data.user.name, res.data.user.email),
          };
          signInWithToken(res.data.token, resolvedUser);
        } else {
          setLoginError(res.error?.message || 'Invalid administrator access key');
        }
      } catch (err: unknown) {
        setLoginError((err as Error)?.message || 'Authentication request failed');
      } finally {
        setIsSubmitting(false);
      }
    };

    const bgStyle: React.CSSProperties = {
      display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center',
      minHeight: '100vh', padding: 'var(--space-6)', boxSizing: 'border-box',
      backgroundColor: '#eef2ff',
      backgroundImage: 'radial-gradient(ellipse 700px 500px at 15% 10%, rgba(37, 99, 235, 0.16) 0%, transparent 65%), radial-gradient(ellipse 550px 450px at 85% 20%, rgba(139, 92, 246, 0.14) 0%, transparent 60%), radial-gradient(ellipse 500px 400px at 50% 85%, rgba(13, 148, 136, 0.10) 0%, transparent 60%)',
      fontFamily: 'var(--font-sans)',
    };

    return (
      <div style={bgStyle}>
        <div style={{
          maxWidth: '420px', width: '100%',
          background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 52%, #1e3a8a 100%)',
          padding: '2.5rem 2rem', borderRadius: 'var(--radius-xl)',
          boxShadow: '0 20px 35px -5px rgba(15, 23, 42, 0.45), 0 8px 16px rgba(37, 99, 235, 0.2)',
          border: '1px solid rgba(255, 255, 255, 0.18)', textAlign: 'center', boxSizing: 'border-box',
          position: 'relative', overflow: 'hidden',
        }}>
          <div style={{
            width: '52px', height: '52px', borderRadius: 'var(--radius-xl)',
            backgroundColor: 'rgba(255, 255, 255, 0.12)', color: '#38bdf8',
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            marginBottom: 'var(--space-4)', border: '1px solid rgba(255, 255, 255, 0.22)',
            boxShadow: '0 4px 12px rgba(37, 99, 235, 0.25)',
          }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
              <path d="M7 11V7a5 5 0 0 1 10 0v4" />
            </svg>
          </div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 700, margin: '0 0 var(--space-2)', color: '#ffffff', letterSpacing: '-0.02em' }}>
            Class Diary
          </h1>
          <p style={{ color: '#cbd5e1', margin: '0 0 var(--space-6)', fontSize: 'var(--font-size-sm)', lineHeight: 1.5 }}>
            Enter your administrator access key to authenticate.
          </p>

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

            <Button type="submit" variant="primary" disabled={isSubmitting || !accessKey.trim()} isLoading={isSubmitting} style={{ width: '100%', height: '42px', fontSize: 'var(--font-size-sm)' }}>
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
