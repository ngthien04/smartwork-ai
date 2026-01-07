/**
 * SEPAY Payment Gateway Service
 * Tài liệu: https://developer.sepay.vn
 */

import axios from 'axios';

// Lưu ý: URL API có thể khác tùy theo tài liệu SEPAY
// Kiểm tra tài liệu SEPAY để xác nhận URL API chính xác
const SEPAY_API_BASE = process.env.SEPAY_API_URL || 'https://my.sepay.vn/userapi';
const SEPAY_API_TOKEN = process.env.SEPAY_API_TOKEN;
const SEPAY_ACCOUNT_NUMBER = process.env.SEPAY_ACCOUNT_NUMBER || '07475307801';
const SEPAY_BANK_NAME = process.env.SEPAY_BANK_NAME || 'TPBank';

/**
 * Tạo payment request với SEPAY
 * @param {Object} params - Payment parameters
 * @returns {Promise<Object>} Payment response từ SEPAY
 */
export async function createSepayPayment({
  amount,
  orderId,
  orderInfo,
  returnUrl,
  notifyUrl,
}) {
  if (!SEPAY_API_TOKEN) {
    throw new Error('SEPAY_API_TOKEN chưa được cấu hình');
  }

  try {
    const response = await axios.post(
      `${SEPAY_API_BASE}/v1/payments/create`,
      {
        amount,
        orderId,
        orderInfo,
        returnUrl,
        notifyUrl,
        currency: 'VND',
      },
      {
        headers: {
          'Authorization': `Bearer ${SEPAY_API_TOKEN}`,
          'Content-Type': 'application/json',
        },
      }
    );

    return response.data;
  } catch (error) {
    console.error('SEPAY create payment error:', error.response?.data || error.message);
    throw error;
  }
}

/**
 * Tạo QR code thanh toán với SEPAY
 * @param {Object} params - Payment parameters
 * @returns {Promise<Object>} QR code data từ SEPAY
 */
export async function createSepayQRCode({
  amount,
  orderId,
  orderInfo,
  notifyUrl,
}) {
  if (!SEPAY_API_TOKEN) {
    throw new Error('SEPAY_API_TOKEN chưa được cấu hình');
  }

  try {
    const response = await axios.post(
      `${SEPAY_API_BASE}/v1/qrcode/create`,
      {
        amount,
        orderId,
        orderInfo,
        notifyUrl,
        currency: 'VND',
      },
      {
        headers: {
          'Authorization': `Bearer ${SEPAY_API_TOKEN}`,
          'Content-Type': 'application/json',
        },
      }
    );

    return response.data;
  } catch (error) {
    if (error.code === 'ENOTFOUND' || error.message.includes('getaddrinfo ENOTFOUND')) {
      console.error('SEPAY API URL không thể kết nối:', SEPAY_API_BASE);
      console.error('Lỗi DNS: Không thể resolve domain. Vui lòng kiểm tra:');
      console.error('1. URL API có đúng không? (hiện tại:', SEPAY_API_BASE, ')');
      console.error('2. Kiểm tra tài liệu SEPAY để xác nhận URL API chính xác');
      console.error('3. Kiểm tra kết nối internet');
      throw new Error(`Không thể kết nối đến SEPAY API tại ${SEPAY_API_BASE}. Vui lòng kiểm tra URL API trong file .env (SEPAY_API_URL)`);
    }
    console.error('SEPAY create QR code error:', error.response?.data || error.message);
    throw error;
  }
}

/**
 * Kiểm tra payment status với SEPAY
 * @param {string} orderId - Order ID
 * @returns {Promise<Object>} Payment status từ SEPAY
 */
export async function checkSepayPaymentStatus(orderId) {
  if (!SEPAY_API_TOKEN) {
    throw new Error('SEPAY_API_TOKEN chưa được cấu hình');
  }

  try {
    const response = await axios.get(`${SEPAY_API_BASE}/v1/payments/${orderId}/status`, {
      headers: {
        'Authorization': `Bearer ${SEPAY_API_TOKEN}`,
      },
    });

    return response.data;
  } catch (error) {
    console.error('SEPAY check payment status error:', error.response?.data || error.message);
    throw error;
  }
}

