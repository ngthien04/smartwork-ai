import { useEffect, useState } from 'react';
import {
  Card,
  Typography,
  Tabs,
  Table,
  Space,
  Tag,
  Descriptions,
  List,
  Avatar,
  Input,
  Statistic,
  Row,
  Col,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';

import adminService, {
  type AdminUser,
  type AdminPlanStatsResponse,
  type AdminPayment,
} from '@/services/adminService';
import type { Team, TeamMember } from '@/services/teamService';
import { useLocation, useNavigate } from 'react-router-dom';
import { ROUTES } from '@/routes/path';

const { Title, Text } = Typography;
const { Search } = Input;

interface TeamWithMembers extends Team {
  membersDetailed?: TeamMember[];
}

export default function AdminPage() {
  const location = useLocation();
  const navigate = useNavigate();

  const searchParams = new URLSearchParams(location.search);
  const initialTab = (searchParams.get('tab') as 'users' | 'teams' | 'plans') || 'users';

  const [users, setUsers] = useState<AdminUser[]>([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [selectedUser, setSelectedUser] = useState<AdminUser | null>(null);
  const [hoveredUserId, setHoveredUserId] = useState<string | null>(null);

  const [teams, setTeams] = useState<TeamWithMembers[]>([]);
  const [teamsLoading, setTeamsLoading] = useState(false);
  const [selectedTeam, setSelectedTeam] = useState<TeamWithMembers | null>(null);
  const [selectedTeamPayment, setSelectedTeamPayment] = useState<AdminPayment | null>(null);
  const [hoveredTeamId, setHoveredTeamId] = useState<string | null>(null);

  // Plan management state
  const [planSummary, setPlanSummary] = useState<AdminPlanStatsResponse | null>(null);
  const [planPayments, setPlanPayments] = useState<AdminPayment[]>([]);
  const [planPaymentsLoading, setPlanPaymentsLoading] = useState(false);
  // Map teamId -> leader info để hiển thị người mua
const [teamLeadersMap, setTeamLeadersMap] = useState<Record<string, { name: string; email: string; avatarUrl?: string }>>({});

  const [activeTab, setActiveTab] = useState<'users' | 'teams' | 'plans'>(initialTab);

  const fetchUsers = async (q?: string) => {
    try {
      setUsersLoading(true);
      const res = await adminService.listUsers({ page: 1, limit: 50, q });
      const users = Array.isArray(res.data.items) ? res.data.items : [];
      setUsers(users);
      if (!selectedUser && users.length > 0) {
        setSelectedUser(users[0]);
      }
    } catch (err) {
      console.error('Failed to fetch users:', err);
      setUsers([]);
    } finally {
      setUsersLoading(false);
    }
  };

  const fetchTeams = async () => {
    try {
      setTeamsLoading(true);
      const res = await adminService.listTeams({ page: 1, limit: 50 });
      const teams = Array.isArray(res.data.items) ? res.data.items : [];
      setTeams(teams);
      if (!selectedTeam && teams.length > 0) {
        // Không tự động fetch members khi load lần đầu để tránh lỗi
        setSelectedTeam({ ...teams[0], membersDetailed: [] } as TeamWithMembers);
      }
    } catch (err) {
      console.error('Failed to fetch teams:', err);
      setTeams([]);
    } finally {
      setTeamsLoading(false);
    }
  };

  const fetchTeamMembers = async (team: Team) => {
    try {
      const res = await adminService.getTeamMembers(team._id);
      const members = Array.isArray(res.data) ? res.data : [];
      setSelectedTeam({ ...team, membersDetailed: members });
      
      // Fetch payment SUCCESS đầu tiên để lấy ngày mua
      try {
        const paymentsRes = await adminService.listPlanPayments({ page: 1, limit: 100, status: 'SUCCESS' });
        const teamPayment = paymentsRes.data.items.find(
          (p) => p.team?._id === team._id
        );
        setSelectedTeamPayment(teamPayment || null);
      } catch (err) {
        console.warn('Failed to fetch team payment:', err);
        setSelectedTeamPayment(null);
      }
    } catch (err) {
      console.error('Failed to fetch team members:', err);
      setSelectedTeam({ ...team, membersDetailed: [] } as TeamWithMembers);
      setSelectedTeamPayment(null);
    }
  };

  const fetchPlanSummary = async () => {
    try {
      const res = await adminService.getPlanSummary();
      setPlanSummary(res.data);
    } catch {
      // ignore
    }
  };

  const fetchPlanPayments = async () => {
    try {
      setPlanPaymentsLoading(true);
      const res = await adminService.listPlanPayments({ page: 1, limit: 100 });
      setPlanPayments(res.data.items);
      
      // Fetch team leaders cho các payment
      const teamIds = new Set<string>();
      res.data.items.forEach((payment) => {
        if (payment.team?._id) {
          teamIds.add(payment.team._id);
        }
      });
      
      // Fetch leaders cho từng team
      const leadersMap: Record<string, { name: string; email: string; avatarUrl?: string }> = {};
      await Promise.all(
        Array.from(teamIds).map(async (teamId) => {
          try {
            const membersRes = await adminService.getTeamMembers(teamId);
            const members = Array.isArray(membersRes.data) ? membersRes.data : [];
            const leader = members.find((m) => m.role === 'leader');
            if (leader) {
              const user = typeof leader.user === 'string' 
                ? { _id: leader.user } 
                : (leader.user || {}) as any;
              leadersMap[teamId] = {
                name: user?.name || user?.email || '—',
                email: user?.email || '—',
                // Ưu tiên avatarUrl, fallback về avatar (nếu backend trả về trường avatar)
                avatarUrl: user?.avatarUrl || user?.avatar,
              };
            }
          } catch (err) {
            console.warn(`Failed to fetch leader for team ${teamId}:`, err);
            // ignore - không block UI
          }
        })
      );
      setTeamLeadersMap((prev) => ({ ...prev, ...leadersMap }));
    } finally {
      setPlanPaymentsLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
    fetchTeams();
    fetchPlanSummary();
    fetchPlanPayments();
  }, []);

  // Đồng bộ tab với query string (?tab=users|teams)
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const tab = params.get('tab') as 'users' | 'teams' | 'plans' | null;
    if (tab && (tab === 'users' || tab === 'teams' || tab === 'plans')) {
      setActiveTab(tab);
    }
  }, [location.search]);

  const handleTabChange = (key: string) => {
    const tabKey = (key === 'teams' ? 'teams' : key === 'plans' ? 'plans' : 'users') as
      | 'users'
      | 'teams'
      | 'plans';
    setActiveTab(tabKey);

    const params = new URLSearchParams(location.search);
    params.set('tab', tabKey);
    navigate({ pathname: ROUTES.ADMIN, search: `?${params.toString()}` }, { replace: true });
  };

  const userColumns: ColumnsType<AdminUser> = [
    {
      title: 'Tên',
      dataIndex: 'name',
      key: 'name',
      render: (text, record) => {
        const displayName = text || record.email || '?';
        const initial = displayName[0];
        return (
          <Space>
            <Avatar src={record.avatarUrl}>{initial}</Avatar>
            <span>{displayName || '—'}</span>
          </Space>
        );
      },
    },
    {
      title: 'Email',
      dataIndex: 'email',
      key: 'email',
    },
    {
      title: 'Quyền',
      dataIndex: 'isAdmin',
      key: 'isAdmin',
      render: (isAdmin: boolean) =>
        isAdmin ? <Tag color="red">Admin</Tag> : <Tag color="blue">User</Tag>,
    },
  ];

  const teamColumns: ColumnsType<Team> = [
    {
      title: 'Tên team',
      dataIndex: 'name',
      key: 'name',
    },
    {
      title: 'Slug',
      dataIndex: 'slug',
      key: 'slug',
    },
    {
      title: 'Gói',
      dataIndex: 'plan',
      key: 'plan',
      render: (plan?: Team['plan']) =>
        plan === 'PREMIUM' ? <Tag color="gold">PREMIUM</Tag> : <Tag>FREE</Tag>,
    },
    {
      title: 'Trạng thái',
      dataIndex: 'isArchived',
      key: 'isArchived',
      render: (isArchived?: boolean) =>
        isArchived ? <Tag color="default">Đã lưu trữ</Tag> : <Tag color="green">Đang hoạt động</Tag>,
    },
  ];

  const paymentColumns: ColumnsType<AdminPayment> = [
    {
      title: 'Thời gian',
      dataIndex: 'createdAt',
      key: 'createdAt',
      render: (value?: string) =>
        value ? new Date(value).toLocaleString('vi-VN') : '—',
    },
    {
      title: 'Team',
      dataIndex: 'team',
      key: 'team',
      render: (team) => (team ? `${team.name} (${team.slug})` : '—'),
    },
    {
      title: 'Người mua (Leader)',
      key: 'buyer',
      render: (_, record) => {
        try {
          const teamId = record.team?._id;
          if (!teamId) return '—';
          const leader = teamLeadersMap[teamId];
          if (leader && leader.name) {
            const avatarChar = leader.name.length > 0 ? leader.name[0].toUpperCase() : '?';
            return (
              <Space>
                <Avatar size="small" src={leader.avatarUrl}>{avatarChar}</Avatar>
                <div>
                  <div style={{ fontWeight: 500 }}>{leader.name}</div>
                  <div style={{ fontSize: '12px', color: '#999' }}>{leader.email || '—'}</div>
                </div>
              </Space>
            );
          }
          return <Text type="secondary">Đang tải...</Text>;
        } catch (err) {
          console.error('Error rendering buyer:', err, record);
          return <Text type="secondary">Lỗi</Text>;
        }
      },
    },
    {
      title: 'Số tiền',
      dataIndex: 'amount',
      key: 'amount',
      render: (amount: number, record) =>
        `${amount.toLocaleString('vi-VN')} ${record.currency || 'VND'}`,
    },
    {
      title: 'Trạng thái',
      dataIndex: 'status',
      key: 'status',
      render: (status: AdminPayment['status']) => {
        if (status === 'SUCCESS') return <Tag color="green">Thành công</Tag>;
        if (status === 'FAILED') return <Tag color="red">Thất bại</Tag>;
        if (status === 'CANCELLED') return <Tag>Đã huỷ</Tag>;
        return <Tag color="blue">Đang chờ</Tag>;
      },
    },
    {
      title: 'Provider',
      dataIndex: 'provider',
      key: 'provider',
    },
    {
      title: 'Mã giao dịch',
      dataIndex: 'transactionId',
      key: 'transactionId',
    },
  ];

  return (
    <div className="p-3 sm:p-4 md:p-6" style={{ minHeight: '100vh', overflowX: 'hidden', width: '100%', maxWidth: '100%' }}>
      <style>{`
        .admin-row-default {
          cursor: pointer !important;
        }
        .admin-row-hovered {
          cursor: pointer !important;
          background-color: #f0f9ff !important;
          border-left: 3px solid #91d5ff !important;
          transition: background-color 0.2s ease, border-left 0.2s ease !important;
        }
        .admin-row-selected {
          cursor: pointer !important;
          background-color: #e6f7ff !important;
          border-left: 3px solid #1890ff !important;
          transition: background-color 0.2s ease, border-left 0.2s ease !important;
        }
        .admin-row-hovered:hover {
          background-color: #e0f2fe !important;
          border-left: 3px solid #40a9ff !important;
        }
        .ant-table-tbody > tr.admin-row-hovered:hover > td {
          background-color: #f0f9ff !important;
        }
        .ant-table-tbody > tr.admin-row-selected > td {
          background-color: #e6f7ff !important;
        }
        .ant-table-tbody > tr.admin-row-hovered > td {
          background-color: #f0f9ff !important;
        }
        .admin-table-wrapper {
          overflow-x: auto !important;
          overflow-y: hidden !important;
          width: 100% !important;
          max-width: 100% !important;
          -webkit-overflow-scrolling: touch;
        }
        .admin-table-wrapper .ant-table {
          min-width: 600px;
        }
        .admin-table-wrapper .ant-table-container {
          overflow-x: auto !important;
        }
        @media (max-width: 768px) {
          .admin-table-wrapper .ant-table {
            min-width: 800px;
          }
        }
      `}</style>
      <Title level={3} className="mb-4">
        Quản trị hệ thống
      </Title>

      <Card>
        <Tabs 
          activeKey={activeTab} 
          onChange={handleTabChange}
          items={[
            {
              key: 'users',
              label: 'Quản lý người dùng',
              children: (
                <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
                  <div className="xl:col-span-2 w-full overflow-hidden">
                    <div className="mb-3 flex flex-wrap gap-2">
                      <Search
                        placeholder="Tìm theo tên hoặc email"
                        allowClear
                        onSearch={(value) => {
                          fetchUsers(value || undefined);
                        }}
                        className="w-full sm:w-auto sm:min-w-[200px] sm:max-w-[320px]"
                      />
                    </div>
                    <div className="admin-table-wrapper">
                      <Table
                        rowKey="_id"
                        columns={userColumns}
                        dataSource={users}
                        loading={usersLoading}
                        pagination={false}
                        scroll={{ y: 'calc(100vh - 400px)', x: 'max-content' }}
                        onRow={(record) => {
                          return {
                            onClick: () => setSelectedUser(record),
                            onMouseEnter: () => setHoveredUserId(record._id),
                            onMouseLeave: () => setHoveredUserId(null),
                          };
                        }}
                        rowClassName={(record) => {
                          const isSelected = selectedUser?._id === record._id;
                          const isHovered = hoveredUserId === record._id;
                          if (isSelected) return 'admin-row-selected';
                          if (isHovered) return 'admin-row-hovered';
                          return 'admin-row-default';
                        }}
                        size="middle"
                      />
                    </div>
                  </div>

                  <div className="w-full xl:w-auto">
                    <Card title="Thông tin người dùng" size="small" className="w-full">
                      {selectedUser ? (
                        <Descriptions column={1} size="small">
                          <Descriptions.Item label="Tên">
                            {selectedUser.name || '—'}
                          </Descriptions.Item>
                          <Descriptions.Item label="Email">
                            {selectedUser.email}
                          </Descriptions.Item>
                          <Descriptions.Item label="Quyền">
                            {selectedUser.isAdmin ? (
                              <Tag color="red">Admin</Tag>
                            ) : (
                              <Tag color="blue">User</Tag>
                            )}
                          </Descriptions.Item>
                          <Descriptions.Item label="Tham gia từ">
                            {selectedUser.createdAt
                              ? new Date(selectedUser.createdAt).toLocaleString()
                              : '—'}
                          </Descriptions.Item>
                        </Descriptions>
                      ) : (
                        <Text type="secondary">Chọn 1 người dùng để xem chi tiết</Text>
                      )}
                    </Card>
                  </div>
                </div>
              ),
            },
            {
              key: 'teams',
              label: 'Quản lý team',
              children: (
                <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
                  <div className="xl:col-span-2 w-full overflow-hidden">
                    <div className="admin-table-wrapper">
                      <Table
                        rowKey="_id"
                        columns={teamColumns}
                        dataSource={teams}
                        loading={teamsLoading}
                        pagination={false}
                        scroll={{ y: 'calc(100vh - 400px)', x: 'max-content' }}
                        onRow={(record) => {
                          return {
                            onClick: () => fetchTeamMembers(record),
                            onMouseEnter: () => setHoveredTeamId(record._id),
                            onMouseLeave: () => setHoveredTeamId(null),
                          };
                        }}
                        rowClassName={(record) => {
                          const isSelected = selectedTeam?._id === record._id;
                          const isHovered = hoveredTeamId === record._id;
                          if (isSelected) return 'admin-row-selected';
                          if (isHovered) return 'admin-row-hovered';
                          return 'admin-row-default';
                        }}
                        size="middle"
                      />
                    </div>
                  </div>

                  <div className="w-full xl:w-auto">
                    <Space direction="vertical" className="w-full" size="middle">
                      {/* Thông tin gói */}
                      <Card title="Thông tin gói" size="small">
                        {selectedTeam ? (
                          <Descriptions column={1} size="small">
                            <Descriptions.Item label="Gói">
                              {selectedTeam.plan === 'PREMIUM' ? (
                                <Tag color="gold">PREMIUM</Tag>
                              ) : (
                                <Tag>FREE</Tag>
                              )}
                            </Descriptions.Item>
                            {selectedTeamPayment && (
                              <Descriptions.Item label="Ngày mua">
                                {selectedTeamPayment.paidAt
                                  ? new Date(selectedTeamPayment.paidAt).toLocaleString('vi-VN')
                                  : selectedTeamPayment.createdAt
                                  ? new Date(selectedTeamPayment.createdAt).toLocaleString('vi-VN')
                                  : '—'}
                              </Descriptions.Item>
                            )}
                            <Descriptions.Item label="Ngày hết hạn">
                              {selectedTeam.planExpiredAt
                                ? new Date(selectedTeam.planExpiredAt).toLocaleString('vi-VN')
                                : '—'}
                            </Descriptions.Item>
                          </Descriptions>
                        ) : (
                          <Text type="secondary">Chọn 1 team để xem thông tin gói</Text>
                        )}
                      </Card>

                      {/* Thành viên team */}
                      <Card title="Thành viên team" size="small">
                        {selectedTeam ? (
                          <List
                            dataSource={selectedTeam.membersDetailed || []}
                            locale={{ emptyText: 'Chưa có dữ liệu thành viên' }}
                            style={{ maxHeight: 400, overflowY: 'auto' }}
                            renderItem={(m) => {
                              try {
                                const u = typeof m.user === 'string' ? { _id: m.user } : (m.user || {}) as any;
                                const displayName = u?.name || u?.email || u?._id || 'Unknown';
                                const email = u?.email || '—';
                                const avatarChar = displayName && displayName.length > 0 ? displayName[0].toUpperCase() : '?';
                                const memberId = (m as any)?._id || u?._id || Math.random().toString();
                                
                                return (
                                  <List.Item key={memberId}>
                                    <List.Item.Meta
                                      avatar={<Avatar src={u?.avatarUrl}>{avatarChar}</Avatar>}
                                      title={displayName}
                                      description={
                                        <>
                                          <div>{email}</div>
                                          <Tag
                                            color={
                                              m.role === 'leader'
                                                ? 'gold'
                                                : m.role === 'admin'
                                                ? 'blue'
                                                : 'default'
                                            }
                                          >
                                            {m.role || 'member'}
                                          </Tag>
                                        </>
                                      }
                                    />
                                  </List.Item>
                                );
                              } catch (err) {
                                console.error('Error rendering member:', err, m);
  return (
                                  <List.Item key={Math.random().toString()}>
                                    <List.Item.Meta
                                      avatar={<Avatar>?</Avatar>}
                                      title="Error loading member"
                                      description={<Tag>Error</Tag>}
                                    />
                                  </List.Item>
                                );
                              }
                            }}
                          />
                        ) : (
                          <Text type="secondary">Chọn 1 team để xem thành viên</Text>
                        )}
                      </Card>
                    </Space>
                  </div>
                </div>
              ),
            },
            {
              key: 'plans',
              label: 'Quản lý gói',
              children: (
                <Space direction="vertical" className="w-full" size="large">
                  {/* Summary cards */}
                  <Row gutter={[16, 16]}>
                    <Col xs={24} sm={12} md={6}>
                      <Card>
                        <Statistic
                          title="Tổng số team"
                          value={planSummary?.planStats.totalTeams ?? 0}
                        />
                      </Card>
                    </Col>
                    <Col xs={24} sm={12} md={6}>
                      <Card>
                        <Statistic
                          title="Team FREE"
                          value={planSummary?.planStats.freeTeams ?? 0}
                        />
                      </Card>
                    </Col>
                    <Col xs={24} sm={12} md={6}>
                      <Card>
                        <Statistic
                          title="Team PREMIUM"
                          value={planSummary?.planStats.premiumTeams ?? 0}
                        />
                      </Card>
                    </Col>
                    <Col xs={24} sm={12} md={6}>
                      <Card>
                        <Statistic
                          title="Premium còn hiệu lực"
                          value={planSummary?.planStats.activePremiumTeams ?? 0}
                        />
                      </Card>
                    </Col>
                  </Row>

                  <Row gutter={[16, 16]}>
                    <Col xs={24} sm={24} md={8}>
                      <Card>
                        <Statistic
                          title="Tổng doanh thu (VND)"
                          value={planSummary?.revenueStats.totalRevenue ?? 0}
                        />
                      </Card>
                    </Col>
                    <Col xs={24} sm={12} md={8}>
                      <Card>
                        <Statistic
                          title="Thanh toán thành công"
                          value={planSummary?.revenueStats.successPayments ?? 0}
                        />
                      </Card>
                    </Col>
                    <Col xs={24} sm={12} md={8}>
      <Card>
                        <Statistic
                          title="Thanh toán thất bại / huỷ"
                          value={
                            (planSummary?.revenueStats.failedPayments ?? 0) +
                            (planSummary?.revenueStats.pendingPayments ?? 0)
                          }
                        />
                      </Card>
                    </Col>
                  </Row>

                  {/* Payments list */}
                  <Card title="Lịch sử thanh toán gói PREMIUM" className="w-full">
                    <div className="admin-table-wrapper">
                      <Table
                        rowKey="_id"
                        columns={paymentColumns}
                        dataSource={planPayments}
                        loading={planPaymentsLoading}
                        pagination={false}
                        scroll={{ y: 'calc(100vh - 600px)', x: 'max-content' }}
                        size="middle"
                      />
                    </div>
                  </Card>
                </Space>
              ),
            },
          ]}
        />
      </Card>
    </div>
  );
}
