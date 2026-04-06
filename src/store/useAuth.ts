import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { logoutApi } from '../api/auth';

interface AuthState {
  // No token stored here — the JWT lives in an httpOnly cookie set by the backend.
  // JavaScript can never read or steal it. We only keep display info in the store.
  email:      string | null;
  username:   string | null;
  first_name: string | null;
  last_name:  string | null;
  bio:        string | null;
  avatar_url: string | null;
  setAuth: (email: string, username?: string | null) => void;
  setUsername: (username: string | null) => void;
  setProfile: (patch: {
    username?:   string | null;
    first_name?: string | null;
    last_name?:  string | null;
    bio?:        string | null;
    avatar_url?: string | null;
  }) => void;
  logout: () => Promise<void>;
  isLoggedIn: () => boolean;
}

export const useAuth = create<AuthState>()(
  persist(
    (set, get) => ({
      email:      null,
      username:   null,
      first_name: null,
      last_name:  null,
      bio:        null,
      avatar_url: null,
      setAuth: (email, username = null) => set({ email, username }),
      setUsername: (username) => set({ username }),
      setProfile: (patch) => set(patch),
      logout: async () => {
        try {
          await logoutApi();
        } catch {
          // Already expired or network error — still clear local state
        }
        set({ email: null, username: null, first_name: null, last_name: null, bio: null, avatar_url: null });
      },
      isLoggedIn: () => !!get().email,
    }),
    {
      // Bumped to v5 — added avatar_url field
      name: 'ss-auth-v5',
    }
  )
);
