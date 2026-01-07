import { Tag } from 'antd';
import type { Task } from '@/types';

/**
 * Status configuration matching Kanban.tsx
 * This ensures consistent status colors and labels across the application
 */
export const statusConfig: Record<Task['status'], { title: string; color: string }> = {
  todo: { title: 'Cần làm', color: 'default' },
  in_progress: { title: 'Đang làm', color: 'blue' },
  done: { title: 'Hoàn thành', color: 'green' },
  backlog: { title: 'Tồn đọng', color: 'gray' },
  review: { title: 'Đang review', color: 'purple' },
  blocked: { title: 'Bị chặn', color: 'red' },
};

interface StatusBadgeProps {
  status: Task['status'] | string;
  showTitle?: boolean;
  className?: string;
}

/**
 * Reusable StatusBadge component
 * Displays task status with consistent colors and labels
 * 
 * @example
 * <StatusBadge status="in_progress" />
 * <StatusBadge status="done" showTitle />
 */
export default function StatusBadge({ status, showTitle = false, className }: StatusBadgeProps) {
  // Normalize status string (handle variations like "in-progress" -> "in_progress")
  const normalizedStatus = status?.replace(/-/g, '_') as Task['status'];
  
  // Get config for this status, fallback to default if not found
  const config = statusConfig[normalizedStatus] || { 
    title: status || 'unknown', 
    color: 'default' 
  };

  return (
    <Tag color={config.color} className={className}>
      {showTitle ? config.title : (status || 'unknown')}
    </Tag>
  );
}

