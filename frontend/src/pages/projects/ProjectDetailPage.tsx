import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Card,
  Typography,
  Tag,
  Button,
  Row,
  Col,
  Statistic,
  List,
  Result,
  Space,
  Alert,
  Modal,
  Form,
  Input,
  Select,
  DatePicker,
  message,
  Tooltip,
  ColorPicker,
  Popover,
  Popconfirm,
  Spin,
} from 'antd';
import { ArrowLeftOutlined, CrownOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';

import projectServices from '@/services/projectService';
import taskServices, { type Task, type TaskPriority } from '@/services/taskServices';
import teamService, { type TeamMember } from '@/services/teamService';
import labelServices, { type Label } from '@/services/labelServices';

const { Title, Text } = Typography;
const { Option } = Select;

type TaskStatus = 'backlog' | 'todo' | 'in_progress' | 'review' | 'blocked' | 'done';
type DayjsLike = any;

type StatusOverview = {
  backlog: number;
  todo: number;
  in_progress: number;
  review: number;
  blocked: number;
  done: number;
  overdue: number;
};

export default function ProjectDetailPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [project, setProject] = useState<any | null>(null);
  const [team, setTeam] = useState<any | null>(null);

  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [overview, setOverview] = useState<StatusOverview>({
    backlog: 0,
    todo: 0,
    in_progress: 0,
    review: 0,
    blocked: 0,
    done: 0,
    overdue: 0,
  });

  // Create task modal/form
  const [taskModalOpen, setTaskModalOpen] = useState(false);
  const [taskForm] = Form.useForm();
  const [creatingTask, setCreatingTask] = useState(false);

  // Edit task modal/form
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [editForm] = Form.useForm();
  const [updatingTask, setUpdatingTask] = useState(false);

  // Delete loading
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Labels
  const [labels, setLabels] = useState<Label[]>([]);
  const [labelsLoading, setLabelsLoading] = useState(false);

  // Quick create label
  const [newLabelName, setNewLabelName] = useState('');
  const [newLabelColor, setNewLabelColor] = useState('#52c41a');
  const [creatingLabel, setCreatingLabel] = useState(false);

  const teamId: string | null = useMemo(() => {
    if (!project) return null;
    const team = project.team;
    return typeof team === 'string' ? team : team?._id;
  }, [project]);

  const totalTasks = useMemo(() => {
    return (
      overview.backlog +
      overview.todo +
      overview.in_progress +
      overview.review +
      overview.blocked +
      overview.done
    );
  }, [overview]);

  const completion = useMemo(() => {
    return totalTasks ? Math.round((overview.done / totalTasks) * 100) : 0;
  }, [overview.done, totalTasks]);

  const leadName = useMemo(() => {
    const leader = teamMembers.find((m) => m.role === 'leader');
    if (!leader) return 'Chưa gán';
    const userObj = typeof leader.user === 'string' ? null : leader.user;
    return userObj?.name || 'Chưa gán';
  }, [teamMembers]);

  const normalizeTaskList = (data: any): Task[] => {
    if (!data) return [];
    if (Array.isArray(data)) return data as Task[];
    if (Array.isArray(data.items)) return data.items as Task[];
    return [];
  };

  const normalizeLabelsList = (data: any): Label[] => {
    if (!data) return [];
    if (Array.isArray(data)) return data as Label[];
    if (Array.isArray(data.items)) return data.items as Label[];
    return [];
  };

  const normalizeOverview = (data: any): StatusOverview => {
    const byStatus = data?.byStatus || [];
    const map: Record<string, number> = {
      backlog: 0,
      todo: 0,
      in_progress: 0,
      review: 0,
      blocked: 0,
      done: 0,
    };

    byStatus.forEach((item: any) => {
      if (item?._id && Object.prototype.hasOwnProperty.call(map, item._id)) {
        map[item._id] = item.count || 0;
      }
    });

    return {
      backlog: map.backlog,
      todo: map.todo,
      in_progress: map.in_progress,
      review: map.review,
      blocked: map.blocked,
      done: map.done,
      overdue: data?.overdue || 0,
    };
  };

  const reloadTasksAndOverview = async (tId?: string, pId?: string) => {
    const realTeamId = tId || teamId;
    const realProjectId = pId || project?._id || projectId;

    if (!realTeamId || !realProjectId) return;

    const [taskRes, overviewRes] = await Promise.all([
      taskServices.list({
        team: realTeamId,
        project: realProjectId,
        limit: 100,
      }),
      taskServices.getOverview({
        team: realTeamId,
        project: realProjectId,
      }),
    ]);

    setTasks(normalizeTaskList(taskRes.data));
    setOverview(normalizeOverview(overviewRes.data));
  };

  // Initial fetch
  useEffect(() => {
    const fetchAll = async () => {
      if (!projectId) return;

      try {
        setLoading(true);

        const projRes = await projectServices.getById(projectId);
        const proj = projRes.data;

        setProject(proj);

        const tId = typeof proj.team === 'string' ? proj.team : proj.team?._id;
        if (!tId) {
          message.error('Project không có team');
          setProject(null);
          return;
        }

        setLabelsLoading(true);

        const [membersRes, teamRes, taskRes, overviewRes, labelRes] = await Promise.all([
          teamService.getMembers(tId),
          teamService.getById(tId),
          taskServices.list({ team: tId, project: proj._id || projectId, limit: 100 }),
          taskServices.getOverview({ team: tId, project: proj._id || projectId }),
          labelServices.list({ team: tId, project: proj._id || projectId, limit: 200 }),
        ]);

        setTeam(teamRes.data);

        setTeamMembers(membersRes.data || []);
        setTasks(normalizeTaskList(taskRes.data));
        setOverview(normalizeOverview(overviewRes.data));
        setLabels(normalizeLabelsList(labelRes.data));
      } catch (err: any) {
        console.error(err);
        message.error(err?.response?.data || 'Không tải được thông tin dự án');
        setProject(null);
      } finally {
        setLabelsLoading(false);
        setLoading(false);
      }
    };

    fetchAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  // -------- Create Task --------
  const openCreateTaskModal = () => {
    if (!teamId) return message.error('Chưa xác định team');
    taskForm.resetFields();
    taskForm.setFieldsValue({
      status: 'todo',
      priority: 'normal',
      assignees: [],
      labels: [],
    });
    setTaskModalOpen(true);
  };

  const handleSubmitTask = async (values: any) => {
    if (!teamId || !project?._id) {
      message.error('Thiếu team hoặc project');
      return;
    }

    try {
      setCreatingTask(true);

      const labelIds: string[] = Array.isArray(values.labels)
        ? values.labels
            .map((id: any) => String(typeof id === 'string' ? id : id?._id || id?.value || '').trim())
            .filter(Boolean)
        : [];

      const due: DayjsLike | undefined = values.dueDate;

      await taskServices.create({
        team: teamId,
        project: project._id,
        title: values.title,
        description: values.description,
        status: values.status as TaskStatus,
        priority: values.priority as TaskPriority,
        assignees: values.assignees || [],
        labels: labelIds,
        dueDate: due ? (due.toISOString?.() || due.toDate?.().toISOString()) : undefined,
      } as any);

      message.success('Đã tạo task thành công');

      setTaskModalOpen(false);
      taskForm.resetFields();

      await reloadTasksAndOverview();
    } catch (err: any) {
      console.error(err);
      message.error(err?.response?.data || 'Tạo task thất bại');
    } finally {
      setCreatingTask(false);
    }
  };

  // -------- Quick Create Label (for create/edit) --------
  const handleQuickCreateLabel = async (targetForm: 'create' | 'edit') => {
    if (!newLabelName.trim()) {
      message.warning('Nhập tên nhãn trước đã');
      return;
    }
    if (!teamId || !project?._id) {
      message.error('Thiếu team hoặc project');
      return;
    }

    try {
      setCreatingLabel(true);

      const res = await labelServices.create({
        team: teamId,
        project: project._id,
        name: newLabelName.trim(),
        color: newLabelColor,
      });

      const created: Label = (res as any).data || res;
      setLabels((prev) => [...prev, created]);

      const form = targetForm === 'create' ? taskForm : editForm;
      const current: string[] = form.getFieldValue('labels') || [];
      const createdId = String((created as any)._id || (created as any).id || '');

      if (createdId && !current.includes(createdId)) {
        form.setFieldsValue({ labels: [...current, createdId] });
      }

      setNewLabelName('');
      message.success('Đã tạo nhãn mới và gán vào task');
    } catch (err: any) {
      console.error(err);
      message.error(err?.response?.data || 'Tạo nhãn thất bại');
    } finally {
      setCreatingLabel(false);
    }
  };

  // -------- Edit Task --------
  const openEditTaskModal = (task: Task) => {
    setEditingTask(task);

    editForm.setFieldsValue({
      title: task.title,
      description: task.description,
      status: task.status,
      priority: task.priority,
      assignees: (task.assignees || [])
        .map((a: any) => (typeof a === 'string' ? a : a?._id))
        .filter(Boolean),
      labels: (task.labels || [])
        .map((lb: any) => (typeof lb === 'string' ? lb : lb?._id))
        .filter(Boolean),
      dueDate: task.dueDate ? dayjs(task.dueDate) : undefined,
    });

    setEditModalOpen(true);
  };

  const handleSubmitEditTask = async (values: any) => {
    if (!editingTask?._id) return;

    try {
      setUpdatingTask(true);

      const labelIds: string[] = Array.isArray(values.labels)
        ? values.labels
            .map((id: any) => String(typeof id === 'string' ? id : id?._id || id?.value || '').trim())
            .filter(Boolean)
        : [];

      const due: DayjsLike | undefined = values.dueDate;

      await taskServices.update(editingTask._id, {
        title: values.title,
        description: values.description,
        status: values.status as TaskStatus,
        priority: values.priority as TaskPriority,
        assignees: values.assignees || [],
        labels: labelIds,
        dueDate: due ? (due.toISOString?.() || due.toDate?.().toISOString()) : undefined,
      } as any);

      message.success('Đã cập nhật task');

      setEditModalOpen(false);
      setEditingTask(null);
      editForm.resetFields();

      await reloadTasksAndOverview();
    } catch (err: any) {
      console.error(err);
      message.error(err?.response?.data || 'Cập nhật task thất bại');
    } finally {
      setUpdatingTask(false);
    }
  };

  // -------- Delete Task (Popconfirm) --------
  const handleDeleteTask = async (task: Task) => {
    try {
      setDeletingId(task._id);
      console.log('deleting task:', task._id);

      await taskServices.delete(task._id);

      message.success('Đã xoá task');
      await reloadTasksAndOverview();
    } catch (err: any) {
      console.error('delete failed', err);
      message.error(err?.response?.data || 'Xoá task thất bại');
    } finally {
      setDeletingId(null);
    }
  };

  // UI component: stacked progress
  const ProgressStacked = ({ overview: ov }: { overview: StatusOverview }) => {
    const segments = [
      { label: 'Backlog', value: ov.backlog, color: '#d9d9d9' },
      { label: 'Todo', value: ov.todo, color: '#1890ff' },
      { label: 'In Progress', value: ov.in_progress, color: '#faad14' },
      { label: 'Review', value: ov.review, color: '#722ed1' },
      { label: 'Blocked', value: ov.blocked, color: '#f5222d' },
      { label: 'Done', value: ov.done, color: '#52c41a' },
    ].filter((s) => s.value > 0);

    const total = totalTasks || 1;

    return (
      <div style={{ display: 'flex', height: 20, borderRadius: 4, overflow: 'hidden' }}>
        {segments.map((s, idx) => (
          <Tooltip key={idx} title={`${s.label}: ${s.value} (${Math.round((s.value / total) * 100)}%)`}>
            <div style={{ width: `${(s.value / total) * 100}%`, backgroundColor: s.color, height: '100%' }} />
          </Tooltip>
        ))}
      </div>
    );
  };

  if (loading) {
    return (
      <div className="w-full h-full flex items-center justify-center">
        <Spin tip="Đang tải dự án..." />
      </div>
    );
  }

  if (!project && !loading) {
    return (
      <Result
        status="404"
        title="Không tìm thấy dự án"
        subTitle="Dự án không tồn tại hoặc bạn không có quyền truy cập."
        extra={
          <Button type="primary" onClick={() => navigate('/projects')}>
            Quay lại danh sách dự án
          </Button>
        }
      />
    );
  }

  return (
    <div className="space-y-4">
      <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/projects')}>
        Quay lại danh sách
      </Button>

      {project && (
        <div className="flex flex-col gap-2">
          <Title level={2} className="m-0">
            {project.name}
          </Title>
          <Text type="secondary">{project.description}</Text>
          <Space wrap>
            <Tag color="blue">{project.key}</Tag>
            <Tag color={project.isArchived ? 'default' : 'green'}>
              {project.isArchived ? 'Archived' : 'Active'}
            </Tag>
            <Tag>Lead: {leadName}</Tag>
          </Space>
        </div>
      )}

      <Row gutter={[16, 16]}>
        <Col xs={24} md={6}>
          <Card>
            <Statistic
              title="Task đang mở"
              value={overview.backlog + overview.todo + overview.in_progress + overview.review + overview.blocked}
            />
          </Card>
        </Col>
        <Col xs={24} md={6}>
          <Card>
            <Statistic title="Đã hoàn thành" value={`${completion}%`} />
          </Card>
        </Col>
        <Col xs={24} md={6}>
          <Card>
            <Statistic title="Overdue" value={overview.overdue} />
          </Card>
        </Col>
        <Col xs={24} md={6}>
          <Card>
            <Statistic title="Tổng task" value={totalTasks} />
          </Card>
        </Col>
      </Row>

      <Row gutter={[16, 16]}>
        <Col xs={24} lg={16}>
          <Card title="Tiến độ dự án" extra={<Tag color="purple">Hoàn thành: {completion}%</Tag>}>
            <ProgressStacked overview={overview} />
            <List
              className="mt-4"
              dataSource={[
                { label: 'Backlog', value: overview.backlog },
                { label: 'Cần làm', value: overview.todo },
                { label: 'Đang làm', value: overview.in_progress },
                { label: 'Đang review', value: overview.review },
                { label: 'Bị chặn', value: overview.blocked },
                { label: 'Hoàn thành', value: overview.done },
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
          <Card title="Thành viên dự án">
            <List
              dataSource={teamMembers}
              renderItem={(m) => {
                const u: any = typeof m.user === 'string' ? { _id: m.user } : m.user || {};
                return (
                  <List.Item>
                    <List.Item.Meta
                      title={
                        <Space>
                          <Text strong>{u.name || '—'}</Text>
                          {m.role === 'leader' && <Tag color="gold">Leader</Tag>}
                          {m.role === 'admin' && <Tag color="blue">Admin</Tag>}
                        </Space>
                      }
                      description={u.email}
                    />
                  </List.Item>
                );
              }}
            />
          </Card>
        </Col>
      </Row>

      <Card
        title="Danh sách task của dự án"
        extra={
          <Space>
            <Text type="secondary">{tasks.length} items</Text>
            <Button type="primary" onClick={openCreateTaskModal}>
              Thêm task
            </Button>
          </Space>
        }
      >
        <List
          dataSource={tasks}
          renderItem={(task) => (
            <List.Item
              actions={[
                <Button key="view" type="link" onClick={() => navigate(`/tasks/${task._id}`)}>
                  Xem
                </Button>,
                <Button key="edit" type="link" onClick={() => openEditTaskModal(task)}>
                  Sửa
                </Button>,
                <Popconfirm
                  key="del"
                  title="Xoá task?"
                  description={`Bạn chắc chắn muốn xoá "${task.title}"?`}
                  okText="Xoá"
                  cancelText="Huỷ"
                  okButtonProps={{ danger: true, loading: deletingId === task._id }}
                  onConfirm={(e) => {
                    e?.preventDefault?.();
                    e?.stopPropagation?.();
                    return handleDeleteTask(task);
                  }}
                  onCancel={(e) => {
                    e?.preventDefault?.();
                    e?.stopPropagation?.();
                  }}
                >
                  <Button
                    type="link"
                    danger
                    loading={deletingId === task._id}
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      console.log('clicked delete', task._id);
                    }}
                  >
                    Xoá
                  </Button>
                </Popconfirm>,
              ]}
            >
              <List.Item.Meta
                title={
                  <Space wrap>
                    <Text strong>{task.title}</Text>
                    <Tag color="blue">{task.status}</Tag>
                    {task.dueDate && (
                      <Tag
                        color={
                          dayjs(task.dueDate).isBefore(dayjs(), 'minute') && task.status !== 'done'
                            ? 'red'
                            : 'default'
                        }
                      >
                        Due: {dayjs(task.dueDate).format('DD/MM/YYYY')}
                      </Tag>
                    )}
                  </Space>
                }
                description={task.description}
              />
              <Tag color="orange">{String(task.priority || '').toUpperCase()}</Tag>
            </List.Item>
          )}
        />

        <Alert
          className="mt-3"
          type="info"
          message="Task được tạo trực tiếp từ dự án này và sẽ xuất hiện trên Task Board."
          showIcon
        />
      </Card>

      {/* MODAL TẠO TASK */}
      <Modal
        open={taskModalOpen}
        title="Tạo task cho dự án này"
        onCancel={() => setTaskModalOpen(false)}
        onOk={() => taskForm.submit()}
        okText="Tạo task"
        confirmLoading={creatingTask}
      >
        <Form layout="vertical" form={taskForm} onFinish={handleSubmitTask}>
          <Form.Item name="title" label="Tiêu đề" rules={[{ required: true, message: 'Nhập tiêu đề' }]}>
            <Input placeholder="VD: Chuẩn bị báo cáo tiến độ" />
          </Form.Item>

          <Form.Item name="description" label="Mô tả">
            <Input.TextArea rows={3} placeholder="Mục tiêu, kết quả mong đợi..." />
          </Form.Item>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="status" label="Trạng thái" initialValue="todo">
                <Select>
                  <Option value="backlog">Backlog</Option>
                  <Option value="todo">Cần làm</Option>
                  <Option value="in_progress">Đang làm</Option>
                  <Option value="review">Đang review</Option>
                  <Option value="blocked">Bị chặn</Option>
                  <Option value="done">Hoàn thành</Option>
                </Select>
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="priority" label="Ưu tiên" initialValue="normal">
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
                <Select mode="multiple" placeholder="Chọn thành viên" allowClear>
                  {teamMembers.map((m) => {
                    const u: any = typeof m.user === 'string' ? { _id: m.user } : m.user || {};
                    return (
                      <Option key={u._id} value={u._id}>
                        {u.name || u.email || u._id}
                      </Option>
                    );
                  })}
                </Select>
              </Form.Item>
            </Col>
          </Row>

          {/* Labels + quick create */}
          <Form.Item label="Nhãn">
            <Space direction="vertical" className="w-full">
              <Form.Item name="labels" noStyle>
                <Select mode="multiple" placeholder="Chọn nhãn" loading={labelsLoading} allowClear>
                  {labels.map((lb) => (
                    <Option key={(lb as any)._id} value={(lb as any)._id}>
                      <Tag color={(lb as any).color || 'default'}>{(lb as any).name}</Tag>
                    </Option>
                  ))}
                </Select>
              </Form.Item>

              <Space.Compact className="w-full" size="large">
                <Input
                  placeholder="Tên nhãn mới (VD: Bug, Feature...)"
                  value={newLabelName}
                  onChange={(e) => setNewLabelName(e.target.value)}
                  style={{ borderRadius: 6 }}
                />

                <Popover
                  trigger="click"
                  content={<ColorPicker value={newLabelColor} onChange={(c) => setNewLabelColor(c.toHexString())} />}
                >
                  <Button style={{ width: 46, padding: 0, borderRadius: 6 }}>
                    <div
                      style={{
                        width: 20,
                        height: 20,
                        borderRadius: '50%',
                        margin: '0 auto',
                        background: newLabelColor,
                        border: '1px solid #ddd',
                      }}
                    />
                  </Button>
                </Popover>

                <Button
                  type="default"
                  loading={creatingLabel}
                  onClick={() => handleQuickCreateLabel('create')}
                  style={{ borderRadius: 6 }}
                >
                  Thêm nhãn
                </Button>
              </Space.Compact>

              <Text type="secondary" className="text-xs">
                Gõ tên nhãn mới, chọn màu rồi bấm "Thêm nhãn" để tạo nhanh và gán luôn cho task.
              </Text>
            </Space>
          </Form.Item>
        </Form>
      </Modal>

      {/* MODAL SỬA TASK */}
      <Modal
        open={editModalOpen}
        title="Sửa task"
        onCancel={() => {
          setEditModalOpen(false);
          setEditingTask(null);
          editForm.resetFields();
        }}
        onOk={() => editForm.submit()}
        okText="Lưu"
        confirmLoading={updatingTask}
      >
        <Form layout="vertical" form={editForm} onFinish={handleSubmitEditTask}>
          <Form.Item name="title" label="Tiêu đề" rules={[{ required: true, message: 'Nhập tiêu đề' }]}>
            <Input />
          </Form.Item>

          <Form.Item name="description" label="Mô tả">
            <Input.TextArea rows={3} />
          </Form.Item>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="status" label="Trạng thái">
                <Select>
                  <Option value="backlog">Backlog</Option>
                  <Option value="todo">Cần làm</Option>
                  <Option value="in_progress">Đang làm</Option>
                  <Option value="review">Đang review</Option>
                  <Option value="blocked">Bị chặn</Option>
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
                <Select mode="multiple" placeholder="Chọn thành viên" allowClear>
                  {teamMembers.map((m) => {
                    const u: any = typeof m.user === 'string' ? { _id: m.user } : m.user || {};
                    return (
                      <Option key={u._id} value={u._id}>
                        {u.name || u.email || u._id}
                      </Option>
                    );
                  })}
                </Select>
              </Form.Item>
            </Col>
          </Row>

          <Form.Item label="Nhãn">
            <Space direction="vertical" className="w-full">
              <Form.Item name="labels" noStyle>
                <Select mode="multiple" placeholder="Chọn nhãn" loading={labelsLoading} allowClear>
                  {labels.map((lb) => (
                    <Option key={(lb as any)._id} value={(lb as any)._id}>
                      <Tag color={(lb as any).color || 'default'}>{(lb as any).name}</Tag>
                    </Option>
                  ))}
                </Select>
              </Form.Item>

              <Space.Compact className="w-full" size="large">
                <Input
                  placeholder="Tên nhãn mới (VD: Bug, Feature...)"
                  value={newLabelName}
                  onChange={(e) => setNewLabelName(e.target.value)}
                  style={{ borderRadius: 6 }}
                />

                <Popover
                  trigger="click"
                  content={<ColorPicker value={newLabelColor} onChange={(c) => setNewLabelColor(c.toHexString())} />}
                >
                  <Button style={{ width: 46, padding: 0, borderRadius: 6 }}>
                    <div
                      style={{
                        width: 20,
                        height: 20,
                        borderRadius: '50%',
                        margin: '0 auto',
                        background: newLabelColor,
                        border: '1px solid #ddd',
                      }}
                    />
                  </Button>
                </Popover>

                <Button
                  type="default"
                  loading={creatingLabel}
                  onClick={() => handleQuickCreateLabel('edit')}
                  style={{ borderRadius: 6 }}
                >
                  Thêm nhãn
                </Button>
              </Space.Compact>

              <Text type="secondary" className="text-xs">
                Tạo nhãn nhanh và gán luôn vào task đang sửa.
              </Text>
            </Space>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
