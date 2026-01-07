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
import { UserAddOutlined, TeamOutlined, CrownOutlined } from '@ant-design/icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

import teamService, { type Team, type TeamMember, type TeamRole } from '@/services/teamService';
import inviteService from '@/services/inviteService';
import paymentService, { type PlanType } from '@/services/paymentService';
import { useAuthContext } from '@/contexts/AuthContext';
import PlanSelectionModal from '@/components/plan/PlanSelectionModal';
import PaymentModal from '@/components/plan/PaymentModal';
import PlanManagementModal from '@/components/plan/PlanManagementModal';

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

  // Plan selection & payment states
  const [planSelectionModalVisible, setPlanSelectionModalVisible] = useState(false);
  const [planManagementModalVisible, setPlanManagementModalVisible] = useState(false);
  const [paymentModalVisible, setPaymentModalVisible] = useState(false);
  const [pendingTeamId, setPendingTeamId] = useState<string | null>(null);
  const [pendingTeamName, setPendingTeamName] = useState<string>('');
  const [currentPayment, setCurrentPayment] = useState<any>(null);
const [planAlert, setPlanAlert] = useState<{
  visible: boolean;
  type: 'expired' | 'near';
  minutesLeft?: number;
  memberLimitExceeded?: boolean;
}>({
  visible: false,
  type: 'near',
});
const [planAlertKey, setPlanAlertKey] = useState<string | null>(null);

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
  const memberCount = members.length;
  const isFreePlan = team?.plan === 'FREE';
  const isLegacyFreeExceedLimit = isFreePlan && memberCount > 3; // team cũ vượt limit trước khi có validation

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

