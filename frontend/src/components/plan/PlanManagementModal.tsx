import { Modal, Button, Space, Typography, Alert, Statistic, Row, Col } from 'antd';
import { CrownOutlined, CalendarOutlined, CloseCircleOutlined, ReloadOutlined, CheckCircleOutlined } from '@ant-design/icons';
import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { message } from 'antd';
import teamService, { type Team } from '@/services/teamService';
import paymentService from '@/services/paymentService';
import PlanSelectionModal from './PlanSelectionModal';
import PaymentModal from './PaymentModal';
import type { PlanType } from '@/services/paymentService';

const { Title, Text } = Typography;

interface PlanManagementModalProps {
  open: boolean;
  team: Team | null;
  onCancel: () => void;
}

export default function PlanManagementModal({
  open,
  team,
  onCancel,
}: PlanManagementModalProps) {
  const queryClient = useQueryClient();
  const [planSelectionModalVisible, setPlanSelectionModalVisible] = useState(false);
  const [paymentModalVisible, setPaymentModalVisible] = useState(false);
  const [currentPayment, setCurrentPayment] = useState<any>(null);
  const [cancelConfirmVisible, setCancelConfirmVisible] = useState(false);

  // Mutation: Hủy gia hạn (chuyển về FREE)
  const cancelPlanMutation = useMutation({
    mutationFn: (teamId: string) => teamService.selectPlan(teamId, 'FREE'),
    onSuccess: async () => {
      message.success('Đã hủy gia hạn PREMIUM. Team đã chuyển về gói FREE.');
      setCancelConfirmVisible(false);
      await queryClient.invalidateQueries({ queryKey: ['team', team?._id] });
      await queryClient.invalidateQueries({ queryKey: ['teams', 'mine'] });
      onCancel();
    },
    onError: (err: any) => {
      message.error(err?.response?.data || 'Hủy gia hạn thất bại');
    },
  });

  // Mutation: Tạo payment để gia hạn
  const createPaymentMutation = useMutation({
    mutationFn: (teamId: string) => paymentService.createPayment(teamId, 'PREMIUM'),
    onSuccess: async (res) => {
      if (res.data?.payment) {
        setCurrentPayment(res.data.payment);
        setPlanSelectionModalVisible(false);
        setPaymentModalVisible(true);
      } else {
        message.error('Không nhận được thông tin payment từ server');
      }
    },
    onError: (err: any) => {
      message.error(err?.response?.data || 'Tạo payment thất bại');
    },
  });

  const handleExtendPlan = () => {
    if (!team) return;
    createPaymentMutation.mutate(team._id);
  };

  const handleCancelPlan = () => {
    if (!team) return;
    cancelPlanMutation.mutate(team._id);
  };

  const handlePaymentSuccess = async () => {
    setPaymentModalVisible(false);
    setCurrentPayment(null);
    await queryClient.invalidateQueries({ queryKey: ['team', team?._id] });
    await queryClient.invalidateQueries({ queryKey: ['teams', 'mine'] });
    onCancel();
  };

  if (!team) return null;

  const isPremium = team.plan === 'PREMIUM';
  const planExpiredAt = team.planExpiredAt ? new Date(team.planExpiredAt) : null;
  const now = new Date();
  const daysRemaining = planExpiredAt
    ? Math.max(0, Math.ceil((planExpiredAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)))
    : null;

  return (
    <>
      <Modal
        open={open}
        onCancel={onCancel}
        footer={null}
        width={600}
        title={
          <div>
            <Title level={4} style={{ margin: 0 }}>
              Quản lý gói {isPremium ? 'PREMIUM' : 'FREE'}
            </Title>
            <Text type="secondary" style={{ fontSize: 12 }}>
              Team: <Text strong>{team.name}</Text>
            </Text>
          </div>
        }
      >
        <Space direction="vertical" size="large" className="w-full" style={{ width: '100%' }}>
          {/* Plan Status */}
          <div
            style={{
              background: '#f5f5f5',
              borderRadius: 8,
              padding: 20,
            }}
          >
            <Row gutter={[16, 16]}>
              <Col span={12}>
                <Statistic
                  title="Gói hiện tại"
                  value={isPremium ? 'PREMIUM' : 'FREE'}
                  prefix={isPremium ? <CrownOutlined style={{ color: '#f59e0b' }} /> : <CheckCircleOutlined style={{ color: '#6b7280' }} />}
                  valueStyle={{ color: isPremium ? '#f59e0b' : '#6b7280', fontWeight: 600 }}
                />
              </Col>
              {isPremium && planExpiredAt && (
                <Col span={12}>
                  <Statistic
                    title="Thời hạn còn lại"
                    value={daysRemaining !== null ? `${daysRemaining} ngày` : '—'}
                    prefix={<CalendarOutlined style={{ color: daysRemaining !== null && daysRemaining <= 3 ? '#ff4d4f' : '#f59e0b' }} />}
                    valueStyle={{ color: daysRemaining !== null && daysRemaining <= 3 ? '#ff4d4f' : '#f59e0b', fontWeight: 600 }}
                  />
                </Col>
              )}
            </Row>
            {isPremium && planExpiredAt && (
              <div style={{ marginTop: 12 }}>
                <Text type="secondary" style={{ fontSize: 12 }}>
                  Hết hạn vào: <Text strong>{planExpiredAt.toLocaleDateString('vi-VN')}</Text>
                </Text>
              </div>
            )}
          </div>

          {/* Actions */}
          {isPremium ? (
            <>
              {daysRemaining !== null && daysRemaining <= 7 && (
                <Alert
                  message="Gói PREMIUM sắp hết hạn"
                  description={`Còn ${daysRemaining} ngày. Hãy gia hạn để tiếp tục sử dụng các tính năng nâng cao.`}
                  type="warning"
                  showIcon
                />
              )}
              <Space direction="vertical" className="w-full" size="middle">
                <Button
                  type="primary"
                  icon={<ReloadOutlined />}
                  onClick={handleExtendPlan}
                  loading={createPaymentMutation.isPending}
                  block
                  style={{
                    background: '#f59e0b',
                    borderColor: '#f59e0b',
                    height: 48,
                    fontSize: 16,
                    fontWeight: 500,
                  }}
                >
                  Tiếp tục gia hạn (10,000 VNĐ / tuần)
                </Button>
                <Button
                  danger
                  icon={<CloseCircleOutlined />}
                  onClick={() => setCancelConfirmVisible(true)}
                  block
                  style={{
                    height: 40,
                  }}
                >
                  Hủy gia hạn (chuyển về FREE)
                </Button>
              </Space>
            </>
          ) : (
            <>
              <Alert
                message="Gói FREE"
                description="Bạn đang sử dụng gói FREE với các tính năng cơ bản. Nâng cấp lên PREMIUM để sử dụng tất cả tính năng AI nâng cao."
                type="info"
                showIcon
              />
              <Button
                type="primary"
                icon={<CrownOutlined />}
                onClick={() => setPlanSelectionModalVisible(true)}
                block
                style={{
                  background: '#f59e0b',
                  borderColor: '#f59e0b',
                  height: 48,
                  fontSize: 16,
                  fontWeight: 500,
                }}
              >
                Nâng cấp lên PREMIUM
              </Button>
            </>
          )}
        </Space>
      </Modal>

      {/* Confirm Cancel Modal */}
      <Modal
        open={cancelConfirmVisible}
        title="Xác nhận hủy gia hạn"
        onOk={handleCancelPlan}
        onCancel={() => setCancelConfirmVisible(false)}
        okText="Xác nhận hủy"
        cancelText="Hủy"
        okType="danger"
        confirmLoading={cancelPlanMutation.isPending}
      >
        <p>
          Bạn có chắc muốn hủy gia hạn PREMIUM và chuyển team về gói FREE? Team sẽ mất quyền truy cập các tính năng AI nâng cao sau khi hết hạn.
        </p>
      </Modal>

      {/* Plan Selection Modal */}
      <PlanSelectionModal
        open={planSelectionModalVisible}
        teamId={team._id}
        teamName={team.name}
        onSelectPlan={(plan: PlanType) => {
          if (plan === 'PREMIUM') {
            createPaymentMutation.mutate(team._id);
          } else {
            setPlanSelectionModalVisible(false);
          }
        }}
        onCancel={() => setPlanSelectionModalVisible(false)}
        loading={createPaymentMutation.isPending}
      />

      {/* Payment Modal */}
      <PaymentModal
        open={paymentModalVisible}
        payment={currentPayment}
        teamId={team._id}
        teamName={team.name}
        onSuccess={handlePaymentSuccess}
        onCancel={() => {
          setPaymentModalVisible(false);
          setCurrentPayment(null);
        }}
      />
    </>
  );
}

