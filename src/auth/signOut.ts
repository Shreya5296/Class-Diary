import { clearStoredToken } from './identityToken';
import { clearApiCache } from '../api/apiClient';
import { clearAppDataStore } from '../context/AppDataContext';

export function handleSignOut(): void {
  clearStoredToken();
  clearApiCache();
  clearAppDataStore();
}
