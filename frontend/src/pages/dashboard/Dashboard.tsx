// src/pages/dashboard/Dashboard.tsx
import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { ROUTES } from '@/routes/path';
import {
  PlusOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  CalendarOutlined,
  RocketOutlined,
  FileTextOutlined,
} from '@ant-design/icons';
import { useQuery } from '@tanstack/react-query';
import dayjs from 'dayjs';
import { taskServices } from '@/services/taskServices';
import { calendarServices } from '@/services/calendarServices';
import { noteServices } from '@/services/noteServices';

export default function Dashboard() {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const { data: tasksResponse } = useQuery({
    queryKey: ['dashboard', 'tasks'],
    queryFn: () => taskServices.list({ size: 20 }),
  });

  const { data: notesResponse } = useQuery({
    queryKey: ['dashboard', 'notes'],
    queryFn: () => noteServices.list({ page: 1, size: 1 }),
  });

  const { data: eventsResponse } = useQuery({
    queryKey: ['dashboard', 'events'],
    queryFn: () => {
      const from = dayjs().startOf('day').toISOString();
      const to = dayjs().add(7, 'day').endOf('day').toISOString();
      return calendarServices.getEvents(from, to);
    },
  });

  const recentTasks = useMemo(() => {
    const items = tasksResponse?.items || tasksResponse?.data || [];
    return items.slice(0, 5);
  }, [tasksResponse]);

  const completedTasks = useMemo(() => {
    const items = tasksResponse?.items || tasksResponse?.data || [];
    return items.filter((task) => task.status === 'done').length;
  }, [tasksResponse]);

  const totalTasks = tasksResponse?.total ?? (tasksResponse?.items || tasksResponse?.data || []).length;

  const upcomingEvents = useMemo(() => {
    return (eventsResponse?.data || []).slice(0, 5);
  }, [eventsResponse]);

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

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'urgent': return 'destructive';
      case 'high': return 'default';
      case 'medium': return 'secondary';
      case 'low': return 'outline';
      default: return 'secondary';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'done': return <CheckCircleOutlined className="text-green-500" />;
      case 'in_progress': return <ClockCircleOutlined className="text-blue-500" />;
      default: return <ClockCircleOutlined className="text-gray-400" />;
    }
  };

  const dashboardStats = [
    {
      label: 'Công việc hoàn thành',
      value: totalTasks ? `${completedTasks}/${totalTasks}` : '—',
      color: 'text-green-600',
    },
    {
      label: 'Ghi chú đã tạo',
      value: notesResponse?.total ?? '—',
      color: 'text-blue-600',
    },
    {
      label: 'Sự kiện tuần này',
      value: upcomingEvents.length,
      color: 'text-purple-600',
    },
  ];

  return (
    <div className="dashboard p-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold">{t('dashboard.title')}</h1>
        <p className="text-muted-foreground">Chào mừng bạn quay trở lại! Đây là tổng quan về công việc của bạn.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Quick Actions */}
        <div className="lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>{t('dashboard.quickActions')}</CardTitle>
            </CardHeader>
            <CardContent>
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
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>{t('dashboard.recentTasks')}</CardTitle>
              <Button variant="outline" onClick={() => navigate(ROUTES.TASKS)}>
                Xem tất cả
              </Button>
            </CardHeader>
            <CardContent>
              {recentTasks.length === 0 ? (
                <p className="text-sm text-muted-foreground">Chưa có công việc nào gần đây.</p>
              ) : (
                <div className="space-y-3">
                  {recentTasks.map((task) => (
                    <div key={task.id} className="flex items-center justify-between p-3 border rounded-lg">
                      <div className="flex items-center space-x-3">
                        {getStatusIcon(task.status)}
                        <div>
                          <p className="font-medium">{task.title}</p>
                          <div className="flex items-center space-x-2">
                            <Badge variant={getPriorityColor(task.priority || 'normal')}>
                              {task.priority || 'normal'}
                            </Badge>
                            <Badge variant="outline">{task.status || 'unknown'}</Badge>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Upcoming Events */}
        <div>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>{t('dashboard.upcomingEvents')}</CardTitle>
              <Button variant="outline" onClick={() => navigate(ROUTES.CALENDAR)}>
                Xem lịch
              </Button>
            </CardHeader>
            <CardContent>
              {upcomingEvents.length === 0 ? (
                <p className="text-sm text-muted-foreground">Chưa có sự kiện nào sắp diễn ra.</p>
              ) : (
                <div className="space-y-3">
                  {upcomingEvents.map((event) => (
                    <div key={event.id} className="flex items-center space-x-3 p-3 border rounded-lg">
                      <CalendarOutlined className="text-blue-500" />
                      <div>
                        <p className="font-medium">{event.title}</p>
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
