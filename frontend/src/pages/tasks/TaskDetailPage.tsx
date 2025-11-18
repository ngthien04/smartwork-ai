import { useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Row,
  Col,
  Card,
  Tag,
  Avatar,
  List,
  Timeline,
  Typography,
  Button,
  Space,
  Divider,
  Progress,
  Alert,
  Result,
} from 'antd';
import {
  ArrowLeftOutlined,
  PaperClipOutlined,
  CommentOutlined,
  RobotOutlined,
  ThunderboltOutlined,
} from '@ant-design/icons';
import { getTaskById, mockProjects, mockUsers } from '@/data/mockData';

const { Title, Text, Paragraph } = Typography;

const mockComments = [
  {
    id: 'cmt-001',
    author: 'user-002',
    content: 'Đã hoàn thiện phần UI, cần review.',
    createdAt: '2024-11-16T08:30:00.000Z',
  },
  {
    id: 'cmt-002',
    author: 'user-001',
    content: 'Nhớ thêm chat box!',
    createdAt: '2024-11-16T09:00:00.000Z',
  },
];

const mockSubtasks = [
  { id: 'sub-1', title: 'Thiết kế header chi tiết task', done: true },
  { id: 'sub-2', title: 'Dựng layout ', done: true },
  { id: 'sub-3', title: 'Thêm comment section', done: false },
  { id: 'sub-4', title: 'Placeholder cho AI action buttons', done: false },
];

const mockAttachments = [
  {
    id: 'att-1',
    name: 'task-detail-wireframe.fig',
    size: '2.1MB',
    uploadedBy: 'user-003',
    uploadedAt: '2024-11-15T10:12:00.000Z',
  },
  {
    id: 'att-2',
    name: 'copywriting.md',
    size: '12KB',
    uploadedBy: 'user-002',
    uploadedAt: '2024-11-15T15:45:00.000Z',
  },
];

const mockAIInsights = [
  {
    id: 'ai-1',
    tone: 'warning',
    headline: 'Risk: Khối lượng subtasks còn 40%',
    description: 'Cần kịp deadline 25/11.',
    suggestion: 'Đề xuất tách phần upload file sang sprint sau.',
  },
  {
    id: 'ai-2',
    tone: 'success',
    headline: 'Opportunity: Có thể tái sử dụng component Comments',
    description: 'Tái sử dụng',
    suggestion: 'Tạo component.',
  },
];

