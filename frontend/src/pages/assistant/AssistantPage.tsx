import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Row,
  Col,
  Card,
  Button,
  Input,
  Space,
  Typography,
  message,
  Tag,
  List,
  Divider,
  Tooltip,
  Progress,
  Empty,
  Alert,
} from 'antd';
import {
  RobotOutlined,
  BugOutlined,
  ThunderboltOutlined,
  InfoCircleOutlined,
  ReloadOutlined,
  MessageOutlined,
  CrownOutlined,
} from '@ant-design/icons';

import ChatPanel from '@/components/chat/ChatPanel';
import { aiServices } from '@/services/aiServices';
import type { BugTriageResponse, TriageItem } from '@/types/ai';
import { useAIFeatureAccess } from '@/hooks/useTeamPlan';

const { Title, Text } = Typography;
const { TextArea } = Input;

function severityColor(s: TriageItem['severity']) {
  switch (s) {
    case 'S1':
      return 'red';
    case 'S2':
      return 'orange';
    case 'S3':
      return 'gold';
    case 'S4':
    default:
      return 'default';
  }
}
function priorityColor(p: TriageItem['priority']) {
  switch (p) {
    case 'urgent':
      return 'red';
    case 'high':
      return 'orange';
    case 'normal':
      return 'blue';
    case 'low':
    default:
      return 'default';
  }
}

