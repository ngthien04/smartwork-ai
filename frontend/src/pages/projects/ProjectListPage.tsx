import { useMemo, useState } from 'react';
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
} from 'antd';
import { PlusOutlined, FolderOpenOutlined } from '@ant-design/icons';
import { mockProjects, mockTasks, mockUsers } from '@/data/mockData';

const { Title, Text } = Typography;
const { Option } = Select;

export default function ProjectListPage() {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<'all' | 'active' | 'archived'>('all');

  const filteredProjects = useMemo(() => {
    return mockProjects.filter((project) => {
      const matchesSearch =
        project.name.toLowerCase().includes(search.toLowerCase()) ||
        project.key.toLowerCase().includes(search.toLowerCase());
      const matchesStatus =
        status === 'all' ||
        (status === 'active' && !project.isArchived) ||
        (status === 'archived' && !!project.isArchived);
      return matchesSearch && matchesStatus;
    });
  }, [search, status]);

  return (
    <div className="space-y-4">
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
        <div>
          <Title level={2} className="m-0">
            Danh sách dự án
          </Title>
          <Text type="secondary">
            Data cứng
          </Text>
        </div>
        <Button type="primary" icon={<PlusOutlined />} >
          Tạo dự án
        </Button>
      </div>

      <Row gutter={[16, 16]}>
        <Col xs={12} md={6}>
          <Card>
            <Statistic title="Đang hoạt động" value={mockProjects.length - 1} />
          </Card>
        </Col>
        <Col xs={12} md={6}>
          <Card>
            <Statistic title="Hoàn thành sprint gần nhất" value="Sprint 16" />
          </Card>
        </Col>
        <Col xs={12} md={6}>
          <Card>
            <Statistic title="Task mở" value={mockTasks.filter((t) => t.status !== 'done').length} />
          </Card>
        </Col>
        <Col xs={12} md={6}>
          <Card>
            <Statistic title="AI đề xuất" value={3} suffix="/ tuần" />
          </Card>
        </Col>
      </Row>

      <Card>
        <Row gutter={[16, 16]} align="middle">
          <Col xs={24} md={12}>
            <Input
              placeholder="Tìm theo tên hoặc mã dự án..."
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </Col>
          <Col xs={24} md={6}>
            <Select
              value={status}
              onChange={(value) => setStatus(value)}
              className="w-full"
            >
              <Option value="all">Tất cả</Option>
              <Option value="active">Đang hoạt động</Option>
              <Option value="archived">Đã lưu trữ</Option>
            </Select>
          </Col>
          <Col xs={24} md={6} className="text-right">
            <Text type="secondary">Dữ liệu mẫu</Text>
          </Col>
        </Row>
      </Card>

      <Row gutter={[16, 16]}>
        {filteredProjects.map((project) => {
          const openTasks = mockTasks.filter(
            (task) => task.project === project.id && task.status !== 'done',
          ).length;
          const progress = Math.round(
            (mockTasks.filter((task) => task.project === project.id && task.status === 'done').length /
              Math.max(mockTasks.filter((task) => task.project === project.id).length, 1)) *
              100,
          );

          return (
            <Col xs={24} md={12} key={project.id}>
              <Card
                actions={[
                  <Button
                    key="detail"
                    type="link"
                    icon={<FolderOpenOutlined />}
                    onClick={() => navigate(`/projects/${project.id}`)}
                  >
                    Xem chi tiết
                  </Button>,
                ]}
              >
                <Space direction="vertical" className="w-full">
                  <div className="flex items-center justify-between">
                    <div>
                      <Text strong>{project.name}</Text>
                      <div className="text-xs text-gray-500">{project.description}</div>
                    </div>
                    <Tag color={project.isArchived ? 'default' : 'blue'}>
                      {project.isArchived ? 'Archived' : 'Active'}
                    </Tag>
                  </div>
                  <Progress percent={progress} status="active" size="small" />
                  <div className="flex items-center justify-between text-sm text-gray-500">
                    <span>{openTasks} task đang mở</span>
                    <span>
                      Lead:{' '}
                      {mockUsers.find((user) => user.id === project.lead)?.name ?? 'Chưa gán'}
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
    </div>
  );
}

