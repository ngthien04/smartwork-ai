import { useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Card,
  Typography,
  Row,
  Col,
  Table,
  Tag,
  Select,
  Button,
  Input,
  Statistic,
  Alert,
  Space,
  message,
  Spin,
  Modal,
} from 'antd';
import { UserAddOutlined, TeamOutlined } from '@ant-design/icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

import teamService, { type Team, type TeamMember, type TeamRole } from '@/services/teamService';
import inviteService from '@/services/inviteService';
import { useAuthContext } from '@/contexts/AuthContext';

const { Title, Text } = Typography;
const { Option } = Select;

interface MemberRow {
  key: string;
  userId: string;
  name: string;
  email: string;
  role: TeamRole;
  joinedAt?: string;
}

function normalizeMembers(members: TeamMember[]): MemberRow[] {
  return (members || []).map((m) => {
    const u: any = typeof m.user === 'string' ? { _id: m.user } : m.user || {};
    return {
      key: String(u._id),
      userId: String(u._id),
      name: u.name || '—',
      email: u.email || '—',
      role: m.role,
      joinedAt: m.joinedAt,
    };
  });
}

export default function TeamManagementPage() {
  const { teamId: routeTeamId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuthContext();
  const queryClient = useQueryClient();

  const [email, setEmail] = useState('');
  const [role, setRole] = useState<TeamRole>('member');

  const [teamName, setTeamName] = useState('');
  const [teamSlug, setTeamSlug] = useState('');

  const [createTeamModalVisible, setCreateTeamModalVisible] = useState(false);
  const [newTeamName, setNewTeamName] = useState('');
  const [newTeamSlug, setNewTeamSlug] = useState('');

  const [removeMemberModalVisible, setRemoveMemberModalVisible] = useState(false);
  const [memberToRemove, setMemberToRemove] = useState<MemberRow | null>(null);

  const [roleModalVisible, setRoleModalVisible] = useState(false);
  const [memberEditingRole, setMemberEditingRole] = useState<MemberRow | null>(null);
  const [newRoleValue, setNewRoleValue] = useState<TeamRole>('member');

  const [deleteTeamModalVisible, setDeleteTeamModalVisible] = useState(false);

  // ---------------------------
  // Queries
  // ---------------------------
  const teamsQuery = useQuery({
    queryKey: ['teams', 'mine'],
    queryFn: async () => {
      const res = await teamService.listMyTeams();
      return res.data.items || [];
    },
    staleTime: 0,
    refetchOnMount: 'always',
    refetchOnWindowFocus: true,
    retry: 1,
  });

  const activeTeamId = useMemo(() => {
    if (routeTeamId) return String(routeTeamId);
    const first = teamsQuery.data?.[0];
    return first?._id ? String(first._id) : '';
  }, [routeTeamId, teamsQuery.data]);

  const teamQuery = useQuery({
    queryKey: ['team', activeTeamId],
    queryFn: async () => {
      const res = await teamService.getById(activeTeamId);
      return res.data;
    },
    enabled: !!activeTeamId,
    staleTime: 0,
    refetchOnMount: 'always',
    refetchOnWindowFocus: true,
    retry: 1,
  });

  const membersQuery = useQuery({
    queryKey: ['team', activeTeamId, 'members'],
    queryFn: async () => {
      const res = await teamService.getMembers(activeTeamId);
      return res.data || [];
    },
    enabled: !!activeTeamId,
    staleTime: 0,
    refetchOnMount: 'always',
    refetchOnWindowFocus: true,
    retry: 1,
  });

  const teams: Team[] = teamsQuery.data || [];
  const team: Team | null = teamQuery.data || null;
  const members: TeamMember[] = membersQuery.data || [];

  const dataSource: MemberRow[] = useMemo(() => normalizeMembers(members), [members]);

  const myRole: TeamRole | null = useMemo(() => {
    const meId = user?._id || (user as any)?.id;
    if (!meId) return null;
    const found = members.find((m) => {
      const u: any = typeof m.user === 'string' ? { _id: m.user } : m.user || {};
      return String(u._id) === String(meId);
    });
    return found?.role || null;
  }, [user, members]);

  const isLeaderOrAdmin = myRole === 'leader' || myRole === 'admin';

  // ---------------------------
  // Mutations
  // ---------------------------
  const createTeamMutation = useMutation({
    mutationFn: (payload: { name: string; slug: string }) => teamService.createTeam(payload),
    onSuccess: async (res) => {
      message.success('Đã tạo team mới');

      // close modal (tạo team mới)
      setNewTeamName('');
      setNewTeamSlug('');
      setCreateTeamModalVisible(false);

      await queryClient.invalidateQueries({ queryKey: ['teams', 'mine'] });

      const createdId = res.data?._id ? String(res.data._id) : '';
      if (createdId) {
        navigate(`/teams/${createdId}`, { replace: true });
        await queryClient.invalidateQueries({ queryKey: ['team', createdId] });
        await queryClient.invalidateQueries({ queryKey: ['team', createdId, 'members'] });
      }
    },
    onError: (err: any) => message.error(err?.response?.data || 'Tạo team thất bại'),
  });

  // ✅ NEW: invite goes through inviteService (Mailjet email)
  const inviteMutation = useMutation({
    mutationFn: (payload: { teamId: string; email: string; role: TeamRole }) =>
      inviteService.create({
        team: payload.teamId,
        email: payload.email,
        role: payload.role,
      }),
    onSuccess: (res) => {
      message.success('Đã gửi email mời thành viên');

      const expiresAt = res.data?.expiresAt;
      Modal.success({
        title: 'Đã gửi lời mời',
        content: (
          <div>
            <p>Email mời đã được gửi. Người được mời có thể bấm <b>Chấp nhận</b> hoặc <b>Từ chối</b> ngay trong email.</p>
            {expiresAt && (
              <p>
                Hạn lời mời: <b>{new Date(expiresAt).toLocaleString()}</b>
              </p>
            )}
          </div>
        ),
      });

      setEmail('');
      setRole('member');

      // optional: nếu bạn có trang "invites list" thì invalidate thêm
      queryClient.invalidateQueries({ queryKey: ['invites'] });
      queryClient.invalidateQueries({ queryKey: ['invites', 'mine'] });
    },
    onError: (err: any) => message.error(err?.response?.data || 'Gửi lời mời thất bại'),
  });

  const changeRoleMutation = useMutation({
    mutationFn: (payload: { teamId: string; userId: string; role: TeamRole }) =>
      teamService.updateMemberRole(payload.teamId, payload.userId, payload.role),
    onSuccess: async (_res, vars) => {
      message.success('Đã cập nhật vai trò');
      setRoleModalVisible(false);
      setMemberEditingRole(null);

      await queryClient.invalidateQueries({ queryKey: ['team', vars.teamId, 'members'] });
      await queryClient.invalidateQueries({ queryKey: ['team', vars.teamId] });
      await queryClient.invalidateQueries({ queryKey: ['teams', 'mine'] });
    },
    onError: (err: any) => message.error(err?.response?.data || 'Đổi vai trò thất bại'),
  });

  const removeMemberMutation = useMutation({
    mutationFn: (payload: { teamId: string; userId: string }) =>
      teamService.removeMember(payload.teamId, payload.userId),
    onSuccess: async (_res, vars) => {
      const meId = user?._id || (user as any)?.id;
      const isMe = String(vars.userId) === String(meId);

      message.success(isMe ? 'Bạn đã rời team' : 'Đã gỡ thành viên khỏi team');
      setRemoveMemberModalVisible(false);
      setMemberToRemove(null);

      await queryClient.invalidateQueries({ queryKey: ['teams', 'mine'] });
      await queryClient.invalidateQueries({ queryKey: ['team', vars.teamId, 'members'] });
      await queryClient.invalidateQueries({ queryKey: ['team', vars.teamId] });

      if (isMe) {
        const myTeams = await queryClient.fetchQuery({
          queryKey: ['teams', 'mine'],
          queryFn: async () => {
            const res = await teamService.listMyTeams();
            return res.data.items || [];
          },
        });
        const next = myTeams?.[0];
        if (next?._id) {
          navigate(`/teams/${next._id}`, { replace: true });
        } else {
          navigate('/teams', { replace: true });
        }
      }
    },
    onError: (err: any) => message.error(err?.response?.data || 'Thao tác thất bại'),
  });

  const deleteTeamMutation = useMutation({
    mutationFn: (teamId: string) => teamService.deleteTeam(teamId),
    onSuccess: async (_res, deletedId) => {
      message.success('Đã giải tán team');
      setDeleteTeamModalVisible(false);

      await queryClient.invalidateQueries({ queryKey: ['teams', 'mine'] });
      queryClient.removeQueries({ queryKey: ['team', deletedId] });
      queryClient.removeQueries({ queryKey: ['team', deletedId, 'members'] });

      const myTeams = await queryClient.fetchQuery({
        queryKey: ['teams', 'mine'],
        queryFn: async () => {
          const res = await teamService.listMyTeams();
          return res.data.items || [];
        },
      });

      const next = myTeams?.[0];
      if (next?._id) {
        navigate(`/teams/${next._id}`, { replace: true });
      } else {
        navigate('/teams', { replace: true });
      }
    },
    onError: (err: any) => message.error(err?.response?.data || 'Không giải tán được team'),
  });

  // ---------------------------
  // Handlers
  // ---------------------------
  const handleCreateFirstTeam = () => {
    if (!teamName.trim() || !teamSlug.trim()) return message.warning('Nhập tên và mã team trước');
    createTeamMutation.mutate({ name: teamName.trim(), slug: teamSlug.trim() });
  };

  const handleCreateTeam = () => {
    if (!newTeamName.trim() || !newTeamSlug.trim()) return message.warning('Nhập tên và mã team trước');
    createTeamMutation.mutate({ name: newTeamName.trim(), slug: newTeamSlug.trim() });
  };

  const handleInvite = () => {
    if (!email.trim()) return message.warning('Nhập email thành viên trước');
    if (!activeTeamId) return message.error('Chưa xác định được team');

    inviteMutation.mutate({ teamId: activeTeamId, email: email.trim(), role });
  };

  const showChangeRoleModal = (record: MemberRow) => {
    setMemberEditingRole(record);
    setNewRoleValue(record.role);
    setRoleModalVisible(true);
  };

  const handleChangeRoleOk = () => {
    if (!team || !memberEditingRole) return;
    changeRoleMutation.mutate({ teamId: team._id, userId: memberEditingRole.userId, role: newRoleValue });
  };

  const showRemoveMemberModal = (record: MemberRow) => {
    setMemberToRemove(record);
    setRemoveMemberModalVisible(true);
  };

  const handleRemoveMemberOk = () => {
    if (!team || !memberToRemove) return;
    removeMemberMutation.mutate({ teamId: team._id, userId: memberToRemove.userId });
  };

  const showDeleteTeamModal = () => setDeleteTeamModalVisible(true);

  const handleDeleteTeamOk = () => {
    if (!team) return;
    deleteTeamMutation.mutate(team._id);
  };

  // ---------------------------
  // Render
  // ---------------------------
  const ready =
    teamsQuery.isSuccess && (!!activeTeamId ? teamQuery.isSuccess && membersQuery.isSuccess : true);

  const loading =
    teamsQuery.isLoading || (!!activeTeamId && (teamQuery.isLoading || membersQuery.isLoading));

  if (loading || !ready) {
    return <Spin tip="Đang tải team..." className="w-full h-full flex justify-center items-center" />;
  }

  if (!team) {
    return (
      <div className="space-y-4 max-w-xl">
        <Title level={3}>Bạn chưa thuộc team nào</Title>
        <Text type="secondary">
          Hãy tự tạo team đầu tiên của bạn, sau đó có thể mời thành viên khác vào.
        </Text>
        <Card title="Tạo team đầu tiên">
          <Space direction="vertical" className="w-full">
            <Input placeholder="Tên team" value={teamName} onChange={(e) => setTeamName(e.target.value)} />
            <Input placeholder="Mã/slug" value={teamSlug} onChange={(e) => setTeamSlug(e.target.value)} />
            <Button type="primary" loading={createTeamMutation.isPending} onClick={handleCreateFirstTeam}>
              Tạo team
            </Button>
          </Space>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
        <div>
          <Title level={2} className="m-0">
            Quản lý thành viên
          </Title>
          <Text type="secondary">Team: {team.name}</Text>
          {teams.length > 1 && (
            <div className="mt-2">
              <Text type="secondary" className="mr-2">
                Chuyển team:
              </Text>
              <Select
                style={{ minWidth: 220 }}
                value={team._id}
                onChange={(value) => {
                  navigate(`/teams/${value}`);
                }}
              >
                {teams.map((t) => (
                  <Option key={t._id} value={t._id}>
                    {t.name}
                  </Option>
                ))}
              </Select>
            </div>
          )}
        </div>

        <Space>
          <Button icon={<TeamOutlined />} onClick={() => navigate('/projects')}>
            Xem dự án liên quan
          </Button>

          <Button type="primary" onClick={() => setCreateTeamModalVisible(true)}>
            Tạo team mới
          </Button>

          {user && (
            <Button
              danger
              onClick={() =>
                showRemoveMemberModal({
                  key: user._id,
                  userId: user._id,
                  name: user.name,
                  email: user.email,
                  role: myRole || 'member',
                })
              }
            >
              Rời team
            </Button>
          )}

          {myRole === 'leader' && (
            <Button danger type="primary" onClick={showDeleteTeamModal}>
              Giải tán team
            </Button>
          )}
        </Space>
      </div>

      {/* Stats */}
      <Row gutter={[16, 16]}>
        <Col xs={12} md={6}>
          <Card>
            <Statistic title="Tổng thành viên" value={members.length} />
          </Card>
        </Col>
        <Col xs={12} md={6}>
          <Card>
            <Statistic
              title="Leader/Admin"
              value={members.filter((m) => m.role === 'leader' || m.role === 'admin').length}
            />
          </Card>
        </Col>
        <Col xs={12} md={6}>
          <Card>
            <Statistic title="Lời mời đang chờ" value={0} />
          </Card>
        </Col>
        <Col xs={12} md={6}>
          <Card>
            <Statistic title="Vai trò AI gợi ý" value="—" />
          </Card>
        </Col>
      </Row>

      {/* Members + Invite */}
      <Row gutter={[16, 16]}>
        <Col xs={24} lg={16}>
          <Card title="Danh sách thành viên" extra={<Text type="secondary">{members.length} người</Text>}>
            <Table
              pagination={false}
              dataSource={dataSource}
              columns={[
                { title: 'Tên', dataIndex: 'name' },
                { title: 'Email', dataIndex: 'email' },
                {
                  title: 'Vai trò',
                  dataIndex: 'role',
                  render: (roleValue: TeamRole) => (
                    <Tag color={roleValue === 'leader' ? 'gold' : roleValue === 'admin' ? 'blue' : 'default'}>
                      {roleValue}
                    </Tag>
                  ),
                },
                {
                  title: 'Tham gia',
                  dataIndex: 'joinedAt',
                  render: (value: string | undefined) => (value ? new Date(value).toLocaleDateString() : '—'),
                },
                {
                  title: 'Thao tác',
                  render: (_: any, record: MemberRow) => {
                    const meId = user?._id;
                    const isMe = meId && record.userId === meId;
                    return (
                      <Space>
                        <Button size="small" disabled={!isLeaderOrAdmin} onClick={() => showChangeRoleModal(record)}>
                          Đổi vai trò
                        </Button>
                        <Button
                          size="small"
                          danger
                          disabled={(!isLeaderOrAdmin && !isMe) || removeMemberMutation.isPending}
                          onClick={() => showRemoveMemberModal(record)}
                        >
                          {isMe ? 'Rời team' : 'Gỡ'}
                        </Button>
                      </Space>
                    );
                  },
                },
              ]}
            />
            <Alert
              className="mt-3"
              type="warning"
              message="Chỉ leader/admin mới được mời thêm hoặc chỉnh sửa vai trò thành viên. Leader cuối cùng không thể tự xoá mình."
              showIcon
            />
          </Card>
        </Col>

        <Col xs={24} lg={8}>
          <Card
            title="Mời thành viên mới"
            actions={[
              <Button
                key="invite"
                type="primary"
                icon={<UserAddOutlined />}
                onClick={handleInvite}
                loading={inviteMutation.isPending}
                disabled={!isLeaderOrAdmin}
              >
                Gửi lời mời
              </Button>,
            ]}
          >
            {!isLeaderOrAdmin && (
              <Alert
                className="mb-3"
                type="info"
                message="Chỉ leader/admin mới có thể mời thành viên. Hãy liên hệ leader team nếu bạn cần thêm người."
                showIcon
              />
            )}
            <Space direction="vertical" className="w-full">
              <Input
                placeholder="Email thành viên"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                disabled={!isLeaderOrAdmin || inviteMutation.isPending}
              />
              <Select
                value={role}
                onChange={(value) => setRole(value)}
                className="w-full"
                disabled={!isLeaderOrAdmin || inviteMutation.isPending}
              >
                <Option value="member">Member</Option>
                <Option value="admin">Admin</Option>
                <Option value="leader">Leader</Option>
              </Select>

              <Text type="secondary" className="text-xs">
                Hệ thống sẽ gửi email mời. Người được mời sẽ chấp nhận/từ chối qua email.
              </Text>
            </Space>
          </Card>
        </Col>
      </Row>

      {/* MODAL RỜI / GỠ THÀNH VIÊN */}
      <Modal
        open={removeMemberModalVisible}
        title={memberToRemove?.userId === user?._id ? 'Bạn muốn rời khỏi team này?' : `Gỡ ${memberToRemove?.name} khỏi team?`}
        okText={memberToRemove?.userId === user?._id ? 'Rời team' : 'Gỡ'}
        cancelText="Huỷ"
        okType="danger"
        confirmLoading={removeMemberMutation.isPending}
        onOk={handleRemoveMemberOk}
        onCancel={() => {
          setRemoveMemberModalVisible(false);
          setMemberToRemove(null);
        }}
      >
        <p>
          {memberToRemove?.userId === user?._id
            ? 'Bạn sẽ rời khỏi team này và mất quyền truy cập.'
            : `Thao tác này sẽ gỡ ${memberToRemove?.name} khỏi team.`}
        </p>
      </Modal>

      {/* MODAL TẠO TEAM MỚI */}
      <Modal
        title="Tạo team mới"
        open={createTeamModalVisible}
        onCancel={() => setCreateTeamModalVisible(false)}
        onOk={handleCreateTeam}
        okText="Tạo team"
        confirmLoading={createTeamMutation.isPending}
      >
        <Space direction="vertical" style={{ width: '100%' }}>
          <Input placeholder="Tên team" value={newTeamName} onChange={(e) => setNewTeamName(e.target.value)} />
          <Input placeholder="Mã/slug" value={newTeamSlug} onChange={(e) => setNewTeamSlug(e.target.value)} />
        </Space>
      </Modal>

      {/* MODAL ĐỔI ROLE */}
      <Modal
        open={roleModalVisible}
        title={`Đổi vai trò cho ${memberEditingRole?.name}`}
        okText="Xác nhận"
        cancelText="Huỷ"
        confirmLoading={changeRoleMutation.isPending}
        onOk={handleChangeRoleOk}
        onCancel={() => setRoleModalVisible(false)}
      >
        <Space direction="vertical" style={{ width: '100%' }}>
          <Text>Vai trò hiện tại: {memberEditingRole?.role}</Text>
          <Select value={newRoleValue} style={{ width: 200 }} onChange={(value: TeamRole) => setNewRoleValue(value)}>
            <Option value="member">Member</Option>
            <Option value="admin">Admin</Option>
            <Option value="leader">Leader</Option>
          </Select>
        </Space>
      </Modal>

      {/* MODAL GIẢI TÁN TEAM */}
      <Modal
        open={deleteTeamModalVisible}
        title="Giải tán team"
        okText="Xác nhận"
        cancelText="Huỷ"
        okType="danger"
        confirmLoading={deleteTeamMutation.isPending}
        onOk={handleDeleteTeamOk}
        onCancel={() => setDeleteTeamModalVisible(false)}
      >
        <p>
          Bạn có chắc muốn giải tán team <b>{team.name}</b>? Thao tác này không thể hoàn tác.
        </p>
      </Modal>
    </div>
  );
}