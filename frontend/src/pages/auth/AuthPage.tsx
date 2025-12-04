import React, { useState, useEffect } from 'react';
import { Row, Col, Card, Form, Input, Button, Typography, Tabs, message } from 'antd';
import { UserOutlined, LockOutlined, MailOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { setCredentials } from '@/store/slices/authSlice';
import { ROUTES } from '@/routes/path';
import { authService, type AuthResponse } from '@/services/authService';
import type { RootState, User } from '@/types';

const { Title, Text } = Typography;

export default function AuthPage() {
  const { t } = useTranslation();
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const { user, token } = useSelector((state: RootState) => state.auth);

  
  const isTokenExpired = (token: string | null) => {
    if (!token) return true;
    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      return payload.exp * 1000 < Date.now();
    } catch {
      return true;
    }
  };

  useEffect(() => {
    
    if (user && token && !isTokenExpired(token)) {
      navigate(user.isAdmin ? ROUTES.ADMIN : ROUTES.DASHBOARD, { replace: true });
    }
  }, [user, token, navigate]);

  const mapResponseToUser = (response: AuthResponse): User => ({
    id: response.id,
    email: response.email,
    name: response.name,
    avatar: response.avatarUrl,
    avatarUrl: response.avatarUrl,
    isAdmin: response.isAdmin,
  });

  const redirectAfterAuth = (isAdmin: boolean) => {
    navigate(isAdmin ? ROUTES.ADMIN : ROUTES.DASHBOARD, { replace: true });
  };

  const handleLogin = async (values: any) => {
    setLoading(true);
    try {
      const response = await authService.login({
        email: values.email,
        password: values.password,
      });

      const user = mapResponseToUser(response);
      dispatch(setCredentials({ user, token: response.token }));
      message.success(t('auth.loginSuccess') || 'Đăng nhập thành công');
      redirectAfterAuth(response.isAdmin);
    } catch (error: any) {
      const errorMessage = error.response?.data || error.message || 'Đăng nhập thất bại';
      message.error(typeof errorMessage === 'string' ? errorMessage : 'Đăng nhập thất bại');
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (values: any) => {
    setLoading(true);
    try {
      const response = await authService.register({
        name: values.name,
        email: values.email,
        password: values.password,
        address: values.address || '',
      });

      const user = mapResponseToUser(response);
      dispatch(setCredentials({ user, token: response.token }));
      message.success(t('auth.registerSuccess') || 'Đăng ký thành công');
      redirectAfterAuth(response.isAdmin);
    } catch (error: any) {
      const errorMessage = error.response?.data || error.message || 'Đăng ký thất bại';
      message.error(typeof errorMessage === 'string' ? errorMessage : 'Đăng ký thất bại');
    } finally {
      setLoading(false);
    }
  };

  const LoginForm = () => (
    <Form layout="vertical" onFinish={handleLogin} size="large">
      <Form.Item
        name="email"
        label={t('auth.email')}
        rules={[
          { required: true, message: 'Vui lòng nhập email' },
          { type: 'email', message: 'Email không hợp lệ' },
        ]}
      >
        <Input prefix={<MailOutlined />} placeholder="Nhập email của bạn" />
      </Form.Item>

      <Form.Item
        name="password"
        label={t('auth.password')}
        rules={[{ required: true, message: 'Vui lòng nhập mật khẩu' }]}
      >
        <Input.Password prefix={<LockOutlined />} placeholder="Nhập mật khẩu" />
      </Form.Item>

      <Form.Item>
        <Button type="primary" htmlType="submit" loading={loading} className="w-full">
          {t('auth.login')}
        </Button>
      </Form.Item>

      <div className="text-center">
        <Button type="link" className="p-0" onClick={() => navigate(ROUTES.RESET_PASSWORD)}>
          {t('auth.forgotPassword')}
        </Button>
      </div>
    </Form>
  );

  const RegisterForm = () => (
    <Form layout="vertical" onFinish={handleRegister} size="large">
      <Form.Item
        name="name"
        label={t('auth.name')}
        rules={[{ required: true, message: 'Vui lòng nhập tên' }]}
      >
        <Input prefix={<UserOutlined />} placeholder="Nhập tên của bạn" />
      </Form.Item>

      <Form.Item
        name="email"
        label={t('auth.email')}
        rules={[
          { required: true, message: 'Vui lòng nhập email' },
          { type: 'email', message: 'Email không hợp lệ' },
        ]}
      >
        <Input prefix={<MailOutlined />} placeholder="Nhập email của bạn" />
      </Form.Item>

      <Form.Item
        name="password"
        label={t('auth.password')}
        rules={[{ required: true, message: 'Vui lòng nhập mật khẩu' }]}
      >
        <Input.Password prefix={<LockOutlined />} placeholder="Nhập mật khẩu" />
      </Form.Item>

      <Form.Item
        name="confirmPassword"
        label={t('auth.confirmPassword')}
        dependencies={['password']}
        rules={[
          { required: true, message: 'Vui lòng xác nhận mật khẩu' },
          ({ getFieldValue }) => ({
            validator(_, value) {
              if (!value || getFieldValue('password') === value) {
                return Promise.resolve();
              }
              return Promise.reject(new Error('Mật khẩu xác nhận không khớp'));
            },
          }),
        ]}
      >
        <Input.Password prefix={<LockOutlined />} placeholder="Xác nhận mật khẩu" />
      </Form.Item>

      <Form.Item>
        <Button type="primary" htmlType="submit" loading={loading} className="w-full">
          {t('auth.register')}
        </Button>
      </Form.Item>
    </Form>
  );

  return (
    <div className="auth-page min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <Row justify="center" className="w-full max-w-md">
        <Col span={24}>
          <Card className="shadow-lg">
            <div className="text-center mb-6">
              <Title level={2} className="m-0 text-blue-600">
                SmartWork AI
              </Title>
              <Text type="secondary">Ứng dụng quản lý công việc thông minh với AI</Text>
            </div>

            <Tabs
              defaultActiveKey="login"
              items={[
                { key: 'login', label: t('auth.login'), children: <LoginForm /> },
                { key: 'register', label: t('auth.register'), children: <RegisterForm /> },
              ]}
            />
          </Card>
        </Col>
      </Row>
    </div>
  );
}