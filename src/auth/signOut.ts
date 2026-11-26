import { clearStoredToken } from './identityToken';
import { clearApiCache } from '../api/apiClient';

export function handleSignOut(): void {
  clearStoredToken();
  clearApiCache();
}
