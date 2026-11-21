import { useState, useEffect } from 'react';
import { getStoredProfileImage, getMemoryFallbackImage, PROFILE_IMAGE_EVENT } from './profileImageStorage';

export function useProfileImage(): string | null {
  const [profileImage, setProfileImage] = useState<string | null>(getMemoryFallbackImage());

  useEffect(() => {
    let mounted = true;
    getStoredProfileImage().then((img) => {
      if (mounted) setProfileImage(img);
    });

    const handleUpdate = (e: Event) => {
      const custom = e as CustomEvent<string | null>;
      if (mounted) setProfileImage(custom.detail ?? null);
    };

    if (typeof window !== 'undefined') {
      window.addEventListener(PROFILE_IMAGE_EVENT, handleUpdate);
    }
    return () => {
      mounted = false;
      if (typeof window !== 'undefined') {
        window.removeEventListener(PROFILE_IMAGE_EVENT, handleUpdate);
      }
    };
  }, []);

  return profileImage;
}
