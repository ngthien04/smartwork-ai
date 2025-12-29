
import { createSlice } from '@reduxjs/toolkit';
import type { PayloadAction } from '@reduxjs/toolkit';
import type { UIState } from '@/types';

const initialState: UIState = {
  // Mặc định dùng light mode; user có thể bật dark trong Settings
  themeMode: 'light',
  // Sidebar mặc định thu gọn; bấm icon menu ở header mới mở rộng
  sidebarCollapsed: true,
  commandPaletteOpen: false,
  loadingGlobal: false,
};

const uiSlice = createSlice({
  name: 'ui',
  initialState,
  reducers: {
    setThemeMode: (state, action: PayloadAction<'light' | 'dark'>) => {
      state.themeMode = action.payload;
    },
    toggleSidebar: (state) => {
      state.sidebarCollapsed = !state.sidebarCollapsed;
    },
    setSidebarCollapsed: (state, action: PayloadAction<boolean>) => {
      state.sidebarCollapsed = action.payload;
    },
    setCommandPaletteOpen: (state, action: PayloadAction<boolean>) => {
      state.commandPaletteOpen = action.payload;
    },
    setLoadingGlobal: (state, action: PayloadAction<boolean>) => {
      state.loadingGlobal = action.payload;
    },
  },
});

export const {
  setThemeMode,
  toggleSidebar,
  setSidebarCollapsed,
  setCommandPaletteOpen,
  setLoadingGlobal,
} = uiSlice.actions;

export default uiSlice.reducer;
