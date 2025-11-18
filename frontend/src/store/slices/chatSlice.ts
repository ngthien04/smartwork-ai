// src/store/slices/chatSlice.ts
import { createSlice } from '@reduxjs/toolkit';
import type { PayloadAction } from '@reduxjs/toolkit';
import type { ChatState, ChatMessage } from '@/types';

const initialState: ChatState = {
  messages: [],
  isStreaming: false,
  currentThreadId: null,
};

const chatSlice = createSlice({
  name: 'chat',
  initialState,
  reducers: {
    addMessage: (state, action: PayloadAction<ChatMessage>) => {
      state.messages.push(action.payload);
    },
    setMessages: (state, action: PayloadAction<ChatMessage[]>) => {
      state.messages = action.payload;
    },
    setIsStreaming: (state, action: PayloadAction<boolean>) => {
      state.isStreaming = action.payload;
    },
    setCurrentThreadId: (state, action: PayloadAction<string | null>) => {
      state.currentThreadId = action.payload;
    },
    clearChat: (state) => {
      state.messages = [];
      state.currentThreadId = null;
    },
  },
});

export const {
  addMessage,
  setMessages,
  setIsStreaming,
  setCurrentThreadId,
  clearChat,
} = chatSlice.actions;

export default chatSlice.reducer;
