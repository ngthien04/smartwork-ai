import { Router } from 'express';
import mongoose from 'mongoose';
import authMid from '../middleware/auth.mid.js';
import { BAD_REQUEST, UNAUTHORIZED, NOT_FOUND } from '../constants/httpStatus.js';
import { PaymentModel } from '../models/payment.js';
import { TeamModel } from '../models/team.js';
import { verifyPaymentSuccess } from '../helpers/payment.helper.js';
import {
  createSepayQRCode,
  checkSepayPaymentStatus,
  verifySepayWebhookSignature,
  getSepayTransactionsList,
  generateSepayQRUrl,
  SEPAY_ACCOUNT_NUMBER,
  SEPAY_BANK_NAME,
} from '../services/sepay.service.js';

const router = Router();
const handler = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

const toId = (v) => {
  if (!v) return null;
  if (v instanceof mongoose.Types.ObjectId) return v;
  const s = String(v);
  if (!mongoose.isValidObjectId(s)) return null;
  return new mongoose.Types.ObjectId(s);
};

function isTeamLeader(teamDoc, userId) {
  if (!teamDoc || !userId) return false;
  const leaders = teamDoc.leaders || [];
  return leaders.some((lid) => String(lid) === String(userId));
}

// Middleware: Chỉ Leader mới được tạo payment
async function leaderOnlyMid(req, res, next) {
  const { teamId } = req.params;
  if (!teamId) return res.status(BAD_REQUEST).send('Thiếu teamId');

  const team = await TeamModel.findById(teamId).lean();
  if (!team || team.isDeleted) return res.status(NOT_FOUND).send('Team không tồn tại');

  if (!isTeamLeader(team, req.user.id)) {
    return res.status(UNAUTHORIZED).send('Chỉ Leader mới được thao tác thanh toán');
  }

  req.team = team;
  next();
}

/**
 * POST /payments/teams/:teamId/create
 * Tạo payment cho PREMIUM plan
 */
