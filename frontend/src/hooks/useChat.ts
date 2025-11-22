import { useCallback } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { aiServices } from '@/services/aiServices';
import type { ChatMessage, RootState } from '@/types';
import { addMessage, setIsStreaming, setCurrentThreadId } from '@/store/slices/chatSlice';

export function useChat() {
  const dispatch = useDispatch();
  const { messages, isStreaming, currentThreadId } = useSelector((state: RootState) => state.chat);

  const sendMessage = useCallback(async (content: string) => {
    if (!content.trim() || isStreaming) return;

    const userMessage: ChatMessage = {
      id: crypto.randomUUID(),
      role: 'user',
      content: content.trim(),
      createdAt: new Date().toISOString(),
    };

    dispatch(addMessage(userMessage));
    dispatch(setIsStreaming(true));

    try {
      // Try streaming first
      const streamGenerator = aiServices.chatStream({
        threadId: currentThreadId || undefined,
        messages: [...messages, userMessage],
      });

      let assistantContent = '';
      let threadId = currentThreadId;

      for await (const chunk of streamGenerator) {
        if (chunk.type === 'content') {
          assistantContent += chunk.content;
          
          // Update the last message or create new one
          const assistantMessage: ChatMessage = {
            id: crypto.randomUUID(),
            role: 'assistant',
            content: assistantContent,
            createdAt: new Date().toISOString(),
          };

          // Replace the last message if it's assistant, otherwise add new
          dispatch(addMessage(assistantMessage));
        } else if (chunk.type === 'thread_id') {
          threadId = chunk.threadId;
          dispatch(setCurrentThreadId(chunk.threadId));
        }
      }
    } catch (error) {
      console.error('Streaming failed, falling back to regular request:', error);
      
      try {
        // Fallback to regular request
        const response = await aiServices.chat({
          threadId: currentThreadId || undefined,
          messages: [...messages, userMessage],
        });

        const assistantMessage: ChatMessage = {
          id: crypto.randomUUID(),
          role: 'assistant',
          content: response.reply,
          createdAt: new Date().toISOString(),
        };

        dispatch(addMessage(assistantMessage));
        dispatch(setCurrentThreadId(response.threadId));
      } catch (fallbackError) {
        console.error('Chat request failed:', fallbackError);
        
        const errorMessage: ChatMessage = {
          id: crypto.randomUUID(),
          role: 'assistant',
          content: 'Xin lỗi, tôi không thể xử lý yêu cầu của bạn lúc này. Vui lòng thử lại sau.',
          createdAt: new Date().toISOString(),
        };

        dispatch(addMessage(errorMessage));
      }
    } finally {
      dispatch(setIsStreaming(false));
    }
  }, [messages, isStreaming, currentThreadId, dispatch]);

  const clearChat = useCallback(() => {
    dispatch(setCurrentThreadId(null));
    // Clear messages will be handled by Redux action
  }, [dispatch]);

  return {
    messages,
    isStreaming,
    currentThreadId,
    sendMessage,
    clearChat,
  };
}
