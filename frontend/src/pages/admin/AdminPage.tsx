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
} from 'antd';
import type { ColumnsType } from 'antd/es/table';

import adminService, { type AdminUser } from '@/services/adminService';
import type { Team, TeamMember } from '@/services/teamService';
import { useLocation, useNavigate } from 'react-router-dom';
import { ROUTES } from '@/routes/path';

const { Title, Text } = Typography;
const { TabPane } = Tabs;
const { Search } = Input;

interface TeamWithMembers extends Team {
  membersDetailed?: TeamMember[];
}

export default function AdminPage() {
  const location = useLocation();
  const navigate = useNavigate();

  const searchParams = new URLSearchParams(location.search);
  const initialTab = (searchParams.get('tab') as 'users' | 'teams') || 'users';

  const [users, setUsers] = useState<AdminUser[]>([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [selectedUser, setSelectedUser] = useState<AdminUser | null>(null);
  const [userSearch, setUserSearch] = useState('');

  const [teams, setTeams] = useState<TeamWithMembers[]>([]);
  const [teamsLoading, setTeamsLoading] = useState(false);
  const [selectedTeam, setSelectedTeam] = useState<TeamWithMembers | null>(null);
  const [activeTab, setActiveTab] = useState<'users' | 'teams'>(initialTab);

  const fetchUsers = async (q?: string) => {
    try {
      setUsersLoading(true);
      const res = await adminService.listUsers({ page: 1, limit: 50, q });
      setUsers(res.data.items);
      if (!selectedUser && res.data.items.length > 0) {
        setSelectedUser(res.data.items[0]);
      }
    } finally {
      setUsersLoading(false);
    }
  };

  const fetchTeams = async () => {
    try {
      setTeamsLoading(true);
      const res = await adminService.listTeams({ page: 1, limit: 50 });
      setTeams(res.data.items);
      if (!selectedTeam && res.data.items.length > 0) {
        setSelectedTeam(res.data.items[0]);
      }
    } finally {
      setTeamsLoading(false);
    }
  };

  const fetchTeamMembers = async (team: Team) => {
    try {
      const res = await adminService.getTeamMembers(team._id);
      setSelectedTeam({ ...team, membersDetailed: res.data });
    } catch {
      setSelectedTeam(team as TeamWithMembers);
    }
  };

  useEffect(() => {
    fetchUsers();
    fetchTeams();
  }, []);

  // Đồng bộ tab với query string (?tab=users|teams)
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const tab = params.get('tab') as 'users' | 'teams' | null;
    if (tab && (tab === 'users' || tab === 'teams')) {
      setActiveTab(tab);
    }
  }, [location.search]);

  const handleTabChange = (key: string) => {
    const tabKey = (key === 'teams' ? 'teams' : 'users') as 'users' | 'teams';
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
      render: (text, record) => (
        <Space>
          <Avatar>{(text || record.email || '?')[0]}</Avatar>
          <span>{text || '—'}</span>
        </Space>
      ),
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
      title: 'Trạng thái',
      dataIndex: 'isArchived',
      key: 'isArchived',
      render: (isArchived?: boolean) =>
        isArchived ? <Tag color="default">Đã lưu trữ</Tag> : <Tag color="green">Đang hoạt động</Tag>,
    },
  ];

  return (
    <div className="p-6">
      <Title level={3} className="mb-4">
        Quản trị hệ thống
      </Title>

      <Card>
        <Tabs activeKey={activeTab} onChange={handleTabChange}>
          <TabPane tab="Quản lý người dùng" key="users">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              <div className="lg:col-span-2">
                <div className="mb-3 flex justify-between">
                  <Search
                    placeholder="Tìm theo tên hoặc email"
                    allowClear
                    onSearch={(value) => {
                      setUserSearch(value);
                      fetchUsers(value || undefined);
                    }}
                    style={{ maxWidth: 320 }}
                  />
                </div>
                <Table
                  rowKey="_id"
                  columns={userColumns}
                  dataSource={users}
                  loading={usersLoading}
                  pagination={false}
                  onRow={(record) => ({
                    onClick: () => setSelectedUser(record),
                  })}
                  rowClassName={(record) =>
                    selectedUser?._id === record._id ? 'bg-blue-50 cursor-pointer' : 'cursor-pointer'
                  }
                  size="middle"
                />
              </div>

              <div>
                <Card title="Thông tin người dùng" size="small">
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
          </TabPane>

          <TabPane tab="Quản lý team" key="teams">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              <div className="lg:col-span-2">
                <Table
                  rowKey="_id"
                  columns={teamColumns}
                  dataSource={teams}
                  loading={teamsLoading}
                  pagination={false}
                  onRow={(record) => ({
                    onClick: () => fetchTeamMembers(record),
                  })}
                  rowClassName={(record) =>
                    selectedTeam?._id === record._id ? 'bg-blue-50 cursor-pointer' : 'cursor-pointer'
                  }
                  size="middle"
                />
              </div>

              <div>
                <Card title="Thành viên team" size="small">
                  {selectedTeam ? (
                    <List
                      dataSource={selectedTeam.membersDetailed || []}
                      locale={{ emptyText: 'Chưa có dữ liệu thành viên' }}
                      renderItem={(m) => {
                        const u = m.user as any;
                        const displayName = u?.name || u?.email || u?._id || '—';
                        return (
                          <List.Item>
                            <List.Item.Meta
                              avatar={<Avatar>{displayName[0]}</Avatar>}
                              title={displayName}
                              description={
                                <>
                                  <div>{u?.email}</div>
                                  <Tag
                                    color={
                                      m.role === 'leader'
                                        ? 'gold'
                                        : m.role === 'admin'
                                        ? 'blue'
                                        : 'default'
                                    }
                                  >
                                    {m.role}
                                  </Tag>
                                </>
                              }
                            />
                          </List.Item>
                        );
                      }}
                    />
                  ) : (
                    <Text type="secondary">Chọn 1 team để xem thành viên</Text>
                  )}
                </Card>
              </div>
            </div>
          </TabPane>
        </Tabs>
      </Card>
    </div>
  );
}
