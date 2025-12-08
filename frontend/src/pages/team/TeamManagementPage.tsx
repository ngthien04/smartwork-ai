import { useEffect, useMemo, useState } from 'react';
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
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import teamService, { type Team, type TeamMember, type TeamRole } from '@/services/teamService';
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

function extractUserId(u: any) {
  return String(u?._id || u?.id || '');
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
  const queryClient = useQueryClient();
  const { user } = useAuthContext();

  // Invite
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<TeamRole>('member');

  // Create team modal
  const [createTeamModalVisible, setCreateTeamModalVisible] = useState(false);
  const [newTeamName, setNewTeamName] = useState('');
  const [newTeamSlug, setNewTeamSlug] = useState('');

  // Remove member modal
  const [removeMemberModalVisible, setRemoveMemberModalVisible] = useState(false);
  const [memberToRemove, setMemberToRemove] = useState<MemberRow | null>(null);

  // Change role modal
  const [roleModalVisible, setRoleModalVisible] = useState(false);
  const [memberEditingRole, setMemberEditingRole] = useState<MemberRow | null>(null);
  const [newRoleValue, setNewRoleValue] = useState<TeamRole>('member');

  // Delete team modal
  const [deleteTeamModalVisible, setDeleteTeamModalVisible] = useState(false);

  // ---------------------------
  // Queries (stable + always fresh)
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

  // activeTeamId: routeTeamId > first team in list
  const activeTeamId = useMemo(() => {
    if (routeTeamId) return String(routeTeamId);
    const first = teamsQuery.data?.[0];
    return first?._id ? String(first._id) : '';
  }, [routeTeamId, teamsQuery.data]);

  // Auto navigate when URL no teamId but have teams
  useEffect(() => {
    if (!routeTeamId && activeTeamId) {
      navigate(`/teams/${activeTeamId}`, { replace: true });
    }
  }, [routeTeamId, activeTeamId, navigate]);

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

  // Gate: chỉ render full UI khi đã có đủ data chắc chắn (tránh “thiếu chức năng”)
  const ready =
    teamsQuery.isSuccess &&
    (!!activeTeamId ? teamQuery.isSuccess && membersQuery.isSuccess : true);

  const loading =
    teamsQuery.isLoading ||
    (!!activeTeamId && (teamQuery.isLoading || membersQuery.isLoading));

  // ---------------------------
  // Derived permissions
  // ---------------------------
  const myRole: TeamRole | null = useMemo(() => {
    const meId = extractUserId(user);
    if (!meId) return null;

    const found = members.find((m) => {
      const u: any = typeof m.user === 'string' ? { _id: m.user } : m.user || {};
      return String(u._id) === meId;
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

  const inviteMutation = useMutation({
    mutationFn: (payload: { teamId: string; email: string; role: TeamRole }) =>
      teamService.inviteMember(payload.teamId, payload.email, payload.role),
    onSuccess: (res) => {
      const { token, expiresAt } = res.data || {};
      const link = `${window.location.origin}/invites/accept?token=${token}`;

      message.success('Đã tạo lời mời thành viên');
      Modal.info({
        title: 'Lời mời đã được tạo',
        width: 720,
        content: (
          <div>
            <p>
              Gửi link này cho người được mời:
              <br />
              <code>{link}</code>
            </p>
            <p>
              Hoặc đưa token:
              <br />
              <code>{token}</code>
            </p>
            <p>Hạn dùng đến: {expiresAt ? new Date(expiresAt).toLocaleString() : '—'}</p>
          </div>
        ),
      });

      setEmail('');
      setRole('member');
      // members list không đổi ngay (vì invite chưa accept), nhưng invalidate để UI luôn fresh
      queryClient.invalidateQueries({ queryKey: ['teams', 'mine'] });
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
      const meId = extractUserId(user);
      const isMe = String(vars.userId) === meId;

      message.success(isMe ? 'Bạn đã rời team' : 'Đã gỡ thành viên khỏi team');
      setRemoveMemberModalVisible(false);
      setMemberToRemove(null);

      // Refresh cache đúng bài
      await queryClient.invalidateQueries({ queryKey: ['teams', 'mine'] });
      await queryClient.invalidateQueries({ queryKey: ['team', vars.teamId, 'members'] });
      await queryClient.invalidateQueries({ queryKey: ['team', vars.teamId] });

      // Nếu rời team: điều hướng sang team khác (lấy từ cache/ fetchQuery để chắc chắn sync)
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
    if (!activeTeamId || !memberEditingRole) return;
    changeRoleMutation.mutate({ teamId: activeTeamId, userId: memberEditingRole.userId, role: newRoleValue });
  };

  const showRemoveMemberModal = (record: MemberRow) => {
    setMemberToRemove(record);
    setRemoveMemberModalVisible(true);
  };

  const handleRemoveMemberOk = () => {
    if (!activeTeamId || !memberToRemove) return;
    removeMemberMutation.mutate({ teamId: activeTeamId, userId: memberToRemove.userId });
  };

  const handleDeleteTeamOk = () => {
    if (!activeTeamId) return;
    deleteTeamMutation.mutate(activeTeamId);
  };

  // ---------------------------
  // Render
  // ---------------------------
  if (loading || !ready) {
    return <Spin tip="Đang tải team..." className="w-full h-full flex justify-center items-center" />;
  }

  // no team case
  if (!activeTeamId || !team) {
    return (
      <div className="space-y-4 max-w-xl">
        <Title level={3}>Bạn chưa thuộc team nào</Title>
        <Text type="secondary">Hãy tạo team đầu tiên của bạn, sau đó có thể mời thành viên khác vào.</Text>

        <Card title="Tạo team đầu tiên">
          <Space direction="vertical" className="w-full">
            <Input placeholder="Tên team" value={newTeamName} onChange={(e) => setNewTeamName(e.target.value)} />
            <Input placeholder="Mã/slug" value={newTeamSlug} onChange={(e) => setNewTeamSlug(e.target.value)} />
            <Button type="primary" loading={createTeamMutation.isPending} onClick={handleCreateTeam}>
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
          <Title level={2} className="m-0">Quản lý thành viên</Title>
          <Text type="secondary">Team: {team.name}</Text>

          {teams.length > 1 && (
            <div className="mt-2">
              <Text type="secondary" className="mr-2">Chuyển team:</Text>
              <Select style={{ minWidth: 220 }} value={team._id} onChange={(value) => navigate(`/teams/${value}`)}>
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
                  key: extractUserId(user),
                  userId: extractUserId(user),
                  name: (user as any)?.name,
                  email: (user as any)?.email,
                  role: myRole || 'member',
                })
              }
              loading={removeMemberMutation.isPending && memberToRemove?.userId === extractUserId(user)}
            >
              Rời team
            </Button>
          )}

          {myRole === 'leader' && (
            <Button
              danger
              type="primary"
              onClick={() => setDeleteTeamModalVisible(true)}
              loading={deleteTeamMutation.isPending}
            >
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
            <Statistic title="Leader/Admin" value={members.filter((m) => m.role === 'leader' || m.role === 'admin').length} />
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
              rowKey="key"
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
                    const meId = extractUserId(user);
                    const isMe = meId && String(record.userId) === meId;

                    return (
                      <Space>
                        <Button size="small" disabled={!isLeaderOrAdmin} onClick={() => showChangeRoleModal(record)}>
                          Đổi vai trò
                        </Button>

                        <Button
                          size="small"
                          danger
                          disabled={!isLeaderOrAdmin && !isMe}
                          onClick={() => showRemoveMemberModal(record)}
                          loading={removeMemberMutation.isPending && memberToRemove?.userId === record.userId}
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
                onChange={(e) => setEmail(e.target.value)}
                disabled={!isLeaderOrAdmin}
              />

              <Select value={role} onChange={(v) => setRole(v)} className="w-full" disabled={!isLeaderOrAdmin}>
                <Option value="member">Member</Option>
                <Option value="admin">Admin</Option>
                <Option value="leader">Leader</Option>
              </Select>
            </Space>
          </Card>
        </Col>
      </Row>

      {/* MODAL: RỜI / GỠ */}
      <Modal
        open={removeMemberModalVisible}
        title={memberToRemove?.userId === extractUserId(user) ? 'Bạn muốn rời khỏi team này?' : `Gỡ ${memberToRemove?.name} khỏi team?`}
        okText={memberToRemove?.userId === extractUserId(user) ? 'Rời team' : 'Gỡ'}
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
          {memberToRemove?.userId === extractUserId(user)
            ? 'Bạn sẽ rời khỏi team này và mất quyền truy cập.'
            : `Thao tác này sẽ gỡ ${memberToRemove?.name} khỏi team.`}
        </p>
      </Modal>

      {/* MODAL: TẠO TEAM */}
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

      {/* MODAL: ĐỔI ROLE */}
      <Modal
        open={roleModalVisible}
        title={`Đổi vai trò cho ${memberEditingRole?.name}`}
        okText="Xác nhận"
        cancelText="Huỷ"
        confirmLoading={changeRoleMutation.isPending}
        onOk={handleChangeRoleOk}
        onCancel={() => {
          setRoleModalVisible(false);
          setMemberEditingRole(null);
        }}
      >
        <Space direction="vertical" style={{ width: '100%' }}>
          <Text>Vai trò hiện tại: {memberEditingRole?.role}</Text>
          <Select value={newRoleValue} style={{ width: 200 }} onChange={(v: TeamRole) => setNewRoleValue(v)}>
            <Option value="member">Member</Option>
            <Option value="admin">Admin</Option>
            <Option value="leader">Leader</Option>
          </Select>
        </Space>
      </Modal>

      {/* MODAL: GIẢI TÁN */}
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