router.post(
  '/teams/:teamId/create',
  authMid,
  leaderOnlyMid,
  handler(async (req, res) => {
    const { teamId } = req.params;
    const { plan = 'PREMIUM' } = req.body || {};

    if (plan !== 'PREMIUM') {
      return res.status(BAD_REQUEST).send('Chỉ hỗ trợ gói PREMIUM');
    }

    // Kiểm tra xem team đã có PREMIUM chưa
    const team = await TeamModel.findById(teamId).lean();
    if (!team) {
      return res.status(NOT_FOUND).send('Team không tồn tại');
    }
    if (team.plan === 'PREMIUM') {
      return res.status(BAD_REQUEST).send('Team đã có gói PREMIUM rồi');
    }

    // Kiểm tra xem có payment PENDING nào không
    const existingPending = await PaymentModel.findOne({
      team: toId(teamId),
      status: 'PENDING',
      plan: 'PREMIUM',
    }).lean();

    if (existingPending) {
      return res.send({
        payment: existingPending,
        message: 'Đã có payment đang chờ thanh toán',
      });
    }

    // Tạo payment mới
    const amount = 10000; // 10k  / tuần
    const transactionId = `TXN_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // Kiểm tra SEPAY config
    if (!process.env.SEPAY_API_TOKEN) {
      return res.status(BAD_REQUEST).send('Chưa cấu hình SEPAY. Vui lòng cấu hình SEPAY_API_TOKEN trong file .env');
    }

    // Tạo nội dung chuyển khoản động: TKPVQ1_<TEAM_SLUG>_<PAYMENT_ID>
    const teamSlug = team.slug || teamId;
    const tempPaymentId = transactionId;
    const transferDescription = `TKPVQ1_${teamSlug}_${tempPaymentId}`;

    //  QR code URL theo format SePay
    const qrCodeUrl = generateSepayQRUrl({
      accountNumber: SEPAY_ACCOUNT_NUMBER,
      bankName: SEPAY_BANK_NAME,
      amount,
      description: transferDescription,
    });

    // Tạo payment với QR code SePay
    const payment = await PaymentModel.create({
      team: toId(teamId),
      amount,
      currency: 'VND',
      provider: 'SEPAY',
      status: 'PENDING',
      plan: 'PREMIUM',
      transactionId,
      paymentUrl: qrCodeUrl,
      qrCode: qrCodeUrl,
      metadata: {
        accountNumber: SEPAY_ACCOUNT_NUMBER,
        bankName: SEPAY_BANK_NAME,
        transferDescription,
        teamId: String(teamId),
      },
      processedTransactionIds: [],
    });

    // Cập nhật lại description với payment._id thực tế
    const finalDescription = `TKPVQ1_${teamSlug}_${payment._id}`;
    payment.metadata.transferDescription = finalDescription;
    payment.qrCode = generateSepayQRUrl({
      accountNumber: SEPAY_ACCOUNT_NUMBER,
      bankName: SEPAY_BANK_NAME,
      amount,
      description: finalDescription,
    });
    payment.paymentUrl = payment.qrCode;
    await payment.save();

    return res.status(201).send({
      payment: {
        _id: payment._id,
        id: payment._id,
        team: payment.team,
        amount: payment.amount,
        currency: payment.currency,
        provider: payment.provider,
        status: payment.status,
        plan: payment.plan,
        transactionId: payment.transactionId,
        paymentUrl: payment.paymentUrl,
        qrCode: payment.qrCode,
        metadata: payment.metadata,
        createdAt: payment.createdAt,
      },
    });
  })
);


/**
 * POST /payments/:paymentId/verify-by-transaction
 * Verify payment bằng cách kiểm tra giao dịch từ SEPAY API
 * Endpoint này có tác dụng:
 * 1. Gọi SEPAY API để lấy danh sách 20 giao dịch gần nhất
 * 2. Tìm giao dịch thỏa mãn: amount đúng, description chứa TKPVQ1_<TEAM_SLUG>_<PAYMENT_ID>
 * 3. Nếu tìm thấy: Cập nhật payment = SUCCESS, team.plan = PREMIUM
 */
router.post(
  '/:paymentId/verify-by-transaction',
  authMid,
  handler(async (req, res) => {
    const { paymentId } = req.params;

    // Tìm payment
    const payment = await PaymentModel.findById(paymentId);
    if (!payment) {
      return res.status(NOT_FOUND).send('Payment không tồn tại');
    }

    // Kiểm tra quyền (chỉ Leader của team đó mới verify được)
    const team = await TeamModel.findById(payment.team).lean();
    if (!team) {
      return res.status(NOT_FOUND).send('Team không tồn tại');
    }

    if (!isTeamLeader(team, req.user.id)) {
      return res.status(UNAUTHORIZED).send('Chỉ Leader mới được verify payment');
    }

    // Nếu payment đã thành công, trả về ngay (có thể đã được verify từ webhook)
    if (payment.status === 'SUCCESS') {
      const updatedTeam = await TeamModel.findById(payment.team).lean();
      return res.status(200).send({
        success: true,
        message: 'Thanh toán đã được xác nhận thành công!',
        checked: true,
        payment: {
          _id: payment._id,
          id: payment._id,
          status: payment.status,
          paidAt: payment.paidAt,
        },
        team: {
          plan: 'PREMIUM',
          planExpiredAt: updatedTeam.planExpiredAt,
        },
      });
    }

    if (payment.status !== 'PENDING') {
      return res.status(BAD_REQUEST).send(`Payment đã ở trạng thái ${payment.status}`);
    }

    // Kiểm tra SEPAY config
    if (!process.env.SEPAY_API_TOKEN) {
      return res.status(BAD_REQUEST).send('Chưa cấu hình SEPAY_API_TOKEN');
    }

    if (!SEPAY_ACCOUNT_NUMBER) {
      return res.status(BAD_REQUEST).send('Chưa cấu hình SEPAY_ACCOUNT_NUMBER');
    }

    try {
      // Gọi SEPAY API để lấy danh sách 20 giao dịch gần nhất
      // Lưu ý: Nếu SEPAY API trả về 401, có thể API Token không đúng hoặc không có quyền
      // Trong trường hợp này, vẫn có thể verify payment từ webhook data
      let transactionsData = null;
      try {
        transactionsData = await getSepayTransactionsList(SEPAY_ACCOUNT_NUMBER, 20);
      } catch (sepayApiError) {
        // Nếu SEPAY API lỗi (401, 403, etc.), kiểm tra lại payment status
        // Vì payment có thể đã được verify từ webhook trong lúc này
        console.warn('SEPAY API error (có thể do API Token hoặc quyền):', sepayApiError.response?.status || sepayApiError.message);
        
        // Refresh payment từ database để lấy status mới nhất
        await payment.populate();
        const refreshedPayment = await PaymentModel.findById(paymentId);
        
        if (refreshedPayment && refreshedPayment.status === 'SUCCESS') {
          // Payment đã được verify từ webhook
          const updatedTeam = await TeamModel.findById(refreshedPayment.team).lean();
          return res.status(200).send({
            success: true,
            message: 'Thanh toán đã được xác nhận thành công (từ webhook)!',
            checked: true,
            payment: {
              _id: refreshedPayment._id,
              id: refreshedPayment._id,
              status: refreshedPayment.status,
              paidAt: refreshedPayment.paidAt,
            },
            team: {
              plan: 'PREMIUM',
              planExpiredAt: updatedTeam.planExpiredAt,
            },
          });
        }
        
        // Nếu vẫn PENDING và không thể gọi SEPAY API, trả về lỗi
        return res.status(200).send({
          success: false,
          message: 'Không thể kết nối đến SEPAY API để kiểm tra giao dịch. Vui lòng thử lại sau hoặc đợi webhook tự động xác nhận.',
          checked: true,
          error: 'SEPAY API không khả dụng',
        });
      }
      
      if (!transactionsData) {
        // Nếu không có data từ SEPAY API, kiểm tra lại payment status
        const refreshedPayment = await PaymentModel.findById(paymentId);
        if (refreshedPayment && refreshedPayment.status === 'SUCCESS') {
          const updatedTeam = await TeamModel.findById(refreshedPayment.team).lean();
          return res.status(200).send({
            success: true,
            message: 'Thanh toán đã được xác nhận thành công (từ webhook)!',
            checked: true,
            payment: {
              _id: refreshedPayment._id,
              id: refreshedPayment._id,
              status: refreshedPayment.status,
              paidAt: refreshedPayment.paidAt,
            },
            team: {
              plan: 'PREMIUM',
              planExpiredAt: updatedTeam.planExpiredAt,
            },
          });
        }
      }
      
      // Xử lý response từ SEPAY (format có thể khác nhau)
      let transactions = [];
      if (Array.isArray(transactionsData)) {
        transactions = transactionsData;
      } else if (transactionsData.data && Array.isArray(transactionsData.data)) {
        transactions = transactionsData.data;
      } else if (transactionsData.transactions && Array.isArray(transactionsData.transactions)) {
        transactions = transactionsData.transactions;
      } else {
        console.error('SEPAY transactions response format không nhận dạng được:', transactionsData);
        return res.status(200).send({
          success: false,
          message: 'Không thể parse danh sách giao dịch từ SEPAY',
          checked: true,
        });
      }

      // Tìm giao dịch thỏa mãn điều kiện
      const expectedAmount = payment.amount;
      const expectedDescription = payment.metadata?.transferDescription || `TKPVQ1_${payment.team}_${payment._id}`;
      
      // Tìm giao dịch chưa được xử lý
      const matchingTransaction = transactions.find((txn) => {
        // Kiểm tra transaction đã được xử lý chưa
        if (payment.processedTransactionIds && payment.processedTransactionIds.includes(String(txn.id || txn.transactionId || txn._id))) {
          return false;
        }

        // Kiểm tra số tiền
        const txnAmount = Number(txn.amount || txn.value || txn.money || 0);
        if (txnAmount !== expectedAmount) {
          return false;
        }

        // Kiểm tra nội dung chuyển khoản
        const txnDescription = String(txn.description || txn.content || txn.note || txn.message || '');
        if (!txnDescription.includes(expectedDescription)) {
          // Thử tìm với format ngắn hơn: TKPVQ1_<TEAM_ID>
          const shortDescription = `TKPVQ1_${payment.team}`;
          if (!txnDescription.includes(shortDescription)) {
            return false;
          }
        }

        return true;
      });

      if (!matchingTransaction) {
        return res.status(200).send({
          success: false,
          message: 'Chưa tìm thấy giao dịch phù hợp. Vui lòng kiểm tra lại số tiền và nội dung chuyển khoản.',
          checked: true,
          payment: {
            status: payment.status,
            amount: payment.amount,
            expectedDescription,
          },
        });
      }

      // Tìm thấy giao dịch hợp lệ - Cập nhật payment và team
      await verifyPaymentSuccess(payment, TeamModel);

      // Đánh dấu transaction đã được xử lý
      const transactionId = String(matchingTransaction.id || matchingTransaction.transactionId || matchingTransaction._id);
      if (!payment.processedTransactionIds) {
        payment.processedTransactionIds = [];
      }
      payment.processedTransactionIds.push(transactionId);
      await payment.save();

      const updatedTeam = await TeamModel.findById(payment.team).lean();

      return res.status(200).send({
        success: true,
        message: 'Thanh toán đã được xác nhận thành công!',
        checked: true,
        payment: {
          _id: payment._id,
          id: payment._id,
          status: payment.status,
          paidAt: payment.paidAt,
        },
        team: {
          plan: 'PREMIUM',
          planExpiredAt: updatedTeam.planExpiredAt,
        },
        transaction: {
          id: transactionId,
          amount: matchingTransaction.amount || matchingTransaction.value || matchingTransaction.money,
          description: matchingTransaction.description || matchingTransaction.content || matchingTransaction.note,
        },
      });
    } catch (error) {
      console.error('SEPAY verify by transaction error:', error);
      const errorMessage = error.response?.data?.message || error.message || 'Lỗi khi kiểm tra giao dịch từ SEPAY';
      return res.status(200).send({
        success: false,
        message: `Lỗi khi kiểm tra giao dịch: ${errorMessage}`,
        checked: true,
        error: errorMessage,
      });
    }
  })
);

/**
 * POST /payments/:paymentId/check
 * Tự động kiểm tra payment status (có thể gọi định kỳ từ frontend hoặc cron job)
 * Trong thực tế, có thể tích hợp với API ngân hàng để check transaction
 */
router.post(
  '/:paymentId/check',
  authMid,
  handler(async (req, res) => {
    const { paymentId } = req.params;

    const payment = await PaymentModel.findById(paymentId);
    if (!payment) return res.status(NOT_FOUND).send('Payment không tồn tại');

    // Kiểm tra quyền (chỉ Leader của team đó mới check được)
    const team = await TeamModel.findById(payment.team).lean();
    if (!isTeamLeader(team, req.user.id)) {
      return res.status(UNAUTHORIZED).send('Chỉ Leader mới được check payment');
    }

    if (payment.status !== 'PENDING') {
      return res.send({
        checked: true,
        status: payment.status,
        message: `Payment đã ở trạng thái ${payment.status}`,
      });
    }

    // Kiểm tra với SEPAY nếu provider là SEPAY
    if (payment.provider === 'SEPAY' && payment.metadata?.sepayOrderId) {
      try {
        const sepayStatus = await checkSepayPaymentStatus(payment.metadata.sepayOrderId);
        
        // Xử lý response format linh hoạt
        const statusData = sepayStatus.data || sepayStatus;
        const paymentStatus = statusData.status || sepayStatus.status;
        
        if (paymentStatus === 'SUCCESS' || paymentStatus === 'PAID' || paymentStatus === 'success' || paymentStatus === 'paid') {
          // Tự động verify payment
          await verifyPaymentSuccess(payment, TeamModel);
          const updatedTeam = await TeamModel.findById(payment.team).lean();

          return res.send({
            checked: true,
            status: 'SUCCESS',
            message: 'Thanh toán đã được xác nhận tự động từ SEPAY',
            payment: {
              _id: payment._id,
              status: payment.status,
              paidAt: payment.paidAt,
            },
            team: {
              plan: 'PREMIUM',
              planExpiredAt: updatedTeam.planExpiredAt,
            },
          });
        } else if (paymentStatus === 'FAILED' || paymentStatus === 'CANCELLED' || paymentStatus === 'failed' || paymentStatus === 'cancelled') {
          payment.status = 'FAILED';
          payment.failedAt = new Date();
          await payment.save();

          return res.send({
            checked: true,
            status: 'FAILED',
            message: 'Thanh toán đã bị hủy hoặc thất bại',
            payment: {
              _id: payment._id,
              status: payment.status,
            },
          });
        }
      } catch (sepayError) {
        console.error('SEPAY check error:', sepayError);
        // Tiếp tục với flow thông thường nếu SEPAY check lỗi
      }
    }

    // Trả về status hiện tại (cho BANK_TRANSFER hoặc nếu SEPAY check không thành công)
    res.send({
      checked: true,
      status: payment.status,
      message: payment.status === 'PENDING' 
        ? 'Payment vẫn đang chờ thanh toán. Vui lòng verify thủ công sau khi chuyển khoản.'
        : `Payment đã ở trạng thái ${payment.status}`,
      payment: {
        _id: payment._id,
        amount: payment.amount,
        transactionId: payment.transactionId,
        metadata: payment.metadata,
      },
    });
  })
);

/**
 * GET /payments/teams/:teamId/status
 * Lấy payment status của team
 */
router.get(
  '/teams/:teamId/status',
  authMid,
  handler(async (req, res) => {
    const { teamId } = req.params;

    const team = await TeamModel.findById(teamId).lean();
    if (!team || team.isDeleted) return res.status(NOT_FOUND).send('Team không tồn tại');

    // Kiểm tra user có thuộc team không
    const isMember = team.members?.some((m) => String(m.user) === String(req.user.id));
    if (!isMember && !req.user.isAdmin) {
      return res.status(UNAUTHORIZED).send('Bạn không thuộc team này');
    }

    const latestPayment = await PaymentModel.findOne({
      team: toId(teamId),
      plan: 'PREMIUM',
    })
      .sort('-createdAt')
      .lean();

    res.send({
      team: {
        _id: team._id,
        plan: team.plan,
      },
      latestPayment: latestPayment
        ? {
            _id: latestPayment._id,
            id: latestPayment._id,
            status: latestPayment.status,
            amount: latestPayment.amount,
            createdAt: latestPayment.createdAt,
            paidAt: latestPayment.paidAt,
          }
        : null,
    });
  })
);

/**
 * POST /payments/sepay/webhook
 * Webhook từ SEPAY để xác nhận thanh toán tự động
 * SEPAY sẽ gọi endpoint này sau khi thanh toán thành công
 * Lưu ý: Endpoint này KHÔNG cần authMid vì được gọi từ SEPAY server
 */
router.post(
  '/sepay/webhook',
  handler(async (req, res) => {
    try {
      const webhookData = req.body;

      // Log chi tiết để debug
      console.log(' SEPAY WEBHOOK RECEIVED');
      console.log('Headers:', JSON.stringify(req.headers, null, 2));
      console.log('Body:', JSON.stringify(webhookData, null, 2));
      console.log('Query:', JSON.stringify(req.query, null, 2));



      // SEPAY webhook format có thể khác nhau, cần xử lý linh hoạt
      // Có thể có các field: orderId, transactionId, amount, status, code, message, content, description, etc.
      const orderId = webhookData.orderId || webhookData.code || webhookData.transactionId || webhookData.referenceCode || webhookData.id;
      const status = webhookData.status || webhookData.state || 'SUCCESS'; // Mặc định SUCCESS nếu có tiền vào
      const transactionId = webhookData.transactionId || webhookData.orderId || webhookData.referenceCode;
      const amount = webhookData.amount || webhookData.money || webhookData.transferAmount;
      const content = webhookData.content || webhookData.description || '';
      
      // Nếu không có orderId/code, vẫn có thể tìm payment theo content/description
      // Không return error ngay, để thử tìm payment theo các cách khác

      // Tìm payment theo nhiều cách:
      // 1. Theo orderId/transactionId/referenceCode từ webhook
      let payment = null;
      if (orderId) {
        payment = await PaymentModel.findOne({
          transactionId: String(orderId),
          status: 'PENDING',
          provider: 'SEPAY',
        });

        // 2. Theo sepayOrderId trong metadata
        if (!payment) {
          payment = await PaymentModel.findOne({
            'metadata.sepayOrderId': String(orderId),
            status: 'PENDING',
            provider: 'SEPAY',
          });
        }
      }

      // 3. Theo content/description trong webhook (QUAN TRỌNG: SEPAY gửi nội dung chuyển khoản ở đây)
      // Format: TKPVQ1_<TEAM_SLUG>_<PAYMENT_ID>
      // Webhook có thể có: content, description, hoặc cả hai
      if (!payment && content) {
        const contentStr = String(content);
        console.log(`Searching payment by content/description: ${contentStr}`);

        // Chuẩn hóa chuỗi để bắt được trường hợp SEPAY bỏ dấu "_" hoặc thêm dấu "-"
        const normalize = (s = '') => String(s).replace(/[^A-Za-z0-9]/g, '').toLowerCase();
        const normalizedContent = normalize(contentStr);

        // Tìm payment có transferDescription khớp
        const payments = await PaymentModel.find({
          status: 'PENDING',
          provider: 'SEPAY',
        });
        
        payment = payments.find((p) => {
          const transferDesc = String(p.metadata?.transferDescription || '');
          const teamId = String(p.metadata?.teamId || p.team || '');
          const paymentId = String(p._id || '');

          const normalizedTransferDesc = normalize(transferDesc);
          const normalizedTeamId = normalize(teamId);
          const normalizedPaymentId = normalize(paymentId);

          // 1) So khớp đầy đủ transferDescription (có thể có/không có dấu _)
          if (transferDesc) {
            if (contentStr.includes(transferDesc)) {
              console.log(`Found payment by transferDescription: ${p._id}, transferDesc: ${transferDesc}`);
              return true;
            }
            if (normalizedTransferDesc && normalizedContent.includes(normalizedTransferDesc)) {
              console.log(`Found payment by normalized transferDescription: ${p._id}, normalized: ${normalizedTransferDesc}`);
              return true;
            }
          }

          // 2) So khớp theo format không dấu: TKPVQ1<TEAM_SLUG><PAYMENT_ID>
          if (teamId && paymentId) {
            const formatWithoutUnderscore = `TKPVQ1${teamId}${paymentId}`;
            const normalizedFormat = normalize(formatWithoutUnderscore);
            if (contentStr.includes(formatWithoutUnderscore) || normalizedContent.includes(normalizedFormat)) {
              console.log(`Found payment by format without underscore: ${p._id}, format: ${formatWithoutUnderscore}`);
              return true;
            }
          }

          // 3) So khớp chỉ theo paymentId xuất hiện trong content
          if (paymentId) {
            if (contentStr.includes(paymentId) || normalizedContent.includes(normalizedPaymentId)) {
              console.log(`Found payment by paymentId in content: ${p._id}`);
              return true;
            }
          }

          // 4) Hoặc theo format ngắn: TKPVQ1_<TEAM_ID> hoặc TKPVQ1<TEAM_ID>
          if (teamId) {
            const shortDescWithUnderscore = `TKPVQ1_${teamId}`;
            const shortDescWithoutUnderscore = `TKPVQ1${teamId}`;
            const normalizedShortWith = normalize(shortDescWithUnderscore);
            const normalizedShortWithout = normalize(shortDescWithoutUnderscore);
            if (
              contentStr.includes(shortDescWithUnderscore) ||
              contentStr.includes(shortDescWithoutUnderscore) ||
              normalizedContent.includes(normalizedShortWith) ||
              normalizedContent.includes(normalizedShortWithout)
            ) {
              console.log(`Found payment by short description: ${p._id}, teamId: ${teamId}`);
              return true;
            }
          }

          return false;
        });
      }

      // 4. Theo amount + content/description (nếu có amount)
      if (!payment && amount) {
        const payments = await PaymentModel.find({
          status: 'PENDING',
          provider: 'SEPAY',
          amount: Number(amount),
        });
        
        // Nếu có content/description, tìm payment có description khớp
        if (content) {
          const contentStr = String(content);
          payment = payments.find(p => {
            const transferDesc = String(p.metadata?.transferDescription || '');
            const teamId = String(p.metadata?.teamId || p.team || '');
            const paymentId = String(p._id || '');
            
            if (transferDesc && contentStr.includes(transferDesc)) {
              console.log(`Found payment by amount + transferDescription: ${p._id}`);
              return true;
            }
            
            // Tìm theo format không có dấu gạch dưới: TKPVQ1<TEAM_ID><PAYMENT_ID>
            if (teamId && paymentId) {
              const formatWithoutUnderscore = `TKPVQ1${teamId}${paymentId}`;
              if (contentStr.includes(formatWithoutUnderscore)) {
                console.log(`Found payment by amount + format without underscore: ${p._id}`);
                return true;
              }
            }
            
            // Hoặc tìm theo format ngắn hơn: TKPVQ1_<TEAM_ID> hoặc TKPVQ1<TEAM_ID>
            if (teamId) {
              const shortDescWithUnderscore = `TKPVQ1_${teamId}`;
              const shortDescWithoutUnderscore = `TKPVQ1${teamId}`;
              if (contentStr.includes(shortDescWithUnderscore) || contentStr.includes(shortDescWithoutUnderscore)) {
                console.log(`Found payment by amount + short description: ${p._id}`);
                return true;
              }
            }
            
            return false;
          });
        }
        
        // Nếu không có content nhưng có amount khớp và chỉ có 1 payment PENDING với amount đó
        // (trường hợp này không an toàn lắm, nhưng có thể dùng nếu chắc chắn)
        if (!payment && payments.length === 1) {
          console.log(`Found payment by amount only (only 1 payment with this amount): ${payments[0]._id}`);
          payment = payments[0];
        }
      }

      if (!payment) {
        console.warn(`=== PAYMENT NOT FOUND ===`);
        console.warn(`OrderId/Code from webhook: ${orderId}`);
        console.warn(`Webhook data:`, JSON.stringify(webhookData, null, 2));
        console.warn(`Searching for PENDING SEPAY payments...`);
        
        // Log tất cả payments PENDING để debug
        const allPendingPayments = await PaymentModel.find({
          status: 'PENDING',
          provider: 'SEPAY',
        }).lean();
        console.warn(`Found ${allPendingPayments.length} PENDING SEPAY payments:`);
        allPendingPayments.forEach(p => {
          console.warn(`  - Payment ID: ${p._id}`);
          console.warn(`    TransactionId: ${p.transactionId}`);
          console.warn(`    Amount: ${p.amount}`);
          console.warn(`    TransferDescription: ${p.metadata?.transferDescription || 'N/A'}`);
          console.warn(`    TeamId: ${p.metadata?.teamId || 'N/A'}`);
        });
        console.warn(`===========================`);
        
        // Trả về 200 để SEPAY không retry (vì có thể là giao dịch không liên quan)
        return res.status(200).send({ 
          success: true, 
          message: 'Payment not found, but webhook received',
          debug: {
            orderId,
            webhookData,
            pendingPaymentsCount: allPendingPayments.length,
          }
        });
      }

      // Verify amount (nếu có amount trong webhook)
      if (amount && payment.amount !== Number(amount)) {
        console.error(`Amount mismatch: payment=${payment.amount}, webhook=${amount}`);
        // Vẫn xử lý nhưng log warning
        console.warn('Processing payment despite amount mismatch');
      }

      // Xử lý theo status
      // Nếu webhook là "Có tiền vào" và "Là WebHooks xác thực thanh toán" = Đúng
      // Thì mặc định là SUCCESS
      const normalizedStatus = String(status).toUpperCase();
      if (normalizedStatus === 'SUCCESS' || normalizedStatus === 'PAID' || normalizedStatus === 'COMPLETED' || !status) {
        // Nếu không có status, coi như thành công (vì webhook được trigger khi có tiền vào)
        await verifyPaymentSuccess(payment, TeamModel);
        console.log(`Payment ${payment._id} verified via SEPAY webhook`);
        
        return res.status(200).send({
          success: true,
          message: 'Payment verified successfully',
        });
      } else if (normalizedStatus === 'FAILED' || normalizedStatus === 'CANCELLED' || normalizedStatus === 'CANCELED') {
        payment.status = 'FAILED';
        payment.failedAt = new Date();
        await payment.save();

        return res.status(200).send({
          success: true,
          message: 'Payment marked as failed',
        });
      }

      // Trường hợp khác
      console.log('SEPAY webhook received with unknown status:', status);
      return res.status(200).send({
        success: true,
        message: 'Webhook received',
      });
    } catch (error) {
      console.error('SEPAY webhook error:', error);
      res.status(500).send('Webhook processing error');
    }
  })
);

export default router;

