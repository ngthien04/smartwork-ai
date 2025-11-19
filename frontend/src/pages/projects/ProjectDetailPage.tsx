import { useMemo, useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Card,
  Typography,
  Tag,
  Button,
  Row,
  Col,
  Timeline,
  Statistic,
  List,
  Avatar,
  Result,
  Progress,
  Space,
  Alert,
  Modal,
  Form,
  Input,
  Select,
  DatePicker,
  message,
} from 'antd';
import { ArrowLeftOutlined, ThunderboltOutlined, RocketOutlined } from '@ant-design/icons';
import {
  DEFAULT_TEAM_ID,
  getProjectById,
  mockTasks,
  mockUsers,
  mockSprints,
  mockLabels,
} from '@/data/mockData';
import type { Task } from '@/types/task';

const { Title, Text } = Typography;
const { Option } = Select;

export default function ProjectDetailPage() {
  const { projectId } = useParams();
  const navigate = useNavigate();
  const project = projectId ? getProjectById(projectId) : undefined;
  const [taskModalOpen, setTaskModalOpen] = useState(false);
  const [taskForm] = Form.useForm();
  const [projectTasks, setProjectTasks] = useState<Task[]>(() =>
    project ? mockTasks.filter((task) => task.project === project.id) : [],
  );

  useEffect(() => {
    if (project) {
      setProjectTasks(mockTasks.filter((task) => task.project === project.id));
    }
  }, [project?.id]);

  const completion = useMemo(() => {
    if (!project) return 0;
    const done = projectTasks.filter((task) => task.status === 'done').length;
    return Math.round((done / Math.max(projectTasks.length, 1)) * 100);
  }, [project, projectTasks]);

  if (!project) {
    return (
      <Result
        status="404"
        title="Không tìm thấy dự án"
        subTitle="Mock data chưa có dự án bạn yêu cầu."
        extra={
          <Button type="primary" onClick={() => navigate('/projects')}>
            Quay lại danh sách dự án
          </Button>
        }
      />
    );
  }

  const lead = mockUsers.find((user) => user.id === project.lead);

  const handleCreateTask = () => {
    taskForm.resetFields();
    taskForm.setFieldsValue({
      status: 'todo',
      priority: 'normal',
      assignees: [],
      labels: [],
      tags: [],
    });
    setTaskModalOpen(true);
  };

  const handleSubmitTask = (values: any) => {
    const checklist =
      values.subtasks?.split('\n').filter((line: string) => line.trim().length > 0) || [];

    const newTask: Task = {
      id: `TASK-${project.id}-${Date.now()}`,
      team: DEFAULT_TEAM_ID,
      project: project.id,
      title: values.title,
      description: values.description,
      status: values.status,
      priority: values.priority,
      assignees: values.assignees,
      labels: values.labels,
      tags: values.tags,
      dueDate: values.dueDate?.toISOString?.(),
      checklist: checklist.map((item: any) => ({
        content: item,
        done: false,
      })),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    setProjectTasks((prev) => [...prev, newTask]);
    message.success('Đã thêm task mới vào dự án. Task sẽ hiển thị tại Task Board sau khi reload.');
    setTaskModalOpen(false);
  };

  return (
    <div className="space-y-4">
      <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/projects')}>
        Quay lại danh sách
      </Button>

      <div className="flex flex-col gap-2">
        <Title level={2} className="m-0">
          {project.name}
        </Title>
        <Text type="secondary">{project.description}</Text>
        <Space>
          <Tag color="blue">{project.key}</Tag>
          <Tag color={project.isArchived ? 'default' : 'green'}>
            {project.isArchived ? 'Archived' : 'Active'}
          </Tag>
          <Tag>Lead: {lead?.name ?? 'Chưa gán'}</Tag>
        </Space>
      </div>

      <Row gutter={[16, 16]}>
        <Col xs={24} md={6}>
          <Card>
            <Statistic title="Task đang mở" value={projectTasks.filter((t) => t.status !== 'done').length} />
          </Card>
        </Col>
        <Col xs={24} md={6}>
          <Card>
            <Statistic title="Đã hoàn thành" value={`${completion}%`} />
          </Card>
        </Col>
        <Col xs={24} md={6}>
          <Card>
            <Statistic title="Thành viên" value={mockUsers.length} />
          </Card>
        </Col>
        <Col xs={24} md={6}>
          <Card>
            <Statistic title="Insight AI tuần này" value={2} prefix={<ThunderboltOutlined />} />
          </Card>
        </Col>
      </Row>

      <Row gutter={[16, 16]}>
        <Col xs={24} lg={16}>
          <Card title="Tiến độ sprint hiện tại" extra={<Tag color="purple">{mockSprints[0].name}</Tag>}>
            <Progress percent={completion} status="active" />
            <List
              className="mt-4"
              dataSource={[
                { label: 'Backlog', value: projectTasks.filter((t) => t.status === 'backlog').length },
                { label: 'Đang làm', value: projectTasks.filter((t) => t.status === 'in_progress').length },
                { label: 'Hoàn thành', value: projectTasks.filter((t) => t.status === 'done').length },
              ]}
              renderItem={(item) => (
                <List.Item className="flex justify-between">
                  <Text>{item.label}</Text>
                  <Text strong>{item.value}</Text>
                </List.Item>
              )}
            />
          </Card>
        </Col>
        <Col xs={24} lg={8}>
          <Card title="Mốc thời gian">
            <Timeline
              items={[
                { children: 'Sprint 17 kick-off · 11/11' },
                { children: 'Báo cáo giữa kỳ · 18/11' },
                { children: 'Demo nội bộ · 25/11' },
                { children: 'Chuẩn bị kết nối backend · 30/11' },
              ]}
            />
          </Card>
        </Col>
      </Row>

      <Row gutter={[16, 16]}>
        <Col xs={24} lg={14}>
          <Card
            title="Danh sách task"
            extra={
              <Space>
                <Text type="secondary">{projectTasks.length} items</Text>
                <Button type="primary" onClick={handleCreateTask}>
                  Thêm task & subtask
                </Button>
              </Space>
            }
          >
            <List
              dataSource={projectTasks}
              renderItem={(task) => (
                <List.Item
                  actions={[
                    <Button key="view" type="link" onClick={() => navigate(`/tasks/${task.id}`)}>
                      Xem task
                    </Button>,
                  ]}
                >
                  <List.Item.Meta
                    title={
                      <Space>
                        <Text strong>{task.title}</Text>
                        <Tag color="blue">{task.status}</Tag>
                      </Space>
                    }
                    description={task.description}
                  />
                  <Tag color="orange">{task.priority?.toUpperCase()}</Tag>
                </List.Item>
              )}
            />
            <Alert
              className="mt-3"
              type="info"
              message="Task chỉ được tạo trong phạm vi dự án và đã có trường Subtask (checklist) để chia nhỏ việc."
              showIcon
            />
          </Card>
        </Col>
        <Col xs={24} lg={10}>
          <Card title="Thành viên dự án">
            <List
              dataSource={mockUsers}
              renderItem={(user) => (
                <List.Item
                  actions={[
                    <Tag key="role" color={user.roles?.[0]?.role === 'leader' ? 'gold' : 'default'}>
                      {user.roles?.[0]?.role}
                    </Tag>,
                  ]}
                >
                  <List.Item.Meta
                    avatar={<Avatar src={user.avatarUrl}>{user.name[0]}</Avatar>}
                    title={user.name}
                    description={user.email}
                  />
                </List.Item>
              )}
            />
          </Card>
        </Col>
      </Row>

      <Row gutter={[16, 16]}>
        <Col xs={24} lg={12}>
          <Card
            title="AI Action Plan"
            extra={<Tag color="cyan">Prototype</Tag>}
            actions={[
              <Button key="execute" type="primary" ghost icon={<RocketOutlined />}>
                Chạy mô phỏng
              </Button>,
            ]}
          >
            <List
              dataSource={[
                'Đề xuất rút ngắn checklist bằng cách gom Task Detail & Admin UI',
                'Gợi ý chuyển task AI widget sang sprint 18 để giảm risk',
                'Ưu tiên build project overview chart trước khi nối backend',
              ]}
              renderItem={(item) => (
                <List.Item>
                  <Text>{item}</Text>
                </List.Item>
              )}
            />
            <Alert
              className="mt-3"
              type="info"
              message="Tính năng mô phỏng đang dùng dữ liệu giả để trình diễn flow."
              showIcon
            />
          </Card>
        </Col>
        <Col xs={24} lg={12}>
          <Card title="Sprints gần đây">
            <List
              dataSource={mockSprints}
              renderItem={(sprint) => (
                <List.Item>
                  <List.Item.Meta
                    title={sprint.name}
                    description="Trạng thái: đang hoạt động"
                  />
                  <Tag color={sprint.id === mockSprints[0].id ? 'green' : 'default'}>Active</Tag>
                </List.Item>
              )}
            />
          </Card>
        </Col>
      </Row>

      <Modal
        open={taskModalOpen}
        title="Tạo task cho dự án này"
        onCancel={() => setTaskModalOpen(false)}
        onOk={() => taskForm.submit()}
        okText="Tạo task"
      >
        <Form layout="vertical" form={taskForm} onFinish={handleSubmitTask}>
          <Form.Item
            name="title"
            label="Tiêu đề"
            rules={[{ required: true, message: 'Nhập tiêu đề' }]}
          >
            <Input placeholder="VD: Chuẩn bị báo cáo tiến độ" />
          </Form.Item>
          <Form.Item name="description" label="Mô tả">
            <Input.TextArea rows={3} placeholder="Mục tiêu, kết quả mong đợi..." />
          </Form.Item>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="status" label="Trạng thái">
                <Select>
                  <Option value="backlog">Backlog</Option>
                  <Option value="todo">Cần làm</Option>
                  <Option value="in_progress">Đang làm</Option>
                  <Option value="done">Hoàn thành</Option>
                </Select>
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="priority" label="Ưu tiên">
                <Select>
                  <Option value="low">Thấp</Option>
                  <Option value="normal">Bình thường</Option>
                  <Option value="high">Cao</Option>
                  <Option value="urgent">Khẩn cấp</Option>
                </Select>
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="dueDate" label="Deadline">
                <DatePicker className="w-full" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="assignees" label="Assignees">
                <Select mode="multiple" placeholder="Chọn thành viên">
                  {mockUsers.map((user) => (
                    <Option key={user.id} value={user.id}>
                      {user.name}
                    </Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
          </Row>
          <Form.Item name="labels" label="Labels">
            <Select mode="multiple" placeholder="Chọn label">
              {mockLabels.map((label) => (
                <Option key={label.id} value={label.id}>
                  {label.name}
                </Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item name="tags" label="Tags">
            <Select mode="tags" placeholder="Ví dụ: báo cáo, sprint" />
          </Form.Item>
          <Form.Item
            name="subtasks"
            label="Danh sách subtask (mỗi dòng 1 việc nhỏ)"
            extra="Ví dụ: Chuẩn bị file excel\nGửi GV review"
          >
            <Input.TextArea rows={4} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}

