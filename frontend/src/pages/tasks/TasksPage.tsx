// src/pages/tasks/TasksPage.tsx
import { useMemo, useState } from 'react';
import {
  Row,
  Col,
  Card,
  Button,
  Input,
  Select,
  Space,
  Typography,
  Modal,
  Tag,
  Statistic,
  Divider,
  Avatar,
  List,
  Tooltip,
  message,
  Alert,
} from 'antd';
import {
  PlusOutlined,
  SearchOutlined,
  FilterOutlined,
  EyeOutlined,
  ReloadOutlined,
  ProjectOutlined,
} from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import Kanban from '@/components/tasks/Kanban';
import type { Task } from '@/types';
import { DEFAULT_TEAM_ID, mockLabels, mockSprints, mockTasks, mockUsers } from '@/data/mockData';

const { Title, Text } = Typography;
const { Option } = Select;

export default function TasksPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [tasks, setTasks] = useState<Task[]>(mockTasks);
  const [filters, setFilters] = useState({
    search: '',
    status: 'all',
    priority: 'all',
    label: 'all',
    assignee: 'all',
    sprint: 'all',
  });
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);

  const filteredTasks = useMemo(() => {
    return tasks.filter((task) => {
      const matchesSearch =
        task.title.toLowerCase().includes(filters.search.toLowerCase()) ||
        (task.description || '').toLowerCase().includes(filters.search.toLowerCase());
      const matchesStatus = filters.status === 'all' || task.status === filters.status;
      const matchesPriority = filters.priority === 'all' || task.priority === filters.priority;
      const matchesLabel =
        filters.label === 'all' || (task.labels as string[] | undefined)?.includes(filters.label);
      const matchesAssignee =
        filters.assignee === 'all' || task.assignees?.includes(filters.assignee);
      return matchesSearch && matchesStatus && matchesPriority && matchesLabel && matchesAssignee;
    });
  }, [filters, tasks]);

  const stats = useMemo(() => {
    const total = tasks.length;
    const inProgress = tasks.filter((task) => task.status === 'in_progress').length;
    const done = tasks.filter((task) => task.status === 'done').length;
    return { total, inProgress, done };
  }, [tasks]);

  const handleTaskUpdate = (taskId: string, updates: Partial<Task>) => {
    setTasks((prev) => prev.map((task) => (task.id === taskId ? { ...task, ...updates } : task)));
    if (selectedTask?.id === taskId) {
      setSelectedTask((prev) => (prev ? { ...prev, ...updates } : prev));
    }
  };

  const handleTaskDelete = (taskId: string) => {
    Modal.confirm({
      title: 'Xác nhận xóa',
      content: 'xóa xong thì có thể reload để khôi phục',
      onOk: () => setTasks((prev) => prev.filter((task) => task.id !== taskId)),
    });
  };

  const handleBlockedCreate = () => {
    message.info('Vui lòng tạo task trong trang Project Detail để gắn với dự án cụ thể.');
  };

  const openDetailModal = (task: Task) => {
    setSelectedTask(task);
    setIsDetailModalOpen(true);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
        <div>
          <Title level={2} className="m-0">
            {t('tasks.title')}
          </Title>
          <Text type="secondary">Mọi task đều phải thuộc một Project cụ thể.</Text>
        </div>
        <Space>
          <Button icon={<ReloadOutlined />} onClick={() => setTasks(mockTasks)}>
            Reset Mock
          </Button>
          <Button
            type="primary"
            icon={<ProjectOutlined />}
            onClick={() => navigate('/projects')}
          >
            Tạo task trong Project
          </Button>
        </Space>
      </div>

      <Row gutter={[16, 16]}>
        <Col xs={24} lg={6}>
          <Space direction="vertical" className="w-full">
            <Card title="Bộ lọc">
              <Space direction="vertical" className="w-full">
            <Input
                  placeholder="Tìm tiêu đề hoặc mô tả..."
              prefix={<SearchOutlined />}
              value={filters.search}
                  onChange={(event) =>
                    setFilters((prev) => ({ ...prev, search: event.target.value }))
                  }
            />
            <Select
              value={filters.status}
                  onChange={(value) => setFilters((prev) => ({ ...prev, status: value }))}
            >
                  <Option value="all">Tất cả trạng thái</Option>
                  <Option value="backlog">Backlog</Option>
              <Option value="todo">Cần làm</Option>
              <Option value="in_progress">Đang làm</Option>
              <Option value="done">Hoàn thành</Option>
            </Select>
            <Select
              value={filters.priority}
                  onChange={(value) => setFilters((prev) => ({ ...prev, priority: value }))}
            >
                  <Option value="all">Mọi ưu tiên</Option>
                  <Option value="low">Thấp</Option>
                  <Option value="normal">Bình thường</Option>
                  <Option value="high">Cao</Option>
                  <Option value="urgent">Khẩn cấp</Option>
                </Select>
                <Select
                  value={filters.label}
                  onChange={(value) => setFilters((prev) => ({ ...prev, label: value }))}
                >
                  <Option value="all">Tất cả label</Option>
                  {mockLabels.map((label) => (
                    <Option key={label.id} value={label.id}>
                      {label.name}
                    </Option>
                  ))}
                </Select>
                <Select
                  value={filters.assignee}
                  onChange={(value) => setFilters((prev) => ({ ...prev, assignee: value }))}
                >
                  <Option value="all">Mọi người phụ trách</Option>
                  {mockUsers.map((user) => (
                    <Option key={user.id} value={user.id}>
                      {user.name}
                    </Option>
                  ))}
                </Select>
              </Space>
            </Card>
            <Card title="AI status" extra={<FilterOutlined />}>
              <List
                dataSource={[
                  'AI đề xuất gom task UI',
                  'Cần ước lượng lại task ',
                  'Đang thu thập báo cáo',
                ]}
                renderItem={(item) => (
                  <List.Item>
                    <Text>{item}</Text>
                  </List.Item>
                )}
              />
            </Card>
          </Space>
        </Col>
        <Col xs={24} lg={18}>
          <Alert
            type="info"
            showIcon
            className="mb-4"
            message="Không thể tạo task trực tiếp ở bảng này. Vui lòng mở một Project, tạo task rồi chia nhỏ subtask."
          />
          <Row gutter={[16, 16]}>
            <Col xs={24} md={8}>
              <Card>
                <Statistic title="Tổng task" value={stats.total} />
              </Card>
            </Col>
            <Col xs={24} md={8}>
              <Card>
                <Statistic title="Đang làm" value={stats.inProgress} />
              </Card>
            </Col>
            <Col xs={24} md={8}>
              <Card>
                <Statistic title="Hoàn thành" value={stats.done} />
              </Card>
            </Col>
          </Row>

          <Card className="mt-4">
            <Kanban
              tasks={filteredTasks}
              onTaskUpdate={handleTaskUpdate}
              onTaskDelete={handleTaskDelete}
              onCreateTask={handleBlockedCreate}
              onTaskSelect={openDetailModal}
            />
          </Card>
        </Col>
      </Row>

      <Modal
        title="Xem nhanh task"
        open={isDetailModalOpen}
        onCancel={() => setIsDetailModalOpen(false)}
        footer={
          <Space>
            <Button onClick={() => setIsDetailModalOpen(false)}>Đóng</Button>
              <Button 
                type="primary" 
              icon={<EyeOutlined />}
              onClick={() => {
                if (selectedTask) {
                  navigate(`/tasks/${selectedTask.id}`);
                }
              }}
              >
              Mở trang Task Detail
              </Button>
          </Space>
        }
        width={520}
      >
        {selectedTask ? (
          <Space direction="vertical" className="w-full">
            <div>
              <Text strong>{selectedTask.title}</Text>
              <div className="text-sm text-gray-500">{selectedTask.description}</div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Tag color="blue">{selectedTask.status}</Tag>
              <Tag color="orange">{selectedTask.priority}</Tag>
            </div>
            <Divider className="my-2" />
            <Space direction="vertical" className="w-full">
              <Text type="secondary" className="text-xs">
                Assignees
              </Text>
              <Avatar.Group>
                {selectedTask.assignees?.map((assignee) => {
                  const user = mockUsers.find((u) => u.id === assignee);
                  return (
                    <Tooltip key={assignee} title={user?.name}>
                      <Avatar src={user?.avatarUrl}>{user?.name?.[0]}</Avatar>
                    </Tooltip>
                  );
                })}
              </Avatar.Group>
              <Text type="secondary" className="text-xs">
                Thuộc sprint
              </Text>
              <Tag>{mockSprints[0].name}</Tag>
            </Space>
          </Space>
        ) : (
          <Text>Chưa chọn task nào</Text>
        )}
      </Modal>
    </div>
  );
}
