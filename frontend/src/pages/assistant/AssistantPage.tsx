// src/pages/assistant/AssistantPage.tsx
import { useState } from 'react';
import { Row, Col, Card, Button, Input, Space, Typography } from 'antd';
import { RobotOutlined, BulbOutlined, CalendarOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import ChatPanel from '@/components/chat/ChatPanel';
import { aiServices } from '@/services/aiServices';
import  taskServices  from '@/services/taskServices';
import { useMutation, useQueryClient } from '@tanstack/react-query';

const { Title, Text } = Typography;
const { TextArea } = Input;

export default function AssistantPage() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [planningGoal, setPlanningGoal] = useState('');
  const [isPlanning, setIsPlanning] = useState(false);
  const [aiSuggestions, setAiSuggestions] = useState<any[]>([]);

  // AI Planning mutation
  const planningMutation = useMutation({
    mutationFn: aiServices.planner,
    onSuccess: (data) => {
      setAiSuggestions(data.tasks);
      setIsPlanning(false);
    },
    onError: () => {
      setIsPlanning(false);
    },
  });

  // Create tasks from AI suggestions
  const createTasksMutation = useMutation({
    //mutationFn: taskServices.createBatch,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      setAiSuggestions([]);
    },
  });

  const handlePlanning = async () => {
    if (!planningGoal.trim()) return;
    
    setIsPlanning(true);
    planningMutation.mutate({
      goal: planningGoal,
      constraints: {
        deadline: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(), // 1 week
      },
    });
  };

  const handleImportTasks = () => {
    // if (aiSuggestions.length === 0) return;
    
    // createTasksMutation.mutate(aiSuggestions);
  };

  const quickPrompts = [
    {
      title: 'Lập kế hoạch dự án',
      prompt: 'Tôi muốn lập kế hoạch cho dự án phát triển ứng dụng web trong 3 tháng',
      icon: <BulbOutlined />,
    },
    {
      title: 'Chia nhỏ công việc',
      prompt: 'Giúp tôi chia nhỏ công việc "Triển khai hệ thống quản lý"',
      icon: <CalendarOutlined />,
    },
    {
      title: 'Tối ưu thời gian',
      prompt: 'Tôi có 5 công việc cần làm tuần này, giúp tôi sắp xếp thời gian',
      icon: <RobotOutlined />,
    },
  ];

  return (
    <div className="assistant-page">
      <div className="mb-6">
        <Title level={2} className="m-0">{t('assistant.title')}</Title>
        <Text type="secondary">Trợ lý AI giúp bạn lập kế hoạch và quản lý công việc hiệu quả</Text>
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
                  loading={isPlanning}
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
                    <div key={index} className="p-2 bg-gray-50 rounded">
                      <Text strong className="block">{task.title}</Text>
                      <Text type="secondary" className="text-sm">
                        Ưu tiên: {task.priority} • Thời gian: {task.estimatedTime || 'Chưa xác định'}
                      </Text>
                    </div>
                  ))}
                  <Button
                    type="primary"
                    //onClick={handleImportTasks}
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
                        <div className="text-xs text-gray-500">{prompt.prompt}</div>
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
