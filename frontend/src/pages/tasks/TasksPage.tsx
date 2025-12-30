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
  Tooltip,
  message,
  Alert,
  Divider,
} from 'antd';
import {
  SearchOutlined,
  ReloadOutlined,
  ProjectOutlined,
  EyeOutlined,
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
      const items = await aiStatusServices.getStatus({ limit: 6 });
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
    fetchAIStatus();
  }, []);

  const handleReload = () => fetchTasks();

  const assigneeOptions: AssigneeOption[] = useMemo(() => {
    const map = new Map<string, AssigneeOption>();
    tasks.forEach((task) => {
      (task.assignees || []).forEach((a: any) => {
        const id = String(a?._id || a?.id || a);
        const name = a?.name || a?.email || id;
        const avatarUrl = a?.avatarUrl;
        if (!map.has(id)) map.set(id, { id, name, avatarUrl });
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
        if (!map.has(id)) map.set(id, { id, name, color });
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
      if (aiFilterKey === 'overdue') matchesAI = !!due && !isNaN(due as any) && due < now && task.status !== 'done';
      else if (aiFilterKey === 'urgent') matchesAI = task.priority === 'urgent' && task.status !== 'done';
      else if (aiFilterKey === 'blocked') matchesAI = (task.status as any) === 'blocked';
      else if (aiFilterKey === 'unassigned') matchesAI = !hasAssignee && task.status !== 'done';
      else matchesAI = true;

      return matchesSearch && matchesStatus && matchesPriority && matchesAssignee && matchesLabel && matchesAI;
    });
  }, [filters, tasks, aiFilterKey]);

  const stats = useMemo(() => {
    const total = tasks.length;
    const inProgress = tasks.filter((task) => task.status === 'in_progress').length;
    const done = tasks.filter((task) => task.status === 'done').length;
    return { total, inProgress, done };
  }, [tasks]);

  const handleTaskUpdate = (taskId: string, updates: Partial<Task>) => {
    setTasks((prev) => prev.map((task) => (task.id === taskId ? { ...task, ...updates } : task)));
    if (selectedTask?.id === taskId) setSelectedTask((prev) => (prev ? { ...prev, ...updates } : prev));

    const payload: any = {};
    if (typeof updates.status !== 'undefined') payload.status = updates.status;
    if (typeof updates.priority !== 'undefined') payload.priority = updates.priority;
    if (typeof updates.title !== 'undefined') payload.title = updates.title;
    if (typeof updates.description !== 'undefined') payload.description = updates.description;
    if (typeof updates.dueDate !== 'undefined') payload.dueDate = updates.dueDate;
    if (typeof (updates as any).project !== 'undefined') payload.project = (updates as any).project;

    if (Object.keys(payload).length === 0) return;

    (async () => {
      try {
        await taskServices.update(taskId, payload);
      } catch (err: any) {
        console.error(err);
        message.error(err?.response?.data || 'Cập nhật task thất bại — bảng sẽ được reload.');
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

  const openDetailModal = (task: Task) => {
    setSelectedTask(task);
    setIsDetailModalOpen(true);
  };

  // -------- UI helpers --------
  const clearFilters = () => {
    setFilters({ search: '', status: 'all', priority: 'all', assignee: 'all', label: 'all' });
    setAiFilterKey(null);
  };

  const aiTagColor = (key: AIStatusItem['key']) => {
    if (key === 'urgent') return 'red';
    if (key === 'overdue') return 'volcano';
    if (key === 'blocked') return 'magenta';
    if (key === 'unassigned') return 'orange';
    if (key === 'ok') return 'green';
    return 'blue';
  };

  return (
    <div className="space-y-3">
      {/* TOP BAR */}
      <Card className="sticky top-0 z-10" style={{ borderRadius: 12 }} bodyStyle={{ padding: 16 }}>
        <div className="flex flex-col gap-3">
          {/* Title row */}
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-2">
            <div>
              <Title level={2} className="m-0">
                {t('tasks.title')}
              </Title>
              <Text type="secondary">Mọi task đều phải thuộc một Project cụ thể.</Text>
            </div>
            <Space wrap>
              <Button icon={<ReloadOutlined />} onClick={handleReload} loading={loading}>
                Reload
              </Button>
              <Button type="primary" icon={<ProjectOutlined />} onClick={() => navigate('/projects')}>
                Tạo task trong Project
              </Button>
            </Space>
          </div>

          {/* Filters row */}
          <div className="flex flex-col lg:flex-row gap-10 items-stretch">
            <div className="flex-1">
              <Input
                placeholder="Tìm tiêu đề hoặc mô tả..."
                prefix={<SearchOutlined />}
                value={filters.search}
                onChange={(e) => setFilters((p) => ({ ...p, search: e.target.value }))}
              />
            </div>

            <div className="flex flex-wrap gap-2 items-center">
              <Select style={{ minWidth: 170 }} value={filters.status} onChange={(value) => setFilters((p) => ({ ...p, status: value }))}>
                <Option value="all">Tất cả trạng thái</Option>
                <Option value="backlog">Backlog</Option>
                <Option value="todo">Cần làm</Option>
                <Option value="in_progress">Đang làm</Option>
                <Option value="done">Hoàn thành</Option>
              </Select>

              <Select style={{ minWidth: 150 }} value={filters.priority} onChange={(value) => setFilters((p) => ({ ...p, priority: value }))}>
                <Option value="all">Mọi ưu tiên</Option>
                <Option value="low">Thấp</Option>
                <Option value="normal">Bình thường</Option>
                <Option value="high">Cao</Option>
                <Option value="urgent">Khẩn cấp</Option>
              </Select>

              <Select style={{ minWidth: 200 }} value={filters.assignee} onChange={(value) => setFilters((p) => ({ ...p, assignee: value }))}>
                <Option value="all">Mọi người phụ trách</Option>
                {assigneeOptions.map((u) => (
                  <Option key={u.id} value={u.id}>
                    {u.name}
                  </Option>
                ))}
              </Select>

              <Select style={{ minWidth: 170 }} value={filters.label} onChange={(value) => setFilters((p) => ({ ...p, label: value }))}>
                <Option value="all">Mọi nhãn</Option>
                {labelOptions.map((lb) => (
                  <Option key={lb.id} value={lb.id}>
                    <Tag color={lb.color || 'default'} style={{ marginRight: 6 }}>
                      {lb.name}
                    </Tag>
                  </Option>
                ))}
              </Select>

              <Button onClick={clearFilters}>Clear</Button>
            </div>
          </div>

          {/* AI status row */}
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <Text strong>AI status</Text>
              <Space>
                {aiFilterKey ? (
                  <Button size="small" onClick={() => setAiFilterKey(null)}>
                    Clear AI
                  </Button>
                ) : null}
                <Button size="small" icon={<ReloadOutlined />} loading={aiStatusLoading} onClick={fetchAIStatus}>
                  Refresh
                </Button>
              </Space>
            </div>

            <div className="flex gap-2 flex-wrap">
              {aiStatus.length === 0 ? (
                <Text type="secondary">Chưa có gợi ý nào</Text>
              ) : (
                aiStatus.map((it) => {
                  const active = aiFilterKey === it.key;
                  return (
                    <Tag
                      key={it.key}
                      color={active ? 'blue' : aiTagColor(it.key)}
                      style={{
                        cursor: 'pointer',
                        userSelect: 'none',
                        padding: '6px 10px',
                        borderRadius: 999,
                        opacity: active ? 1 : 0.9,
                      }}
                      onClick={() => {
                        setAiFilterKey(it.key);

                        if (it.key === 'urgent') setFilters((p) => ({ ...p, priority: 'urgent', status: 'all' }));
                        if (it.key === 'blocked') setFilters((p) => ({ ...p, status: 'all' }));
                        if (it.key === 'overdue') setFilters((p) => ({ ...p, status: 'all', priority: 'all' }));
                        if (it.key === 'unassigned') setFilters((p) => ({ ...p, assignee: 'all', status: 'all' }));
                      }}
                    >
                      {it.text}
                      {typeof it.count === 'number' ? ` • ${it.count}` : ''}
                      {active ? ' • Active' : ''}
                    </Tag>
                  );
                })
              )}
            </div>
          </div>
        </div>
      </Card>

      <Alert type="info" showIcon message="Task được tạo trong Project Detail. Đây là bảng tổng quan & drag-drop." />

      {/* STATS */}
      <Row gutter={[12, 12]}>
        <Col xs={24} md={8}>
          <Card style={{ borderRadius: 12 }}>
            <Statistic title="Tổng task" value={stats.total} />
          </Card>
        </Col>
        <Col xs={24} md={8}>
          <Card style={{ borderRadius: 12 }}>
            <Statistic title="Đang làm" value={stats.inProgress} />
          </Card>
        </Col>
        <Col xs={24} md={8}>
          <Card style={{ borderRadius: 12 }}>
            <Statistic title="Hoàn thành" value={stats.done} />
          </Card>
        </Col>
      </Row>

      {/* BOARD */}
      <Card style={{ borderRadius: 12 }}>
        <div style={{ overflowX: 'auto' }}>
          <div style={{ minWidth: 980 }}>
            <Kanban
              tasks={filteredTasks}
              onTaskUpdate={handleTaskUpdate}
              onTaskDelete={handleTaskDelete}
              onCreateTask={() => message.info('Vui lòng tạo task trong trang Project Detail để gắn với dự án cụ thể.')}
              onTaskSelect={openDetailModal}
            />
          </div>
        </div>
      </Card>

      {/* Detail modal */}
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
                if (selectedTask) navigate(`/tasks/${selectedTask.id}`);
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
              <Tag color="orange">{selectedTask.priority || 'normal'}</Tag>
            </div>

            <Divider style={{ margin: '8px 0' }} />

            <div>
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
            </div>
          </Space>
        ) : (
          <Text>Chưa chọn task nào</Text>
        )}
      </Modal>
    </div>
  );
}