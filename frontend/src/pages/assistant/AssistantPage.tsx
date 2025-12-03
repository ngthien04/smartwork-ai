
import { useState } from 'react';
import {
  Row,
  Col,
  Card,
  Button,
  Input,
  Space,
  Typography,
  message,
} from 'antd';
import {
  RobotOutlined,
  BulbOutlined,
  CalendarOutlined,
} from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import ChatPanel from '@/components/chat/ChatPanel';
import { aiServices, type AIPlannedTask } from '@/services/aiServices';
import taskServices from '@/services/taskServices';
import { useMutation, useQueryClient } from '@tanstack/react-query';

const { Title, Text } = Typography;
const { TextArea } = Input;

export default function AssistantPage() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [planningGoal, setPlanningGoal] = useState('');
  const [aiSuggestions, setAiSuggestions] = useState<AIPlannedTask[]>([]);

  
  const planningMutation = useMutation({
    mutationFn: (payload: { goal: string; constraints?: any }) =>
      aiServices.planner(payload).then((res) => res.data),
    onSuccess: (data) => {
      setAiSuggestions(data.tasks || []);
    },
  });

  
  const createTasksMutation = useMutation({
    mutationFn: async (tasks: AIPlannedTask[]) => {
      
      
      for (const t of tasks) {
        await taskServices.create({
          title: t.title,
          description: t.description,
          priority: t.priority || 'normal',
          team: ''
        });
      }
    },
    onSuccess: () => {
      message.success('Đã import tasks từ AI');
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      setAiSuggestions([]);
    },
  });

  const handlePlanning = () => {
    if (!planningGoal.trim()) return;
    planningMutation.mutate({
      goal: planningGoal,
      constraints: {
        deadline: new Date(
          Date.now() + 7 * 24 * 60 * 60 * 1000,
        ).toISOString(),
      },
    });
  };

  const handleImportTasks = () => {
    if (!aiSuggestions.length) return;
    createTasksMutation.mutate(aiSuggestions);
  };

  const quickPrompts = [
    {
      title: 'Lập kế hoạch dự án',
      prompt:
        'Tôi muốn lập kế hoạch cho dự án phát triển ứng dụng web trong 3 tháng',
      icon: <BulbOutlined />,
    },
    {
      title: 'Chia nhỏ công việc',
      prompt: 'Giúp tôi chia nhỏ công việc "Triển khai hệ thống quản lý"',
      icon: <CalendarOutlined />,
    },
    {
      title: 'Tối ưu thời gian',
      prompt:
        'Tôi có 5 công việc cần làm tuần này, giúp tôi sắp xếp thời gian',
      icon: <RobotOutlined />,
    },
  ];

  return (
    <div className="assistant-page">
      <div className="mb-6">
        <Title level={2} className="m-0">
          {t('assistant.title')}
        </Title>
        <Text type="secondary">
          Trợ lý AI giúp bạn lập kế hoạch và quản lý công việc hiệu quả
        </Text>
      </div>

      <Row gutter={[24, 24]}>
        {/* Chat Panel */}
        <Col xs={24} lg={16}>
          <div className="h-[600px]">
            <ChatPanel />
          </div>
        </Col>

        {/* AI Planning & Quick Actions */}
        <Col xs={24} lg={8}>
          <Space direction="vertical" className="w-full" size="large">
            {/* AI Planning */}
            <Card title={t('assistant.aiPlanning')} className="w-full">
              <Space direction="vertical" className="w-full" size="middle">
                <TextArea
                  placeholder="Nhập mục tiêu hoặc công việc bạn muốn lập kế hoạch..."
                  value={planningGoal}
                  onChange={(e) => setPlanningGoal(e.target.value)}
                  rows={4}
                />
                <Button
                  type="primary"
                  icon={<RobotOutlined />}
                  onClick={handlePlanning}
                  loading={planningMutation.isPending}
                  className="w-full"
                >
                  Lập kế hoạch với AI
                </Button>
              </Space>
            </Card>

            {/* AI Suggestions */}
            {aiSuggestions.length > 0 && (
              <Card title="Đề xuất từ AI" className="w-full">
                <Space direction="vertical" className="w-full" size="small">
                  {aiSuggestions.map((task, index) => (
                    <div
                      key={index}
                      className="p-2 bg-gray-50 rounded border border-gray-100"
                    >
                      <Text strong className="block">
                        {task.title}
                      </Text>
                      {task.description && (
                        <Text type="secondary" className="text-sm block mb-1">
                          {task.description}
                        </Text>
                      )}
                      <Text type="secondary" className="text-xs">
                        Ưu tiên: {task.priority || 'normal'} • Ước lượng:{' '}
                        {task.estimateHours || 'N/A'}h
                      </Text>
                    </div>
                  ))}
                  <Button
                    type="primary"
                    onClick={handleImportTasks}
                    loading={createTasksMutation.isPending}
                    className="w-full mt-2"
                  >
                    Import vào Tasks
                  </Button>
                </Space>
              </Card>
            )}

            {/* Quick Prompts */}
            <Card title="Gợi ý nhanh" className="w-full">
              <Space direction="vertical" className="w-full" size="small">
                {quickPrompts.map((prompt, index) => (
                  <Button
                    key={index}
                    type="text"
                    className="w-full text-left justify-start h-auto p-3"
                    onClick={() => setPlanningGoal(prompt.prompt)}
                  >
                    <Space>
                      {prompt.icon}
                      <div>
                        <div className="font-medium">{prompt.title}</div>
                        <div className="text-xs text-gray-500">
                          {prompt.prompt}
                        </div>
                      </div>
                    </Space>
                  </Button>
                ))}
              </Space>
            </Card>
          </Space>
        </Col>
      </Row>
    </div>
  );
}
