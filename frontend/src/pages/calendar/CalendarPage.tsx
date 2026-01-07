import { useMemo, useState } from "react";
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
  Divider,
  Select,
} from "antd";
import {
  ClockCircleOutlined,
  EnvironmentOutlined,
  ReloadOutlined,
} from "@ant-design/icons";
import { useTranslation } from "react-i18next";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import dayjs from "dayjs";
import { useNavigate } from "react-router-dom";

import {
  calendarServices,
  type CalendarEvent,
} from "@/services/calendarServices";
import { taskCalendarServices } from "@/services/taskCalendarServices";

const { Title, Text } = Typography;

type EventFormValues = {
  title: string;
  start: dayjs.Dayjs;
  end: dayjs.Dayjs;
  location?: string;
  description?: string;
};

function monthRange(d: dayjs.Dayjs) {
  const start = d.startOf("month").startOf("week");
  const end = d.endOf("month").endOf("week");
  return { start, end };
}

type UnifiedEvent =
  | (CalendarEvent & { source: "manual" })
  | {
      source: "task";
      taskId: string;
      title: string;
      start: string;
      end: string;
      color?: string;
      description?: string;
      priority?: "low" | "normal" | "high" | "urgent";
      status?: string;
    };

function priorityColor(p?: UnifiedEvent extends any ? any : never) {
  switch (p) {
    case "urgent":
      return "red";
    case "high":
      return "orange";
    case "normal":
      return "blue";
    case "low":
      return "default";
    default:
      return "default";
  }
}

