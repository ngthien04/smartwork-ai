import { Modal, Button, Space, Typography, QRCode, Alert, Tag, message } from 'antd';
import { CheckCircleOutlined, CloseCircleOutlined, ReloadOutlined } from '@ant-design/icons';
import { useState, useEffect, useRef } from 'react';
import paymentService, { type Payment } from '@/services/paymentService';

const { Title, Text, Paragraph } = Typography;

interface PaymentModalProps {
  open: boolean;
  payment: Payment | null;
  teamId: string;
  teamName: string;
  onSuccess: () => void;
  onCancel: () => void;
}

export default function PaymentModal({
  open,
  payment,
  teamId: _teamId, // Keep for future use
  teamName,
  onSuccess,
  onCancel,
}: PaymentModalProps) {
  // const [verifying, setVerifying] = useState(false);
  const [checking, setChecking] = useState(false);
  const [paymentStatus, setPaymentStatus] = useState<Payment['status'] | null>(
    payment?.status || null
  );
  const checkIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const successHandledRef = useRef(false); // Track xem đã gọi onSuccess chưa

  useEffect(() => {
    if (payment) {
      setPaymentStatus(payment.status);
    }
  }, [payment]);

  // Tự động đóng modal khi payment thành công
  useEffect(() => {
    if (paymentStatus === 'SUCCESS' && open && !successHandledRef.current) {
      // Clear interval nếu có
      if (checkIntervalRef.current) {
        clearInterval(checkIntervalRef.current);
        checkIntervalRef.current = null;
      }
      // Đánh dấu đã xử lý để tránh gọi nhiều lần
      successHandledRef.current = true;
      // Đóng modal sau 1.5 giây để user thấy thông báo thành công
      const timer = setTimeout(() => {
        onSuccess();
      }, 1500);
      return () => clearTimeout(timer);
    }
  }, [paymentStatus, open, onSuccess]);

  // Reset successHandledRef khi modal đóng hoặc payment thay đổi
  useEffect(() => {
    if (!open || !payment) {
      successHandledRef.current = false;
    }
  }, [open, payment]);

  // Tự động check payment status mỗi 3 giây nếu đang PENDING và là BANK_TRANSFER hoặc SEPAY
  // Giảm thời gian để phát hiện webhook nhanh hơn
  useEffect(() => {
    // Clear interval nếu payment đã thành công hoặc modal đóng
    if (paymentStatus === 'SUCCESS' || !open || !payment) {
      if (checkIntervalRef.current) {
        clearInterval(checkIntervalRef.current);
        checkIntervalRef.current = null;
      }
      return;
    }

    if (
      open &&
      payment &&
      paymentStatus === 'PENDING' &&
      (payment.provider === 'BANK_TRANSFER' || payment.provider === 'SEPAY')
    ) {
      // Check ngay lập tức khi mở modal
      handleCheckPayment();
      
      // Sau đó check định kỳ mỗi 3 giây
      checkIntervalRef.current = setInterval(async () => {
        try {
          await handleCheckPayment();
        } catch (err) {
          console.error('Auto check payment error:', err);
        }
      }, 3000); // Check mỗi 3 giây (giảm từ 10s để phát hiện webhook nhanh hơn)

      return () => {
        if (checkIntervalRef.current) {
          clearInterval(checkIntervalRef.current);
          checkIntervalRef.current = null;
        }
      };
    }
  }, [open, payment, paymentStatus]);

  const handleCheckPayment = async () => {
    if (!payment) return;
    
    // Nếu đã SUCCESS, không cần check nữa và clear interval
    if (paymentStatus === 'SUCCESS') {
      if (checkIntervalRef.current) {
        clearInterval(checkIntervalRef.current);
        checkIntervalRef.current = null;
      }
      return;
    }

    try {
      setChecking(true);
      
      // Nếu là SEPAY, sử dụng verify-by-transaction
      if (payment.provider === 'SEPAY') {
        const res = await paymentService.verifyPaymentByTransaction(payment._id);
        
        if (res.data.success) {
          // Clear interval ngay lập tức
          if (checkIntervalRef.current) {
            clearInterval(checkIntervalRef.current);
            checkIntervalRef.current = null;
          }
          
          setPaymentStatus('SUCCESS');
          message.success(res.data.message || 'Thanh toán đã được xác nhận!');
          
          // Không gọi onSuccess ở đây nữa, để useEffect tự động xử lý
          // Điều này tránh gọi nhiều lần
          return;
        } else {
          // Không hiển thị message mỗi lần check để tránh spam
          // Chỉ log để debug
          console.log('Payment still pending:', res.data.message);
        }
      } else {
        // Với provider khác, dùng check thông thường
        const res = await paymentService.checkPaymentStatus(payment._id);
        
        // Nếu payment đã được verify (có thể từ webhook hoặc nơi khác)
        if (res.data.status !== 'PENDING') {
          // Clear interval ngay lập tức
          if (checkIntervalRef.current) {
            clearInterval(checkIntervalRef.current);
            checkIntervalRef.current = null;
          }
          
          setPaymentStatus(res.data.status as Payment['status']);
          if (res.data.status === 'SUCCESS') {
            // Clear interval ngay lập tức
            if (checkIntervalRef.current) {
              clearInterval(checkIntervalRef.current);
              checkIntervalRef.current = null;
            }
            message.success('Thanh toán đã được xác nhận!');
            // Không gọi onSuccess ở đây nữa, để useEffect tự động xử lý
            // Điều này tránh gọi nhiều lần
            return;
          }
        }
      }
    } catch (err: any) {
      console.error('Check payment error:', err);
      // Không hiển thị error mỗi lần check để tránh spam
      // Chỉ log để debug
    } finally {
      setChecking(false);
    }
  };

  // Debug: Log payment state
  console.log('PaymentModal render - open:', open, 'payment:', payment);
  
  if (!payment) {
    console.warn('PaymentModal: payment is null, returning null');
    return null;
  }

  const isPending = paymentStatus === 'PENDING';
  const isSuccess = paymentStatus === 'SUCCESS';
  const isFailed = paymentStatus === 'FAILED';

  return (
    <Modal
      open={open}
      onCancel={onCancel}
      footer={null}
      width={500}
      title={
        <div>
          <Title level={4} style={{ margin: 0 }}>
            Thanh toán gói PREMIUM
          </Title>
          <Text type="secondary" style={{ fontSize: 12 }}>
            Team: <Text strong>{teamName}</Text>
          </Text>
        </div>
      }
    >
      <Space direction="vertical" size="large" className="w-full" style={{ width: '100%' }}>
        {/* Payment Info */}
        <div
          style={{
            background: '#fafafa',
            borderRadius: 8,
            padding: 20,
            border: '1px solid #e5e5e5',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
            <Text style={{ color: '#666', fontSize: 14 }}>Số tiền:</Text>
            <Text strong style={{ fontSize: 20, color: '#000', fontWeight: 600 }}>
              {payment.amount.toLocaleString('vi-VN')} {payment.currency}
            </Text>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
            <Text style={{ color: '#666', fontSize: 14 }}>Gói:</Text>
            <Tag style={{ background: '#000', color: '#fff', border: 'none', fontSize: 12, padding: '2px 8px' }}>PREMIUM</Tag>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
            <Text style={{ color: '#666', fontSize: 14 }}>Thời hạn sử dụng:</Text>
            <Text strong style={{ color: '#000', fontSize: 14, fontWeight: 500 }}>
              7 ngày (1 tuần)
            </Text>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <Text style={{ color: '#666', fontSize: 14 }}>Mã giao dịch:</Text>
            <Text code style={{ fontSize: 11, background: '#f5f5f5', color: '#000', border: '1px solid #e5e5e5', padding: '2px 6px', borderRadius: 4 }}>
              {payment.transactionId}
            </Text>
          </div>
        </div>

        {/* Status */}
        {isPending && (
          <>
            <Alert
              message="Đang chờ thanh toán"
              description="Vui lòng quét QR code hoặc thanh toán qua link bên dưới."
              type="info"
              showIcon
            />

            {/* QR Code */}
            {payment.qrCode && (
              <div style={{ textAlign: 'center', padding: 24 }}>
                {(payment.provider === 'BANK_TRANSFER' || payment.provider === 'SEPAY') &&
                payment.qrCode.startsWith('http') ? (
                  // Hiển thị QR code từ URL hình ảnh (VietQR API hoặc SEPAY)
                  <div>
                    <div
                      style={{
                        display: 'inline-block',
                        padding: 16,
                        background: '#fff',
                        borderRadius: 12,
                        border: '2px solid #000',
                        boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                      }}
                    >
                      <img
                        src={payment.qrCode}
                        alt="QR Code thanh toán"
                        style={{ width: 240, height: 240, display: 'block' }}
                      />
                    </div>
                    {payment.provider === 'BANK_TRANSFER' && payment.metadata?.bankAccountNo && (
                      <div style={{ marginTop: 12, padding: 12, background: '#f5f5f5', borderRadius: 8 }}>
                        <Text type="secondary" style={{ fontSize: 12, display: 'block' }}>
                          <strong>Số tài khoản:</strong> {payment.metadata.bankAccountNo}
                        </Text>
                        <Text type="secondary" style={{ fontSize: 12, display: 'block' }}>
                          <strong>Chủ tài khoản:</strong> {payment.metadata.bankAccountName}
                        </Text>
                        <Text type="secondary" style={{ fontSize: 12, display: 'block' }}>
                          <strong>Nội dung:</strong> {payment.metadata.addInfo}
                        </Text>
                      </div>
                    )}
                    {payment.provider === 'SEPAY' && (
                      <div style={{ marginTop: 20, padding: 16, background: '#fafafa', borderRadius: 8, border: '1px solid #e5e5e5' }}>
                        <Text style={{ fontSize: 13, color: '#000', fontWeight: 500, display: 'block', marginBottom: 8 }}>
                          Thông tin thanh toán
                        </Text>
                        {payment.metadata?.accountNumber && (
                          <Text style={{ fontSize: 12, color: '#666', display: 'block', marginBottom: 4 }}>
                            <strong style={{ color: '#000' }}>Số tài khoản:</strong> {payment.metadata.accountNumber}
                          </Text>
                        )}
                        {payment.metadata?.bankName && (
                          <Text style={{ fontSize: 12, color: '#666', display: 'block', marginBottom: 4 }}>
                            <strong style={{ color: '#000' }}>Ngân hàng:</strong> {payment.metadata.bankName}
                          </Text>
                        )}
                        {payment.metadata?.transferDescription && (
                          <Text style={{ fontSize: 12, color: '#666', display: 'block', marginBottom: 8 }}>
                            <strong style={{ color: '#000' }}>Nội dung:</strong>{' '}
                            <Text code style={{ background: '#fff', color: '#000', border: '1px solid #e5e5e5', padding: '2px 6px', borderRadius: 4 }}>
                              {payment.metadata.transferDescription}
                            </Text>
                          </Text>
                        )}
                        <Alert
                          message="Lưu ý"
                          description="Vui lòng chuyển khoản đúng số tiền và nội dung chuyển khoản như trên. Sau khi chuyển khoản, nhấn nút 'Xác nhận thanh toán' để hệ thống kiểm tra."
                          type="warning"
                          showIcon
                          style={{ marginTop: 12, background: '#fffbe6', borderColor: '#ffe58f' }}
                        />
                      </div>
                    )}
                    <Paragraph style={{ marginTop: 16, marginBottom: 0 }}>
                      <Text style={{ fontSize: 13, color: '#666', fontWeight: 500 }}>
                        Quét QR code để thanh toán
                      </Text>
                    </Paragraph>
                  </div>
                ) : (
                  // Hiển thị QR code generate từ string (fallback)
                  <div>
                    <div
                      style={{
                        display: 'inline-block',
                        padding: 16,
                        background: '#fff',
                        borderRadius: 12,
                        border: '2px solid #000',
                        boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                      }}
                    >
                      <QRCode
                        value={payment.qrCode}
                        size={240}
                        errorLevel="M"
                        iconSize={40}
                        color="#000"
                        bgColor="#fff"
                      />
                    </div>
                    <Paragraph style={{ marginTop: 16, marginBottom: 0 }}>
                      <Text style={{ fontSize: 13, color: '#666', fontWeight: 500 }}>
                        Quét QR code để thanh toán
                      </Text>
                    </Paragraph>
                  </div>
                )}
              </div>
            )}

            {/* Payment URL */}
            {payment.paymentUrl && (
              <div style={{ textAlign: 'center' }}>
                <Button
                  type="link"
                  href={payment.paymentUrl}
                  target="_blank"
                  icon={<ReloadOutlined />}
                >
                  Mở link thanh toán
                </Button>
              </div>
            )}

            {/* Action buttons */}
            <div
              style={{
                borderTop: '1px solid #f0f0f0',
                paddingTop: 16,
                display: 'flex',
                gap: 12,
                justifyContent: 'center',
                flexWrap: 'wrap',
              }}
            >
              {(payment.provider === 'BANK_TRANSFER' || payment.provider === 'SEPAY') && (
                <>
                  <Button
                    icon={<ReloadOutlined />}
                    onClick={handleCheckPayment}
                    loading={checking}
                    disabled={isSuccess || isFailed}
                    type={payment.provider === 'SEPAY' ? 'primary' : 'default'}
                  >
                    {payment.provider === 'SEPAY' ? 'Xác nhận thanh toán' : 'Kiểm tra thanh toán'}
                  </Button>
                  <Text type="secondary" style={{ fontSize: 11, width: '100%', textAlign: 'center', marginTop: 8 }}>
                    {payment.provider === 'SEPAY' 
                      ? 'Sau khi chuyển khoản, nhấn nút trên để hệ thống kiểm tra giao dịch. Hệ thống sẽ tự động kiểm tra mỗi 10 giây.'
                      : 'Hệ thống sẽ tự động kiểm tra mỗi 10 giây. Hoặc bấm nút trên để kiểm tra ngay.'}
                  </Text>
                </>
              )}
              
            </div>
          </>
        )}

        {isSuccess && (
          <Alert
            message="Thanh toán thành công!"
            description="Team của bạn đã được nâng cấp lên gói PREMIUM. Bạn có thể sử dụng tất cả chức năng AI nâng cao."
            type="success"
            showIcon
            icon={<CheckCircleOutlined />}
          />
        )}

        {isFailed && (
          <Alert
            message="Thanh toán thất bại"
            description="Vui lòng thử lại hoặc liên hệ hỗ trợ nếu vấn đề vẫn tiếp tục."
            type="error"
            showIcon
            icon={<CloseCircleOutlined />}
          />
        )}

        {/* Actions */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12 }}>
          {isSuccess ? (
            <Button
              type="primary"
              onClick={onSuccess}
              style={{
                background: '#000',
                borderColor: '#000',
                height: 40,
              }}
            >
              Đóng
            </Button>
          ) : (
            <Button
              onClick={onCancel}
              style={{
                height: 40,
                borderColor: '#d9d9d9',
                color: '#000',
              }}
            >
              {isFailed ? 'Đóng' : 'Hủy'}
            </Button>
          )}
        </div>
      </Space>
    </Modal>
  );
}


