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
} from 'antd';
import { ArrowLeftOutlined } from '@ant-design/icons';
import projectServices from '@/services/projectService';
import taskServices, { type Task, type TaskStatus, type TaskPriority } from '@/services/taskServices';
import teamService, { type TeamMember } from '@/services/teamService';
import labelServices, { type Label } from '@/services/labelServices';

const { Title, Text } = Typography;
const { Option } = Select;

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
  const [taskModalOpen, setTaskModalOpen] = useState(false);
  const [taskForm] = Form.useForm();

  const [creatingTask, setCreatingTask] = useState(false);

  const [labels, setLabels] = useState<Label[]>([]);
  const [labelsLoading, setLabelsLoading] = useState(false);

  const [newLabelName, setNewLabelName] = useState('');
  const [newLabelColor, setNewLabelColor] = useState('#52c41a');
  const [creatingLabel, setCreatingLabel] = useState(false);

  const teamId: string | null = useMemo(() => {
    if (!project) return null;
    const team = project.team;
    return typeof team === 'string' ? team : team._id;
  }, [project]);

  
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
          return;
        }

        const [membersRes, taskRes, overviewRes, labelRes] = await Promise.all([
          teamService.getMembers(tId),
          taskServices.list({ team: tId, project: proj._id || projectId, limit: 100 }),
          taskServices.getOverview({ team: tId, project: proj._id || projectId }),
          labelServices.list({ team: tId, project: proj._id || projectId, limit: 200 }),
        ]);

        setTeamMembers(membersRes.data || []);
        setTasks(taskRes.data.items || taskRes.data || []);

        const labelsData = labelRes.data.items || labelRes.data || [];
        setLabels(labelsData);

        
        const byStatus = overviewRes.data.byStatus || [];
        const map: any = { backlog: 0, todo: 0, in_progress: 0, done: 0, review: 0, blocked: 0 };
        byStatus.forEach((item) => {
          if (item?._id && map.hasOwnProperty(item._id)) {
            map[item._id] = item.count || 0;
          }
        });
        setOverview({ ...map, overdue: overviewRes.data.overdue || 0 });
      } catch (err: any) {
        console.error(err);
        message.error(err?.response?.data || 'Không tải được thông tin dự án');
        setProject(null);
      } finally {
        setLoading(false);
      }
    };
    fetchAll();
  }, [projectId]);

  
  const totalTasks = useMemo(
    () => overview.backlog + overview.todo + overview.in_progress + overview.review + overview.blocked + overview.done,
    [overview]
  );

  const completion = useMemo(() => (totalTasks ? Math.round((overview.done / totalTasks) * 100) : 0), [overview, totalTasks]);

  const statusPercentages = useMemo(() => {
    if (!totalTasks) return { backlog: 0, todo: 0, in_progress: 0, review: 0, blocked: 0, done: 0 };
    return {
      backlog: Math.round((overview.backlog / totalTasks) * 100),
      todo: Math.round((overview.todo / totalTasks) * 100),
      in_progress: Math.round((overview.in_progress / totalTasks) * 100),
      review: Math.round((overview.review / totalTasks) * 100),
      blocked: Math.round((overview.blocked / totalTasks) * 100),
      done: Math.round((overview.done / totalTasks) * 100),
    };
  }, [overview, totalTasks]);

  const leadName = useMemo(() => {
    const leader = teamMembers.find((m) => m.role === 'leader');
    if (!leader) return 'Chưa gán';
    const userObj = typeof leader.user === 'string' ? null : leader.user;
    return userObj?.name || 'Chưa gán';
  }, [teamMembers]);

  
  const openCreateTaskModal = () => {
    if (!teamId) return message.error('Chưa xác định team');
    taskForm.resetFields();
    taskForm.setFieldsValue({ status: 'todo', priority: 'normal', assignees: [], labels: [] });
    setTaskModalOpen(true);
  };

  const handleSubmitTask = async (values: any) => {
    console.log('values.labels:', values.labels);
    if (!teamId || !project?._id) {
      message.error('Thiếu team hoặc project');
      return;
    }

    try {
      setCreatingTask(true);

      const labelIds: string[] = Array.isArray(values.labels)
        ? values.labels
            .map((id: any) =>
              String(
                typeof id === 'string' ? id : id?._id || id?.value || ''
              ).trim(),
            )
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
        dueDate: due
          ? due.toISOString?.() || due.toDate?.().toISOString()
          : undefined,
      });

      message.success('Đã tạo task thành công');

      
      setTaskModalOpen(false);
      taskForm.resetFields();

      
      const [taskRes, overviewRes] = await Promise.all([
        taskServices.list({
          team: teamId,
          project: project._id || projectId,
          limit: 100,
        }),
        taskServices.getOverview({
          team: teamId,
          project: project._id || projectId,
        }),
      ]);

      setTasks(taskRes.data.items || taskRes.data || []);

      const byStatus = overviewRes.data.byStatus || [];
      const map: any = {
        backlog: 0,
        todo: 0,
        in_progress: 0,
        done: 0,
        review: 0,
        blocked: 0,
      };
      byStatus.forEach((item) => {
        if (item?._id && Object.prototype.hasOwnProperty.call(map, item._id)) {
          map[item._id] = item.count || 0;
        }
      });
      setOverview({ ...map, overdue: overviewRes.data.overdue || 0 });
    } catch (err: any) {
      console.error(err);
      message.error(err?.response?.data || 'Tạo task thất bại');
    } finally {
      setCreatingTask(false);
    }
  };


  const handleQuickCreateLabel = async () => {
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

      const created: Label = res.data || res;

      
      setLabels((prev) => [...prev, created]);

      
      const current: string[] = taskForm.getFieldValue('labels') || [];

      
      if (!current.includes(String(created._id))) {
        taskForm.setFieldsValue({
          labels: [...current, String(created._id)],
        });
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


  if (!project && !loading) {
    return (
      <Result
        status="404"
        title="Không tìm thấy dự án"
        subTitle="Dự án không tồn tại hoặc bạn không có quyền truy cập."
        extra={<Button type="primary" onClick={() => navigate('/projects')}>Quay lại danh sách dự án</Button>}
      />
    );
  }

  
  const ProgressStacked = ({ overview }: { overview: StatusOverview }) => {
    const segments = [
      { label: 'Backlog', value: overview.backlog, color: '#d9d9d9' },
      { label: 'Todo', value: overview.todo, color: '#1890ff' },
      { label: 'In Progress', value: overview.in_progress, color: '#faad14' },
      { label: 'Review', value: overview.review, color: '#722ed1' },
      { label: 'Blocked', value: overview.blocked, color: '#f5222d' },
      { label: 'Done', value: overview.done, color: '#52c41a' },
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

  return (
    <div className="space-y-4">
      <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/projects')}>Quay lại danh sách</Button>

      {/* Header */}
      {project && (
        <div className="flex flex-col gap-2">
          <Title level={2} className="m-0">{project.name}</Title>
          <Text type="secondary">{project.description}</Text>
          <Space>
            <Tag color="blue">{project.key}</Tag>
            <Tag color={project.isArchived ? 'default' : 'green'}>{project.isArchived ? 'Archived' : 'Active'}</Tag>
            <Tag>Lead: {leadName}</Tag>
          </Space>
        </div>
      )}

      {/* Stats */}
      <Row gutter={[16, 16]}>
        <Col xs={24} md={6}><Card><Statistic title="Task đang mở" value={overview.backlog + overview.todo + overview.in_progress} /></Card></Col>
        <Col xs={24} md={6}><Card><Statistic title="Đã hoàn thành" value={`${completion}%`} /></Card></Col>
        <Col xs={24} md={6}><Card><Statistic title="Overdue" value={overview.overdue} /></Card></Col>
        <Col xs={24} md={6}><Card><Statistic title="Tổng task" value={totalTasks} /></Card></Col>
      </Row>

      {/* Progress + Task List */}
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

      {/* Task List */}
      <Card
        title="Danh sách task của dự án"
        extra={
          <Space>
            <Text type="secondary">{tasks.length} items</Text>
            <Button type="primary" onClick={openCreateTaskModal}>Thêm task</Button>
          </Space>
        }
      >
        <List
          dataSource={tasks}
          renderItem={(task) => (
            <List.Item
              actions={[<Button key="view" type="link" onClick={() => navigate(`/tasks/${task._id}`)}>Xem task</Button>]}
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
          message="Task được tạo trực tiếp từ dự án này và sẽ xuất hiện trên Task Board."
          showIcon
        />
      </Card>

      {/* Modal tạo task */}
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
                    return <Option key={u._id} value={u._id}>{u.name || u.email || u._id}</Option>;
                  })}
                </Select>
              </Form.Item>
            </Col>
          </Row>

{/* Nhãn */}
<Form.Item label="Nhãn">
  <Space direction="vertical" className="w-full">

    {/* Select nhãn – chỉ cái này gắn với field labels */}
    <Form.Item name="labels" noStyle>
      <Select
        mode="multiple"
        placeholder="Chọn nhãn"
        loading={labelsLoading}
        allowClear
      >
        {labels.map((lb) => (
          <Option key={lb._id} value={lb._id}>
            <Tag color={lb.color || 'default'}>{lb.name}</Tag>
          </Option>
        ))}
      </Select>
    </Form.Item>

    {/* Tạo nhãn nhanh (KHÔNG buộc vào Form, dùng state newLabelName / newLabelColor) */}
    <Space.Compact className="w-full" size="large">
      <Input
        placeholder="Tên nhãn mới (VD: Bug, Feature...)"
        value={newLabelName}
        onChange={(e) => setNewLabelName(e.target.value)}
        style={{ borderRadius: 6 }}
      />

      <Popover
        trigger="click"
        content={
          <ColorPicker
            value={newLabelColor}
            onChange={(color) => setNewLabelColor(color.toHexString())}
          />
        }
      >
        <Button
          style={{
            width: 46,
            padding: 0,
            borderRadius: 6,
          }}
        >
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
        onClick={handleQuickCreateLabel}
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
    </div>
  );
}
