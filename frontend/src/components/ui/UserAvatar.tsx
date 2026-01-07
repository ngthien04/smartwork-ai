import { Avatar, Tooltip } from 'antd';
import type { AvatarProps } from 'antd';

interface UserAvatarProps extends Omit<AvatarProps, 'src' | 'children'> {
  user?: {
    _id?: string;
    id?: string;
    name?: string;
    email?: string;
    avatarUrl?: string;
    avatar?: string;
  } | null;
  /**
   * Fallback text if user name is not available
   * @default '?'
   */
  fallback?: string;
  /**
   * Show user name as tooltip
   * @default true
   */
  showTooltip?: boolean;
}

/**
 * Reusable UserAvatar component
 * Displays user avatar with consistent format and style
 * Matches the format used in TaskDetailPage (Assignees, Reporter)
 * 
 * @example
 * <UserAvatar user={user} />
 * <UserAvatar user={user} size={40} />
 * <Avatar.Group>
 *   {users.map(u => <UserAvatar key={u.id} user={u} />)}
 * </Avatar.Group>
 */
export default function UserAvatar({ 
  user, 
  fallback = '?',
  showTooltip = true,
  ...avatarProps 
}: UserAvatarProps) {
  if (!user) {
    return <Avatar {...avatarProps}>{fallback}</Avatar>;
  }

  const avatarUrl = user.avatarUrl || user.avatar;
  const displayName = user.name || user.email || fallback;
  const initials = displayName && displayName.length > 0 
    ? displayName[0].toUpperCase() 
    : fallback;

  const avatar = (
    <Avatar 
      src={avatarUrl} 
      {...avatarProps}
    >
      {initials}
    </Avatar>
  );

  if (showTooltip && displayName) {
    return <Tooltip title={displayName}>{avatar}</Tooltip>;
  }

  return avatar;
}

