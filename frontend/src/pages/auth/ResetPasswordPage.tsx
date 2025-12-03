
import React, { useState } from 'react';
import { Row, Col, Card, Form, Input, Button, Typography, Steps, message } from 'antd';
import { MailOutlined, LockOutlined, CheckCircleOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ROUTES } from '@/routes/path';
import { authService } from '@/services/authService';

const { Title, Text } = Typography;

export default function ResetPasswordPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState(token ? 2 : 1); 
  const [emailSent, setEmailSent] = useState(false);

  const handleForgotPassword = async (values: { email: string }) => {
    setLoading(true);
    try {
      await authService.forgotPassword({ email: values.email });
      setEmailSent(true);
      message.success('Email đặt lại mật khẩu đã được gửi! Vui lòng kiểm tra hộp thư của bạn.');
    } catch (error: any) {
      
      if (error.message?.includes('chưa được triển khai')) {
        message.info('Tính năng này đang được phát triển. Vui lòng liên hệ admin để đặt lại mật khẩu.');
      } else {
        message.error('Có lỗi xảy ra. Vui lòng thử lại sau.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async (values: { newPassword: string; confirmPassword: string }) => {
    if (!token) {
      message.error('Token không hợp lệ');
      return;
    }

    setLoading(true);
    try {
      await authService.resetPassword({
        token,
        newPassword: values.newPassword,
      });
      message.success('Đặt lại mật khẩu thành công!');
      navigate(ROUTES.LOGIN);
    } catch (error: any) {
      if (error.message?.includes('chưa được triển khai')) {
        message.info('Tính năng này đang được phát triển.');
      } else {
        message.error('Có lỗi xảy ra. Vui lòng thử lại sau.');
      }
    } finally {
      setLoading(false);
    }
  };

  const ForgotPasswordForm = () => (
    <Form
      layout="vertical"
      onFinish={handleForgotPassword}
      size="large"
    >
      <Form.Item
        name="email"
        label="Email"
        rules={[
          { required: true, message: 'Vui lòng nhập email' },
          { type: 'email', message: 'Email không hợp lệ' }
        ]}
      >
        <Input
          prefix={<MailOutlined />}
          placeholder="Nhập email của bạn"
        />
      </Form.Item>

      <Form.Item>
        <Button
          type="primary"
          htmlType="submit"
          loading={loading}
          className="w-full"
        >
          Gửi email đặt lại mật khẩu
        </Button>
      </Form.Item>

      <div className="text-center">
        <Button type="link" onClick={() => navigate(ROUTES.LOGIN)}>
          Quay lại đăng nhập
        </Button>
      </div>
    </Form>
  );

  const ResetPasswordForm = () => (
    <Form
      layout="vertical"
      onFinish={handleResetPassword}
      size="large"
    >
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
        label="Xác nhận mật khẩu"
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
        <Button
          type="primary"
          htmlType="submit"
          loading={loading}
          className="w-full"
        >
          Đặt lại mật khẩu
        </Button>
      </Form.Item>

      <div className="text-center">
        <Button type="link" onClick={() => navigate(ROUTES.LOGIN)}>
          Quay lại đăng nhập
        </Button>
      </div>
    </Form>
  );

  return (
    <div className="auth-page min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <Row justify="center" className="w-full max-w-md">
        <Col span={24}>
          <Card className="shadow-lg">
            <div className="text-center mb-6">
              <Title level={2} className="m-0 text-blue-600">
                {step === 1 ? 'Quên mật khẩu' : 'Đặt lại mật khẩu'}
              </Title>
              <Text type="secondary">
                {step === 1
                  ? 'Nhập email để nhận link đặt lại mật khẩu'
                  : 'Nhập mật khẩu mới của bạn'}
              </Text>
            </div>

            <Steps
              current={step - 1}
              items={[
                {
                  title: 'Nhập email',
                  icon: <MailOutlined />,
                },
                {
                  title: 'Đặt lại mật khẩu',
                  icon: <LockOutlined />,
                },
                {
                  title: 'Hoàn thành',
                  icon: <CheckCircleOutlined />,
                },
              ]}
              className="mb-6"
            />

            {step === 1 && !emailSent && <ForgotPasswordForm />}
            {step === 1 && emailSent && (
              <div className="text-center py-4">
                <CheckCircleOutlined className="text-4xl text-green-500 mb-4" />
                <Text strong className="block mb-2">
                  Email đã được gửi!
                </Text>
                <Text type="secondary" className="text-sm">
                  Vui lòng kiểm tra hộp thư của bạn và làm theo hướng dẫn.
                </Text>
              </div>
            )}
            {step === 2 && <ResetPasswordForm />}
          </Card>
        </Col>
      </Row>
    </div>
  );
}

