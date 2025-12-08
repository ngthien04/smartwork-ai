import { useEffect, useMemo, useState } from 'react';
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
  Avatar,
  List,
  Tooltip,
  message,
  Alert,
} from 'antd';
import {
  SearchOutlined,
  FilterOutlined,
  EyeOutlined,
  ReloadOutlined,
  ProjectOutlined,
} from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';

import Kanban from '@/components/tasks/Kanban';
import taskServices from '@/services/taskServices';
import type { Task } from '@/types'; 
import { aiStatusServices, type AIStatusItem } from '@/services/aiStatusServices';

const { Title, Text } = Typography;
const { Option } = Select;

type Filters = {
  search: string;
  status: 'all' | 'backlog' | 'todo' | 'in_progress' | 'done';
  priority: 'all' | 'low' | 'normal' | 'high' | 'urgent';
  assignee: 'all' | string;
  label: 'all' | string;
};

type AssigneeOption = {
  id: string;
  name: string;
  avatarUrl?: string;
};

type LabelOption = {
  id: string;
  name: string;
  color?: string;
};

export default function TasksPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(false);

  const [filters, setFilters] = useState<Filters>({
    search: '',
    status: 'all',
    priority: 'all',
    assignee: 'all',
    label: 'all',
  });

  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [aiStatus, setAiStatus] = useState<AIStatusItem[]>([]);
  const [aiStatusLoading, setAiStatusLoading] = useState(false);
  const [aiFilterKey, setAiFilterKey] = useState<AIStatusItem['key'] | null>(null);


  const fetchAIStatus = async () => {
    try {
      setAiStatusLoading(true);
      const items = await aiStatusServices.getStatus({ limit: 5 }); // AIStatusItem[]
      setAiStatus(items);
    } catch (e) {
      console.error(e);
      setAiStatus([{ key: 'ok', text: 'Không tải được AI status.', count: 0 }]);
    } finally {
      setAiStatusLoading(false);
    }
  };

  const fetchTasks = async () => {
    try {
      setLoading(true);
      const res = await taskServices.list({ limit: 200, sort: '-createdAt' });
      const raw = (res.data as any).items || res.data || [];

      const mapped: Task[] = raw.map((t: any) => ({
        ...t,
        id: (t as any).id || (t as any)._id, 
      }));

      setTasks(mapped);
    } catch (err: any) {
      console.error(err);
      message.error(err?.response?.data || 'Không tải được danh sách task');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTasks();
  }, []);

  const handleReload = () => {
    fetchTasks();
  };

  
  const assigneeOptions: AssigneeOption[] = useMemo(() => {
    const map = new Map<string, AssigneeOption>();

    tasks.forEach((task) => {
      (task.assignees || []).forEach((a: any) => {
        const id = String(a?._id || a?.id || a);
        const name = a?.name || a?.email || id;
        const avatarUrl = a?.avatarUrl;

        if (!map.has(id)) {
          map.set(id, { id, name, avatarUrl });
        }
      });
    });

    return Array.from(map.values());
  }, [tasks]);

  
  const labelOptions: LabelOption[] = useMemo(() => {
    const map = new Map<string, LabelOption>();

    tasks.forEach((task) => {
      (task as any).labels?.forEach((lb: any) => {
        const id = String(lb?._id || lb?.id || lb);
        if (!id) return;
        const name = lb?.name || id;
        const color = lb?.color;

        if (!map.has(id)) {
          map.set(id, { id, name, color });
        }
      });
    });

    return Array.from(map.values());
  }, [tasks]);

  
  const filteredTasks = useMemo(() => {
    return tasks.filter((task) => {
      const search = filters.search.toLowerCase();
      const matchesSearch =
        task.title.toLowerCase().includes(search) ||
        (task.description || '').toLowerCase().includes(search);

      const matchesStatus = filters.status === 'all' || task.status === filters.status;
      const matchesPriority = filters.priority === 'all' || task.priority === filters.priority;

      const matchesAssignee =
        filters.assignee === 'all' ||
        task.assignees?.some((a) => String((a as any).id || (a as any)._id || a) === filters.assignee);

      const matchesLabel =
        filters.label === 'all' ||
        (task as any).labels?.some((lb: any) => String(lb?.id || lb?._id || lb) === filters.label);

      // --- AI filter ---
      const now = new Date();
      const due = task.dueDate ? new Date(task.dueDate) : null;
      const hasAssignee = (task.assignees || []).length > 0;

      let matchesAI = true;
      if (aiFilterKey === 'overdue') {
        matchesAI = !!due && !isNaN(due as any) && due < now && task.status !== 'done';
      } else if (aiFilterKey === 'urgent') {
        matchesAI = task.priority === 'urgent' && task.status !== 'done';
      } else if (aiFilterKey === 'blocked') {
        matchesAI = task.status === 'blocked';
      } else if (aiFilterKey === 'unassigned') {
        matchesAI = !hasAssignee && task.status !== 'done';
      } else if (aiFilterKey === 'overloaded') {
        // overloaded là insight chung; để không filter sai thì giữ nguyên (hoặc bạn filter in_progress)
        matchesAI = true;
      } else if (aiFilterKey === 'ok') {
        matchesAI = true;
      }

      return matchesSearch && matchesStatus && matchesPriority && matchesAssignee && matchesLabel && matchesAI;
    });
  }, [filters, tasks, aiFilterKey]);

  
  const stats = useMemo(() => {
    const total = tasks.length;
    const inProgress = tasks.filter(
      (task) => task.status === 'in_progress',
    ).length;
    const done = tasks.filter((task) => task.status === 'done').length;
    return { total, inProgress, done };
  }, [tasks]);

  
  const handleTaskUpdate = (taskId: string, updates: Partial<Task>) => {
    
    setTasks((prev) =>
      prev.map((task) => (task.id === taskId ? { ...task, ...updates } : task)),
    );
    if (selectedTask?.id === taskId) {
      setSelectedTask((prev) => (prev ? { ...prev, ...updates } : prev));
    }

    const payload: any = {};
    if (typeof updates.status !== 'undefined') payload.status = updates.status;
    if (typeof updates.priority !== 'undefined')
      payload.priority = updates.priority;
    if (typeof updates.title !== 'undefined') payload.title = updates.title;
    if (typeof updates.description !== 'undefined')
      payload.description = updates.description;
    if (typeof updates.dueDate !== 'undefined') payload.dueDate = updates.dueDate;
    if (typeof (updates as any).project !== 'undefined')
      payload.project = (updates as any).project;

    if (Object.keys(payload).length === 0) return;

    (async () => {
      try {
        await taskServices.update(taskId, payload);
      } catch (err: any) {
        console.error(err);
        message.error(
          err?.response?.data || 'Cập nhật task thất bại — bảng sẽ được reload.',
        );
        handleReload();
      }
    })();
  };

  const handleTaskDelete = (taskId: string) => {
    Modal.confirm({
      title: 'Xác nhận xóa',
      content: 'Task sẽ bị xoá (soft-delete ở backend nếu có).',
      onOk: async () => {
        try {
          await taskServices.delete(taskId);
          setTasks((prev) => prev.filter((task) => task.id !== taskId));
          message.success('Đã xoá task');
        } catch (err: any) {
          console.error(err);
          message.error(err?.response?.data || 'Xoá task thất bại');
        }
      },
    });
  };

  const handleBlockedCreate = () => {
    message.info(
      'Vui lòng tạo task trong trang Project Detail để gắn với dự án cụ thể.',
    );
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
          <Text type="secondary">
            Mọi task đều phải thuộc một Project cụ thể.
          </Text>
        </div>
        <Space>
          <Button
            icon={<ReloadOutlined />}
            onClick={handleReload}
            loading={loading}
          >
            Reload
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
        {/* Sidebar filters */}
        <Col xs={24} lg={6}>
          <Space direction="vertical" className="w-full">
            <Card title="Bộ lọc">
              <Space direction="vertical" className="w-full">
                <Input
                  placeholder="Tìm tiêu đề hoặc mô tả..."
                  prefix={<SearchOutlined />}
                  value={filters.search}
                  onChange={(event) =>
                    setFilters((prev) => ({
                      ...prev,
                      search: event.target.value,
                    }))
                  }
                />

                <Select
                  value={filters.status}
                  onChange={(value) =>
                    setFilters((prev) => ({ ...prev, status: value }))
                  }
                >
                  <Option value="all">Tất cả trạng thái</Option>
                  <Option value="backlog">Backlog</Option>
                  <Option value="todo">Cần làm</Option>
                  <Option value="in_progress">Đang làm</Option>
                  <Option value="done">Hoàn thành</Option>
                </Select>

                <Select
                  value={filters.priority}
                  onChange={(value) =>
                    setFilters((prev) => ({ ...prev, priority: value }))
                  }
                >
                  <Option value="all">Mọi ưu tiên</Option>
                  <Option value="low">Thấp</Option>
                  <Option value="normal">Bình thường</Option>
                  <Option value="high">Cao</Option>
                  <Option value="urgent">Khẩn cấp</Option>
                </Select>

                {/* Filter theo assignee */}
                <Select
                  value={filters.assignee}
                  onChange={(value) =>
                    setFilters((prev) => ({ ...prev, assignee: value }))
                  }
                  placeholder="Lọc theo người phụ trách"
                  allowClear={false}
                >
                  <Option value="all">Mọi người phụ trách</Option>
                  {assigneeOptions.map((user) => (
                    <Option key={user.id} value={user.id}>
                      {user.name}
                    </Option>
                  ))}
                </Select>

                {/* Filter theo label */}
                <Select
                  value={filters.label}
                  onChange={(value) =>
                    setFilters((prev) => ({ ...prev, label: value }))
                  }
                  placeholder="Lọc theo nhãn"
                  allowClear={false}
                >
                  <Option value="all">Mọi nhãn</Option>
                  {labelOptions.map((lb) => (
                    <Option key={lb.id} value={lb.id}>
                      <Tag
                        color={lb.color || 'default'}
                        style={{ marginRight: 4 }}
                      >
                        {lb.name}
                      </Tag>
                    </Option>
                  ))}
                </Select>
              </Space>
            </Card>
            <Card
              title="AI status"
              extra={
                <Space>
                  {aiFilterKey ? (
                    <Button size="small" onClick={() => setAiFilterKey(null)}>
                      Clear
                    </Button>
                  ) : null}
                  <Button
                    size="small"
                    icon={<ReloadOutlined />}
                    loading={aiStatusLoading}
                    onClick={fetchAIStatus}
                  >
                    Refresh
                  </Button>
                </Space>
              }
            >
              <List
                dataSource={aiStatus}
                locale={{ emptyText: 'Chưa có gợi ý nào' }}
                renderItem={(it) => (
                  <List.Item
                    className="cursor-pointer"
                    onClick={() => {
                      // click item => set AI filter + set filters hợp lý
                      setAiFilterKey(it.key);

                      // optional: auto-set filter để user thấy effect rõ
                      if (it.key === 'urgent') setFilters((p) => ({ ...p, priority: 'urgent', status: 'all' }));
                      if (it.key === 'blocked') setFilters((p) => ({ ...p, status: 'blocked' as any, priority: 'all' }));
                      if (it.key === 'overdue') setFilters((p) => ({ ...p, status: 'all', priority: 'all' }));
                      if (it.key === 'unassigned') setFilters((p) => ({ ...p, assignee: 'all', status: 'all' }));
                    }}
                  >
                    <Space className="w-full justify-between">
                      <Text strong={aiFilterKey === it.key}>{it.text}</Text>
                      {aiFilterKey === it.key ? <Tag color="blue">Active</Tag> : null}
                    </Space>
                  </List.Item>
                )}
              />
            </Card>
          </Space>
        </Col>

        {/* Kanban + stats */}
        <Col xs={24} lg={18}>
          <Alert
            type="info"
            showIcon
            className="mb-4"
            message="Task được tạo trong Project Detail. Đây là bảng tổng quan & drag-drop."
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

      {/* Modal xem nhanh task */}
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
              <div className="text-sm text-gray-500">
                {selectedTask.description}
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <Tag color="blue">{selectedTask.status}</Tag>
              <Tag color="orange">{selectedTask.priority || 'normal'}</Tag>
            </div>

            <div className="mt-2">
              <Text type="secondary" className="text-xs block mb-1">
                Assignees
              </Text>
              <Avatar.Group>
                {selectedTask.assignees?.map((assignee) => {
                  const a: any = assignee;
                  const id = String(a?.id || a?._id || a);
                  const name = a?.name || a?.email || id;
                  const avatarUrl = a?.avatarUrl;

                  return (
                    <Tooltip key={id} title={name}>
                      <Avatar src={avatarUrl}>{name?.[0]}</Avatar>
                    </Tooltip>
                  );
                })}
              </Avatar.Group>

              <Text type="secondary" className="text-xs block mt-3 mb-1">
                Thuộc sprint
              </Text>
              {selectedTask.sprint ? (
                <Tag>
                  {typeof selectedTask.sprint === 'string'
                    ? selectedTask.sprint
                    : (selectedTask.sprint as any).name}
                </Tag>
              ) : (
                <Text type="secondary" className="text-xs">
                  Không thuộc sprint nào
                </Text>
              )}
            </div>
          </Space>
        ) : (
          <Text>Chưa chọn task nào</Text>
        )}
      </Modal>
    </div>
  );
}
