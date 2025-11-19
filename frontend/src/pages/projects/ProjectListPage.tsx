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
  Modal,
  Form,
  message,
} from 'antd';
import { PlusOutlined, FolderOpenOutlined } from '@ant-design/icons';
import { mockProjects, mockTasks, mockUsers } from '@/data/mockData';
import projectServices from '@/services/projectService';

const { Title, Text } = Typography;
const { Option } = Select;

export default function ProjectListPage() {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<'all' | 'active' | 'archived'>('all');

  // state cho modal tạo dự án
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [form] = Form.useForm();

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

  // mở modal
  const handleOpenCreateModal = () => {
    form.resetFields();
    form.setFieldsValue({
      name: '',
      key: '',
      description: '',
      lead: undefined,
    });
    setCreateModalOpen(true);
  };

  // bấm OK trong modal
  const handleCreateProject = async () => {
    try {
      const values = await form.validateFields();

      const res = await projectServices.create({
        name: values.name,
        key: values.key,
        description: values.description,
        lead: values.lead,
        // teamId: có thể không truyền, service tự dùng DEFAULT_TEAM_ID
      });

      const created = res.data; // project từ backend

      message.success('Tạo dự án thành công');
      setCreateModalOpen(false);

      // chuyển sang ProjectDetailPage dùng _id từ backend
      navigate(`/projects/${created._id}`);
    } catch (err: any) {
      if (err?.errorFields) {
        // lỗi validate form antd
        return;
      }
      const msg = err?.response?.data || 'Tạo dự án thất bại';
      message.error(String(msg));
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
        <div>
          <Title level={2} className="m-0">
            Danh sách dự án
          </Title>
          <Text type="secondary">
            Data cứng (list đang dùng mock, nút Tạo dự án đã gọi backend)
          </Text>
        </div>
        <Button
          type="primary"
          icon={<PlusOutlined />}
          onClick={handleOpenCreateModal}
        >
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

      {/* Modal tạo dự án */}
      <Modal
        title="Tạo dự án mới"
        open={createModalOpen}
        onCancel={() => setCreateModalOpen(false)}
        onOk={handleCreateProject}
        okText="Tạo dự án"
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

          <Form.Item name="lead" label="Lead (tùy chọn)">
            <Select allowClear placeholder="Chọn người lead">
              {mockUsers.map((user) => (
                <Option key={user.id} value={user.id}>
                  {user.name}
                </Option>
              ))}
            </Select>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
