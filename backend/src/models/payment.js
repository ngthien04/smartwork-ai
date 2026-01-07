import { model, Schema } from 'mongoose';

const PaymentSchema = new Schema(
  {
    team: { type: Schema.Types.ObjectId, ref: 'team', required: true, index: true },
    amount: { type: Number, required: true },
    currency: { type: String, default: 'VND' },
    provider: {
      type: String,
      enum: ['VNPAY', 'MOMO', 'STRIPE', 'MOCK', 'BANK_TRANSFER', 'SEPAY'],
      default: 'MOCK',
    },
    status: {
      type: String,
      enum: ['PENDING', 'SUCCESS', 'FAILED', 'CANCELLED'],
      default: 'PENDING',
      index: true,
    },
    plan: {
      type: String,
      enum: ['PREMIUM'],
      required: true,
    },
    transactionId: String, // ID từ payment provider
    paymentUrl: String, // URL thanh toán (QR code hoặc redirect)
    qrCode: String, // QR code data URL 
    metadata: { type: Schema.Types.Mixed, default: {} },
    processedTransactionIds: [{ type: String }], // Track các transaction đã xử lý để tránh duplicate
    paidAt: Date,
    failedAt: Date,
    cancelledAt: Date,
  },
  { timestamps: true }
);

PaymentSchema.index({ team: 1, status: 1 });
PaymentSchema.index({ transactionId: 1 });

export const PaymentModel = model('payment', PaymentSchema);

