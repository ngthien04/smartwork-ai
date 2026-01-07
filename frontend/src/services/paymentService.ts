import api from './api';

export type PlanType = 'FREE' | 'PREMIUM';

export interface Payment {
  _id: string;
  id: string;
  team: string;
  amount: number;
  currency: string;
  provider: 'VNPAY' | 'MOMO' | 'STRIPE' | 'MOCK' | 'BANK_TRANSFER' | 'SEPAY';
  status: 'PENDING' | 'SUCCESS' | 'FAILED' | 'CANCELLED';
  plan: 'PREMIUM';
  transactionId?: string;
  paymentUrl?: string;
  qrCode?: string;
  metadata?: {
    bankAccountNo?: string;
    bankAccountName?: string;
    bankBin?: string;
    bankName?: string;
    addInfo?: string;
    sepayOrderId?: string;
    sepayTransactionId?: string;
    orderInfo?: string;
    accountNumber?: string;
    transferDescription?: string;
    teamId?: string;
  };
  createdAt?: string;
  paidAt?: string;
  failedAt?: string;
}

export interface PaymentStatusResponse {
  team: {
    _id: string;
    plan: PlanType;
  };
  latestPayment: Payment | null;
}

const paymentService = {
  /**
   * Tạo payment cho PREMIUM plan
   */
  createPayment(teamId: string, plan: 'PREMIUM' = 'PREMIUM') {
    return api.post<{ payment: Payment; message?: string }>(
      `/payments/teams/${teamId}/create`,
      { plan }
    );
  },

  /**
   * Lấy payment status của team
   */
  getTeamPaymentStatus(teamId: string) {
    return api.get<PaymentStatusResponse>(`/payments/teams/${teamId}/status`);
  },

  /**
   * Tự động kiểm tra payment status (có thể gọi định kỳ)
   */
  checkPaymentStatus(paymentId: string) {
    return api.post<{
      checked: boolean;
      status: string;
      message: string;
      payment?: any;
    }>(`/payments/${paymentId}/check`);
  },

  /**
   * Verify payment bằng cách kiểm tra giao dịch từ SEPAY API
   * Endpoint này sẽ gọi SEPAY API để lấy danh sách giao dịch và tìm giao dịch phù hợp
   * Backend sẽ tự động sử dụng SEPAY_API_TOKEN từ env để gọi SEPAY API
   */
  verifyPaymentByTransaction(paymentId: string) {
    return api.post<{
      success: boolean;
      message: string;
      checked: boolean;
      payment?: Payment;
      team?: { plan: PlanType; planExpiredAt?: string };
      transaction?: {
        id: string;
        amount: number;
        description: string;
      };
      error?: string;
    }>(`/payments/${paymentId}/verify-by-transaction`);
  },
};

export default paymentService;
