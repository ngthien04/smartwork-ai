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
} from 'antd';
import { UserAddOutlined, TeamOutlined } from '@ant-design/icons';
import { DEFAULT_TEAM_ID, mockTeams, mockUsers } from '@/data/mockData';

const { Title, Text } = Typography;

export default function TeamManagementPage() {
  const { teamId } = useParams();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('member');
  const team = useMemo(
    () => mockTeams.find((item) => item.id === (teamId || DEFAULT_TEAM_ID)),
    [teamId],
  );

  const dataSource =
    team?.members?.map((member) => {
      const user = mockUsers.find((u) => u.id === member.user);
      return {
        key: member.user,
        name: user?.name,
        email: user?.email,
        role: member.role,
        joinedAt: member.joinedAt,
      };
    }) ?? [];

  return (
    <div className="space-y-4">
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
        <div>
          <Title level={2} className="m-0">
            Quản lý thành viên
          </Title>
          <Text type="secondary">Team: {team?.name ?? 'Chưa xác định'}</Text>
        </div>
        <Button icon={<TeamOutlined />} onClick={() => navigate('/projects')}>
          Xem dự án liên quan
        </Button>
      </div>

      <Row gutter={[16, 16]}>
        <Col xs={12} md={6}>
          <Card>
            <Statistic title="Tổng thành viên" value={dataSource.length} />
          </Card>
        </Col>
        <Col xs={12} md={6}>
          <Card>
            <Statistic title="Leader/Admin" value={1} />
          </Card>
        </Col>
        <Col xs={12} md={6}>
          <Card>
            <Statistic title="Lời mời đang chờ" value={2} />
          </Card>
        </Col>
        <Col xs={12} md={6}>
          <Card>
            <Statistic title="Vai trò AI gợi ý" value="1 nâng cấp" />
          </Card>
        </Col>
      </Row>

      <Row gutter={[16, 16]}>
        <Col xs={24} lg={16}>
          <Card
            title="Danh sách thành viên"
            extra={<Text type="secondary">{dataSource.length} người</Text>}
          >
            <Table
              pagination={false}
              dataSource={dataSource}
              columns={[
                { title: 'Tên', dataIndex: 'name' },
                { title: 'Email', dataIndex: 'email' },
                {
                  title: 'Vai trò',
                  dataIndex: 'role',
                  render: (roleValue: string) => (
                    <Tag color={roleValue === 'leader' ? 'gold' : roleValue === 'admin' ? 'blue' : 'default'}>
                      {roleValue}
                    </Tag>
                  ),
                },
                { title: 'Tham gia', dataIndex: 'joinedAt', render: (value) => new Date(value).toLocaleDateString() },
                {
                  title: 'Thao tác',
                  render: () => (
                    <Space>
                      <Button size="small">Đổi vai trò</Button>
                      <Button size="small" danger>
                        Gỡ
                      </Button>
                    </Space>
                  ),
                },
              ]}
            />
            <Alert
              className="mt-3"
              type="warning"
              message="warning nè."
              showIcon
            />
          </Card>
        </Col>
        <Col xs={24} lg={8}>
          <Card title="Mời thành viên mới" actions={[<Button key="invite" type="primary" icon={<UserAddOutlined />} disabled>Gửi lời mời</Button>]}>
            <Space direction="vertical" className="w-full">
              <Input
                placeholder="Email thành viên"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
              />
              <Select value={role} onChange={(value) => setRole(value)} className="w-full">
                <Select.Option value="member">Member</Select.Option>
                <Select.Option value="admin">Admin</Select.Option>
                <Select.Option value="leader">Leader</Select.Option>
              </Select>
            </Space>
          </Card>
        </Col>
      </Row>
    </div>
  );
}

