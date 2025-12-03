
import { useState } from 'react';
import { Row, Col, Card, Switch, Select, Button, Typography, Space, Divider, Modal, Form, Input, message } from 'antd';
import { LogoutOutlined, UserOutlined, GlobalOutlined, BulbOutlined, LockOutlined, EditOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { useSelector, useDispatch } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import type { RootState } from '@/types';
import { setThemeMode } from '@/store/slices/uiSlice';
import { logout, setCredentials } from '@/store/slices/authSlice';
import { authService } from '@/services/authService';
import { ROUTES } from '@/routes/path';

const { Title, Text } = Typography;
const { Option } = Select;

export default function SettingsPage() {
  const { t, i18n } = useTranslation();
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { themeMode } = useSelector((state: RootState) => state.ui);
  const { user } = useSelector((state: RootState) => state.auth);
  const [editProfileModalVisible, setEditProfileModalVisible] = useState(false);
  const [changePasswordModalVisible, setChangePasswordModalVisible] = useState(false);
  const [editForm] = Form.useForm();
  const [passwordForm] = Form.useForm();

  const handleThemeChange = (checked: boolean) => {
    dispatch(setThemeMode(checked ? 'dark' : 'light'));
  };

  const handleLanguageChange = (value: string) => {
    i18n.changeLanguage(value);
  };

  const handleLogout = () => {
    dispatch(logout());
    navigate(ROUTES.AUTH);
  };

  
  const updateProfileMutation = useMutation({
    mutationFn: authService.updateProfile,
    onSuccess: (response) => {
      const updatedUser = {
        id: response.id,
        email: response.email,
        name: response.name,
        avatar: response.avatarUrl,
        avatarUrl: response.avatarUrl,
        isAdmin: response.isAdmin,
      };
      dispatch(setCredentials({ user: updatedUser, token: response.token }));
      message.success('Cập nhật thông tin thành công!');
      setEditProfileModalVisible(false);
      editForm.resetFields();
    },
    onError: (error: any) => {
      message.error(error.response?.data || 'Cập nhật thông tin thất bại');
    },
  });

  
  const changePasswordMutation = useMutation({
    mutationFn: authService.changePassword,
    onSuccess: (response) => {
      const updatedUser = {
        id: response.id,
        email: response.email,
        name: response.name,
        avatar: response.avatarUrl,
        avatarUrl: response.avatarUrl,
        isAdmin: response.isAdmin,
      };
      dispatch(setCredentials({ user: updatedUser, token: response.token }));
      message.success('Đổi mật khẩu thành công!');
      setChangePasswordModalVisible(false);
      passwordForm.resetFields();
    },
    onError: (error: any) => {
      message.error(error.response?.data || 'Đổi mật khẩu thất bại');
    },
  });

  const handleEditProfile = () => {
    editForm.setFieldsValue({
      name: user?.name,
    });
    setEditProfileModalVisible(true);
  };

  const handleSaveProfile = async (values: any) => {
    updateProfileMutation.mutate({
      name: values.name,
    });
  };

  const handleChangePassword = () => {
    passwordForm.resetFields();
    setChangePasswordModalVisible(true);
  };

  const handleSavePassword = async (values: any) => {
    changePasswordMutation.mutate({
      oldPassword: values.oldPassword,
      newPassword: values.newPassword,
    });
  };

  return (
    <div className="settings-page">
      <div className="mb-6">
        <Title level={2} className="m-0">{t('settings.title')}</Title>
        <Text type="secondary">Quản lý cài đặt ứng dụng và tài khoản của bạn</Text>
      </div>

      <Row gutter={[24, 24]}>
        {/* Appearance Settings */}
        <Col xs={24} lg={12}>
          <Card title="Giao diện" className="h-full">
            <Space direction="vertical" className="w-full" size="large">
              <div className="flex justify-between items-center">
                <div>
                  <Text strong>Chế độ tối</Text>
                  <div className="text-sm text-gray-500">
                    Chuyển đổi giữa chế độ sáng và tối
                  </div>
                </div>
                <Switch
                  checked={themeMode === 'dark'}
                  onChange={handleThemeChange}
                />
              </div>

              <Divider />

              <div className="flex justify-between items-center">
                <div>
                  <Text strong>Ngôn ngữ</Text>
                  <div className="text-sm text-gray-500">
                    Chọn ngôn ngữ hiển thị
                  </div>
                </div>
                <Select
                  value={i18n.language}
                  onChange={handleLanguageChange}
                  style={{ width: 120 }}
                >
                  <Option value="vi">Tiếng Việt</Option>
                  <Option value="en">English</Option>
                </Select>
              </div>
            </Space>
          </Card>
        </Col>

        {/* Account Settings */}
        <Col xs={24} lg={12}>
          <Card title="Tài khoản" className="h-full">
            <Space direction="vertical" className="w-full" size="large">
              <div className="flex items-center space-x-3">
                <div className="w-12 h-12 bg-gray-200 rounded-full flex items-center justify-center">
                  <UserOutlined className="text-xl text-gray-500" />
                </div>
                <div>
                  <Text strong className="block">{user?.name || 'User'}</Text>
                  <Text type="secondary" className="text-sm">{user?.email}</Text>
                </div>
              </div>

              <Divider />

              <div className="space-y-3">
                <Button
                  type="text"
                  className="w-full text-left justify-start"
                  icon={<EditOutlined />}
                  onClick={handleEditProfile}
                >
                  Chỉnh sửa thông tin cá nhân
                </Button>
                
                <Button
                  type="text"
                  className="w-full text-left justify-start"
                  icon={<LockOutlined />}
                  onClick={handleChangePassword}
                >
                  Đổi mật khẩu
                </Button>
                
                <Button
                  type="text"
                  className="w-full text-left justify-start"
                  icon={<GlobalOutlined />}
                >
                  Đồng bộ với Google Calendar
                </Button>
                
                <Button
                  type="text"
                  className="w-full text-left justify-start"
                  icon={<BulbOutlined />}
                >
                  Tùy chỉnh AI Assistant
                </Button>
              </div>

              <Divider />

              <Button
                danger
                icon={<LogoutOutlined />}
                onClick={handleLogout}
                className="w-full"
              >
                {t('settings.logout')}
              </Button>
            </Space>
          </Card>
        </Col>

        {/* Notifications Settings */}
        <Col xs={24}>
          <Card title="Thông báo">
            <Row gutter={[24, 24]}>
              <Col xs={24} sm={12}>
                <div className="flex justify-between items-center">
                  <div>
                    <Text strong>Thông báo email</Text>
                    <div className="text-sm text-gray-500">
                      Nhận thông báo qua email
                    </div>
                  </div>
                  <Switch defaultChecked />
                </div>
              </Col>
              
              <Col xs={24} sm={12}>
                <div className="flex justify-between items-center">
                  <div>
                    <Text strong>Thông báo push</Text>
                    <div className="text-sm text-gray-500">
                      Nhận thông báo trên trình duyệt
                    </div>
                  </div>
                  <Switch defaultChecked />
                </div>
              </Col>
              
              <Col xs={24} sm={12}>
                <div className="flex justify-between items-center">
                  <div>
                    <Text strong>Nhắc nhở deadline</Text>
                    <div className="text-sm text-gray-500">
                      Nhắc nhở khi sắp đến hạn
                    </div>
                  </div>
                  <Switch defaultChecked />
                </div>
              </Col>
              
              <Col xs={24} sm={12}>
                <div className="flex justify-between items-center">
                  <div>
                    <Text strong>Thông báo AI</Text>
                    <div className="text-sm text-gray-500">
                      Thông báo từ AI Assistant
                    </div>
                  </div>
                  <Switch defaultChecked />
                </div>
              </Col>
            </Row>
          </Card>
        </Col>
      </Row>

      {/* Edit Profile Modal */}
      <Modal
        title="Chỉnh sửa thông tin cá nhân"
        open={editProfileModalVisible}
        onCancel={() => {
          setEditProfileModalVisible(false);
          editForm.resetFields();
        }}
        footer={null}
      >
        <Form
          form={editForm}
          layout="vertical"
          onFinish={handleSaveProfile}
        >
          <Form.Item
            name="name"
            label="Tên"
            rules={[{ required: true, message: 'Vui lòng nhập tên' }]}
          >
            <Input prefix={<UserOutlined />} placeholder="Nhập tên của bạn" />
          </Form.Item>

          <Form.Item>
            <Space>
              <Button
                type="primary"
                htmlType="submit"
                loading={updateProfileMutation.isPending}
              >
                Lưu
              </Button>
              <Button onClick={() => {
                setEditProfileModalVisible(false);
                editForm.resetFields();
              }}>
                Hủy
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>

      {/* Change Password Modal */}
      <Modal
        title="Đổi mật khẩu"
        open={changePasswordModalVisible}
        onCancel={() => {
          setChangePasswordModalVisible(false);
          passwordForm.resetFields();
        }}
        footer={null}
      >
        <Form
          form={passwordForm}
          layout="vertical"
          onFinish={handleSavePassword}
        >
          <Form.Item
            name="oldPassword"
            label="Mật khẩu cũ"
            rules={[{ required: true, message: 'Vui lòng nhập mật khẩu cũ' }]}
          >
            <Input.Password
              prefix={<LockOutlined />}
              placeholder="Nhập mật khẩu cũ"
            />
          </Form.Item>

          <Form.Item
            name="newPassword"
            label="Mật khẩu mới"
            rules={[
              { required: true, message: 'Vui lòng nhập mật khẩu mới' },
              { min: 6, message: 'Mật khẩu phải có ít nhất 6 ký tự' }
            ]}
          >
            <Input.Password
              prefix={<LockOutlined />}
              placeholder="Nhập mật khẩu mới"
            />
          </Form.Item>

          <Form.Item
            name="confirmPassword"
            label="Xác nhận mật khẩu mới"
            dependencies={['newPassword']}
            rules={[
              { required: true, message: 'Vui lòng xác nhận mật khẩu' },
              ({ getFieldValue }) => ({
                validator(_, value) {
                  if (!value || getFieldValue('newPassword') === value) {
                    return Promise.resolve();
                  }
                  return Promise.reject(new Error('Mật khẩu xác nhận không khớp'));
                },
              }),
            ]}
          >
            <Input.Password
              prefix={<LockOutlined />}
              placeholder="Xác nhận mật khẩu mới"
            />
          </Form.Item>

          <Form.Item>
            <Space>
              <Button
                type="primary"
                htmlType="submit"
                loading={changePasswordMutation.isPending}
              >
                Đổi mật khẩu
              </Button>
              <Button onClick={() => {
                setChangePasswordModalVisible(false);
                passwordForm.resetFields();
              }}>
                Hủy
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
