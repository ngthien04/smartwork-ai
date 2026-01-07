import React, { useState, useEffect } from 'react';
import { Row, Col, Card, Form, Input, Button, Typography, message, Divider, Modal } from 'antd';
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
  const [googleLoading, setGoogleLoading] = useState(false);
  const { user, token } = useSelector((state: RootState) => state.auth);
  const googleButtonRef = React.useRef<HTMLDivElement>(null);
  
  // State cho Modal xác nhận tên Google
  const [showNameConfirmModal, setShowNameConfirmModal] = useState(false);
  const [confirmNameForm] = Form.useForm();
  const [pendingAuthResponse, setPendingAuthResponse] = useState<AuthResponse | null>(null);

  
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


  // Khởi tạo Google Sign-In khi component mount
  useEffect(() => {
    const initGoogleSignIn = () => {
      if (typeof window === 'undefined' || !(window as any).google || !googleButtonRef.current) {
        return;
      }

      const googleClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;
      if (!googleClientId) {
        return;
      }

      const { google } = window as any;
      
      google.accounts.id.initialize({
        client_id: googleClientId,
        callback: async (response: any) => {
          setGoogleLoading(true);
          try {
            // Gọi API đăng nhập Google (backend sẽ verify)
            const authResponse = await authService.googleLogin(response.credential);
            
            // log response để kiểm tra
            // console.log('Google login response:', authResponse);
            
            // Chỉ hiển thị Modal cho user mới (lần đầu đăng nhập)
            if (authResponse.isNewUser) {
              // Sử dụng tên từ backend response (đã được verify đúng UTF-8)
              const googleName = authResponse.name || 'Người dùng';
              
              // console.log('New user - showing name confirmation modal. Google name:', googleName);
              
              // Hiển thị Modal xác nhận tên với tên thật từ Google
              setPendingAuthResponse(authResponse);
              confirmNameForm.setFieldsValue({ name: googleName });
              setShowNameConfirmModal(true);
            } else {
              // User đã tồn tại - đăng nhập trực tiếp không cần Modal
              console.log('Existing user - login directly without modal');
              const user = mapResponseToUser(authResponse);
              dispatch(setCredentials({ user, token: authResponse.token }));
              message.success('Đăng nhập Google thành công');
              redirectAfterAuth(authResponse.isAdmin);
            }
          } catch (error: any) {
            const errorMessage = error.response?.data || error.message || 'Đăng nhập Google thất bại';
            message.error(typeof errorMessage === 'string' ? errorMessage : 'Đăng nhập Google thất bại');
          } finally {
            setGoogleLoading(false);
          }
        },
      });

      // Render Google button vào div
      google.accounts.id.renderButton(googleButtonRef.current, {
        type: 'standard',
        theme: 'outline',
        size: 'large',
        text: 'signin_with',
        width: '100%',
      });
    };

    // Đợi Google script load xong
    const checkGoogle = setInterval(() => {
      if ((window as any).google && googleButtonRef.current) {
        clearInterval(checkGoogle);
        initGoogleSignIn();
      }
    }, 100);

    // Cleanup sau 10 giây
    setTimeout(() => clearInterval(checkGoogle), 10000);

    return () => clearInterval(checkGoogle);
  }, [dispatch, navigate]);

  // Xử lý xác nhận và lưu tên từ Google
  const handleConfirmGoogleName = async () => {
    try {
      const values = await confirmNameForm.validateFields();
      const confirmedName = values.name.trim();

      if (!confirmedName) {
        message.error('Vui lòng nhập tên của bạn');
        return;
      }

      if (!pendingAuthResponse) {
        message.error('Không tìm thấy thông tin đăng nhập');
        setShowNameConfirmModal(false);
        return;
      }

      setGoogleLoading(true);

      // Cập nhật tên người dùng trong Redux + localStorage
      const baseUser = mapResponseToUser(pendingAuthResponse);
      const optimisticUser = { ...baseUser, name: confirmedName };
      dispatch(setCredentials({ user: optimisticUser, token: pendingAuthResponse.token }));

      // Gửi request cập nhật tên lên server (nếu lỗi thì giữ tên ở client, chỉ cảnh báo)
      try {
        message.success('Đã lưu tên người dùng thành công');
        await authService.updateProfile({ name: confirmedName });
      } catch (updateError: any) {
        console.warn('Không thể cập nhật tên lên server:', updateError);
        message.warning('Đăng nhập thành công, nhưng chưa lưu được tên lên server');
      }

      setShowNameConfirmModal(false);
      setPendingAuthResponse(null);
      
      // Chuyển sang trang dashboard/home sau khi xác nhận
      navigate(ROUTES.DASHBOARD, { replace: true });
    } catch (error) {
      // Validation error - không làm gì
    } finally {
      setGoogleLoading(false);
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

      <Divider plain>Hoặc</Divider>

      <Form.Item>
        <div ref={googleButtonRef} className="w-full flex justify-center" style={{ minHeight: '40px' }} />
        {googleLoading && (
          <div className="text-center mt-2">
            <Typography.Text type="secondary">Đang xử lý đăng nhập Google...</Typography.Text>
          </div>
        )}
      </Form.Item>

    </Form>
  );


  return (
    <>
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

              <LoginForm />
            </Card>
          </Col>
        </Row>
      </div>

      {/* Modal xác nhận tên từ Google */}
      <Modal
        title="Xác nhận tên người dùng"
        open={showNameConfirmModal}
        onOk={handleConfirmGoogleName}
        okText="Xác nhận"
        confirmLoading={googleLoading}
        maskClosable={false}
        closable={false}
        cancelButtonProps={{ style: { display: 'none' } }}
      >
        <div className="mb-4">
          <Text>
            Vui lòng xác nhận hoặc chỉnh sửa tên dưới đây:
          </Text>
        </div>
        <Form form={confirmNameForm} layout="vertical">
          <Form.Item
            name="name"
            label="Tên người dùng"
            rules={[
              { required: true, message: 'Vui lòng nhập tên của bạn' },
              { min: 2, message: 'Tên phải có ít nhất 2 ký tự' },
            ]}
          >
            <Input
              prefix={<UserOutlined />}
              placeholder="Nhập tên của bạn"
              autoFocus
              onPressEnter={handleConfirmGoogleName}
            />
          </Form.Item>
        </Form>
        <div className="mt-2">
          <Text type="secondary" className="text-xs">
            Tên này sẽ được hiển thị trong hồ sơ của bạn
          </Text>
        </div>
      </Modal>
    </>
  );
}