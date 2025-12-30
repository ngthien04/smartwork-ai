import React, { useMemo } from 'react';
import { Button, Input, List, Typography, Space, Avatar, Card, Spin, Tooltip } from 'antd';
import { SendOutlined, UserOutlined, RobotOutlined, ClearOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { useChat } from '@/hooks/useChat';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

const { TextArea } = Input;
const { Text } = Typography;

type MarkdownProps = {
  className?: string;
} & Parameters<typeof ReactMarkdown>[0];

const Markdown: React.FC<MarkdownProps> = ({ className, ...props }) => (
  <div className={className}>
    <ReactMarkdown remarkPlugins={[remarkGfm]} {...props} />
  </div>
);

export default function ChatPanel() {
  const { t } = useTranslation();
  const {
    messages,
    inputValue,
    setInputValue,
    handleSend,
    handleKeyPress,
    isStreaming,
    clearChat,
    messagesEndRef,
  } = useChat();

  const hasMessages = messages.length > 0;

  const headerTitle = useMemo(() => t('assistant.title'), [t]);

  return (
    <Card
      className="h-full"
      style={{
        height: '100%',
        borderRadius: 16,
        overflow: 'hidden',
      }}
      bodyStyle={{
        padding: 0,
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: '12px 14px',
          borderBottom: '1px solid rgba(5, 5, 5, 0.06)',
          background:
            'linear-gradient(180deg, rgba(22, 119, 255, 0.10) 0%, rgba(22, 119, 255, 0.03) 100%)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
            <div
              style={{
                width: 34,
                height: 34,
                borderRadius: 12,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: 'rgba(255,255,255,0.75)',
                border: '1px solid rgba(5, 5, 5, 0.08)',
              }}
            >
              <RobotOutlined />
            </div>

            <div style={{ minWidth: 0 }}>
              <Text strong style={{ display: 'block', fontSize: 14, lineHeight: 1.2 }}>
                {headerTitle}
              </Text>
              <Text type="secondary" style={{ fontSize: 12 }}>
                {isStreaming ? 'AI đang trả lời…' : 'Hỏi nhanh về task, bug, deadline, cách dùng app'}
              </Text>
            </div>
          </div>

          <Space size={8}>
            <Tooltip title={hasMessages ? t('assistant.newChat') : 'Chưa có tin nhắn'}>
              <Button
                icon={<ClearOutlined />}
                onClick={clearChat}
                size="small"
                disabled={!hasMessages || isStreaming}
                style={{ borderRadius: 10 }}
              />
            </Tooltip>
          </Space>
        </div>
      </div>

      {/* Messages */}
      <div
        style={{
          flex: 1,
          minHeight: 0,
          overflowY: 'auto',
          padding: 14,
          background:
            'radial-gradient(1200px 400px at 50% 0%, rgba(22, 119, 255, 0.08) 0%, rgba(22, 119, 255, 0.00) 55%), #ffffff',
        }}
      >
        {!hasMessages && !isStreaming ? (
          <div
            style={{
              height: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: 18,
            }}
          >
            <div
              style={{
                maxWidth: 420,
                width: '100%',
                border: '1px dashed rgba(5, 5, 5, 0.15)',
                borderRadius: 16,
                padding: 16,
                background: 'rgba(0,0,0,0.02)',
              }}
            >
              <Text strong style={{ display: 'block' }}>
                Bắt đầu chat
              </Text>
              <Text type="secondary" style={{ fontSize: 12 }}>
                Ví dụ: “Tạo task sửa bug login”, “Task nào đang quá hạn?”, “Gợi ý ưu tiên cho task này”
              </Text>
            </div>
          </div>
        ) : (
          <List
            dataSource={messages}
            split={false}
            renderItem={(m) => {
              const isUser = m.role === 'user';

              const bubbleStyle: React.CSSProperties = {
                maxWidth: '78%',
                borderRadius: 18,
                padding: '10px 12px',
                background: isUser ? 'rgba(22, 119, 255, 1)' : 'rgba(0,0,0,0.04)',
                color: isUser ? '#fff' : 'rgba(0,0,0,0.88)',
                border: isUser ? '1px solid rgba(255,255,255,0.15)' : '1px solid rgba(5, 5, 5, 0.06)',
                boxShadow: isUser
                  ? '0 6px 18px rgba(22, 119, 255, 0.22)'
                  : '0 6px 18px rgba(0, 0, 0, 0.06)',
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
              };

              const time = m.createdAt ? new Date(m.createdAt).toLocaleTimeString() : '';

              return (
                <List.Item style={{ padding: '8px 0' }}>
                  <div
                    style={{
                      width: '100%',
                      display: 'flex',
                      justifyContent: isUser ? 'flex-end' : 'flex-start',
                      gap: 10,
                    }}
                  >
                    {!isUser && (
                      <Avatar
                        size={34}
                        icon={<RobotOutlined />}
                        style={{
                          background: 'rgba(22, 119, 255, 0.12)',
                          border: '1px solid rgba(22, 119, 255, 0.22)',
                          color: 'rgba(22, 119, 255, 1)',
                        }}
                      />
                    )}

                    <div style={bubbleStyle}>
                      {m.role === 'assistant' ? (
                        <Markdown
                          className="chat-md"
                        >
                          {m.content}
                        </Markdown>
                      ) : (
                        <Text style={{ color: '#fff' }}>{m.content}</Text>
                      )}

                      <div
                        style={{
                          marginTop: 6,
                          fontSize: 11,
                          opacity: 0.75,
                          color: isUser ? 'rgba(255,255,255,0.85)' : 'rgba(0,0,0,0.45)',
                          display: 'flex',
                          justifyContent: 'flex-end',
                        }}
                      >
                        {time}
                      </div>
                    </div>

                    {isUser && (
                      <Avatar
                        size={34}
                        icon={<UserOutlined />}
                        style={{
                          background: 'rgba(0,0,0,0.04)',
                          border: '1px solid rgba(5, 5, 5, 0.06)',
                          color: 'rgba(0,0,0,0.65)',
                        }}
                      />
                    )}
                  </div>
                </List.Item>
              );
            }}
          />
        )}

        {/* Streaming bubble */}
        {isStreaming && (
          <div style={{ paddingTop: 6 }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
              <Avatar
                size={34}
                icon={<RobotOutlined />}
                style={{
                  background: 'rgba(22, 119, 255, 0.12)',
                  border: '1px solid rgba(22, 119, 255, 0.22)',
                  color: 'rgba(22, 119, 255, 1)',
                }}
              />
              <div
                style={{
                  borderRadius: 18,
                  padding: '10px 12px',
                  background: 'rgba(0,0,0,0.04)',
                  border: '1px solid rgba(5, 5, 5, 0.06)',
                  boxShadow: '0 6px 18px rgba(0, 0, 0, 0.06)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                }}
              >
                <Spin size="small" />
                <Text type="secondary" style={{ fontSize: 13 }}>
                  AI đang trả lời…
                </Text>
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Composer */}
      <div
        style={{
          padding: 12,
          borderTop: '1px solid rgba(5, 5, 5, 0.06)',
          background: '#fff',
        }}
      >
        <div
          style={{
            borderRadius: 16,
            border: '1px solid rgba(5, 5, 5, 0.08)',
            background: 'rgba(0,0,0,0.02)',
            padding: 10,
          }}
        >
          <Space.Compact className="w-full">
            <TextArea
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder={t('assistant.chatPlaceholder')}
              autoSize={{ minRows: 1, maxRows: 4 }}
              disabled={isStreaming}
              style={{
                borderRadius: 14,
                resize: 'none',
                background: '#fff',
              }}
            />
            <Button
              type="primary"
              icon={<SendOutlined />}
              onClick={handleSend}
              disabled={!inputValue.trim() || isStreaming}
              loading={isStreaming}
              style={{
                borderRadius: 14,
                height: '100%',
                paddingInline: 14,
              }}
            >
              {t('assistant.sendMessage')}
            </Button>
          </Space.Compact>

          <div style={{ marginTop: 8, display: 'flex', justifyContent: 'space-between', gap: 10 }}>
            <Text type="secondary" style={{ fontSize: 12 }}>
              Enter để gửi • Shift+Enter xuống dòng
            </Text>
            <Text type="secondary" style={{ fontSize: 12, opacity: 0.8 }}>
              {inputValue.trim().length}/2000
            </Text>
          </div>
        </div>
      </div>

      {/* Small CSS for markdown without depending on prose */}
      <style>{`
        .chat-md :where(p) { margin: 0 0 8px 0; }
        .chat-md :where(p:last-child) { margin-bottom: 0; }
        .chat-md :where(ul, ol) { margin: 6px 0 6px 18px; padding: 0; }
        .chat-md :where(li) { margin: 2px 0; }
        .chat-md :where(code) {
          background: rgba(0,0,0,0.06);
          padding: 2px 6px;
          border-radius: 8px;
          font-size: 12px;
        }
        .chat-md :where(pre) {
          background: rgba(0,0,0,0.06);
          padding: 10px 12px;
          border-radius: 12px;
          overflow: auto;
        }
        .chat-md :where(pre code) {
          background: transparent;
          padding: 0;
        }
        .chat-md :where(a) { text-decoration: underline; }
        .chat-md :where(table) {
          border-collapse: collapse;
          width: 100%;
          margin: 8px 0;
          font-size: 13px;
        }
        .chat-md :where(th, td) {
          border: 1px solid rgba(0,0,0,0.12);
          padding: 6px 8px;
          text-align: left;
        }
      `}</style>
    </Card>
  );
}