export default function CalendarPage() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const [panelDate, setPanelDate] = useState(dayjs());
  const [selectedDate, setSelectedDate] = useState(dayjs());
  const [isModalOpen, setIsModalOpen] = useState(false);

  const [editingEvent, setEditingEvent] = useState<CalendarEvent | null>(null);

  const [viewingTaskEvent, setViewingTaskEvent] = useState<UnifiedEvent | null>(
    null
  );

  const { start, end } = useMemo(() => monthRange(panelDate), [panelDate]);

  const manualEventsQuery = useQuery({
    queryKey: ["events", start.format("YYYY-MM-DD"), end.format("YYYY-MM-DD")],
    queryFn: async () => {
      const res = await calendarServices.getEvents(
        start.toISOString(),
        end.toISOString()
      );
      return res.data || [];
    },
    staleTime: 0,
    refetchOnWindowFocus: true,
    retry: 1,
  });

  const taskDeadlinesQuery = useQuery({
    queryKey: [
      "taskDeadlines",
      start.format("YYYY-MM-DD"),
      end.format("YYYY-MM-DD"),
    ],
    queryFn: async () => {
      const res = await taskCalendarServices.getTaskDeadlines(
        start.toISOString(),
        end.toISOString()
      );
      return res.data || [];
    },
    staleTime: 0,
    refetchOnWindowFocus: true,
    retry: 1,
  });

  const loading = manualEventsQuery.isLoading || taskDeadlinesQuery.isLoading;

  const unifiedEvents: UnifiedEvent[] = useMemo(() => {
    const manual = (manualEventsQuery.data || []).map((ev) => ({
      ...ev,
      source: "manual" as const,
    }));

    const tasks = (taskDeadlinesQuery.data || []).map((t) => {
      const due = dayjs(t.dueDate);
      const startTime =
        due.hour() === 0 && due.minute() === 0 ? due.hour(9).minute(0) : due;
      const endTime = startTime.add(30, "minute");

      const color =
        t.priority === "urgent"
          ? "#ff4d4f"
          : t.priority === "high"
          ? "#fa8c16"
          : t.priority === "normal"
          ? "#1677ff"
          : "#8c8c8c";

      const descParts: string[] = [];
      if (t.status) descParts.push(`Status: ${t.status}`);
      if (t.priority) descParts.push(`Priority: ${t.priority}`);
      if (t.projectName) descParts.push(`Project: ${t.projectName}`);
      if (t.teamName) descParts.push(`Team: ${t.teamName}`);

      return {
        source: "task" as const,
        taskId: t.id,
        title: `Deadline: ${t.title}`,
        start: startTime.toISOString(),
        end: endTime.toISOString(),
        color,
        description: descParts.join(" • "),
        priority: t.priority,
        status: t.status,
      };
    });

    return [...manual, ...tasks];
  }, [manualEventsQuery.data, taskDeadlinesQuery.data]);

  const createEventMutation = useMutation({
    mutationFn: calendarServices.createEvent,
    onSuccess: async () => {
      message.success("Đã tạo sự kiện");
      setIsModalOpen(false);
      await queryClient.invalidateQueries({ queryKey: ["events"] });
    },
    onError: (err: any) =>
      message.error(err?.response?.data || "Tạo sự kiện thất bại"),
  });

  const updateEventMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) =>
      calendarServices.updateEvent(id, data),
    onSuccess: async () => {
      message.success("Đã cập nhật sự kiện");
      setIsModalOpen(false);
      setEditingEvent(null);
      await queryClient.invalidateQueries({ queryKey: ["events"] });
    },
    onError: (err: any) =>
      message.error(err?.response?.data || "Cập nhật thất bại"),
  });

  const deleteEventMutation = useMutation({
    mutationFn: (id: string) => calendarServices.removeEvent(id),
    onSuccess: async () => {
      message.success("Đã xoá sự kiện");
      await queryClient.invalidateQueries({ queryKey: ["events"] });
    },
    onError: (err: any) => message.error(err?.response?.data || "Xoá thất bại"),
  });

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingEvent(null);
  };

  const openCreateModal = (prefillDate?: dayjs.Dayjs) => {
    setEditingEvent(null);
    if (prefillDate) setSelectedDate(prefillDate);
    setIsModalOpen(true);
  };

  const openEditManualModal = (ev: CalendarEvent) => {
    setEditingEvent(ev);
    setIsModalOpen(true);
  };

  const openTaskEventModal = (ev: UnifiedEvent) => {
    setViewingTaskEvent(ev);
  };

  const getEventsForCell = (date: dayjs.Dayjs) => {
    return unifiedEvents
      .filter((ev) => dayjs(ev.start).isSame(date, "day"))
      .sort((a, b) => dayjs(a.start).valueOf() - dayjs(b.start).valueOf());
  };

  const eventsForDate = useMemo(() => {
    return unifiedEvents
      .filter((ev) => dayjs(ev.start).isSame(selectedDate, "day"))
      .sort((a, b) => dayjs(a.start).valueOf() - dayjs(b.start).valueOf());
  }, [unifiedEvents, selectedDate]);

  const onSubmit = (values: EventFormValues) => {
    if (values.start.isSame(values.end) || values.start.isAfter(values.end)) {
      message.warning("Thời gian kết thúc phải lớn hơn thời gian bắt đầu");
      return;
    }

    const payload = {
      title: values.title,
      start: values.start.toISOString(),
      end: values.end.toISOString(),
      location: values.location || "",
      description: values.description || "",
    };

    if (editingEvent?._id) {
      updateEventMutation.mutate({ id: editingEvent._id, data: payload });
    } else {
      createEventMutation.mutate(payload);
    }
  };

  const dateCellRender = (date: dayjs.Dayjs) => {
    const dayEvents = getEventsForCell(date);
    if (!dayEvents.length) return null;

    return (
      <div style={{ marginTop: 6 }}>
        {dayEvents.slice(0, 3).map((ev) => {
          const id = ev.source === "manual" ? ev._id : ev.taskId;
          const title = ev.title;

          return (
            <Tooltip key={id} title={title}>
              <div
                onClick={(e) => {
                  e.stopPropagation();
                  if (ev.source === "manual") openEditManualModal(ev);
                  else openTaskEventModal(ev);
                }}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  cursor: "pointer",
                  fontSize: 12,
                  padding: "2px 6px",
                  borderRadius: 10,
                  background:
                    ev.source === "task" ? "rgba(255,77,79,0.08)" : "#f5f5f5",
                  border:
                    ev.source === "task"
                      ? "1px solid rgba(255,77,79,0.18)"
                      : "1px solid rgba(0,0,0,0.06)",
                  marginBottom: 4,
                }}
              >
                <span
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: 999,
                    background: ev.color || "#1677ff",
                    display: "inline-block",
                    flex: "0 0 auto",
                  }}
                />
                <span
                  style={{
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                  }}
                >
                  {title}
                </span>
              </div>
            </Tooltip>
          );
        })}

        {dayEvents.length > 3 ? (
          <div style={{ fontSize: 12, color: "#999", paddingLeft: 6 }}>
            +{dayEvents.length - 3} more
          </div>
        ) : null}
      </div>
    );
  };

  return (
    <div className="calendar-page space-y-4">
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
        <div>
          <Title level={2} className="m-0">
            {t("calendar.title") || "Calendar"}
          </Title>
        </div>

        <Space>
          <Button
            icon={<ReloadOutlined />}
            onClick={() => {
              queryClient.invalidateQueries({ queryKey: ["events"] });
              queryClient.invalidateQueries({ queryKey: ["taskDeadlines"] });
            }}
            loading={loading}
          >
            Reload
          </Button>
        </Space>
      </div>

      <Row gutter={[16, 16]}>
        <Col xs={24} lg={16}>
          <Card loading={loading}>
            <Calendar
              value={selectedDate}
              onSelect={(d: any, info: any) => {
                setSelectedDate(d);
                if (info?.source === "date" && !isModalOpen) openCreateModal(d);
              }}
              onPanelChange={(d) => setPanelDate(d)}
              cellRender={dateCellRender as any}
              headerRender={({ value, onChange }) => {
                const cur = value; // dayjs
                const year = cur.year();
                const month = cur.month(); // 0..11

                const monthOptions = Array.from({ length: 12 }).map((_, i) => ({
                  label: dayjs().month(i).format("MM"),
                  value: i,
                }));

                const yearOptions = Array.from({ length: 7 }).map((_, idx) => {
                  const y = year - 3 + idx;
                  return { label: String(y), value: y };
                });

                return (
                  <div className="flex items-center justify-between mb-2">
                    <Space>
                      <Button
                        size="small"
                        onClick={() => {
                          const next = cur.subtract(1, "month");
                          onChange(next);
                          setPanelDate(next);
                        }}
                      >
                        ← Tháng trước
                      </Button>

                      <Button
                        size="small"
                        onClick={() => {
                          const next = cur.add(1, "month");
                          onChange(next);
                          setPanelDate(next);
                        }}
                      >
                        Tháng sau →
                      </Button>
                    </Space>

                    <Space>
                      <Select
                        size="small"
                        value={year}
                        style={{ width: 110 }}
                        options={yearOptions}
                        onChange={(y) => {
                          const next = cur.year(y);
                          onChange(next);
                          setPanelDate(next);
                        }}
                      />
                      <Select
                        size="small"
                        value={month}
                        style={{ width: 90 }}
                        options={monthOptions}
                        onChange={(m) => {
                          const next = cur.month(m);
                          onChange(next);
                          setPanelDate(next);
                        }}
                      />
                    </Space>
                  </div>
                );
              }}
            />
          </Card>
        </Col>

        <Col xs={24} lg={8}>
          <Card
            title={
              <Space>
                <span>Sự kiện</span>
                <Tag>{selectedDate.format("DD/MM/YYYY")}</Tag>
              </Space>
            }
          >
            {eventsForDate.length === 0 ? (
              <Text type="secondary">Chưa có sự kiện trong ngày này.</Text>
            ) : (
              <List
                dataSource={eventsForDate}
                renderItem={(ev) => {
                  const isTask = ev.source === "task";

                  const startStr = dayjs(ev.start).format("HH:mm");
                  const endStr = dayjs(ev.end).format("HH:mm");

                  return (
                    <List.Item
                      actions={
                        isTask
                          ? [
                              <Button
                                key="open"
                                size="small"
                                type="primary"
                                onClick={() =>
                                  navigate(`/tasks/${(ev as any).taskId}`)
                                }
                              >
                                Mở task
                              </Button>,
                            ]
                          : [
                              <Button
                                key="edit"
                                size="small"
                                onClick={() => openEditManualModal(ev as any)}
                              >
                                Sửa
                              </Button>,
                              <Popconfirm
                                key="del"
                                title="Xóa sự kiện?"
                                description="Bạn có chắc muốn xóa sự kiện này không?"
                                okText="Xóa"
                                cancelText="Hủy"
                                okButtonProps={{ danger: true }}
                                onConfirm={() =>
                                  deleteEventMutation.mutate((ev as any)._id)
                                }
                              >
                                <Button
                                  size="small"
                                  danger
                                  loading={deleteEventMutation.isPending}
                                >
                                  Xóa
                                </Button>
                              </Popconfirm>,
                            ]
                      }
                    >
                      <List.Item.Meta
                        title={
                          <Space wrap>
                            <span
                              style={{
                                width: 10,
                                height: 10,
                                borderRadius: 999,
                                background: ev.color || "#1677ff",
                                display: "inline-block",
                              }}
                            />
                            <span style={{ fontWeight: 600 }}>{ev.title}</span>
                            {isTask ? (
                              <Tag color={priorityColor((ev as any).priority)}>
                                deadline
                              </Tag>
                            ) : (
                              <Tag>event</Tag>
                            )}
                          </Space>
                        }
                        description={
                          <Space direction="vertical" size={2}>
                            <Space>
                              <ClockCircleOutlined />
                              <Text type="secondary">
                                {startStr} - {endStr}
                              </Text>
                            </Space>

                            {!isTask && (ev as any).location ? (
                              <Space>
                                <EnvironmentOutlined />
                                <Text type="secondary">
                                  {(ev as any).location}
                                </Text>
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
                  );
                }}
              />
            )}
          </Card>
        </Col>
      </Row>

      {/* Modal Create/Edit manual event */}
      <Modal
        open={isModalOpen}
        title={editingEvent ? "Sửa sự kiện" : "Tạo sự kiện"}
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
                  title: "",
                  location: "",
                  description: "",
                  start: selectedDate.hour(9).minute(0).second(0),
                  end: selectedDate.hour(10).minute(0).second(0),
                }
          }
        >
          <Form.Item
            name="title"
            label="Tiêu đề"
            rules={[{ required: true, message: "Nhập tiêu đề" }]}
          >
            <Input placeholder="Ví dụ: Daily standup" />
          </Form.Item>

          <Row gutter={12}>
            <Col xs={24} md={12}>
              <Form.Item
                name="start"
                label="Bắt đầu"
                rules={[{ required: true, message: "Chọn thời gian bắt đầu" }]}
              >
                <DatePicker showTime className="w-full" />
              </Form.Item>
            </Col>
            <Col xs={24} md={12}>
              <Form.Item
                name="end"
                label="Kết thúc"
                rules={[{ required: true, message: "Chọn thời gian kết thúc" }]}
              >
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
                loading={
                  createEventMutation.isPending || updateEventMutation.isPending
                }
              >
                Lưu
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        open={!!viewingTaskEvent}
        onCancel={() => setViewingTaskEvent(null)}
        footer={null}
        title="Deadline từ Task"
        width={520}
        destroyOnClose
      >
        {viewingTaskEvent && viewingTaskEvent.source === "task" ? (
          <Space direction="vertical" className="w-full">
            <div>
              <Text strong>{viewingTaskEvent.title}</Text>
              <div style={{ marginTop: 6 }}>
                <Tag color={priorityColor(viewingTaskEvent.priority)}>
                  {viewingTaskEvent.priority || "normal"}
                </Tag>
                {viewingTaskEvent.status ? (
                  <Tag>{viewingTaskEvent.status}</Tag>
                ) : null}
              </div>
            </div>

            <Divider style={{ margin: "8px 0" }} />

            <Space>
              <ClockCircleOutlined />
              <Text type="secondary">
                {dayjs(viewingTaskEvent.start).format("DD/MM/YYYY HH:mm")}
              </Text>
            </Space>

            {viewingTaskEvent.description ? (
              <Text type="secondary" style={{ fontSize: 12 }}>
                {viewingTaskEvent.description}
              </Text>
            ) : null}

            <Space className="w-full justify-end">
              <Button onClick={() => setViewingTaskEvent(null)}>Đóng</Button>
              <Button
                type="primary"
                onClick={() => navigate(`/tasks/${viewingTaskEvent.taskId}`)}
              >
                Mở Task Detail
              </Button>
            </Space>
          </Space>
        ) : null}
      </Modal>
    </div>
  );
}
