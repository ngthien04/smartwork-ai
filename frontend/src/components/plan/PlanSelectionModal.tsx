import { Modal, Card, Button, Space, Typography, Tag, List } from 'antd';
import { CheckCircleOutlined, CrownOutlined, CheckOutlined } from '@ant-design/icons';
import { useState } from 'react';
import type React from 'react';
import type { PlanType } from '@/services/paymentService';

const { Title, Text } = Typography;

interface PlanSelectionModalProps {
  open: boolean;
  teamId: string;
  teamName: string;
  onSelectPlan: (plan: PlanType) => void;
  onCancel: () => void;
  loading?: boolean;
}

export default function PlanSelectionModal({
  open,
  teamId: _teamId, // Keep for future use (validation, logging, etc.)
  teamName,
  onSelectPlan,
  onCancel,
  loading = false,
}: PlanSelectionModalProps) {
  const [selectedPlan, setSelectedPlan] = useState<PlanType | null>(null);

  const plans: Array<{
    key: PlanType;
    name: string;
    icon: React.ReactNode;
    price: string;
    priceNote?: string;
    features: string[];
    limitations: string[];
    color: string;
    recommended?: boolean;
  }> = [
    {
      key: 'FREE' as PlanType,
      name: 'Gói FREE',
      icon: <CheckCircleOutlined style={{ fontSize: 32, color: '#6b7280' }} />,
      price: 'Miễn phí',
      features: [
        '1 chức năng AI cơ bản',
        'Tối đa 3 thành viên (bao gồm Leader)',
        'Quản lý task cơ bản',
        'Quản lý project',
      ],
      limitations: ['Giới hạn số lượng thành viên', 'Chỉ 1 chức năng AI'],
      color: '#6b7280', // Xám nhẹ, trung tính
    },
    {
      key: 'PREMIUM' as PlanType,
      name: 'Gói PREMIUM',
      icon: <CrownOutlined style={{ fontSize: 32, color: '#f59e0b' }} />,
      price: '10,000 VNĐ',
      priceNote: '/tuần',
      features: [
        'Tất cả chức năng AI nâng cao',
        'Không giới hạn số lượng thành viên',
        'Quản lý task & project đầy đủ',
        'Bug triage AI',
        'Priority analysis AI',
        'AI chat assistant',
        'AI task planning',
        'Hỗ trợ ưu tiên',
      ],
      limitations: [],
      color: '#f59e0b', // Vàng/gold nổi bật
      recommended: true,
    },
  ];

  const handleConfirm = () => {
    if (selectedPlan) {
      onSelectPlan(selectedPlan);
    }
  };

  return (
    <Modal
      open={open}
      onCancel={onCancel}
      footer={null}
      width={900}
      title={
        <div>
          <Title level={4} style={{ margin: 0 }}>
            Chọn gói cho Team: <Text strong>{teamName}</Text>
          </Title>
          <Text type="secondary" style={{ fontSize: 12 }}>
            Chỉ Leader mới được chọn gói. Gói được áp dụng cho toàn bộ Team và tất cả Project trong Team.
          </Text>
        </div>
      }
    >
      <Space direction="vertical" size="large" className="w-full" style={{ width: '100%' }}>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
            gap: 16,
          }}
        >
          {plans.map((plan) => {
            const isSelected = selectedPlan === plan.key;
            return (
              <Card
                key={plan.key}
                hoverable
                onClick={() => setSelectedPlan(plan.key)}
                style={{
                  border: isSelected ? `2px solid ${plan.color}` : '1px solid #e5e5e5',
                  borderRadius: 12,
                  cursor: 'pointer',
                  position: 'relative',
                  transition: 'all 0.3s',
                  background: isSelected ? `${plan.color}08` : '#fff',
                }}
                bodyStyle={{ padding: 20 }}
              >
                {plan.recommended && (
                  <Tag
                    style={{
                      position: 'absolute',
                      top: 12,
                      right: 12,
                      borderRadius: 12,
                      background: plan.color,
                      color: '#fff',
                      border: 'none',
                    }}
                  >
                    Đề xuất
                  </Tag>
                )}

                {isSelected && (
                  <div
                    style={{
                      position: 'absolute',
                      top: 12,
                      left: 12,
                      width: 24,
                      height: 24,
                      borderRadius: '50%',
                      background: plan.color,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <CheckOutlined style={{ color: '#fff', fontSize: 14 }} />
                  </div>
                )}

                <div style={{ textAlign: 'center', marginBottom: 16 }}>
                  {plan.icon}
                  <Title level={4} style={{ margin: '12px 0 8px 0' }}>
                    {plan.name}
                  </Title>
                  <div>
                    <Text strong style={{ fontSize: 24, color: plan.color, fontWeight: 600 }}>
                      {plan.price}
                    </Text>
                    {plan.priceNote && (
                      <Text style={{ fontSize: 12, marginLeft: 4, color: '#666' }}>
                        {plan.priceNote}
                      </Text>
                    )}
                  </div>
                </div>

                <List
                  size="small"
                  dataSource={plan.features}
                  renderItem={(item) => (
                    <List.Item style={{ padding: '4px 0', border: 'none' }}>
                      <CheckCircleOutlined style={{ color: plan.color, marginRight: 8 }} />
                      <Text style={{ color: '#333' }}>{item}</Text>
                    </List.Item>
                  )}
                />

                {plan.limitations.length > 0 && (
                  <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid #f0f0f0' }}>
                    <Text style={{ fontSize: 12, color: '#ff4d4f', fontWeight: 600 }}>
                      Hạn chế:
                    </Text>
                    <List
                      size="small"
                      dataSource={plan.limitations}
                      renderItem={(item) => (
                        <List.Item style={{ padding: '4px 0', border: 'none' }}>
                          <Text style={{ fontSize: 12, color: '#ff4d4f' }}>
                            • {item}
                          </Text>
                        </List.Item>
                      )}
                    />
                  </div>
                )}
              </Card>
            );
          })}
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, marginTop: 8 }}>
          <Button onClick={onCancel} disabled={loading}>
            Hủy
          </Button>
          <Button
            type="primary"
            onClick={handleConfirm}
            disabled={!selectedPlan || loading}
            loading={loading}
            icon={selectedPlan === 'PREMIUM' ? <CrownOutlined /> : <CheckCircleOutlined />}
            style={{
              background: selectedPlan ? plans.find(p => p.key === selectedPlan)?.color || '#000' : '#000',
              borderColor: selectedPlan ? plans.find(p => p.key === selectedPlan)?.color || '#000' : '#000',
              height: 40,
            }}
          >
            {selectedPlan === 'PREMIUM' ? 'Thanh toán' : 'Chọn gói FREE'}
          </Button>
        </div>
      </Space>
    </Modal>
  );
}

