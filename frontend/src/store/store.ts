import { configureStore } from '@reduxjs/toolkit';
import uiReducer from './slices/uiSlice';
import authReducer from './slices/authSlice';
import chatReducer from './slices/chatSlice';
import type { RootState } from '@/types';

export const store = configureStore({
  reducer: {
    ui: uiReducer,
    auth: authReducer,
    chat: chatReducer,
  },
});

export type AppDispatch = typeof store.dispatch;
export type { RootState };
