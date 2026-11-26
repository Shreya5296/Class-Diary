import React from 'react';
import { AuthProvider } from '../auth/AuthProvider';
import { AppDataProvider } from '../context/AppDataContext';

export const AppProviders: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return (
    <AuthProvider>
      <AppDataProvider>{children}</AppDataProvider>
    </AuthProvider>
  );
};
