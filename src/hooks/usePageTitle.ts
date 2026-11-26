import { useEffect } from 'react';
import { APP_NAME } from '../config/publicConfig';

export function usePageTitle(title: string): void {
  useEffect(() => {
    document.title = title ? (APP_NAME ? `${title} | ${APP_NAME}` : title) : (APP_NAME || 'Class Diary');
  }, [title]);
}