export default function TaskDetailPage() {
  const { taskId } = useParams();
  const navigate = useNavigate();
  const task = taskId ? getTaskById(taskId) : undefined;

  const project = useMemo(
    () => (task?.project ? mockProjects.find((p) => p.id === task.project) : undefined),
    [task?.project],
  );

  const assignees = useMemo(
    () => mockUsers.filter((user) => task?.assignees?.includes(user.id)),
    [task?.assignees],
  );

  const subtaskProgress = useMemo(() => {
    const doneCount = mockSubtasks.filter((item) => item.done).length;
    return Math.round((doneCount / mockSubtasks.length) * 100);
  }, []);

  if (!task) {
    return (
      <Result
        status="404"
        title="Task không tồn tại"
        subTitle="Giá trị mock data chưa có task này. Vui lòng quay lại bảng công việc."
        extra={
          <Button type="primary" onClick={() => navigate(-1)}>
            Quay lại Tasks
          </Button>
        }
      />
    );
  }

  return (
    <div className="space-y-4">
      <Button icon={<ArrowLeftOutlined />} onClick={() => navigate(-1)}>
        Quay lại bảng công việc
      </Button>

      <div className="flex justify-between items-start flex-col lg:flex-row lg:items-center">
        <div className="space-y-1">
          <Title level={2} className="m-0">
            {task.id} · {task.title}
          </Title>
          <Text type="secondary">
            Thuộc dự án {project?.name ?? 'Chưa gắn dự án'} · Deadline{' '}
            {task.dueDate ? new Date(task.dueDate).toLocaleDateString() : 'Chưa đặt'}
          </Text>
        </div>
        <Space size="middle" className="mt-3 lg:mt-0">
          <Tag color="orange">{task.priority?.toUpperCase()}</Tag>
          <Tag color="blue">{task.status}</Tag>
        </Space>
      </div>

      <Row gutter={[24, 24]}>
        <Col xs={24} lg={16}>
          <Card title="Thông tin chung">
            <Space direction="vertical" size="middle" className="w-full">
              <Paragraph>{task.description}</Paragraph>
              <div className="flex flex-wrap gap-2">
                {task.tags?.map((tag) => (
                  <Tag key={tag} color="blue">
                    {tag}
                  </Tag>
                ))}
              </div>
              <Divider />
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Text type="secondary" className="block text-xs">
                    Assignees
                  </Text>
                  <Avatar.Group maxCount={5}>
                    {assignees.map((user) => (
                      <Avatar key={user.id} src={user.avatarUrl}>
                        {user.name[0]}
                      </Avatar>
                    ))}
                  </Avatar.Group>
                </div>
                <div>
                  <Text type="secondary" className="block text-xs">
                    Trạng thái phụ thuộc
                  </Text>
                  <Tag color="default">Không có</Tag>
                </div>
              </div>
            </Space>
          </Card>

          <Card title="Subtasks" className="mt-4">
            <Space direction="vertical" size="large" className="w-full">
              <Progress percent={subtaskProgress} />
              <List
                dataSource={mockSubtasks}
                renderItem={(item) => (
                  <List.Item>
                    <Space>
                      <Tag color={item.done ? 'green' : 'default'}>
                        {item.done ? 'DONE' : 'TODO'}
                      </Tag>
                      <Text delete={item.done}>{item.title}</Text>
                    </Space>
                  </List.Item>
                )}
              />
            </Space>
          </Card>

          <Row gutter={16} className="mt-4">
            <Col span={12}>
              <Card title="Attachments" extra={<PaperClipOutlined />}>
                <List
                  dataSource={mockAttachments}
                  renderItem={(file) => (
                    <List.Item>
                      <Space direction="vertical" size={0}>
                        <Text strong>{file.name}</Text>
                        <Text type="secondary" className="text-xs">
                          {file.size} · Upload bởi{' '}
                          {mockUsers.find((u) => u.id === file.uploadedBy)?.name}
                        </Text>
                      </Space>
                    </List.Item>
                  )}
                />
              </Card>
            </Col>
            <Col span={12}>
              <Card title="Hoạt động gần đây">
                <Timeline
                  items={[
                    {
                      children: '09:15 · Hung cập nhật mô tả task',
                    },
                    {
                      children: '08:30 · Thien đính kèm wireframe',
                    },
                    {
                      children: 'Hôm qua · A tạo task',
                    },
                  ]}
                />
              </Card>
            </Col>
          </Row>

          <Card title="Bình luận" className="mt-4" extra={<CommentOutlined />}>
            <List
              dataSource={mockComments}
              renderItem={(comment) => (
                <List.Item>
                  <List.Item.Meta
                    avatar={
                      <Avatar src={mockUsers.find((u) => u.id === comment.author)?.avatarUrl}>
                        {mockUsers.find((u) => u.id === comment.author)?.name?.[0]}
                      </Avatar>
                    }
                    title={
                      <Space>
                        <Text strong>
                          {mockUsers.find((u) => u.id === comment.author)?.name}
                        </Text>
                        <Text type="secondary" className="text-xs">
                          {new Date(comment.createdAt).toLocaleString()}
                        </Text>
                      </Space>
                    }
                    description={comment.content}
                  />
                </List.Item>
              )}
            />
            <Alert
              type="info"
              className="mt-4"
              message="Form bình luận sẽ được nối API sau. Hiện tại chỉ hiển thị mock data."
            />
          </Card>
        </Col>

        <Col xs={24} lg={8}>
          <Space direction="vertical" size="large" className="w-full">
            <Card
              title="AI Insights"
              extra={<RobotOutlined />}
              actions={[
                <Button key="accept" type="primary" ghost icon={<ThunderboltOutlined />}>
                  Chấp nhận gợi ý
                </Button>,
                <Button key="dismiss" type="text">
                  Bỏ qua
                </Button>,
              ]}
            >
              <Space direction="vertical" className="w-full">
                {mockAIInsights.map((insight) => (
                  <Card
                    key={insight.id}
                    size="small"
                    style={{
                      backgroundColor:
                        insight.tone === 'warning'
                          ? '#fff7e6'
                          : insight.tone === 'success'
                          ? '#f6ffed'
                          : undefined,
                    }}
                  >
                    <Text strong>{insight.headline}</Text>
                    <Paragraph className="mb-1">{insight.description}</Paragraph>
                    <Text type="secondary" className="text-sm">
                      {insight.suggestion}
                    </Text>
                  </Card>
                ))}
              </Space>
            </Card>

            <Card title="Checklist báo cáo">
              <List
                dataSource={[
                  { id: 'ck-1', label: 'UI layout hoàn chỉnh', done: true },
                  { id: 'ck-2', label: 'Comment & Attachment section', done: true },
                  { id: 'ck-3', label: 'AI Insight widget', done: false },
                  { id: 'ck-4', label: 'Hook API thực tế', done: false },
                ]}
                renderItem={(item) => (
                  <List.Item>
                    <Space>
                      <Tag color={item.done ? 'green' : 'default'}>
                        {item.done ? 'ĐÃ LÀM' : 'ĐANG LÀM'}
                      </Tag>
                      <Text>{item.label}</Text>
                    </Space>
                  </List.Item>
                )}
              />
            </Card>

            <Card title="Báo cáo tiến độ">
              <Space direction="vertical">
                <Text strong>Tiến độ tổng</Text>
                <Progress percent={70} status="active" />
                <Text type="secondary" className="text-sm">
                  Dữ liệu minh họa để demo giữa kỳ, không kết nối backend.
                </Text>
              </Space>
            </Card>
          </Space>
        </Col>
      </Row>
    </div>
  );
}

