/**
 * Helper function để verify payment thành công
 * Cập nhật payment status và team plan
 * @param {Object} payment - Payment document
 * @param {Object} TeamModel - Team model
 */
export async function verifyPaymentSuccess(payment, TeamModel) {
  if (!payment || !TeamModel) {
    throw new Error('Payment và TeamModel là bắt buộc');
  }

  // Cập nhật payment status
  payment.status = 'SUCCESS';
  payment.paidAt = new Date();
  await payment.save();

  // Cập nhật team plan
  const team = await TeamModel.findById(payment.team);
  if (!team) {
    throw new Error('Team không tồn tại');
  }

  // Cập nhật team plan = PREMIUM và thời hạn 5 phút 
  const now = new Date();
  const expiredAt = new Date(now);
  expiredAt.setMinutes(expiredAt.getMinutes() + 5); 

  team.plan = 'PREMIUM';
  team.planExpiredAt = expiredAt;
  await team.save();

  return {
    payment,
    team,
  };
}

