// src/components/chat/ChatPanel.tsx
import React, { useState, useRef, useEffect } from 'react';
import { Button, Input, List, Typography, Space, Avatar, Card, Spin } from 'antd';
import { SendOutlined, UserOutlined, RobotOutlined, ClearOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { useChat } from '@/hooks/useChat';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

const { TextArea } = Input;
const { Text } = Typography;

export default function ChatPanel() {
  const { t } = useTranslation();
  const { messages, isStreaming, sendMessage, clearChat } = useChat();
  const [inputValue, setInputValue] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSend = async () => {
    if (!inputValue.trim() || isStreaming) return;
    
    const message = inputValue.trim();
    setInputValue('');
    await sendMessage(message);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const formatMessage = (content: string) => {
    // Simple markdown-like formatting
    return content
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.*?)\*/g, '<em>$1</em>')
      .replace(/`(.*?)`/g, '<code>$1</code>')
      .replace(/\n/g, '<br/>');
  };

  return (
    <Card className="h-full flex flex-col">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-semibold m-0">{t('assistant.title')}</h3>
        <Button 
          icon={<ClearOutlined />} 
          onClick={clearChat}
          size="small"
          disabled={messages.length === 0}
        >
          {t('assistant.newChat')}
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto mb-4 min-h-0">
        <List
          dataSource={messages}
          renderItem={(message) => (
            <List.Item className="!border-none !px-0">
              <div className={`flex w-full ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`flex max-w-[80%] ${message.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
                  <Avatar
                    icon={message.role === 'user' ? <UserOutlined /> : <RobotOutlined />}
                    className={`${message.role === 'user' ? 'ml-2' : 'mr-2'}`}
                  />
                  <div className={`rounded-lg p-3 ${
                    message.role === 'user' 
                      ? 'bg-blue-500 text-white' 
                      : 'bg-gray-100 text-gray-800'
                  }`}>
                    {message.role === 'assistant' ? (
                      <ReactMarkdown 
                        remarkPlugins={[remarkGfm]}
                        className="prose prose-sm max-w-none"
                      >
                        {message.content}
                      </ReactMarkdown>
                    ) : (
                      <Text className="whitespace-pre-wrap">{message.content}</Text>
                    )}
                    <div className={`text-xs mt-1 opacity-70 ${
                      message.role === 'user' ? 'text-blue-100' : 'text-gray-500'
                    }`}>
                      {new Date(message.createdAt).toLocaleTimeString()}
                    </div>
                  </div>
                </div>
              </div>
            </List.Item>
          )}
        />
        
        {isStreaming && (
          <div className="flex justify-start">
            <div className="flex mr-2">
              <Avatar icon={<RobotOutlined />} />
            </div>
            <div className="bg-gray-100 rounded-lg p-3">
              <Spin size="small" />
              <Text type="secondary" className="ml-2">AI đang trả lời...</Text>
            </div>
          </div>
        )}
        
        <div ref={messagesEndRef} />
      </div>

      <div className="border-t pt-4">
        <Space.Compact className="w-full">
          <TextArea
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder={t('assistant.chatPlaceholder')}
            autoSize={{ minRows: 1, maxRows: 4 }}
            className="flex-1"
            disabled={isStreaming}
          />
          <Button
            type="primary"
            icon={<SendOutlined />}
            onClick={handleSend}
            disabled={!inputValue.trim() || isStreaming}
            loading={isStreaming}
          >
            {t('assistant.sendMessage')}
          </Button>
        </Space.Compact>
      </div>
    </Card>
  );
}