/**
 * Lấy danh sách giao dịch từ SEPAY
 * @param {string} accountNumber - Số tài khoản ngân hàng
 * @param {number} limit - Số lượng giao dịch cần lấy (mặc định 20)
 * @returns {Promise<Array>} Danh sách giao dịch từ SEPAY
 */
export async function getSepayTransactionsList(accountNumber, limit = 20) {
  if (!SEPAY_API_TOKEN) {
    throw new Error('SEPAY_API_TOKEN chưa được cấu hình');
  }

  if (!accountNumber) {
    throw new Error('accountNumber là bắt buộc');
  }

  try {
    const response = await axios.get(
      `${SEPAY_API_BASE}/transactions/list`,
      {
        params: {
          account_number: accountNumber,
          limit,
        },
        headers: {
          'Authorization': `Apikey ${SEPAY_API_TOKEN}`,
          'Content-Type': 'application/json',
        },
      }
    );

    return response.data;
  } catch (error) {
    if (error.code === 'ENOTFOUND' || error.message.includes('getaddrinfo ENOTFOUND')) {
      console.error('SEPAY API URL không thể kết nối:', SEPAY_API_BASE);
      console.error('Lỗi DNS: Không thể resolve domain. Vui lòng kiểm tra:');
      console.error('1. URL API có đúng không? (hiện tại:', SEPAY_API_BASE, ')');
      console.error('2. Kiểm tra tài liệu SEPAY để xác nhận URL API chính xác');
      console.error('3. Kiểm tra kết nối internet');
      throw new Error(`Không thể kết nối đến SEPAY API tại ${SEPAY_API_BASE}. Vui lòng kiểm tra URL API trong file .env (SEPAY_API_URL)`);
    }
    console.error('SEPAY get transactions list error:', error.response?.data || error.message);
    throw error;
  }
}

/**
 * Tạo URL QR code SePay
 * @param {Object} params - QR code parameters
 * @param {string} params.accountNumber - Số tài khoản
 * @param {string} params.bankName - Tên ngân hàng
 * @param {number} params.amount - Số tiền
 * @param {string} params.description - Nội dung chuyển khoản
 * @returns {string} URL QR code
 */
export function generateSepayQRUrl({ accountNumber, bankName, amount, description }) {
  const params = new URLSearchParams({
    acc: accountNumber,
    bank: bankName,
    amount: String(amount),
    des: description,
  });
  return `https://qr.sepay.vn/img?${params.toString()}`;
}

/**
 * Verify webhook signature từ SEPAY
 * @param {Object} webhookData - Webhook data từ SEPAY
 * @param {string} signature - Signature từ header
 * @returns {boolean} true nếu signature hợp lệ
 * 
 * Lưu ý: SEPAY có thể sử dụng API Token để verify webhook hoặc có cách xác thực riêng
 * Cần kiểm tra tài liệu SEPAY để biết chính xác cách verify webhook
 */
export function verifySepayWebhookSignature(webhookData, signature) {
  // Nếu có signature từ SEPAY, verify theo cách SEPAY yêu cầu
  // Có thể SEPAY sử dụng API Token hoặc có secret key riêng cho webhook
  // Tạm thời return true nếu có signature (cần kiểm tra tài liệu SEPAY)
  if (!signature) {
    return false;
  }

  // TODO: Implement webhook verification theo tài liệu SEPAY
  // Có thể cần:
  // 1. Verify bằng API Token
  // 2. Verify bằng secret key riêng (nếu có)
  // 3. Verify bằng HMAC-SHA256 với secret key
  
  // Tạm thời: Nếu có signature thì coi như hợp lệ (cần cập nhật sau khi có tài liệu)
  return true;
}

// Export constants for use in other files
export { SEPAY_ACCOUNT_NUMBER, SEPAY_BANK_NAME };
