import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import type { PayloadAction } from '@reduxjs/toolkit';
import type { AuthState, User } from '@/types';
import { authService } from '@/services/authService';
import { ensureId } from '@/types';

type StoredAuth = {
  user: User | null;
  token: string | null;
};

const STORAGE_KEY = 'auth';

const loadStoredAuth = (): StoredAuth => {
  if (typeof window === 'undefined') return { user: null, token: null };
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { user: null, token: null };
    const parsed = JSON.parse(raw);
    return {
      user: parsed.user || null,
      token: parsed.token || null,
    };
  } catch {
    return { user: null, token: null };
  }
};

const persistAuth = (payload: StoredAuth) => {
  if (typeof window === 'undefined') return;
  if (!payload.user || !payload.token) {
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem('token');
    window.dispatchEvent(new Event('auth-changed'));
    return;
  }
  const data = JSON.stringify(payload);
  localStorage.setItem(STORAGE_KEY, data);
  localStorage.setItem('token', payload.token);
  window.dispatchEvent(new Event('auth-changed'));
};

const stored = loadStoredAuth();

const initialState: AuthState = {
  user: stored.user,
  token: stored.token,
  status: 'idle',
};

export const fetchCurrentUser = createAsyncThunk<User>(
  'auth/fetchCurrentUser',
  async (_, { rejectWithValue }) => {
    try {
      const response = await authService.getMe();
      const normalized = ensureId(response);
      return normalized;
    } catch (error: any) {
      const message = error?.response?.data || error?.message || 'Failed to fetch current user';
      return rejectWithValue(message);
    }
  }
);

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    setCredentials: (state, action: PayloadAction<{ user: User; token: string }>) => {
      state.user = action.payload.user;
      state.token = action.payload.token;
      state.status = 'succeeded';
      persistAuth({ user: state.user, token: state.token });
    },
    logout: (state) => {
      state.user = null;
      state.token = null;
      state.status = 'idle';
      persistAuth({ user: null, token: null });
    },
    setAuthStatus: (state, action: PayloadAction<'idle' | 'loading' | 'succeeded' | 'failed'>) => {
      state.status = action.payload;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchCurrentUser.pending, (state) => {
        state.status = 'loading';
      })
      .addCase(fetchCurrentUser.fulfilled, (state, action: PayloadAction<User>) => {
        state.user = action.payload;
        state.status = 'succeeded';
        persistAuth({ user: state.user, token: state.token });
      })
      .addCase(fetchCurrentUser.rejected, (state) => {
        state.user = null;
        state.token = null;
        state.status = 'failed';
        persistAuth({ user: null, token: null });
      });
  },
});

export const { setCredentials, logout, setAuthStatus } = authSlice.actions;

export default authSlice.reducer;