// Cảnh báo hết hạn / gần hết hạn gói (chỉ hiển thị cho leader/admin)
useEffect(() => {
  if (!team || !team.planStatus) return;
  if (!isLeaderOrAdmin) return;

  const status = team.planStatus;
  let key: string | null = null;
  let type: 'expired' | 'near' | null = null;

  if (status.isExpired) {
    type = 'expired';
    key = `${team._id}-expired-${status.expiredAt || ''}`;
  } else if (status.isNearExpiry) {
    type = 'near';
    key = `${team._id}-near-${status.expiredAt || ''}`;
  }

  if (!type || !key) return;
  if (planAlertKey === key) return; 

  setPlanAlert({
    visible: true,
    type,
    minutesLeft: status.minutesLeft,
    memberLimitExceeded: status.memberLimitExceeded,
  });
  setPlanAlertKey(key);
}, [team, isLeaderOrAdmin, planAlertKey]);

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
      const createdName = res.data?.name || '';

      if (createdId) {
        // Tự động mở modal chọn gói sau khi tạo team thành công
        setPendingTeamId(createdId);
        setPendingTeamName(createdName);
        setPlanSelectionModalVisible(true);
      }
    },
    onError: (err: any) => message.error(err?.response?.data || 'Tạo team thất bại'),
  });

  // Mutation: Chọn plan (chỉ cho FREE)
  const selectPlanMutation = useMutation({
    mutationFn: ({ teamId, plan }: { teamId: string; plan: PlanType }) =>
      teamService.selectPlan(teamId, plan),
    onSuccess: async () => {
      message.success('Đã chọn gói FREE');
      setPlanSelectionModalVisible(false);
      await handlePlanSelectionComplete();
    },
    onError: (err: any) => {
      message.error(err?.response?.data || 'Chọn gói thất bại');
    },
  });

  // Mutation: Tạo payment
  const createPaymentMutation = useMutation({
    mutationFn: (teamId: string) => {
      console.log('Creating payment for team:', teamId);
      return paymentService.createPayment(teamId, 'PREMIUM');
    },
    onSuccess: async (res) => {
      console.log('Payment created successfully:', res.data);
      if (res.data?.payment) {
        setCurrentPayment(res.data.payment);
        setPlanSelectionModalVisible(false);
        setPaymentModalVisible(true);
      } else {
        console.error('Payment data missing:', res.data);
        message.error('Không nhận được thông tin payment từ server');
      }
    },
    onError: (err: any) => {
      console.error('Create payment error:', err);
      message.error(err?.response?.data || 'Tạo payment thất bại');
    },
  });

  // Handlers
  const handleSelectPlan = (plan: PlanType) => {
    console.log('handleSelectPlan called with plan:', plan, 'pendingTeamId:', pendingTeamId);
    if (!pendingTeamId) {
      message.error('Không tìm thấy Team ID');
      return;
    }
    
    if (plan === 'FREE') {
      // FREE: Gọi API selectPlan ngay
      selectPlanMutation.mutate({ teamId: pendingTeamId, plan });
    } else if (plan === 'PREMIUM') {
      // PREMIUM: Tạo payment ngay (không cần gọi selectPlan)
      console.log('Creating payment for PREMIUM plan...');
      createPaymentMutation.mutate(pendingTeamId);
    }
  };

  const handlePaymentSuccess = async () => {
    setPaymentModalVisible(false);
    setCurrentPayment(null);
    
    // Refresh team data ngay lập tức
    if (pendingTeamId) {
      await queryClient.invalidateQueries({ queryKey: ['team', pendingTeamId] });
      await queryClient.invalidateQueries({ queryKey: ['teams', 'mine'] });
    }
    
    // Nếu đang ở trang team đó, không cần navigate
    if (routeTeamId === pendingTeamId) {
      // Chỉ reset states, không navigate
      setPendingTeamId(null);
      setPendingTeamName('');
    } else {
      // Nếu không, navigate đến team đó
      await handlePlanSelectionComplete();
    }
  };

  const handlePlanSelectionComplete = async () => {
    if (!pendingTeamId) return;

    // Invalidate queries để refresh team data
    await queryClient.invalidateQueries({ queryKey: ['team', pendingTeamId] });
    await queryClient.invalidateQueries({ queryKey: ['teams', 'mine'] });

    // Navigate to team page
    navigate(`/teams/${pendingTeamId}`, { replace: true });

    // Reset states
    setPendingTeamId(null);
    setPendingTeamName('');
  };

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

    // Nếu FREE và đã đủ 3 thành viên thì yêu cầu nâng cấp
    if (isFreePlan && memberCount >= 3) {
      Modal.confirm({
        title: 'Nâng cấp PREMIUM để mời thêm thành viên',
        content: (
          <div>
            <p>Gói FREE chỉ cho phép tối đa 3 thành viên (bao gồm Leader).</p>
            <p>Vui lòng nâng cấp lên PREMIUM hoặc xoá bớt thành viên để tiếp tục.</p>
          </div>
        ),
        okText: 'Nâng cấp PREMIUM',
        cancelText: 'Để sau',
        onOk: () => {
          setPendingTeamId(activeTeamId);
          setPendingTeamName(team?.name || '');
          setPlanSelectionModalVisible(true);
        },
      });
      return;
    }

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
    <div className="space-y-4 p-3 sm:p-4 md:p-6" style={{ minHeight: '100vh', overflowX: 'hidden', width: '100%', maxWidth: '100%' }}>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
          <Title level={2} className="m-0">
            Quản lý thành viên
          </Title>
          </div>
          {teams.length > 1 && (
            <div className="mt-2">
              <Text type="secondary" className="mr-2">
                Team:
              </Text>
              <Select
                className="w-full sm:w-auto sm:min-w-[200px]"
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

        <Space className="flex-wrap">
          {/* Nút quản lý gói - chỉ Leader mới thấy */}
          {isLeaderOrAdmin && (
            <Button
              icon={team.plan === 'PREMIUM' ? <CrownOutlined /> : null}
              onClick={() => {
                setPlanManagementModalVisible(true);
              }}
              style={{
                background: team.plan === 'PREMIUM' ? '#f59e0b' : '#f3f4f6',
                borderColor: team.plan === 'PREMIUM' ? '#f59e0b' : '#cbd5e1',
                color: team.plan === 'PREMIUM' ? '#fff' : '#374151',
              }}
            >
              {team.plan === 'PREMIUM' ? 'PREMIUM' : 'Free'}
            </Button>
          )}
          
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
        <Col xs={24} md={12}>
          <Card>
            <Statistic title="Tổng thành viên" value={members.length} />
          </Card>
        </Col>
        <Col xs={24} md={12}>
          <Card>
            <Statistic
              title="Leader"
              value={members.filter((m) => m.role === 'leader' || m.role === 'admin').length}
            />
          </Card>
        </Col>
      </Row>

      {/* Members + Invite */}
      <Row gutter={[16, 16]}>
        <Col xs={24} lg={16}>
          <Card title="Danh sách thành viên" extra={<Text type="secondary">{members.length} người</Text>}>
            {isLegacyFreeExceedLimit && (
              <Alert
                className="mb-3"
                type="warning"
                showIcon
                message="Team đang dùng gói FREE nhưng đã có hơn 3 thành viên."
                description="Vui lòng nâng cấp lên PREMIUM để giữ đủ thành viên, hoặc xoá bớt thành viên để về đúng giới hạn."
                action={
                  <Button
                    type="primary"
                    size="small"
                    onClick={() => {
                      setPendingTeamId(activeTeamId);
                      setPendingTeamName(team?.name || '');
                      setPlanSelectionModalVisible(true);
                    }}
                  >
                    Nâng cấp PREMIUM
                  </Button>
                }
              />
            )}

            <div style={{ overflowX: 'auto', overflowY: 'hidden' }}>
            <Table
              pagination={false}
              dataSource={dataSource}
              columns={[
                  { title: 'Tên', dataIndex: 'name', width: 150 },
                  { title: 'Email', dataIndex: 'email', width: 200 },
                {
                  title: 'Vai trò',
                  dataIndex: 'role',
                    width: 120,
                  render: (roleValue: TeamRole) => (
                    <Tag color={roleValue === 'leader' ? 'gold' : roleValue === 'admin' ? 'blue' : 'default'}>
                      {roleValue}
                    </Tag>
                  ),
                },
                {
                  title: 'Tham gia',
                  dataIndex: 'joinedAt',
                    width: 120,
                  render: (value: string | undefined) => (value ? new Date(value).toLocaleDateString() : '—'),
                },
                {
                  title: 'Thao tác',
                    width: 200,
                  render: (_: any, record: MemberRow) => {
                    const meId = user?._id;
                    const isMe = meId && record.userId === meId;
                    return (
                        <Space size="small" wrap>
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
                scroll={{ x: 'max-content', y: 'calc(100vh - 500px)' }}
                size="middle"
            />
            </div>
            <Alert
              className="mt-3"
              type="warning"
              message="Chỉ leader mới được mời thêm hoặc chỉnh sửa vai trò thành viên. Leader cuối cùng không thể tự xoá mình."
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
                disabled={!isLeaderOrAdmin || (isFreePlan && memberCount >= 3)}
              >
                Gửi lời mời
              </Button>,
            ]}
          >
            {isFreePlan && (
              <Alert
                className="mb-3"
                type={memberCount >= 3 ? 'warning' : 'info'}
                showIcon
                message={
                  memberCount >= 3
                    ? 'Gói FREE đã đạt giới hạn 3 thành viên. Nâng cấp PREMIUM để mời thêm.'
                    : 'Gói FREE giới hạn tối đa 3 thành viên (bao gồm Leader).'
                }
                action={
                  memberCount >= 3 ? (
                    <Button
                      type="primary"
                      size="small"
                      onClick={() => {
                        setPendingTeamId(activeTeamId);
                        setPendingTeamName(team?.name || '');
                        setPlanSelectionModalVisible(true);
                      }}
                    >
                      Nâng cấp PREMIUM
                    </Button>
                  ) : null
                }
              />
            )}
            {!isLeaderOrAdmin && (
              <Alert
                className="mb-3"
                type="info"
                message="Chỉ leader mới có thể mời thành viên. Hãy liên hệ leader team nếu bạn cần thêm người."
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

      {/* POPUP cảnh báo gói hết hạn / sắp hết hạn */}
      <Modal
        open={planAlert.visible}
        onCancel={() => setPlanAlert((prev) => ({ ...prev, visible: false }))}
        footer={[
          <Button key="close" onClick={() => setPlanAlert((prev) => ({ ...prev, visible: false }))}>
            Để sau
          </Button>,
          <Button
            key="manage"
            type="primary"
            onClick={() => {
              setPlanAlert((prev) => ({ ...prev, visible: false }));
              setPlanManagementModalVisible(true);
              if (team?._id) {
                setPendingTeamId(team._id);
                setPendingTeamName(team.name);
              }
            }}
          >
            Gia hạn / Quản lý gói
          </Button>,
        ]}
      >
        {planAlert.type === 'expired' ? (
          <div>
            <p>
              Gói PREMIUM của team <b>{team?.name}</b> đã hết hạn.
            </p>
            <p>
              Vui lòng gia hạn để tiếp tục dùng tính năng PREMIUM. Nếu không gia hạn, team sẽ ở gói FREE và giới hạn tối đa 3 thành viên.
            </p>
            {planAlert.memberLimitExceeded && (
              <p style={{ color: '#d4380d' }}>
                Hiện team đang vượt quá 3 thành viên. Bạn cần xoá bớt hoặc gia hạn gói để tiếp tục.
              </p>
            )}
          </div>
        ) : (
          <div>
            <p>
              Gói PREMIUM của team <b>{team?.name}</b> sắp hết hạn.
            </p>
            <p>
              {typeof planAlert.minutesLeft === 'number'
                ? `Còn khoảng ${planAlert.minutesLeft} phút. Vui lòng gia hạn để tránh gián đoạn.`
                : 'Vui lòng gia hạn để tránh gián đoạn.'}
            </p>
          </div>
        )}
      </Modal>

      {/* MODAL CHỌN GÓI */}
      <PlanSelectionModal
        open={planSelectionModalVisible}
        teamId={pendingTeamId || ''}
        teamName={pendingTeamName}
        onSelectPlan={handleSelectPlan}
        onCancel={() => {
          setPlanSelectionModalVisible(false);
          // Chỉ đóng modal, không navigate (user có thể mở lại sau)
        }}
        loading={selectPlanMutation.isPending || createPaymentMutation.isPending}
      />

      {/* MODAL QUẢN LÝ GÓI */}
      <PlanManagementModal
        open={planManagementModalVisible}
        team={team}
        onCancel={() => {
          setPlanManagementModalVisible(false);
        }}
      />

      {/* MODAL THANH TOÁN */}
      <PaymentModal
        open={paymentModalVisible}
        payment={currentPayment}
        teamId={pendingTeamId || ''}
        teamName={pendingTeamName}
        onSuccess={handlePaymentSuccess}
        onCancel={() => {
          setPaymentModalVisible(false);
          setCurrentPayment(null);
          // Chỉ đóng modal, không navigate (user có thể mở lại sau)
        }}
      />
    </div>
  );
}