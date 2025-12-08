import { useEffect, useMemo, useRef, useState } from 'react';
import { message as antdMessage } from 'antd';
import { chatHistoryServices, type ChatMsg } from '@/services/chatHistoryServices';

type UIMessage = {
  role: 'user' | 'assistant';
  content: string;
  createdAt: string;
};

export function useChat() {
  const [messages, setMessages] = useState<UIMessage[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  // nếu sau này bạn muốn tách theo team, set teamId ở đây
  const teamId = useMemo(() => undefined as string | undefined, []);

  const scrollToBottom = () => {
    requestAnimationFrame(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    });
  };

  // load history khi mount
  useEffect(() => {
    (async () => {
      try {
        const history = await chatHistoryServices.getHistory(teamId ? { team: teamId } : undefined);
        // đảm bảo createdAt luôn có
        const normalized = history.map((m: ChatMsg) => ({
          ...m,
          createdAt: m.createdAt || new Date().toISOString(),
        }));
        setMessages(normalized);
        scrollToBottom();
      } catch (e: any) {
        // silent fail cũng được, nhưng báo nhẹ
        console.error(e);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    scrollToBottom();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages.length, isStreaming]);

  const handleSend = async () => {
    const content = inputValue.trim();
    if (!content || isStreaming) return;

    setIsStreaming(true);

    // optimistic
    const optimistic: UIMessage = {
      role: 'user',
      content,
      createdAt: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, optimistic]);
    setInputValue('');

    try {
      const res = await chatHistoryServices.sendMessage({ content, ...(teamId ? { team: teamId } : {}) });
      const normalized = (res.messages || []).map((m) => ({
        ...m,
        createdAt: m.createdAt || new Date().toISOString(),
      }));
      setMessages(normalized);
    } catch (e: any) {
      console.error(e);
      antdMessage.error('Gửi tin nhắn thất bại');
    } finally {
      setIsStreaming(false);
    }
  };

  const handleKeyPress: React.KeyboardEventHandler<HTMLTextAreaElement> = (e) => {
    // Enter để send, Shift+Enter để xuống dòng
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      void handleSend();
    }
  };

  const clearChat = async () => {
    if (isStreaming) return;
    try {
      await chatHistoryServices.clearHistory(teamId ? { team: teamId } : undefined);
      setMessages([]);
      antdMessage.success('Đã tạo chat mới');
    } catch (e) {
      console.error(e);
      antdMessage.error('Không thể xoá lịch sử chat');
    }
  };

  return {
    messages,
    inputValue,
    setInputValue,
    handleSend,
    handleKeyPress,
    isStreaming,
    clearChat,
    messagesEndRef,
  };
}
