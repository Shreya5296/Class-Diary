import React, { useState, useEffect } from 'react';
import { AppProviders } from './AppProviders';
import { RequireAdmin } from '../auth/RequireAdmin';
import { AppShell } from '../layout/AppShell';
import { NavSection } from '../layout/Sidebar';
import { AppRoutes } from './appRoutes';
import { ErrorBoundary } from '../components/feedback/ErrorBoundary';

const parseHashSection = (): NavSection => {
  if (typeof window === 'undefined') return 'dashboard';
  const h = window.location.hash.replace('#', '').toLowerCase();
  if (['dashboard', 'calendar', 'students', 'finances', 'classes', 'settings'].includes(h)) {
    return h as NavSection;
  }
  return 'dashboard';
};

export const App: React.FC = () => {
  const [activeSection, setActiveSection] = useState<NavSection>(parseHashSection);

  const handleNavigate = (section: NavSection) => {
    setActiveSection(section);
    if (typeof window !== 'undefined') {
      window.location.hash = section;
    }
  };

  useEffect(() => {
    const onHashChange = () => setActiveSection(parseHashSection());
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);

  return (
    <ErrorBoundary>
      <AppProviders>
        <RequireAdmin>
          <AppShell activeSection={activeSection} onNavigate={handleNavigate}>
            <AppRoutes activeSection={activeSection} onNavigate={handleNavigate} />
          </AppShell>
        </RequireAdmin>
      </AppProviders>
    </ErrorBoundary>
  );
};
