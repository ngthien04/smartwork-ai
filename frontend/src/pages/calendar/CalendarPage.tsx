import { useMemo, useState } from 'react';
import {
  Row,
  Col,
  Card,
  Button,
  Calendar,
  Modal,
  Form,
  Input,
  DatePicker,
  Space,
  Typography,
  List,
  message,
  Tag,
  Popconfirm,
  Tooltip,
} from 'antd';
import { ClockCircleOutlined, EnvironmentOutlined, ReloadOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import dayjs from 'dayjs';

import { calendarServices, type CalendarEvent } from '@/services/calendarServices';

const { Title, Text } = Typography;

type EventFormValues = {
  title: string;
  start: dayjs.Dayjs;
  end: dayjs.Dayjs;
  location?: string;
  description?: string;
};

function monthRange(d: dayjs.Dayjs) {
  const start = d.startOf('month').startOf('week');
  const end = d.endOf('month').endOf('week');
  return { start, end };
}

export default function CalendarPage() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();

  const [panelDate, setPanelDate] = useState(dayjs());
  const [selectedDate, setSelectedDate] = useState(dayjs());
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<CalendarEvent | null>(null);

  const { start, end } = useMemo(() => monthRange(panelDate), [panelDate]);

  // -------------------------
  // Query
  // -------------------------
  const eventsQuery = useQuery({
    queryKey: ['events', start.format('YYYY-MM-DD'), end.format('YYYY-MM-DD')],
    queryFn: async () => {
      const res = await calendarServices.getEvents(start.toISOString(), end.toISOString());
      return res.data || [];
    },
    staleTime: 0,
    refetchOnWindowFocus: true,
    retry: 1,
  });

  const events = eventsQuery.data || [];
  const loading = eventsQuery.isLoading;

  // -------------------------
  // Mutations
  // -------------------------
  const createEventMutation = useMutation({
    mutationFn: calendarServices.createEvent,
    onSuccess: async () => {
      message.success('Đã tạo sự kiện');
      setIsModalOpen(false);
      await queryClient.invalidateQueries({ queryKey: ['events'] });
    },
    onError: (err: any) => message.error(err?.response?.data || 'Tạo sự kiện thất bại'),
  });

  const updateEventMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => calendarServices.updateEvent(id, data),
    onSuccess: async () => {
      message.success('Đã cập nhật sự kiện');
      setIsModalOpen(false);
      setEditingEvent(null);
      await queryClient.invalidateQueries({ queryKey: ['events'] });
    },
    onError: (err: any) => message.error(err?.response?.data || 'Cập nhật thất bại'),
  });

  const deleteEventMutation = useMutation({
    mutationFn: (id: string) => calendarServices.removeEvent(id),
    onSuccess: async () => {
      message.success('Đã xoá sự kiện');
      await queryClient.invalidateQueries({ queryKey: ['events'] });
    },
    onError: (err: any) => message.error(err?.response?.data || 'Xoá thất bại'),
  });

  // -------------------------
  // Helpers
  // -------------------------
  const closeModal = () => {
    setIsModalOpen(false);
    setEditingEvent(null);
  };

  const openCreateModal = (prefillDate?: dayjs.Dayjs) => {
    setEditingEvent(null);
    if (prefillDate) setSelectedDate(prefillDate);
    setIsModalOpen(true);
  };

  const openEditModal = (ev: CalendarEvent) => {
    setEditingEvent(ev);
    setIsModalOpen(true);
  };

  const getEventsForCell = (date: dayjs.Dayjs) => {
    return events
      .filter((ev) => dayjs(ev.start).isSame(date, 'day'))
      .sort((a, b) => dayjs(a.start).valueOf() - dayjs(b.start).valueOf());
  };

  const eventsForDate = useMemo(() => {
    return events
      .filter((ev) => dayjs(ev.start).isSame(selectedDate, 'day'))
      .sort((a, b) => dayjs(a.start).valueOf() - dayjs(b.start).valueOf());
  }, [events, selectedDate]);

  const onSubmit = (values: EventFormValues) => {
    if (values.start.isSame(values.end) || values.start.isAfter(values.end)) {
      message.warning('Thời gian kết thúc phải lớn hơn thời gian bắt đầu');
      return;
    }

    const payload = {
      title: values.title,
      start: values.start.toISOString(),
      end: values.end.toISOString(),
      location: values.location || '',
      description: values.description || '',
    };

    if (editingEvent?._id) {
      updateEventMutation.mutate({ id: editingEvent._id, data: payload });
    } else {
      createEventMutation.mutate(payload);
    }
  };

  // -------------------------
  // Cell render
  // -------------------------
  const dateCellRender = (date: dayjs.Dayjs) => {
    const dayEvents = getEventsForCell(date);
    if (!dayEvents.length) return null;

    return (
      <div style={{ marginTop: 6 }}>
        {dayEvents.slice(0, 3).map((ev) => (
          <Tooltip key={ev._id} title={ev.title}>
            <div
              onClick={(e) => {
                e.stopPropagation();
                openEditModal(ev);
              }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                cursor: 'pointer',
                fontSize: 12,
                padding: '2px 6px',
                borderRadius: 8,
                background: '#f5f5f5',
                marginBottom: 4,
              }}
            >
              <span
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: 999,
                  background: ev.color || '#1677ff',
                  display: 'inline-block',
                  flex: '0 0 auto',
                }}
              />
              <span
                style={{
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}
              >
                {ev.title}
              </span>
            </div>
          </Tooltip>
        ))}
        {dayEvents.length > 3 ? (
          <div style={{ fontSize: 12, color: '#999', paddingLeft: 6 }}>
            +{dayEvents.length - 3} more
          </div>
        ) : null}
      </div>
    );
  };

  return (
    <div className="calendar-page space-y-4">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
        <div>
          <Title level={2} className="m-0">
            {t('calendar.title') || 'Calendar'}
          </Title>
          <Text type="secondary">Click vào ô ngày để tạo sự kiện • Click vào sự kiện để sửa</Text>
        </div>

        <Space>
          <Button
            icon={<ReloadOutlined />}
            onClick={() => queryClient.invalidateQueries({ queryKey: ['events'] })}
            loading={loading}
          >
            Reload
          </Button>
        </Space>
      </div>

      <Row gutter={[16, 16]}>
        {/* Main Calendar */}
        <Col xs={24} lg={16}>
          <Card loading={loading}>
            <Calendar
              value={selectedDate}
              onSelect={(d: any, info: any) => {
                setSelectedDate(d);
                if (info?.source === 'date' && !isModalOpen) openCreateModal(d);
              }}
              onPanelChange={(d) => setPanelDate(d)}
              cellRender={dateCellRender as any}
            />
          </Card>
        </Col>

        {/* Right sidebar: selected day events (CHỈ HIỂN THỊ) */}
        <Col xs={24} lg={8}>
          <Card
            title={
              <Space>
                <span>Sự kiện</span>
                <Tag>{selectedDate.format('DD/MM/YYYY')}</Tag>
              </Space>
            }
          >
            {eventsForDate.length === 0 ? (
              <Text type="secondary">Chưa có sự kiện trong ngày này.</Text>
            ) : (
              <List
                dataSource={eventsForDate}
                renderItem={(ev) => (
                  <List.Item
                    actions={[
                      <Button key="edit" size="small" onClick={() => openEditModal(ev)}>
                        Sửa
                      </Button>,
                      <Popconfirm
                        key="del"
                        title="Xóa sự kiện?"
                        description="Bạn có chắc muốn xóa sự kiện này không?"
                        okText="Xóa"
                        cancelText="Hủy"
                        okButtonProps={{ danger: true }}
                        onConfirm={() => deleteEventMutation.mutate(ev._id)}
                      >
                        <Button size="small" danger loading={deleteEventMutation.isPending}>
                          Xóa
                        </Button>
                      </Popconfirm>,
                    ]}
                  >
                    <List.Item.Meta
                      title={
                        <Space>
                          <span
                            style={{
                              width: 10,
                              height: 10,
                              borderRadius: 999,
                              background: ev.color || '#1677ff',
                              display: 'inline-block',
                            }}
                          />
                          <span style={{ fontWeight: 600 }}>{ev.title}</span>
                        </Space>
                      }
                      description={
                        <Space direction="vertical" size={2}>
                          <Space>
                            <ClockCircleOutlined />
                            <Text type="secondary">
                              {dayjs(ev.start).format('HH:mm')} - {dayjs(ev.end).format('HH:mm')}
                            </Text>
                          </Space>

                          {ev.location ? (
                            <Space>
                              <EnvironmentOutlined />
                              <Text type="secondary">{ev.location}</Text>
                            </Space>
                          ) : null}

                          {ev.description ? (
                            <Text type="secondary" style={{ fontSize: 12 }}>
                              {ev.description}
                            </Text>
                          ) : null}
                        </Space>
                      }
                    />
                  </List.Item>
                )}
              />
            )}
          </Card>
        </Col>
      </Row>

      {/* Modal Create/Edit */}
      <Modal
        open={isModalOpen}
        title={editingEvent ? 'Sửa sự kiện' : 'Tạo sự kiện'}
        onCancel={closeModal}
        footer={null}
        width={640}
        destroyOnClose
      >
        <Form<EventFormValues>
          layout="vertical"
          onFinish={onSubmit}
          initialValues={
            editingEvent
              ? {
                  title: editingEvent.title,
                  location: editingEvent.location,
                  description: editingEvent.description,
                  start: dayjs(editingEvent.start),
                  end: dayjs(editingEvent.end),
                }
              : {
                  title: '',
                  location: '',
                  description: '',
                  start: selectedDate.hour(9).minute(0).second(0),
                  end: selectedDate.hour(10).minute(0).second(0),
                }
          }
        >
          <Form.Item name="title" label="Tiêu đề" rules={[{ required: true, message: 'Nhập tiêu đề' }]}>
            <Input placeholder="Ví dụ: Daily standup" />
          </Form.Item>

          <Row gutter={12}>
            <Col xs={24} md={12}>
              <Form.Item name="start" label="Bắt đầu" rules={[{ required: true, message: 'Chọn thời gian bắt đầu' }]}>
                <DatePicker showTime className="w-full" />
              </Form.Item>
            </Col>
            <Col xs={24} md={12}>
              <Form.Item name="end" label="Kết thúc" rules={[{ required: true, message: 'Chọn thời gian kết thúc' }]}>
                <DatePicker showTime className="w-full" />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item name="location" label="Địa điểm">
            <Input placeholder="Ví dụ: Zoom / Phòng họp A" />
          </Form.Item>

          <Form.Item name="description" label="Mô tả">
            <Input.TextArea rows={3} placeholder="Ghi chú thêm..." />
          </Form.Item>

          <Form.Item className="mb-0">
            <Space className="w-full justify-end">
              <Button onClick={closeModal}>Hủy</Button>
              <Button
                type="primary"
                htmlType="submit"
                loading={createEventMutation.isPending || updateEventMutation.isPending}
              >
                Lưu
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
