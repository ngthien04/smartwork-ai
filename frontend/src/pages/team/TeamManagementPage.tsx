// src/pages/TeamManagementPage.tsx
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
import { UserAddOutlined, TeamOutlined, ExclamationCircleOutlined } from '@ant-design/icons';
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

export default function TeamManagementPage() {
  const { teamId: routeTeamId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuthContext();

  const [loading, setLoading] = useState(true);
  const [teams, setTeams] = useState<Team[]>([]);
  const [team, setTeam] = useState<Team | null>(null);
  const [members, setMembers] = useState<TeamMember[]>([]);

  // mời thành viên
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<TeamRole>('member');
  const [inviting, setInviting] = useState(false);

  // tạo team đầu tiên
  const [creating, setCreating] = useState(false);
  const [teamName, setTeamName] = useState('');
  const [teamSlug, setTeamSlug] = useState('');

  // modal rời/gỡ member
  const [removeMemberModalVisible, setRemoveMemberModalVisible] = useState(false);
  const [memberToRemove, setMemberToRemove] = useState<MemberRow | null>(null);

  // modal đổi role
  const [roleModalVisible, setRoleModalVisible] = useState(false);
  const [memberEditingRole, setMemberEditingRole] = useState<MemberRow | null>(null);
  const [newRoleValue, setNewRoleValue] = useState<TeamRole>('member');
  const [changingRole, setChangingRole] = useState(false);

  // modal giải tán team
  const [deleteTeamModalVisible, setDeleteTeamModalVisible] = useState(false);

  const userId = user?._id || (user as any)?.id;

  // ================= LOAD TEAM + MEMBERS =================
  const loadTeamAndMembers = async (explicitTeamId?: string) => {
    try {
      setLoading(true);

      const listRes = await teamService.listMyTeams();
      const myTeams = listRes.data.items || [];
      setTeams(myTeams);

      let activeTeamId = explicitTeamId || routeTeamId || '';
      if (!activeTeamId) {
        const firstTeam = myTeams[0];
        if (!firstTeam) {
          setTeam(null);
          setMembers([]);
          return;
        }
        activeTeamId = firstTeam._id;
        navigate(`/teams/${activeTeamId}`, { replace: true });
      }

      const teamRes = await teamService.getById(activeTeamId);
      setTeam(teamRes.data);

      const memberRes = await teamService.getMembers(activeTeamId);
      setMembers(memberRes.data);
    } catch (err: any) {
      console.error(err);
      message.error(err?.response?.data || 'Không tải được thông tin team');
      setTeam(null);
      setMembers([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTeamAndMembers();
  }, [routeTeamId]);

  // ================= DERIVED DATA =================
  const dataSource: MemberRow[] = useMemo(
    () =>
      members.map((member) => {
        const u: any = typeof member.user === 'string' ? { _id: member.user } : member.user || {};
        return {
          key: u._id,
          userId: u._id,
          name: u.name || '—',
          email: u.email || '—',
          role: member.role,
          joinedAt: member.joinedAt,
        };
      }),
    [members]
  );

  const myRole: TeamRole | null = useMemo(() => {
    if (!user || !members.length) return null;
    const userId = (user as any)._id || (user as any).id;
    const found = members.find((m) => {
      const u: any = typeof m.user === 'string' ? { _id: m.user } : m.user || {};
      return String(u._id) === String(userId);
    });
    return found?.role || null;
  }, [user, members]);

  const isLeaderOrAdmin = myRole === 'leader' || myRole === 'admin';

  // ================= TẠO TEAM ĐẦU TIÊN =================
  const handleCreateFirstTeam = async () => {
    if (!teamName || !teamSlug) {
      message.warning('Nhập tên và mã team trước');
      return;
    }
    try {
      setCreating(true);
      const res = await teamService.createTeam({ name: teamName, slug: teamSlug });
      message.success('Đã tạo team đầu tiên');
      navigate(`/teams/${res.data._id}`);
    } catch (err: any) {
      console.error(err);
      message.error(err?.response?.data || 'Tạo team thất bại');
    } finally {
      setCreating(false);
    }
  };

  // ================= MỜI THÀNH VIÊN =================
  const handleInvite = async () => {
    if (!email) {
      message.warning('Nhập email thành viên trước');
      return;
    }
    if (!team?._id) {
      message.error('Chưa xác định được team');
      return;
    }
    try {
      setInviting(true);
      const res = await teamService.inviteMember(team._id, email, role);
      const { token, expiresAt } = res.data;
      const link = `${window.location.origin}/invites/accept?token=${token}`;

      message.success('Đã tạo lời mời thành viên');
      Modal.info({
        title: 'Lời mời đã được tạo',
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
            <p>Hạn dùng đến: {new Date(expiresAt).toLocaleString()}</p>
          </div>
        ),
        width: 600,
      });

      setEmail('');
      setRole('member');
    } catch (err: any) {
      console.error(err);
      message.error(err?.response?.data || 'Gửi lời mời thất bại');
    } finally {
      setInviting(false);
    }
  };

  // ================= ĐỔI ROLE =================
  const showChangeRoleModal = (record: MemberRow) => {
    setMemberEditingRole(record);
    setNewRoleValue(record.role);
    setRoleModalVisible(true);
  };

  const handleChangeRoleOk = async () => {
    if (!team?._id || !memberEditingRole) return;
    setChangingRole(true);
    try {
      await teamService.updateMemberRole(team._id, memberEditingRole.userId, newRoleValue);
      message.success('Đã cập nhật vai trò');
      await loadTeamAndMembers(team._id);

      if (user && memberEditingRole.userId === user._id && newRoleValue === 'member') {
        message.info('Bạn vừa bị hạ quyền, một số thao tác có thể bị hạn chế.');
      }
    } catch (err: any) {
      console.error(err);
      message.error(err?.response?.data || 'Đổi vai trò thất bại');
    } finally {
      setChangingRole(false);
      setRoleModalVisible(false);
      setMemberEditingRole(null);
    }
  };

  // ================= MODAL RỜI / GỠ THÀNH VIÊN =================
  const showRemoveMemberModal = (record: MemberRow) => {
    setMemberToRemove(record);
    setRemoveMemberModalVisible(true);
  };

  const handleRemoveMemberOk = async () => {
    if (!team?._id || !memberToRemove) return;
    const isMe = memberToRemove.userId === user?._id;
    try {
      await teamService.removeMember(team._id, memberToRemove.userId);
      message.success(isMe ? 'Bạn đã rời team' : 'Đã gỡ thành viên khỏi team');
      await loadTeamAndMembers(team._id);
    } catch (err: any) {
      console.error(err);
      message.error(err?.response?.data || 'Thao tác thất bại');
    } finally {
      setRemoveMemberModalVisible(false);
      setMemberToRemove(null);
    }
  };

  // ================= MODAL GIẢI TÁN TEAM =================
  const showDeleteTeamModal = () => setDeleteTeamModalVisible(true);

  const handleDeleteTeamOk = async () => {
    if (!team?._id) return;
    try {
      await teamService.deleteTeam(team._id);
      message.success('Đã giải tán team');
      await loadTeamAndMembers();
    } catch (err: any) {
      console.error(err);
      message.error(err?.response?.data || 'Không giải tán được team');
    } finally {
      setDeleteTeamModalVisible(false);
    }
  };

  // ================= RENDER =================
  if (loading) return <Spin tip="Đang tải team..." className="w-full h-full flex justify-center items-center" />;

  if (!team)
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
            <Button type="primary" loading={creating} onClick={handleCreateFirstTeam}>
              Tạo team
            </Button>
          </Space>
        </Card>
      </div>
    );

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
              <Select style={{ minWidth: 200 }} value={team._id} onChange={(value) => navigate(`/teams/${value}`)}>
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
            <Statistic title="Vai trò AI gợi ý" value="1 nâng cấp" />
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
                    const meId = user?._id || (user as any)?.id;
                    const isMe = meId && record.userId === meId;
                    return (
                      <Space>
                        <Button size="small" disabled={!isLeaderOrAdmin} onClick={() => showChangeRoleModal(record)}>
                          Đổi vai trò
                        </Button>
                        <Button size="small" danger disabled={!isLeaderOrAdmin && !isMe} onClick={() => showRemoveMemberModal(record)}>
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
              <Button key="invite" type="primary" icon={<UserAddOutlined />} onClick={handleInvite} loading={inviting} disabled={!isLeaderOrAdmin}>
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
              <Input placeholder="Email thành viên" value={email} onChange={(event) => setEmail(event.target.value)} disabled={!isLeaderOrAdmin} />
              <Select value={role} onChange={(value) => setRole(value)} className="w-full" disabled={!isLeaderOrAdmin}>
                <Option value="member">Member</Option>
                <Option value="admin">Admin</Option>
                <Option value="leader">Leader</Option>
              </Select>
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

      {/* MODAL ĐỔI ROLE */}
      <Modal
        open={roleModalVisible}
        title={`Đổi vai trò cho ${memberEditingRole?.name}`}
        okText="Xác nhận"
        cancelText="Huỷ"
        confirmLoading={changingRole}
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
        onOk={handleDeleteTeamOk}
        onCancel={() => setDeleteTeamModalVisible(false)}
      >
        <p>Bạn có chắc muốn giải tán team {team.name}? Thao tác này không thể hoàn tác.</p>
      </Modal>
    </div>
  );
}
