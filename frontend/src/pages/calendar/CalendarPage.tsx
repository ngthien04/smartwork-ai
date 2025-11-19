// src/pages/calendar/CalendarPage.tsx
import { useMemo, useState } from 'react';
import { Row, Col, Card, Button, Calendar, Modal, Form, Input, DatePicker, Space, Typography, List, message } from 'antd';
import { PlusOutlined, CalendarOutlined, ClockCircleOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { calendarServices } from '@/services/calendarServices';
import dayjs from 'dayjs';
import { taskServices } from '@/services/taskServices';

const { Title, Text } = Typography;
export default function CalendarPage() {
  const { t } = useTranslation();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<any>(null);
  const [selectedDate, setSelectedDate] = useState(dayjs());
  const [aiSuggestions, setAiSuggestions] = useState<any[]>([]);

  const queryClient = useQueryClient();

  // Fetch events for current month
  const { data: eventsData } = useQuery({
    queryKey: ['events', selectedDate.format('YYYY-MM')],
    queryFn: () => {
      const start = selectedDate.startOf('month').toISOString();
      const end = selectedDate.endOf('month').toISOString();
      return calendarServices.getEvents(start, end);
    },
  });

  const events = eventsData?.data || [];

  // Create event mutation
  const createEventMutation = useMutation({
    mutationFn: calendarServices.createEvent,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['events'] });
      setIsModalOpen(false);
    },
  });

  // Update event mutation
  const updateEventMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => 
      calendarServices.updateEvent(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['events'] });
    },
  });

  // Delete event mutation
  const deleteEventMutation = useMutation({
    mutationFn: calendarServices.removeEvent,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['events'] });
    },
  });

  // AI Suggest mutation
  const aiSuggestMutation = useMutation({
    mutationFn: calendarServices.aiSuggest,
    onSuccess: (data) => {
      setAiSuggestions(data.data);
    },
  });

  const { data: taskListResponse } = useQuery({
    queryKey: ['calendar', 'tasks'],
    queryFn: () => taskServices.list({ size: 20 }),
  });

  const pendingTasks = useMemo(() => {
    const items = taskListResponse?.items || taskListResponse?.data || [];
    return items.filter((task) => task.status !== 'done');
  }, [taskListResponse]);

  const handleCreateEvent = () => {
    setEditingEvent(null);
    setIsModalOpen(true);
  };

  const handleEditEvent = (event: any) => {
    setEditingEvent(event);
    setIsModalOpen(true);
  };

  const handleDeleteEvent = (eventId: string) => {
    Modal.confirm({
      title: 'Xác nhận xóa',
      content: 'Bạn có chắc chắn muốn xóa sự kiện này?',
      onOk: () => deleteEventMutation.mutate(eventId),
    });
  };

  const handleModalSubmit = (values: any) => {
    const eventData = {
      ...values,
      start: values.start.toISOString(),
      end: values.end.toISOString(),
    };

    if (editingEvent) {
      updateEventMutation.mutate({ id: editingEvent.id, data: eventData });
    } else {
      createEventMutation.mutate(eventData);
    }
  };

  const handleAiSuggest = () => {
    if (pendingTasks.length === 0) {
      message.info('Không có công việc nào cần đề xuất lịch trình.');
      return;
    }

    const workingSlots = Array.from({ length: 5 }).map((_, index) => ({
      start: dayjs().add(index + 1, 'day').hour(9).minute(0).second(0).millisecond(0).toISOString(),
      end: dayjs().add(index + 1, 'day').hour(17).minute(0).second(0).millisecond(0).toISOString(),
    }));

    aiSuggestMutation.mutate({
      tasks: pendingTasks.map((task) => ({
        id: task.id,
        title: task.title,
        estimatedTime: task.estimate || task.storyPoints || 1,
        priority: task.priority,
      })),
      slots: workingSlots,
    });
  };

  const getEventsForDate = (date: dayjs.Dayjs) => {
    return events.filter(event => 
      dayjs(event.start).isSame(date, 'day')
    );
  };

  const dateCellRender = (date: dayjs.Dayjs) => {
    const dayEvents = getEventsForDate(date);
    
    return (
      <div className="calendar-events">
        {dayEvents.map(event => (
          <div
            key={event.id}
            className="text-xs bg-blue-100 text-blue-800 p-1 mb-1 rounded cursor-pointer"
            onClick={() => handleEditEvent(event)}
          >
            {event.title}
          </div>
        ))}
      </div>
    );
  };

  return (
    <div className="calendar-page">
      <div className="mb-6">
        <Title level={2} className="m-0">{t('calendar.title')}</Title>
      </div>

      <Row gutter={[24, 24]}>
        {/* Calendar */}
        <Col xs={24} lg={16}>
          <Card className="h-full">
            <div className="mb-4 flex justify-between items-center">
              <Space>
                <Button
                  type="primary"
                  icon={<PlusOutlined />}
                  onClick={handleCreateEvent}
                >
                  {t('calendar.createEvent')}
                </Button>
                <Button
                  icon={<CalendarOutlined />}
                  onClick={handleAiSuggest}
                  loading={aiSuggestMutation.isPending}
                >
                  {t('calendar.aiSuggestSchedule')}
                </Button>
              </Space>
            </div>

            <Calendar
              value={selectedDate}
              onChange={setSelectedDate}
              cellRender={dateCellRender}
              className="h-full"
            />
          </Card>
        </Col>

        {/* AI Suggestions & Events List */}
        <Col xs={24} lg={8}>
          <Space direction="vertical" className="w-full" size="large">
            {/* AI Suggestions */}
            {aiSuggestions.length > 0 && (
              <Card title="Đề xuất từ AI" className="w-full">
                <List
                  dataSource={aiSuggestions}
                  renderItem={(suggestion) => (
                    <List.Item
                      actions={[
                        <Button size="small" type="primary">
                          Chấp nhận
                        </Button>
                      ]}
                    >
                      <List.Item.Meta
                        title={suggestion.taskTitle}
                        description={
                          <Space>
                            <ClockCircleOutlined />
                            <Text type="secondary">
                              {dayjs(suggestion.suggestedTime.start).format('HH:mm')} - 
                              {dayjs(suggestion.suggestedTime.end).format('HH:mm')}
                            </Text>
                          </Space>
                        }
                      />
                    </List.Item>
                  )}
                />
              </Card>
            )}

            {/* Today's Events */}
            <Card title="Sự kiện hôm nay" className="w-full">
              <List
                dataSource={getEventsForDate(dayjs())}
                renderItem={(event) => (
                  <List.Item
                    actions={[
                      <Button
                        size="small"
                        onClick={() => handleEditEvent(event)}
                      >
                        Sửa
                      </Button>,
                      <Button
                        size="small"
                        danger
                        onClick={() => handleDeleteEvent(event.id)}
                      >
                        Xóa
                      </Button>,
                    ]}
                  >
                    <List.Item.Meta
                      title={event.title}
                      description={
                        <Space>
                          <ClockCircleOutlined />
                          <Text type="secondary">
                            {dayjs(event.start).format('HH:mm')} - 
                            {dayjs(event.end).format('HH:mm')}
                          </Text>
                          {event.location && (
                            <>
                              <Text type="secondary">•</Text>
                              <Text type="secondary">{event.location}</Text>
                            </>
                          )}
                        </Space>
                      }
                    />
                  </List.Item>
                )}
              />
            </Card>
          </Space>
        </Col>
      </Row>

      {/* Event Modal */}
      <Modal
        title={editingEvent ? 'Sửa sự kiện' : t('calendar.createEvent')}
        open={isModalOpen}
        onCancel={() => setIsModalOpen(false)}
        footer={null}
        width={600}
      >
        <Form
          layout="vertical"
          onFinish={handleModalSubmit}
          initialValues={editingEvent ? {
            ...editingEvent,
            start: dayjs(editingEvent.start),
            end: dayjs(editingEvent.end),
          } : {}}
        >
          <Form.Item
            name="title"
            label={t('calendar.eventTitle')}
            rules={[{ required: true, message: 'Vui lòng nhập tiêu đề' }]}
          >
            <Input placeholder="Nhập tiêu đề sự kiện..." />
          </Form.Item>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="start"
                label={t('calendar.eventStart')}
                rules={[{ required: true, message: 'Vui lòng chọn thời gian bắt đầu' }]}
              >
                <DatePicker showTime className="w-full" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="end"
                label={t('calendar.eventEnd')}
                rules={[{ required: true, message: 'Vui lòng chọn thời gian kết thúc' }]}
              >
                <DatePicker showTime className="w-full" />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item
            name="location"
            label={t('calendar.eventLocation')}
          >
            <Input placeholder="Nhập địa điểm..." />
          </Form.Item>

          <Form.Item className="mb-0">
            <Space className="w-full justify-end">
              <Button onClick={() => setIsModalOpen(false)}>
                {t('common.cancel')}
              </Button>
              <Button 
                type="primary" 
                htmlType="submit"
                loading={createEventMutation.isPending || updateEventMutation.isPending}
              >
                {t('common.save')}
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