export default function AssistantPage() {
  const { t } = useTranslation();

  // Check AI feature access
  const triageAccess = useAIFeatureAccess('triage');

  const [bugText, setBugText] = useState('');
  const [triageLoading, setTriageLoading] = useState(false);
  const [triage, setTriage] = useState<BugTriageResponse | null>(null);

  const templates = useMemo(
    () => [
      {
        title: 'Buglist mẫu (Web)',
        text: `Crash khi bấm nút Save ở trang Profile (Chrome)
Không load được danh sách tasks khi filter theo label
UI bị lệch trên mobile iPhone 13 ở trang Login
Không nhận email reset password
Tạo task xong nhưng không hiện trên Kanban cho tới khi reload`,
      },
      {
        title: 'Buglist mẫu (Backend/API)',
        text: `POST /tasks đôi khi trả 500 khi thiếu trường team
GET /projects chậm bất thường khi limit=200
Auth token hết hạn nhưng FE vẫn hiển thị logged in
Upload attachment file > 20MB bị treo request`,
      },
      {
        title: 'Buglist ngắn',
        text: `Không thể đổi priority trên Task Detail
Search tasks không tìm theo description`,
      },
    ],
    [],
  );

  const parseCount = useMemo(() => {
    const lines = bugText
      .split('\n')
      .map((s) => s.trim())
      .filter(Boolean);
    return lines.length;
  }, [bugText]);

  const handleRunTriage = async () => {
    const clean = bugText.trim();
    if (!clean) {
      message.warning('Bạn dán buglist vào trước đã nha.');
      return;
    }

    try {
      setTriageLoading(true);
      setTriage(null);

      const res = await aiServices.triageBugs({
        buglist: clean,
        context: {
          env: import.meta.env.MODE,
          userAgent: navigator.userAgent,
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
          locale: navigator.language,
          routes: [window.location.pathname],
        },
      });
      setTriage(res.data);
    } catch (e: any) {
      console.error(e);
      message.error(e?.response?.data || 'Triage thất bại');
    } finally {
      setTriageLoading(false);
    }
  };

  const handleReset = () => {
    setBugText('');
    setTriage(null);
  };

  const sortedItems = useMemo(() => {
    if (!triage?.items) return [];
    return [...triage.items].sort((a, b) => a.order - b.order);
  }, [triage?.items]);

  return (
    <div
      className="assistant-page"
      style={{
        padding: 16,
        background:
          'linear-gradient(180deg, rgba(15, 23, 42, 0.03) 0%, rgba(15, 23, 42, 0.01) 100%)',
        minHeight: '100vh',
      }}
    >
      {/* Header */}
      <div className="mb-4">
        <Space align="start" size={12}>
          <div
            style={{
              width: 44,
              height: 44,
              borderRadius: 14,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: 'rgba(22, 119, 255, 0.10)',
              border: '1px solid rgba(22, 119, 255, 0.20)',
            }}
          >
            <RobotOutlined style={{ fontSize: 20 }} />
          </div>

          <div>
            <Title level={2} className="m-0">
              {t('assistant.title')}
            </Title>
          </div>
        </Space>
      </div>

      <Row gutter={[16, 16]}>
        {/* Chat Panel */}
        <Col xs={24} lg={16}>
          <Card
            style={{ borderRadius: 16 }}
            bodyStyle={{ padding: 0 }}
            title={
              <Space>
                <MessageOutlined />
                <span>Chat</span>
                <Text type="secondary" style={{ fontSize: 12 }}>
                  (hỏi đáp nhanh trong app)
                </Text>
              </Space>
            }
            extra={
              <Tooltip title="Mẹo: bạn có thể hỏi về task, deadline, cách dùng app, hoặc nhờ tạo task qua chat.">
                <InfoCircleOutlined style={{ opacity: 0.7 }} />
              </Tooltip>
            }
          >
            <div
              style={{
                height: 640,
                borderTop: '1px solid rgba(5, 5, 5, 0.06)',
              }}
            >
              {/* Wrapper padding nhẹ cho đẹp, nhưng không phá layout của ChatPanel */}
              <div style={{ height: '100%', padding: 12 }}>
                <div
                  style={{
                    height: '100%',
                    borderRadius: 12,
                    background: '#fff',
                    border: '1px solid rgba(5, 5, 5, 0.06)',
                    overflow: 'hidden',
                  }}
                >
                  <ChatPanel />
                </div>
              </div>
            </div>
          </Card>
        </Col>

        {/* Bug triage */}
        <Col xs={24} lg={8}>
          <Space direction="vertical" className="w-full" size="large">
            {!triageAccess.hasAccess && (
              <Alert
                message="Tính năng Premium"
                description={
                  <div>
                    <p style={{ marginBottom: 8 }}>Bug Triage AI chỉ có trong gói PREMIUM.</p>
                    <Button
                      type="primary"
                      icon={<CrownOutlined />}
                      size="small"
                      onClick={() => {
                        window.location.href = '/teams';
                      }}
                    >
                      Nâng cấp lên PREMIUM
                    </Button>
                  </div>
                }
                type="warning"
                showIcon
                style={{ marginBottom: 16 }}
              />
            )}
            <Card
              style={{ borderRadius: 16 }}
              title={
                <Space>
                  <BugOutlined />
                  <span>Bug Triage</span>
                  <Tooltip title="Dán danh sách bug (mỗi dòng 1 bug). AI sẽ phân loại severity/priority và sắp thứ tự xử lý.">
                    <InfoCircleOutlined style={{ opacity: 0.7 }} />
                  </Tooltip>
                </Space>
              }
              extra={
                <Button
                  size="small"
                  icon={<ReloadOutlined />}
                  onClick={handleReset}
                  disabled={triageLoading}
                >
                  Reset
                </Button>
              }
              className="w-full"
            >
              <Space direction="vertical" className="w-full" size="middle">
                {/* Templates */}
                <div
                  style={{
                    background: 'rgba(0,0,0,0.02)',
                    border: '1px solid rgba(5, 5, 5, 0.06)',
                    borderRadius: 12,
                    padding: 10,
                  }}
                >
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    Templates
                  </Text>
                  <div style={{ height: 6 }} />
                  <Space wrap>
                    {templates.map((tp) => (
                      <Button
                        key={tp.title}
                        size="small"
                        type="default"
                        onClick={() => setBugText(tp.text)}
                        disabled={triageLoading}
                        style={{ borderRadius: 10 }}
                      >
                        {tp.title}
                      </Button>
                    ))}
                  </Space>
                </div>

                <TextArea
                  placeholder={`Dán buglist vào đây...\nVí dụ:\n- Crash khi bấm Save\n- Không load tasks khi filter label`}
                  value={bugText}
                  onChange={(e) => setBugText(e.target.value)}
                  rows={8}
                  style={{ borderRadius: 12 }}
                />

                <div className="flex justify-between items-center">
                  <Text type="secondary" className="text-xs">
                    {parseCount} bugs
                  </Text>
                  <Space>
                    <Button
                      type="primary"
                      icon={<ThunderboltOutlined />}
                      onClick={handleRunTriage}
                      loading={triageLoading}
                      disabled={!triageAccess.hasAccess}
                      style={{ borderRadius: 12 }}
                    >
                      Analyze
                    </Button>
                  </Space>
                </div>
              </Space>
            </Card>

            {/* Result (scrollable) */}
            <Card
              style={{ borderRadius: 16 }}
              title={
                <Space>
                  <ThunderboltOutlined />
                  <span>Kết quả triage</span>
                </Space>
              }
              className="w-full"
              bodyStyle={{
                maxHeight: 560,
                overflow: 'hidden',
                paddingRight: 8,
              }}
            >
              {!triage && !triageLoading && (
                <Empty
                  description="Chưa có kết quả. Hãy dán buglist và bấm Analyze."
                  image={Empty.PRESENTED_IMAGE_SIMPLE}
                />
              )}

              {triageLoading && (
                <Space direction="vertical" className="w-full">
                  <Text type="secondary">AI đang phân tích buglist...</Text>
                  <Progress percent={60} status="active" />
                </Space>
              )}

              {triage && (
                <div style={{ maxHeight: 520, overflowY: 'auto', paddingRight: 4 }}>
                  <Space direction="vertical" className="w-full" size="middle">
                    {/* Summary sticky */}
                    <div
                      style={{
                        position: 'sticky',
                        top: 0,
                        zIndex: 2,
                        background: '#fff',
                        paddingBottom: 8,
                      }}
                    >
                      <div
                        className="rounded border border-gray-200 p-3"
                        style={{
                          borderRadius: 14,
                          background: 'rgba(0,0,0,0.02)',
                        }}
                      >
                        <Space direction="vertical" className="w-full" size={6}>
                          <div className="flex items-center justify-between">
                            <Text strong>Tổng quan</Text>
                            <Text type="secondary" className="text-xs">
                              Tổng: <b>{triage.summary.total}</b>
                            </Text>
                          </div>

                          <Space wrap>
                            {(['S1', 'S2', 'S3', 'S4'] as const).map((s) => (
                              <Tag key={s} color={severityColor(s)} style={{ borderRadius: 999 }}>
                                {s}: {triage.summary.bySeverity?.[s] ?? 0}
                              </Tag>
                            ))}
                          </Space>

                          <Space wrap>
                            {(['urgent', 'high', 'normal', 'low'] as const).map((p) => (
                              <Tag key={p} color={priorityColor(p)} style={{ borderRadius: 999 }}>
                                {p}: {triage.summary.byPriority?.[p] ?? 0}
                              </Tag>
                            ))}
                          </Space>

                          {Array.isArray(triage.summary.topRisks) &&
                            triage.summary.topRisks.length > 0 && (
                              <>
                                <Divider className="my-2" />
                                <Text strong className="text-sm">
                                  Top risks
                                </Text>
                                <ul className="list-disc pl-5 m-0">
                                  {triage.summary.topRisks.slice(0, 5).map((r, idx) => (
                                    <li key={idx}>
                                      <Text className="text-sm">{r}</Text>
                                    </li>
                                  ))}
                                </ul>
                              </>
                            )}
                        </Space>
                      </div>
                    </div>

                    {/* Items */}
                    <List<TriageItem>
                      dataSource={sortedItems}
                      locale={{ emptyText: 'Không có item' }}
                      renderItem={(it) => (
                        <List.Item style={{ paddingLeft: 8, paddingRight: 8 }}>
                          <div
                            style={{
                              width: '100%',
                              border: '1px solid rgba(5, 5, 5, 0.06)',
                              borderRadius: 14,
                              padding: 12,
                              background: '#fff',
                            }}
                          >
                            <div className="flex items-start justify-between gap-2">
                              <div className="min-w-0">
                                <Text strong className="block">
                                  #{it.order} — {it.title}
                                </Text>
                                {it.description && (
                                  <Text type="secondary" className="text-xs block">
                                    {it.description}
                                  </Text>
                                )}
                              </div>

                              <Space wrap>
                                <Tag color={severityColor(it.severity)} style={{ borderRadius: 999 }}>
                                  {it.severity}
                                </Tag>
                                <Tag color={priorityColor(it.priority)} style={{ borderRadius: 999 }}>
                                  {it.priority}
                                </Tag>
                                <Tooltip
                                  title={`Confidence: ${Math.round((it.confidence ?? 0) * 100)}%`}
                                >
                                  <Tag style={{ borderRadius: 999 }}>
                                    {Math.round((it.confidence ?? 0) * 100)}%
                                  </Tag>
                                </Tooltip>
                              </Space>
                            </div>

                            {Array.isArray(it.rationale) && it.rationale.length > 0 && (
                              <ul className="list-disc pl-5 mt-2 mb-0">
                                {it.rationale.slice(0, 4).map((r, idx) => (
                                  <li key={idx}>
                                    <Text className="text-sm">{r}</Text>
                                  </li>
                                ))}
                              </ul>
                            )}

                            {Array.isArray(it.suggestedLabels) && it.suggestedLabels.length > 0 && (
                              <div className="mt-2 flex flex-wrap gap-2">
                                {it.suggestedLabels.slice(0, 8).map((lb) => (
                                  <Tag key={lb} style={{ borderRadius: 999 }}>
                                    {lb}
                                  </Tag>
                                ))}
                              </div>
                            )}
                          </div>
                        </List.Item>
                      )}
                    />
                  </Space>
                </div>
              )}
            </Card>
          </Space>
        </Col>
      </Row>
    </div>
  );
}