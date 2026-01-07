
import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import StatusBadge from '@/components/ui/StatusBadge';
import UserAvatar from '@/components/ui/UserAvatar';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { ROUTES } from '@/routes/path';
import {
  PlusOutlined,
  CalendarOutlined,
  RocketOutlined,
  FileTextOutlined,
} from '@ant-design/icons';
import { useQuery } from '@tanstack/react-query';
import dayjs from 'dayjs';
import taskServices from '@/services/taskServices';
import { calendarServices } from '@/services/calendarServices';
import { noteServices } from '@/services/noteServices';
import inviteService from '@/services/inviteService';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Alert, Button, Space, message, Tag, Avatar, Typography, Tooltip } from 'antd';
import type { Task as ApiTask } from '@/services/taskServices';

const { Text } = Typography;


export default function Dashboard() {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const queryClient = useQueryClient();

  const { data: myInvitesRes } = useQuery({
    queryKey: ['my-invites'],
    queryFn: () => inviteService.listMine(),
  });

  const myInvites = myInvitesRes?.data?.items || [];

  const acceptMutation = useMutation({
    mutationFn: (token: string) => inviteService.accept(token),
    onSuccess: (res) => {
      message.success('Đã tham gia team thành công');
      queryClient.invalidateQueries({ queryKey: ['my-invites'] });
      
      queryClient.invalidateQueries({ queryKey: ['teams'] });
      
      const teamId = (res.data as any)?.team?._id || (res.data as any)?.teamId;
      if (teamId) {
        navigate(`/teams/${teamId}`);
      }
    },
    onError: (err: any) => {
      message.error(err?.response?.data || 'Chấp nhận lời mời thất bại');
    },
  });

  const declineMutation = useMutation({
    mutationFn: (inviteId: string) => inviteService.cancel(inviteId),
    onSuccess: () => {
      message.info('Đã từ chối lời mời');
      queryClient.invalidateQueries({ queryKey: ['my-invites'] });
    },
    onError: (err: any) => {
      message.error(err?.response?.data || 'Không từ chối được lời mời');
    },
  });


  // Summary thống kê: total 
  const { data: tasksSummary } = useQuery({
    queryKey: ['dashboard', 'tasks-summary'],
    queryFn: () => taskServices.list({ limit: 1 }),
  });

  // Số task đã hoàn thành
  const { data: doneSummary } = useQuery({
    queryKey: ['dashboard', 'tasks-done-summary'],
    queryFn: () => taskServices.list({ status: 'done', limit: 1 }),
  });

  // Danh sách task để hiển thị recent tasks 
  const { data: tasksResponse } = useQuery({
    queryKey: ['dashboard', 'tasks'],
    queryFn: () => taskServices.list({ limit: 20 }),
  });

const { data: notesRes } = useQuery({
  queryKey: ['dashboard', 'notes'],
  queryFn: () => noteServices.list({ page: 1, size: 1 }),
});

  const notesTotal = useMemo(() => {
    const data = notesRes?.data;
    if (!data) return undefined;
    if (Array.isArray(data)) return data.length; 
    return data.total ?? data.items?.length ?? 0; 
  }, [notesRes]);

  const { data: eventsResponse } = useQuery({
    queryKey: ['dashboard', 'events'],
    queryFn: () => {
      const from = dayjs().startOf('day').toISOString();
      const to = dayjs().add(7, 'day').endOf('day').toISOString();
      return calendarServices.getEvents(from, to);
    },
  });

  const recentTasks = useMemo<ApiTask[]>(() => {
    const items = tasksResponse?.data?.items ?? [];
    return items.slice(0, 5);
  }, [tasksResponse]);


  const completedTasks = useMemo(() => {
    const totalDone =
      doneSummary?.data?.total ??
      doneSummary?.data?.items?.length ??
      0;
    return totalDone;
  }, [doneSummary]);

  const totalTasks =
    tasksSummary?.data?.total ??
    tasksSummary?.data?.items?.length ??
    0;


  // Deadline task trong 7 ngày tới (chưa hoàn thành)
  const upcomingTaskDeadlines = useMemo(() => {
    const items: ApiTask[] = tasksResponse?.data?.items ?? [];
    const now = dayjs().startOf('day');
    const to = dayjs().add(7, 'day').endOf('day');

    return items
      .filter((task) => {
        if (!task.dueDate) return false;
        if (task.status === 'done') return false;
        const due = dayjs(task.dueDate);
        return due.isAfter(now) && due.isBefore(to);
      })
      .map((task) => ({
        _id: `task-deadline-${task._id}`,
        title: `[Deadline] ${task.title}`,
        start: task.dueDate,
        end: task.dueDate,
      }));
  }, [tasksResponse]);

  // Kết hợp sự kiện lịch + deadline task
  const upcomingEvents = useMemo(() => {
    const raw = eventsResponse?.data as any;
    const calendarEvents: any[] = Array.isArray(raw) ? raw : raw?.items || [];

    const merged = [...calendarEvents, ...upcomingTaskDeadlines].sort((a, b) =>
      dayjs(a.start).valueOf() - dayjs(b.start).valueOf(),
    );

    return merged.slice(0, 5);
  }, [eventsResponse, upcomingTaskDeadlines]);

  const quickActions = [
    {
      title: t('dashboard.aiPlan'),
      description: 'Lập kế hoạch công việc với AI',
      icon: <RocketOutlined className="text-2xl text-blue-500" />,
      action: () => navigate(ROUTES.ASSISTANT),
    },
    {
      title: t('tasks.createTask'),
      description: 'Tạo công việc mới',
      icon: <PlusOutlined className="text-2xl text-green-500" />,
      action: () => navigate(ROUTES.TASKS),
    },
    {
      title: t('notes.createNote'),
      description: 'Tạo ghi chú mới',
      icon: <FileTextOutlined className="text-2xl text-purple-500" />,
      action: () => navigate(ROUTES.NOTES),
    },
  ];

  // Priority color config matching Kanban.tsx
  const priorityConfig: Record<string, { color: string }> = {
    low: { color: 'green' },
    normal: { color: 'blue' },
    medium: { color: 'blue' },
    high: { color: 'orange' },
    urgent: { color: 'red' },
  };

  const getPriorityColor = (priority: string) => {
    return priorityConfig[priority]?.color || priorityConfig.normal.color;
  };

  const dashboardStats = [
    {
      label: 'Công việc hoàn thành',
      value: totalTasks ? `${completedTasks}/${totalTasks}` : '—',
      color: 'text-green-600',
    },
    {
      label: 'Ghi chú đã tạo',
      value: notesTotal ?? '—',
      color: 'text-blue-600',
    },
    {
      label: 'Sự kiện tuần này',
      value: upcomingEvents.length,
      color: 'text-purple-600',
    },
  ];

  return (
    <div className="dashboard p-3 sm:p-4 md:p-6" style={{ minHeight: '100vh', overflowX: 'hidden', width: '100%', maxWidth: '100%' }}>
      <div className="mb-4 sm:mb-6">
        <h1 className="text-2xl sm:text-3xl font-bold">{t('dashboard.title')}</h1>
        <p className="text-muted-foreground text-sm sm:text-base">Chào mừng bạn quay trở lại! Đây là tổng quan về công việc của bạn.</p>
      </div>

      {myInvites.length > 0 && (
        <div className="mb-4">
          <Alert
            type="info"
            showIcon
            message={`Bạn có ${myInvites.length} lời mời tham gia team`}
            description={
              <div>
                {myInvites.map((inv) => (
                  <div
                    key={inv._id}
                    className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-2"
                  >
                    <div className="text-sm sm:text-base">
                      Bạn được mời vào team{' '}
                      <b>{typeof inv.team === 'string' ? inv.team : inv.team?.name || '—'}</b>{' '}
                      với vai trò <b>{inv.role}</b>.
                    </div>
                    <Space className="flex-wrap">
                      <Button
                        type="primary"
                        size="small"
                        loading={acceptMutation.isPending  && acceptMutation.variables === inv.token}
                        onClick={() => acceptMutation.mutate(inv.token)}
                      >
                        Chấp nhận
                      </Button>

                      <Button
                        type="default"
                        danger
                        size="small"
                        loading={declineMutation.isPending  && declineMutation.variables === inv._id}
                        onClick={() => declineMutation.mutate(inv._id)}
                      >
                        Từ chối
                      </Button>
                    </Space>
                  </div>
                ))}
              </div>
            }
          />
        </div>
      )}


      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
        {/* Quick Actions */}
        <div className="lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>{t('dashboard.quickActions')}</CardTitle>
            </CardHeader>
            <CardContent className="max-h-80 overflow-y-auto pr-1">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {quickActions.map((action, index) => (
                  <Card key={index} className="cursor-pointer hover:shadow-md transition-shadow" onClick={action.action}>
                    <CardContent className="p-4 text-center">
                      <div className="space-y-2">
                        {action.icon}
                        <h3 className="font-semibold">{action.title}</h3>
                        <p className="text-sm text-muted-foreground">
                          {action.description}
                        </p>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Statistics */}
        <div>
          <Card>
            <CardHeader>
              <CardTitle>Thống kê</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {dashboardStats.map((stat) => (
                <div key={stat.label} className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">{stat.label}</span>
                  <span className={`text-2xl font-bold ${stat.color}`}>{stat.value}</span>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>

        {/* Recent Tasks */}
        <div className="lg:col-span-2">
          <Card>
            <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
              <CardTitle className="text-base sm:text-lg">{t('dashboard.recentTasks')}</CardTitle>
              <Button type="default" size="small" className="w-full sm:w-auto" onClick={() => navigate(ROUTES.TASKS)}>
                Xem tất cả
              </Button>
            </CardHeader>
            <CardContent className="max-h-80 overflow-y-auto pr-1">
              {recentTasks.length === 0 ? (
                <p className="text-sm text-muted-foreground">Chưa có công việc nào gần đây.</p>
              ) : (
                <div className="space-y-3">
                  {recentTasks.map((task: ApiTask) => {
                    const priority = task.priority || 'normal';
                    const assignees = (task.assignees as any[]) || [];
                    
                    return (
                      <div 
                        key={task._id} 
                        className="p-3 border rounded-lg hover:shadow-md transition-shadow cursor-pointer"
                        onClick={() => navigate(`/tasks/${task._id}`)}
                      >
                        <Space direction="vertical" size="small" className="w-full">
                          {/* Title */}
                          <div>
                            <Text strong className="block">
                              {task.title}
                            </Text>
                            {task.description && (
                              <Text type="secondary" className="text-xs block mt-1">
                                {task.description.length > 100
                                  ? `${task.description.substring(0, 100)}...`
                                  : task.description}
                              </Text>
                            )}
                          </div>

                          {/* Tags: Priority + Status */}
                          <div className="flex flex-wrap gap-2">
                            <Tag color={getPriorityColor(priority)}>
                              {priority}
                            </Tag>
                            <StatusBadge status={task.status || 'todo'} />
                          </div>

                          {/* Assignees */}
                          {assignees.length > 0 && (
                            <div>
                              <Text type="secondary" className="text-xs block mb-1">
                                Assignees
                              </Text>
                              <Avatar.Group>
                                {assignees.map((assignee: any) => {
                                  const id = String(assignee?.id || assignee?._id || assignee);
                                  const name = assignee?.name || assignee?.email || id;
                                  
                                  return (
                                    <Tooltip key={id} title={name}>
                                      <UserAvatar 
                                        user={{
                                          id,
                                          name: assignee?.name,
                                          email: assignee?.email,
                                          avatarUrl: assignee?.avatarUrl,
                                        }}
                                        size="small"
                                      />
                                    </Tooltip>
                                  );
                                })}
                              </Avatar.Group>
                            </div>
                          )}

                          {/* Due Date */}
                          {task.dueDate && (
                            <Text type="secondary" className="text-xs">
                              Deadline: {dayjs(task.dueDate).format('DD/MM/YYYY')}
                            </Text>
                          )}
                        </Space>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Upcoming Events */}
        <div>
          <Card>
            <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
              <CardTitle className="text-base sm:text-lg">{t('dashboard.upcomingEvents')}</CardTitle>
              <Button type="default" size="small" className="w-full sm:w-auto" onClick={() => navigate(ROUTES.CALENDAR)}>
                Xem lịch
              </Button>
            </CardHeader>
            <CardContent className="max-h-80 overflow-y-auto pr-1">
              {upcomingEvents.length === 0 ? (
                <p className="text-sm text-muted-foreground">Chưa có sự kiện nào sắp diễn ra.</p>
              ) : (
                <div className="space-y-3">
                  {upcomingEvents.map((event: any) => (
                    <div key={event._id} className="flex items-center space-x-3 p-3 border rounded-lg">
                      <CalendarOutlined className="text-blue-500 shrink-0" />
                      <div className="min-w-0 flex-1">
                        <p className="font-medium truncate">{event.title}</p>
                        <p className="text-sm text-muted-foreground">
                          {dayjs(event.start).format('DD/MM HH:mm')} • {dayjs(event.end).format('HH:mm')}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
