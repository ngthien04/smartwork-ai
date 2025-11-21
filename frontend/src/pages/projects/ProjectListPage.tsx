// src/pages/ProjectListPage.tsx
import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Row,
  Col,
  Card,
  Typography,
  Input,
  Select,
  Tag,
  Button,
  Statistic,
  Progress,
  List,
  Space,
  Modal,
  Form,
  message,
  Popconfirm,
} from 'antd';
import {
  PlusOutlined,
  FolderOpenOutlined,
  EditOutlined,
  DeleteOutlined,
  InboxOutlined,          // 👈 icon cho archive
} from '@ant-design/icons';

import projectServices, { type ProjectListParams } from '@/services/projectService';
import teamService, { type Team } from '@/services/teamService';
import { useAuth } from '@/hooks/useAuth';
import type { Project } from '@/types/project';

const { Title, Text } = Typography;
const { Option } = Select;

type TeamRole = 'member' | 'admin' | 'leader';

export default function ProjectListPage() {
  const navigate = useNavigate();
  const { user } = useAuth();

  const [teams, setTeams] = useState<Team[]>([]);
  const [team, setTeam] = useState<Team | null>(null);
  const [teamRole, setTeamRole] = useState<TeamRole | null>(null);

  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(false);

  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<'all' | 'active' | 'archived'>('all');

  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [form] = Form.useForm();
  const [editingProject, setEditingProject] = useState<Project | null>(null);

  const currentUserId = (user as any)?._id || (user as any)?.id;

  // =============== Load list team + chọn team đầu tiên ===============
  useEffect(() => {
    const fetchTeams = async () => {
      try {
        setLoading(true);
        const res = await teamService.listMyTeams();
        const items = res.data.items || [];
        setTeams(items);

        if (!items.length) {
          setTeam(null);
          setTeamRole(null);
          setProjects([]);
          return;
        }

        const firstTeam = items[0] as Team;
        setTeam(firstTeam);

        // lấy role từ members thay vì user.roles
        const foundMember = firstTeam.members?.find((m) => {
          const u: any =
            typeof m.user === 'string' ? { _id: m.user } : m.user || {};
          return String(u._id) === String(currentUserId);
        });

        setTeamRole((foundMember?.role as TeamRole) ?? null);
      } catch (err: any) {
        console.error(err);
        message.error(err?.response?.data || 'Không tải được danh sách team');
        setTeam(null);
        setTeamRole(null);
      } finally {
        setLoading(false);
      }
    };

    fetchTeams();
  }, [currentUserId]);

  // =============== Chuyển team ===============
  const handleChangeTeam = (teamId: string) => {
    const t = teams.find((x) => String((x as any)._id) === String(teamId));
    if (!t) return;
    setTeam(t);

    const foundMember = t.members?.find((m) => {
      const u: any =
        typeof m.user === 'string' ? { _id: m.user } : m.user || {};
      return String(u._id) === String(currentUserId);
    });

    setTeamRole((foundMember?.role as TeamRole) ?? null);
  };

  // =============== Fetch projects ===============
  const fetchProjects = async (currentTeam: Team | null, s: string, st: typeof status) => {
    if (!currentTeam?._id) {
      setProjects([]);
      return;
    }
    setLoading(true);
    try {
      const params: ProjectListParams = {
        team: (currentTeam as any)._id,
      };

      if (st === 'active') params.isArchived = false;
      if (st === 'archived') params.isArchived = true;
      if (s) params.q = s;

      const res = await projectServices.list(params);
      setProjects(res.data.items || res.data || []);
    } catch (err: any) {
      console.error(err);
      message.error(err?.response?.data || 'Không lấy được danh sách project');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProjects(team, search, status);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [team?._id, search, status]);

  // =============== Modal create/edit ===============
  const handleOpenCreateModal = () => {
    if (!team) {
      message.error('Chưa xác định team');
      return;
    }
    if (teamRole !== 'leader' && teamRole !== 'admin') {
      message.error('Chỉ leader/admin mới được tạo project');
      return;
    }
    setEditingProject(null);
    form.resetFields();
    setCreateModalOpen(true);
  };

  const handleOpenEditModal = (project: Project) => {
    if (teamRole !== 'leader' && teamRole !== 'admin') {
      message.error('Chỉ leader/admin mới được sửa project');
      return;
    }
    setEditingProject(project);
    form.setFieldsValue({
      name: project.name,
      key: project.key,
      description: project.description,
    });
    setCreateModalOpen(true);
  };

  const handleSubmitProject = async () => {
    try {
      const values = await form.validateFields();
      if (!team?._id) return message.error('Team chưa xác định');
      if (teamRole !== 'leader' && teamRole !== 'admin') {
        return message.error('Chỉ leader/admin mới được thao tác với project');
      }

      if (editingProject) {
        // UPDATE
        const id = (editingProject as any)._id || (editingProject as any).id;
        await projectServices.update(id, {
          name: values.name,
          key: values.key,
          description: values.description,
        });
        message.success('Cập nhật dự án thành công');
      } else {
        // CREATE
        const res = await projectServices.create({
          team: (team as any)._id,
          name: values.name,
          key: values.key,
          description: values.description,
        });
        message.success('Tạo dự án thành công');
        navigate(`/projects/${res.data._id}`);
      }

      setCreateModalOpen(false);
      await fetchProjects(team, search, status);
    } catch (err: any) {
      console.error(err);
      if (err?.response?.data) message.error(err.response.data);
      else message.error('Lưu dự án thất bại');
    }
  };

  // =============== Archive / Unarchive project ===============
  const handleToggleArchiveProject = async (project: Project) => {
    if (teamRole !== 'leader' && teamRole !== 'admin') {
      return message.error('Chỉ leader/admin mới được lưu trữ dự án');
    }
    const id = (project as any)._id || (project as any).id;
    const nextArchived = !project.isArchived;

    try {
      await projectServices.archive(id, nextArchived);
      message.success(nextArchived ? 'Đã lưu trữ dự án' : 'Đã khôi phục dự án');
      await fetchProjects(team, search, status);
    } catch (err: any) {
      console.error(err);
      message.error(err?.response?.data || 'Không lưu trữ được dự án');
    }
  };

  // =============== Delete project ===============
  const handleDeleteProject = async (project: Project) => {
    if (teamRole !== 'leader' && teamRole !== 'admin') {
      return message.error('Chỉ leader/admin mới được xoá project');
    }
    const id = (project as any)._id || (project as any).id;
    try {
      await projectServices.delete(id);
      message.success('Đã xoá dự án');
      await fetchProjects(team, search, status);
    } catch (err: any) {
      console.error(err);
      message.error(err?.response?.data || 'Xoá dự án thất bại');
    }
  };

  // =============== Filter search (front) ===============
  const filteredProjects = useMemo(() => {
    return projects.filter((p) => {
      const name = p.name?.toLowerCase() || '';
      const key = p.key?.toLowerCase() || '';
      const q = search.toLowerCase();
      return name.includes(q) || key.includes(q);
    });
  }, [projects, search]);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
        <div>
          <Title level={2} className="m-0">
            Danh sách dự án
          </Title>
          <Text type="secondary">
            Team: {team?.name ?? 'Chưa có team'}
          </Text>

          {teams.length > 1 && (
            <div className="mt-2">
              <Text type="secondary" className="mr-2">
                Chuyển team:
              </Text>
              <Select
                style={{ minWidth: 200 }}
                value={team?._id}
                onChange={handleChangeTeam}
              >
                {teams.map((t) => (
                  <Option key={(t as any)._id} value={(t as any)._id}>
                    {t.name}
                  </Option>
                ))}
              </Select>
            </div>
          )}
        </div>

        {team && (teamRole === 'leader' || teamRole === 'admin') && (
          <Button type="primary" icon={<PlusOutlined />} onClick={handleOpenCreateModal}>
            Tạo dự án
          </Button>
        )}
      </div>

      {/* Stats */}
      <Row gutter={[16, 16]}>
        <Col xs={12} md={6}>
          <Card>
            <Statistic title="Tổng dự án" value={projects.length} />
          </Card>
        </Col>
      </Row>

      {/* Filter */}
      <Card>
        <Row gutter={[16, 16]} align="middle">
          <Col xs={24} md={12}>
            <Input
              placeholder="Tìm theo tên hoặc mã dự án..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </Col>
          <Col xs={24} md={6}>
            <Select value={status} onChange={setStatus} className="w-full">
              <Option value="all">Tất cả</Option>
              <Option value="active">Đang hoạt động</Option>
              <Option value="archived">Đã lưu trữ</Option>
            </Select>
          </Col>
        </Row>
      </Card>

      {/* List projects */}
      <Row gutter={[16, 16]}>
        {filteredProjects.map((project) => {
          const totalTasks = (project as any).totalTasksCount || 0;
          const doneTasks = (project as any).doneTasksCount || 0;
          const openTasks = (project as any).openTasksCount || 0;
          const progress = Math.round((doneTasks / Math.max(totalTasks, 1)) * 100);

          const leadName = (project as any).leadName || 'Chưa gán';

          const id = (project as any)._id || (project as any).id;

          const canManage = teamRole === 'leader' || teamRole === 'admin';

          return (
            <Col xs={24} md={12} key={id}>
              <Card
                actions={[
                  <Button
                    key="detail"
                    type="link"
                    icon={<FolderOpenOutlined />}
                    onClick={() => navigate(`/projects/${id}`)}
                  >
                    Xem chi tiết
                  </Button>,

                  canManage && (
                    <Button
                      key="edit"
                      type="link"
                      icon={<EditOutlined />}
                      onClick={() => handleOpenEditModal(project)}
                    >
                      Sửa
                    </Button>
                  ),

                  canManage && (
                    <Popconfirm
                      key="archive"
                      title={project.isArchived ? 'Khôi phục dự án?' : 'Lưu trữ dự án?'}
                      okText={project.isArchived ? 'Khôi phục' : 'Lưu trữ'}
                      cancelText="Huỷ"
                      onConfirm={() => handleToggleArchiveProject(project)}
                    >
                      <Button type="link" icon={<InboxOutlined />}>
                        {project.isArchived ? 'Khôi phục' : 'Lưu trữ'}
                      </Button>
                    </Popconfirm>
                  ),

                  canManage && (
                    <Popconfirm
                      key="delete"
                      title="Xoá dự án?"
                      okText="Xoá"
                      cancelText="Huỷ"
                      onConfirm={() => handleDeleteProject(project)}
                    >
                      <Button type="link" danger icon={<DeleteOutlined />}>
                        Xoá
                      </Button>
                    </Popconfirm>
                  ),
                ].filter(Boolean as any)}
              >
                <Space direction="vertical" className="w-full">
                  <div className="flex items-center justify-between">
                    <div>
                      <Text strong>{project.name}</Text>
                      <div className="text-xs text-gray-500">
                        {project.description}
                      </div>
                      <div className="text-xs text-gray-500 mt-1">
                        Lead: <b>{leadName}</b>
                      </div>
                    </div>
                    <Tag color={project.isArchived ? 'default' : 'blue'}>
                      {project.isArchived ? 'Archived' : 'Active'}
                    </Tag>
                  </div>
                  <Progress percent={progress} status="active" size="small" />
                  <div className="flex items-center justify-between text-sm text-gray-500">
                    <span>{openTasks} task đang mở</span>
                    <span>
                      {doneTasks}/{totalTasks} task hoàn thành
                    </span>
                  </div>
                </Space>
              </Card>
            </Col>
          );
        })}
      </Row>

      {filteredProjects.length === 0 && (
        <Card>
          <List
            locale={{ emptyText: 'Không có dự án nào khớp điều kiện.' }}
            dataSource={[]}
            renderItem={() => null}
          />
        </Card>
      )}

      {/* Modal tạo/sửa dự án */}
      <Modal
        title={editingProject ? 'Sửa dự án' : 'Tạo dự án mới'}
        open={createModalOpen}
        onCancel={() => setCreateModalOpen(false)}
        onOk={handleSubmitProject}
        okText={editingProject ? 'Lưu' : 'Tạo dự án'}
      >
        <Form layout="vertical" form={form}>
          <Form.Item
            name="name"
            label="Tên dự án"
            rules={[{ required: true, message: 'Nhập tên dự án' }]}
          >
            <Input placeholder="VD: Smartwork AI" />
          </Form.Item>

          <Form.Item
            name="key"
            label="Mã dự án (KEY)"
            rules={[{ required: true, message: 'Nhập mã dự án' }]}
          >
            <Input placeholder="VD: SWAI" />
          </Form.Item>

          <Form.Item name="description" label="Mô tả">
            <Input.TextArea rows={3} placeholder="Mô tả ngắn về dự án" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
