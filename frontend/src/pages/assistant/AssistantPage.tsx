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
} from 'antd';
import {
  RobotOutlined,
  BugOutlined,
  ThunderboltOutlined,
  InfoCircleOutlined,
  ReloadOutlined,
} from '@ant-design/icons';

import ChatPanel from '@/components/chat/ChatPanel';
import { aiServices } from '@/services/aiServices';
import type { BugTriageResponse, TriageItem } from '@/types/ai';

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

      // ✅ Bạn cần implement api này ở aiServices + backend
      // Expected: POST /ai/triage/bugs { buglist: string }
      const res = await aiServices.triageBugs({ buglist: clean });
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

  return (
    <div className="assistant-page">
      <div className="mb-6">
        <Title level={2} className="m-0">
          {t('assistant.title')}
        </Title>
        <Text type="secondary">
          Trợ lý AI hỗ trợ bug triage: phân loại severity/priority và đề xuất thứ tự xử lý.
        </Text>
      </div>

      <Row gutter={[24, 24]}>
        {/* Chat Panel */}
        <Col xs={24} lg={16}>
          <div className="h-[600px]">
            <ChatPanel />
          </div>
        </Col>

        {/* Bug triage */}
        <Col xs={24} lg={8}>
          <Space direction="vertical" className="w-full" size="large">
            <Card
              title={
                <Space>
                  <BugOutlined />
                  <span>Bug Triage (Buglist → Triage)</span>
                  <Tooltip title="Dán danh sách bug (mỗi dòng 1 bug). AI sẽ phân loại severity/priority và sắp thứ tự xử lý.">
                    <InfoCircleOutlined style={{ opacity: 0.7 }} />
                  </Tooltip>
                </Space>
              }
              extra={
                <Space>
                  <Button
                    size="small"
                    icon={<ReloadOutlined />}
                    onClick={handleReset}
                    disabled={triageLoading}
                  >
                    Reset
                  </Button>
                </Space>
              }
              className="w-full"
            >
              <Space direction="vertical" className="w-full" size="middle">
                {/* Templates */}
                <Space wrap>
                  {templates.map((tp) => (
                    <Button
                      key={tp.title}
                      size="small"
                      type="default"
                      onClick={() => setBugText(tp.text)}
                      disabled={triageLoading}
                    >
                      {tp.title}
                    </Button>
                  ))}
                </Space>

                <TextArea
                  placeholder={`Dán buglist vào đây...\nVí dụ:\n- Crash khi bấm Save\n- Không load tasks khi filter label`}
                  value={bugText}
                  onChange={(e) => setBugText(e.target.value)}
                  rows={8}
                />

                <div className="flex justify-between items-center">
                  <Text type="secondary" className="text-xs">
                    {parseCount} bugs
                  </Text>
                  <Space>
                    <Button
                      type="primary"
                      icon={<RobotOutlined />}
                      onClick={handleRunTriage}
                      loading={triageLoading}
                    >
                      Analyze & Triage
                    </Button>
                  </Space>
                </div>
              </Space>
            </Card>

            {/* Result */}
            <Card
              title={
                <Space>
                  <ThunderboltOutlined />
                  <span>Kết quả triage</span>
                </Space>
              }
              className="w-full"
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
                <Space direction="vertical" className="w-full" size="middle">
                  {/* Summary */}
                  <div className="rounded border border-gray-200 p-3 bg-gray-50">
                    <Space direction="vertical" className="w-full" size={6}>
                      <Text strong>Tổng quan</Text>
                      <Text type="secondary" className="text-xs">
                        Tổng: <b>{triage.summary.total}</b>
                      </Text>

                      <Space wrap>
                        {(['S1', 'S2', 'S3', 'S4'] as const).map((s) => (
                          <Tag key={s} color={severityColor(s)}>
                            {s}: {triage.summary.bySeverity?.[s] ?? 0}
                          </Tag>
                        ))}
                      </Space>

                      <Space wrap>
                        {(['urgent', 'high', 'normal', 'low'] as const).map((p) => (
                          <Tag key={p} color={priorityColor(p)}>
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

                  {/* Items */}
                  <List<TriageItem>
                    dataSource={[...triage.items].sort((a, b) => a.order - b.order)}
                    locale={{ emptyText: 'Không có item' }}
                    renderItem={(it) => (
                      <List.Item>
                        <div className="w-full">
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
                              <Tag color={severityColor(it.severity)}>{it.severity}</Tag>
                              <Tag color={priorityColor(it.priority)}>{it.priority}</Tag>
                              <Tooltip title={`Confidence: ${Math.round((it.confidence ?? 0) * 100)}%`}>
                                <Tag>{Math.round((it.confidence ?? 0) * 100)}%</Tag>
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
                                <Tag key={lb}>{lb}</Tag>
                              ))}
                            </div>
                          )}
                        </div>
                      </List.Item>
                    )}
                  />
                </Space>
              )}
            </Card>
          </Space>
        </Col>
      </Row>
    </div>
  );
}