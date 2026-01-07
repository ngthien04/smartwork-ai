import { useQuery } from '@tanstack/react-query';
import { useParams } from 'react-router-dom';
import teamService from '@/services/teamService';

export type PlanType = 'FREE' | 'PREMIUM';

/**
 * Hook để lấy plan của team hiện tại
 * @param teamId - Optional teamId, nếu không có sẽ lấy từ route params
 */
export function useTeamPlan(teamId?: string) {
  // Safely get route params - useParams can be called outside router context in some edge cases
  let routeTeamId: string | undefined;
  try {
    const params = useParams<{ teamId?: string }>();
    routeTeamId = params?.teamId;
  } catch (e) {
    // If useParams fails (shouldn't happen but safety check)
    routeTeamId = undefined;
  }
  
  const finalTeamId = teamId || routeTeamId || undefined;

  const { data: team, isLoading, error } = useQuery({
    queryKey: ['team', finalTeamId],
    queryFn: () => {
      if (!finalTeamId) throw new Error('Team ID is required');
      return teamService.getById(finalTeamId);
    },
    enabled: !!finalTeamId,
  });

  const plan: PlanType = team?.data?.plan || 'FREE';
  const planExpiredAt = team?.data?.planExpiredAt ? new Date(team.data.planExpiredAt) : null;
  
  // Check if premium plan is still valid (not expired)
  const now = new Date();
  const isPremiumValid = plan === 'PREMIUM' && planExpiredAt && planExpiredAt > now;
  const isPremium = isPremiumValid;
  const isFree = !isPremiumValid;

  // If premium expired, treat as FREE
  const effectivePlan: PlanType = isPremiumValid ? 'PREMIUM' : 'FREE';

  return {
    plan: effectivePlan,
    isPremium,
    isFree,
    planExpiredAt,
    team,
    isLoading,
    error,
    teamId: finalTeamId,
  };
}

/**
 * Check xem team có quyền dùng AI feature không
 * - FREE: giới hạn một số tính năng phân tích sâu (AI Insights)
 * - PREMIUM: mở toàn bộ
 *
 * Quy ước:
 * - 'chat'      : Chat assistant (FREE)
 * - 'triage'    : Bug triage (FREE)
 * - 'planning'  : Task planning (FREE)
 * - 'status'    : Status analysis (FREE theo yêu cầu)
 * - 'priority'  : Priority analysis / AI Insights (PREMIUM)
 */
export function canUseAIFeature(
  plan: PlanType,
  feature: 'chat' | 'priority' | 'planning' | 'triage' | 'status'
): boolean {
  if (plan === 'PREMIUM') {
    return true; // Premium có tất cả
  }

  // FREE: cho phép chat, triage, planning, status
  if (plan === 'FREE') {
    return feature === 'chat' || feature === 'triage' || feature === 'planning' || feature === 'status';
  }

  return false;
}

/**
 * Hook để check quyền dùng AI feature
 * Nếu không có teamId, mặc định cho phép (fallback để không crash)
 */
export function useAIFeatureAccess(feature: 'chat' | 'priority' | 'planning' | 'triage' | 'status', teamId?: string) {
  // Always call useTeamPlan - it will handle getting teamId from route params if needed
  const { plan, isPremium, isLoading, teamId: resolvedTeamId } = useTeamPlan(teamId);
  
  // Nếu không có teamId, mặc định cho phép (fallback)
  // Trong thực tế, có thể cần check từ user's teams hoặc context
  if (!resolvedTeamId) {
    return {
      hasAccess: true, // Fallback: cho phép nếu không có team context
      plan: 'FREE' as PlanType,
      isPremium: false,
      isLoading: false,
    };
  }

  const hasAccess = canUseAIFeature(plan, feature);

  return {
    hasAccess,
    plan,
    isPremium,
    isLoading,
  };
}
