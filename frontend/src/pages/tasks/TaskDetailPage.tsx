import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Form,
  Row,
  Col,
  Card,
  Tag,
  Avatar,
  List,
  Timeline,
  Typography,
  Button,
  Space,
  Divider,
  Progress,
  Alert,
  Result,
  message,
  Upload,
  Popconfirm,
  Input,
  Modal,
  Select,
} from 'antd';
import {
  ArrowLeftOutlined,
  PaperClipOutlined,
  CommentOutlined,
  RobotOutlined,
  ThunderboltOutlined,
  UploadOutlined,
  DeleteOutlined,
} from '@ant-design/icons';
import type { RcFile } from 'antd/es/upload/interface';

import type { Attachment as TaskAttachment } from '@/types/attachment';
import type { Subtask } from '@/types/subtask';
import type { Comment } from '@/types/comment';
import type { Activity } from '@/types/activity';

import taskServices from '@/services/taskServices';
import projectServices from '@/services/projectService';
import subtaskServices from '@/services/subtaskServices';
import commentServices from '@/services/commentServices';
import activityServices from '@/services/activityServices';
import labelServices, { type Label } from '@/services/labelServices';

const { Title, Text, Paragraph } = Typography;
const { TextArea } = Input;
const { Option } = Select;

export default function TaskDetailPage() {
  const { taskId } = useParams<{ taskId: string }>();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [task, setTask] = useState<any | null>(null);
  const [project, setProject] = useState<any | null>(null);
  const [attachments, setAttachments] = useState<TaskAttachment[]>([]);

  const [subtasks, setSubtasks] = useState<Subtask[]>([]);
  const [subtasksLoading, setSubtasksLoading] = useState(false);
  const [creatingSubtask, setCreatingSubtask] = useState(false);

  const [comments, setComments] = useState<Comment[]>([]);
  const [commentsLoading, setCommentsLoading] = useState(false);
  const [newComment, setNewComment] = useState('');
  const [postingComment, setPostingComment] = useState(false);

  const [replyingTo, setReplyingTo] = useState<Comment | null>(null);
  const [editingComment, setEditingComment] = useState<Comment | null>(null);

  const [activities, setActivities] = useState<Activity[]>([]);
  const [activitiesLoading, setActivitiesLoading] = useState(false);

  const [subtaskModalOpen, setSubtaskModalOpen] = useState(false);
  const [subtaskForm] = Form.useForm();
  const [subtaskFile, setSubtaskFile] = useState<RcFile | null>(null);
  const [editingSubtask, setEditingSubtask] = useState<Subtask | null>(null);

  const [labels, setLabels] = useState<Label[]>([]);
  const [labelsLoading, setLabelsLoading] = useState(false);

  const [labelModalOpen, setLabelModalOpen] = useState(false);
  const [labelForm] = Form.useForm();
  const [editingLabel, setEditingLabel] = useState<Label | null>(null);
  const [savingLabel, setSavingLabel] = useState(false);

  // ========== LOAD TASK + PROJECT ==========
  useEffect(() => {
    const fetchData = async () => {
      if (!taskId) return;
      try {
        setLoading(true);

        const res = await taskServices.getById(taskId);
        const t: any = res.data || res;
        t.id = t.id || t._id;
        setTask(t);
        setAttachments((t.attachments as TaskAttachment[]) || []);

        const projectId =
          t.project &&
          (typeof t.project === 'string'
            ? t.project
            : (t.project as any)?._id);

        if (projectId) {
          try {
            const projRes = await projectServices.getById(projectId);
            setProject(projRes.data || projRes);
          } catch (e) {
            console.error(e);
          }
        } else {
          setProject(null);
        }
      } catch (err: any) {
        console.error(err);
        message.error(err?.response?.data || 'Không lấy được chi tiết task');
        setTask(null);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [taskId]);

  // ========== LOAD SUBTASKS + COMMENTS + ACTIVITIES ==========
  useEffect(() => {
    if (!task || (!task._id && !task.id)) return;
    const id = task.id || task._id;

    const loadSubtasks = async () => {
      try {
        setSubtasksLoading(true);
        const res = await subtaskServices.list({ parentTask: id, limit: 100 });
        setSubtasks(res.data.items || res.data || []);
      } catch (e: any) {
        console.error(e);
        message.error(e?.response?.data || 'Không tải được subtasks');
      } finally {
        setSubtasksLoading(false);
      }
    };

    const loadComments = async () => {
      try {
        setCommentsLoading(true);
        const res = await commentServices.list({ task: id, limit: 100 });
        setComments(res.data.items || res.data || []);
      } catch (e: any) {
        console.error(e);
        message.error(e?.response?.data || 'Không tải được bình luận');
      } finally {
        setCommentsLoading(false);
      }
    };

    const loadActivities = async () => {
      try {
        setActivitiesLoading(true);
        const res = await activityServices.list({
          targetType: 'task',
          targetId: id,
          limit: 20,
        });
        setActivities(res.data.items || res.data || []);
      } catch (e: any) {
        console.error(e);
        message.error(e?.response?.data || 'Không tải được lịch sử hoạt động');
      } finally {
        setActivitiesLoading(false);
      }
    };

    loadSubtasks();
    loadComments();
    loadActivities();
  }, [task]);

  // ========== AUTO-REFRESH ACTIVITIES ==========
  useEffect(() => {
    if (!task?.id) return;

    const interval = setInterval(() => {
      activityServices
        .list({ targetType: 'task', targetId: task.id, limit: 20 })
        .then((res) => setActivities(res.data.items || res.data || []))
        .catch((err) => console.error(err));
    }, 5000);

    return () => clearInterval(interval);
  }, [task?.id]);

  // ========== LOAD LABELS THEO PROJECT ==========
  useEffect(() => {
    const loadLabels = async () => {
      if (!project) return;
      const team = project.team;
      const teamId = typeof team === 'string' ? team : team?._id;
      if (!teamId) return;

      try {
        setLabelsLoading(true);
        const res = await labelServices.list({
          team: teamId,
          project: project._id || project.id,
          limit: 200,
        });
        setLabels(res.data.items || res.data || []);
      } catch (e: any) {
        console.error(e);
        message.error(e?.response?.data || 'Không tải được nhãn');
      } finally {
        setLabelsLoading(false);
      }
    };

    loadLabels();
  }, [project]);

  // ========== LABEL IDS TRÊN TASK ==========
  const taskLabelIds = useMemo(() => {
    const raw = (task as any)?.labels;

    if (!raw) return [];

    if (Array.isArray(raw)) {
      return raw
        .map((l: any) => String(l?._id || l?.id || l).trim())
        .filter(Boolean);
    }

    if (typeof raw === 'string') {
      try {
        const parsed = JSON.parse(raw);
        const arr = Array.isArray(parsed) ? parsed : [parsed];
        return arr
          .map((id: any) => String(id).trim())
          .filter(Boolean);
      } catch {
        return String(raw)
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean);
      }
    }

    return [];
  }, [task?.labels]);

  // Chỉ object label thuộc task
  const taskLabelObjects: Label[] = useMemo(() => {
    if (!taskLabelIds.length) return [];
    return taskLabelIds
      .map((id) => labels.find((lb) => String(lb._id) === id))
      .filter((x): x is Label => Boolean(x));
  }, [taskLabelIds, labels]);

  // ========== ASSIGNEES ==========
  const assignees = useMemo(() => {
    if (!task?.assignees) return [];
    return (task.assignees as any[]).map((u) => ({
      id: u._id || u.id,
      name: u.name,
      avatarUrl: u.avatarUrl,
      email: u.email,
    }));
  }, [task?.assignees]);

  // ========== SUBTASK PROGRESS ==========
  const subtaskProgress = useMemo(() => {
    if (!subtasks.length) return 0;
    const doneCount = subtasks.filter((s) => s.isDone).length;
    return Math.round((doneCount / subtasks.length) * 100);
  }, [subtasks]);

  const reloadTaskAttachments = async (id: string) => {
    const res = await taskServices.getById(id);
    const t: any = res.data || res;
    t.id = t.id || t._id;
    setTask(t);
    setAttachments((t.attachments as TaskAttachment[]) || []);
  };

  // ========== ATTACHMENTS ==========
  const handleDeleteAttachment = async (attachmentId: string) => {
    if (!task?.id && !task?._id) return;
    const id = task.id || task._id;

    try {
      await taskServices.deleteAttachment(id, attachmentId);
      message.success('Đã xoá tệp đính kèm');
      setAttachments((prev) => prev.filter((att) => att._id !== attachmentId));
    } catch (err: any) {
      console.error(err);
      message.error(err?.response?.data || 'Xoá tệp thất bại');
    }
  };

  const attachmentStats = useMemo(() => {
    const total = attachments.length;

    const subtaskIds = new Set<string>();
    attachments.forEach((att) => {
      const st: any = att.subtask;
      const id =
        typeof st === 'string'
          ? st
          : st?._id || st?.id;

      if (id) subtaskIds.add(String(id));
    });

    return { total, subtaskCount: subtaskIds.size };
  }, [attachments]);

  // ========== SUBTASK HANDLERS ==========
  const handleToggleSubtask = async (subtask: Subtask) => {
    try {
      const res = await subtaskServices.toggle(subtask._id || subtask.id);
      const updated = res.data || res;
      setSubtasks((prev) =>
        prev.map((s) =>
          (s._id || s.id) === (updated._id || updated.id) ? updated : s,
        ),
      );
    } catch (err: any) {
      console.error(err);
      message.error(err?.response?.data || 'Không đổi trạng thái subtask được');
    }
  };

  const handleDeleteSubtask = async (subtask: Subtask) => {
    try {
      await subtaskServices.remove(subtask._id || subtask.id);
      setSubtasks((prev) =>
        prev.filter((s) => (s._id || s.id) !== (subtask._id || subtask.id)),
      );
    } catch (err: any) {
      console.error(err);
      message.error(err?.response?.data || 'Xoá subtask thất bại');
    }
  };

  const handleOpenSubtaskModal = (subtask?: Subtask) => {
    if (subtask) {
      setEditingSubtask(subtask);

      const assignee: any = subtask.assignee;
      const assigneeId = assignee?._id || assignee?.id || assignee || undefined;

      subtaskForm.setFieldsValue({
        title: subtask.title,
        assignee: assigneeId,
      });
    } else {
      setEditingSubtask(null);
      subtaskForm.resetFields();
      setSubtaskFile(null);
    }

    setSubtaskModalOpen(true);
  };

  const handleSubmitSubtask = async () => {
    if (!task?.id && !task?._id) return;
    const taskId = task.id || task._id;

    try {
      const values = await subtaskForm.validateFields();
      setCreatingSubtask(true);

      const assigneeId = values.assignee || undefined;

      if (editingSubtask) {
        const subId = (editingSubtask._id || editingSubtask.id) as string;

        const res = await subtaskServices.update(subId, {
          title: values.title,
          assignee: assigneeId,
        });

        const updated = res.data || res;

        setSubtasks((prev) =>
          prev.map((s) =>
            (s._id || s.id) === (updated._id || updated.id) ? updated : s,
          ),
        );

        setSubtaskModalOpen(false);
        setSubtaskFile(null);
        setEditingSubtask(null);
        subtaskForm.resetFields();
        message.success('Cập nhật subtask thành công');
        return;
      }

      const res = await subtaskServices.create({
        parentTask: taskId,
        title: values.title,
        assignee: assigneeId,
        order: subtasks.length,
      });

      const sub = res.data || res;
      setSubtasks((prev) => [...prev, sub]);

      if (subtaskFile) {
        await taskServices.uploadAttachment(taskId, subtaskFile, {
          folder: 'smartwork/attachments',
          subtaskId: sub._id || sub.id,
        });
        await reloadTaskAttachments(taskId);
      }

      setSubtaskModalOpen(false);
      setSubtaskFile(null);
      setEditingSubtask(null);
      subtaskForm.resetFields();
      message.success('Tạo subtask thành công');
    } catch (err: any) {
      console.error(err);
      if (err?.response?.data) message.error(err.response.data);
      else message.error('Lưu subtask thất bại');
    } finally {
      setCreatingSubtask(false);
    }
  };

  // ========== COMMENT HANDLERS ==========
  const handlePostComment = async () => {
    if (!newComment.trim()) return;
    if (!task?.id && !task?._id) return;
    const id = task.id || task._id;

    try {
      setPostingComment(true);

      if (editingComment) {
        const commentId = (editingComment._id || editingComment.id) as string;
        const res = await commentServices.update(commentId, {
          content: newComment.trim(),
        });
        const updated = res.data || res;

        setComments((prev) =>
          prev.map((c) =>
            (c._id || c.id) === (updated._id || updated.id) ? updated : c,
          ),
        );

        setEditingComment(null);
        setReplyingTo(null);
        setNewComment('');
        return;
      }

      const mentions: string[] = [];

      if (replyingTo) {
        const author: any = replyingTo.author;
        const mentionId = author?._id || author?.id;
        if (mentionId) {
          mentions.push(String(mentionId));
        }
      }

      const res = await commentServices.create({
        task: id,
        content: newComment.trim(),
        mentions,
      });

      const cmt = res.data || res;
      setComments((prev) => [cmt, ...prev]);
      setNewComment('');
      setReplyingTo(null);
    } catch (err: any) {
      console.error(err);
      message.error(err?.response?.data || 'Gửi bình luận thất bại');
    } finally {
      setPostingComment(false);
    }
  };

  const handleDeleteComment = async (comment: Comment) => {
    try {
      await commentServices.remove(comment._id || comment.id);
      setComments((prev) =>
        prev.filter((c) => (c._id || c.id) !== (comment._id || comment.id)),
      );
    } catch (err: any) {
      console.error(err);
      message.error(err?.response?.data || 'Xoá bình luận thất bại');
    }
  };

  // ========== LABEL HANDLERS ==========
  const handleSetLabelsForTask = async (nextIds: string[]) => {
    if (!task?.id && !task?._id) return;
    const id = task.id || task._id;

    await taskServices.setLabels(id, nextIds);

    const nextLabelObjs = labels.filter((lb) =>
      nextIds.includes(String(lb._id)),
    );

    setTask((prev: any) =>
      prev ? { ...prev, labels: nextLabelObjs } : prev,
    );
  };

  const handleAddLabelToTask = async (labelId: string) => {
    const id = String(labelId);
    if (taskLabelIds.includes(id)) return;

    const nextIds = [...taskLabelIds, id];
    try {
      await handleSetLabelsForTask(nextIds);
      message.success('Đã gán nhãn cho task');
    } catch (err: any) {
      console.error(err);
      message.error(err?.response?.data || 'Gán nhãn thất bại');
    }
  };

  const handleRemoveLabelFromTask = async (labelId: string) => {
    const id = String(labelId);
    const nextIds = taskLabelIds.filter((x) => x !== id);

    try {
      await handleSetLabelsForTask(nextIds);
      message.success('Đã bỏ nhãn khỏi task');
    } catch (err: any) {
      console.error(err);
      message.error(err?.response?.data || 'Cập nhật nhãn thất bại');
    }
  };

  // ========== ACTIVITIES VIEW MODEL ==========
  const activityItems = useMemo(() => {
    if (!activities.length) return [];
    return activities.map((a) => {
      const actor: any = a.actor;
      const actorName = actor?.name || 'Ai đó';
      const time = a.createdAt ? new Date(a.createdAt).toLocaleString() : '';
      const action = a.verb;
      return {
        children: `${time} · ${actorName} ${action}`,
      };
    });
  }, [activities]);

  // ========== EARLY RETURNS ==========
  if (!loading && !task) {
    return (
      <Result
        status="404"
        title="Task không tồn tại"
        subTitle="Task này không tìm thấy hoặc bạn không có quyền truy cập."
        extra={
          <Button type="primary" onClick={() => navigate(-1)}>
            Quay lại Tasks
          </Button>
        }
      />
    );
  }

  if (loading || !task) {
    return (
      <div className="p-4">
        <Text>Đang tải dữ liệu task...</Text>
      </div>
    );
  }

  // ========== RENDER ==========
  return (
    <div className="space-y-4">
      <Button icon={<ArrowLeftOutlined />} onClick={() => navigate(-1)}>
        Quay lại bảng công việc
      </Button>

      {/* Header */}
      <div className="flex justify-between items-start flex-col lg:flex-row lg:items-center">
        <div className="space-y-1">
          <Title level={2} className="m-0">
            {task.title}
          </Title>
          <Text type="secondary">
            Thuộc dự án {project?.name ?? 'Chưa gắn dự án'} · Deadline{' '}
            {task.dueDate
              ? new Date(task.dueDate).toLocaleDateString()
              : 'Chưa đặt'}
          </Text>
        </div>
        <Space size="middle" className="mt-3 lg:mt-0">
          <Tag color="orange">{(task.priority || 'normal').toUpperCase()}</Tag>
          <Tag color="blue">{task.status}</Tag>
        </Space>
      </div>

      <Row gutter={[24, 24]}>
        {/* LEFT COLUMN */}
        <Col xs={24} lg={16}>
          <Card title="Thông tin chung">
            <Space direction="vertical" size="middle" className="w-full">
              <Paragraph>{task.description || 'Chưa có mô tả'}</Paragraph>

              <div className="flex flex-wrap gap-2">
                {task.tags?.map((tag: string) => (
                  <Tag key={tag} color="blue">
                    {tag}
                  </Tag>
                ))}
              </div>
              <Divider />

              {/* LABELS - CHỈ HIỆN LABEL CỦA TASK */}
              <div>
                <Space className="mb-2">
                  <Text type="secondary" className="text-xs">
                    Nhãn
                  </Text>
                  <Button
                    size="small"
                    type="link"
                    onClick={() => {
                      setEditingLabel(null);
                      labelForm.resetFields();
                      setLabelModalOpen(true);
                    }}
                  >
                    Quản lý nhãn
                  </Button>
                  {labelsLoading && (
                    <Text type="secondary" className="text-xs">
                      (Đang tải nhãn...)
                    </Text>
                  )}
                </Space>

                <Space direction="vertical" size="small" className="w-full">
                  {/* Chỉ label của task */}
                  <Space wrap>
                    {taskLabelObjects.length === 0 && (
                      <Text type="secondary" className="text-xs">
                        Task này chưa có nhãn nào.
                      </Text>
                    )}

                    {taskLabelObjects.map((lb) => (
                      <Tag
                        key={lb._id}
                        color={lb.color || 'default'}
                        closable
                        onClose={(e) => {
                          e.preventDefault(); // tránh Tag tự remove DOM
                          handleRemoveLabelFromTask(String(lb._id));
                        }}
                        style={{ borderRadius: 4 }}
                      >
                        {lb.name}
                      </Tag>
                    ))}
                  </Space>

                  {/* Dropdown thêm nhãn mới cho task */}
                  <Space>
                    <Select
                      size="small"
                      placeholder="Thêm nhãn..."
                      style={{ minWidth: 160 }}
                      value={undefined}
                      onChange={handleAddLabelToTask}
                      loading={labelsLoading}
                    >
                      {labels
                        .filter(
                          (lb) => !taskLabelIds.includes(String(lb._id)),
                        )
                        .map((lb) => (
                          <Option key={lb._id} value={lb._id}>
                            <span
                              style={{
                                display: 'inline-block',
                                width: 8,
                                height: 8,
                                borderRadius: '50%',
                                background: lb.color || '#d9d9d9',
                                marginRight: 6,
                              }}
                            />
                            {lb.name}
                          </Option>
                        ))}
                    </Select>
                  </Space>
                </Space>
              </div>

              <Divider />

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Text type="secondary" className="block text-xs">
                    Assignees
                  </Text>
                  <Avatar.Group maxCount={5}>
                    {assignees.map((user) => (
                      <Avatar key={user.id} src={user.avatarUrl}>
                        {user.name?.[0]}
                      </Avatar>
                    ))}
                    {assignees.length === 0 && (
                      <Text type="secondary" className="text-xs">
                        Chưa gán người phụ trách
                      </Text>
                    )}
                  </Avatar.Group>
                </div>

                <div>
                  <Text type="secondary" className="block text-xs">
                    Reporter
                  </Text>
                  {task.reporter ? (
                    <Space>
                      <Avatar src={(task.reporter as any).avatarUrl}>
                        {(task.reporter as any).name?.[0]}
                      </Avatar>
                      <div>
                        <Text strong>{(task.reporter as any).name}</Text>
                        <div className="text-xs text-gray-500">
                          {(task.reporter as any).email}
                        </div>
                      </div>
                    </Space>
                  ) : (
                    <Tag color="default">Chưa có</Tag>
                  )}
                </div>
              </div>
            </Space>
          </Card>

          {/* SUBTASKS */}
          <Card
            title="Subtasks"
            className="mt-4"
            extra={
              <Button
                type="primary"
                size="small"
                loading={creatingSubtask}
                onClick={() => handleOpenSubtaskModal()}
              >
                Thêm subtask mới
              </Button>
            }
          >
            <Space direction="vertical" size="large" className="w-full">
              <Progress percent={subtaskProgress} />
              <List<Subtask>
                loading={subtasksLoading}
                dataSource={subtasks}
                locale={{ emptyText: 'Chưa có subtask nào.' }}
                renderItem={(item) => (
                  <List.Item
                    actions={[
                      <Button
                        key="toggle"
                        size="small"
                        onClick={() => handleToggleSubtask(item)}
                      >
                        {item.isDone ? 'Đánh dấu chưa xong' : 'Đánh dấu đã xong'}
                      </Button>,
                      <Button
                        key="edit"
                        size="small"
                        onClick={() => handleOpenSubtaskModal(item)}
                      >
                        Sửa
                      </Button>,
                      <Popconfirm
                        key="delete"
                        title="Xoá subtask này?"
                        okText="Xoá"
                        cancelText="Huỷ"
                        onConfirm={() => handleDeleteSubtask(item)}
                      >
                        <Button size="small" danger>
                          Xoá
                        </Button>
                      </Popconfirm>,
                    ]}
                  >
                    <Space>
                      <Tag color={item.isDone ? 'green' : 'default'}>
                        {item.isDone ? 'DONE' : 'TODO'}
                      </Tag>
                      <Text delete={item.isDone}>{item.title}</Text>
                    </Space>
                  </List.Item>
                )}
              />
            </Space>
          </Card>

          {/* MODALS + ATTACHMENTS + ACTIVITIES */}
          <Row gutter={[16, 25]} className="mt-4">
            {/* LABEL MODAL: tạo/sửa/xoá nhãn (project) */}
            <Modal
              open={labelModalOpen}
              title={editingLabel ? 'Sửa nhãn' : 'Quản lý nhãn'}
              onCancel={() => {
                setLabelModalOpen(false);
                setEditingLabel(null);
                labelForm.resetFields();
              }}
              onOk={async () => {
                try {
                  const values = await labelForm.validateFields();
                  setSavingLabel(true);

                  const team = project?.team;
                  const teamId = typeof team === 'string' ? team : team?._id;

                  if (!teamId) {
                    message.error(
                      'Project không có team, không thể lưu nhãn',
                    );
                    return;
                  }

                  if (editingLabel) {
                    // UPDATE LABEL
                    const res = await labelServices.update(editingLabel._id, {
                      name: values.name,
                      color: values.color,
                      description: values.description,
                    });
                    const updated = res.data || res;

                    setLabels((prev) =>
                      prev.map((lb) =>
                        lb._id === updated._id ? updated : lb,
                      ),
                    );
                    message.success('Đã cập nhật nhãn');
                  } else {
                    // CREATE LABEL
                    const res = await labelServices.create({
                      team: teamId,
                      project: project?._id || project?.id,
                      name: values.name,
                      color: values.color,
                      description: values.description,
                    });
                    const created = res.data || res;
                    setLabels((prev) => [...prev, created]);
                    message.success('Đã tạo nhãn mới');
                  }

                  labelForm.resetFields();
                  setEditingLabel(null);
                  setLabelModalOpen(false);
                } catch (err: any) {
                  if (err?.response?.data) message.error(err.response.data);
                  else if (!err?.errorFields)
                    message.error('Lưu nhãn thất bại');
                } finally {
                  setSavingLabel(false);
                }
              }}
              confirmLoading={savingLabel}
              okText={editingLabel ? 'Lưu nhãn' : 'Tạo nhãn'}
            >
              <Row gutter={[16, 16]}>
                <Col span={12}>
                  <Form form={labelForm} layout="vertical">
                    <Form.Item
                      name="name"
                      label="Tên nhãn"
                      rules={[{ required: true, message: 'Nhập tên nhãn' }]}
                    >
                      <Input placeholder="VD: Bug, Feature, Urgent..." />
                    </Form.Item>
                    <Form.Item name="color" label="Màu (hex)">
                      <input
                        type="color"
                        value={labelForm.getFieldValue('color') || '#52c41a'}
                        onChange={(e) => {
                          labelForm.setFieldsValue({ color: e.target.value });
                        }}
                        style={{
                          width: '100%',
                          height: 32,
                          border: 'none',
                          padding: 0,
                          cursor: 'pointer',
                        }}
                      />
                    </Form.Item>
                    <Form.Item name="description" label="Mô tả">
                      <Input.TextArea
                        rows={3}
                        placeholder="Nhãn dùng cho loại công việc nào..."
                      />
                    </Form.Item>
                  </Form>
                </Col>
                <Col span={12}>
                  <Text strong className="block mb-2">
                    Danh sách nhãn
                  </Text>
                  <List
                    size="small"
                    bordered
                    dataSource={labels}
                    locale={{ emptyText: 'Chưa có nhãn' }}
                    renderItem={(lb) => (
                      <List.Item
                        actions={[
                          <Button
                            key="edit"
                            type="link"
                            size="small"
                            onClick={() => {
                              setEditingLabel(lb);
                              labelForm.setFieldsValue({
                                name: lb.name,
                                color: lb.color,
                                description: lb.description,
                              });
                            }}
                          >
                            Sửa
                          </Button>,
                          <Popconfirm
                            key="delete"
                            title="Xoá nhãn này?"
                            okText="Xoá"
                            cancelText="Huỷ"
                            onConfirm={async () => {
                              try {
                                await labelServices.remove(lb._id);
                                setLabels((prev) =>
                                  prev.filter((x) => x._id !== lb._id),
                                );

                                // Nếu task đang gắn nhãn này thì bỏ ra
                                setTask((prev: any) => {
                                  if (!prev?.labels) return prev;
                                  const next = (prev.labels as any[]).filter(
                                    (l: any) =>
                                      String(
                                        l?._id || l?.id || l,
                                      ) !== String(lb._id),
                                  );
                                  return { ...prev, labels: next };
                                });

                                message.success('Đã xoá nhãn');
                              } catch (err: any) {
                                console.error(err);
                                message.error(
                                  err?.response?.data || 'Xoá nhãn thất bại',
                                );
                              }
                            }}
                          >
                            <Button type="link" danger size="small">
                              Xoá
                            </Button>
                          </Popconfirm>,
                        ]}
                      >
                        <Space direction="vertical" size={0}>
                          <Tag color={lb.color || 'default'}>{lb.name}</Tag>
                          {lb.description && (
                            <Text type="secondary" className="text-xs">
                              {lb.description}
                            </Text>
                          )}
                        </Space>
                      </List.Item>
                    )}
                  />
                </Col>
              </Row>
            </Modal>

            {/* SUBTASK MODAL */}
            <Modal
              title={editingSubtask ? 'Sửa subtask' : 'Tạo subtask mới'}
              open={subtaskModalOpen}
              onCancel={() => {
                setSubtaskModalOpen(false);
                setSubtaskFile(null);
                setEditingSubtask(null);
              }}
              onOk={handleSubmitSubtask}
              confirmLoading={creatingSubtask}
              okText={editingSubtask ? 'Lưu thay đổi' : 'Tạo subtask'}
            >
              <Form form={subtaskForm} layout="vertical">
                <Form.Item
                  name="title"
                  label="Tiêu đề subtask"
                  rules={[{ required: true, message: 'Vui lòng nhập tiêu đề' }]}
                >
                  <Input placeholder="VD: Thiết kế UI phần header" />
                </Form.Item>

                <Form.Item name="assignee" label="Giao cho">
                  <Select
                    allowClear
                    placeholder="Chọn người phụ trách"
                    options={assignees.map((u) => ({
                      label: u.name,
                      value: u.id,
                    }))}
                  />
                </Form.Item>

                <Form.Item label="File đính kèm (tuỳ chọn)">
                  <Upload
                    beforeUpload={(file) => {
                      setSubtaskFile(file);
                      return false;
                    }}
                    onRemove={() => setSubtaskFile(null)}
                    maxCount={1}
                  >
                    <Button icon={<UploadOutlined />}>Chọn file</Button>
                  </Upload>
                  {subtaskFile && (
                    <Text type="secondary" className="text-xs">
                      Đã chọn: {subtaskFile.name}
                    </Text>
                  )}
                </Form.Item>
              </Form>
            </Modal>

            {/* ATTACHMENTS */}
            <Col span={12}>
              <Card
                title={
                  <Space>
                    <PaperClipOutlined />
                    <span>
                      Attachments
                      {attachmentStats.total > 0 && (
                        <Text type="secondary" className="ml-1 text-xs">
                          ({attachmentStats.total} tệp ·{' '}
                          {attachmentStats.subtaskCount} subtask)
                        </Text>
                      )}
                    </span>
                  </Space>
                }
                className="h-full"
              >
                {attachments.length === 0 ? (
                  <Text type="secondary" className="text-sm">
                    Chưa có tệp đính kèm nào.
                  </Text>
                ) : (
                  <List<TaskAttachment>
                    size="small"
                    bordered
                    dataSource={attachments}
                    className="rounded border-gray-200"
                    renderItem={(att) => (
                      <List.Item
                        className="flex justify-between items-center"
                        actions={[
                          att.storage?.url && (
                            <a
                              key="open"
                              href={att.storage.url}
                              target="_blank"
                              rel="noreferrer"
                            >
                              Mở
                            </a>
                          ),
                          att._id && (
                            <Popconfirm
                              key="delete"
                              title="Xoá tệp này?"
                              okText="Xoá"
                              cancelText="Huỷ"
                              onConfirm={() =>
                                handleDeleteAttachment(String(att._id))
                              }
                            >
                              <Button
                                type="link"
                                danger
                                icon={<DeleteOutlined />}
                                size="small"
                              >
                                Xoá
                              </Button>
                            </Popconfirm>
                          ),
                        ].filter(Boolean)}
                      >
                        <List.Item.Meta
                          title={
                            <Space direction="vertical" size={0}>
                              <Text ellipsis>{att.name}</Text>
                              {att.subtask && (
                                <Text type="secondary" className="text-xs">
                                  Thuộc subtask:{' '}
                                  <b>
                                    {(att.subtask as any).title || 'Không rõ'}
                                  </b>
                                </Text>
                              )}
                            </Space>
                          }
                          description={
                            <Space size="small">
                              {typeof att.size === 'number' && (
                                <Text type="secondary" className="text-xs">
                                  {(att.size / 1024).toFixed(1)} KB
                                </Text>
                              )}
                            </Space>
                          }
                        />
                      </List.Item>
                    )}
                  />
                )}
              </Card>
            </Col>

            {/* ACTIVITIES */}
            <Col span={12}>
              <Card
                title="Hoạt động gần đây"
                loading={activitiesLoading}
                className="h-full"
              >
                <div className="max-h-80 overflow-y-auto pr-3">
                  <div className="pl-5">
                    <Timeline
                      className="overflow-visible"
                      items={activityItems.map((item) => ({
                        dot: (
                          <div className="w-3 h-3 bg-blue-500 rounded-full shadow-sm"></div>
                        ),
                        children: (
                          <div className="break-words leading-relaxed">
                            <Text className="text-sm text-gray-700">
                              {item.children}
                            </Text>
                          </div>
                        ),
                      }))}
                    />
                  </div>
                </div>
              </Card>
            </Col>
          </Row>

          {/* COMMENTS */}
          <Card
            title="Bình luận"
            className="mt-4"
            extra={<CommentOutlined />}
          >
            <Space direction="vertical" size="middle" className="w-full">
              <div>
                {replyingTo && (
                  <Alert
                    type="info"
                    showIcon
                    className="mb-2"
                    message={
                      <>
                        Đang trả lời bình luận của{' '}
                        <b>
                          {(replyingTo.author as any)?.name || 'ai đó'}
                        </b>
                      </>
                    }
                    action={
                      <Button
                        type="link"
                        size="small"
                        onClick={() => {
                          setReplyingTo(null);
                          setEditingComment(null);
                        }}
                      >
                        Huỷ
                      </Button>
                    }
                  />
                )}

                {editingComment && !replyingTo && (
                  <Alert
                    type="info"
                    showIcon
                    className="mb-2"
                    message="Đang sửa bình luận"
                    action={
                      <Button
                        type="link"
                        size="small"
                        onClick={() => {
                          setEditingComment(null);
                          setNewComment('');
                        }}
                      >
                        Huỷ
                      </Button>
                    }
                  />
                )}

                <TextArea
                  rows={3}
                  placeholder="Nhập bình luận..."
                  value={newComment}
                  onChange={(e) => setNewComment(e.target.value)}
                />
                <div className="mt-2 flex justify-end">
                  <Button
                    type="primary"
                    loading={postingComment}
                    onClick={handlePostComment}
                  >
                    {editingComment ? 'Lưu bình luận' : 'Gửi bình luận'}
                  </Button>
                </div>
              </div>

              <Divider />

              <List
                loading={commentsLoading}
                dataSource={comments}
                locale={{ emptyText: 'Chưa có bình luận nào.' }}
                renderItem={(comment) => {
                  const author: any = comment.author;
                  const createdAt = comment.createdAt
                    ? new Date(comment.createdAt).toLocaleString()
                    : '';

                  return (
                    <List.Item
                      actions={[
                        <Button
                          key="reply"
                          type="link"
                          size="small"
                          onClick={() => {
                            setReplyingTo(comment);
                            setEditingComment(null);
                            const name = author?.name || '';
                            setNewComment(name ? `${name} ` : '');
                          }}
                        >
                          Trả lời
                        </Button>,
                        <Button
                          key="edit"
                          type="link"
                          size="small"
                          onClick={() => {
                            setEditingComment(comment);
                            setReplyingTo(null);
                            setNewComment(comment.content);
                          }}
                        >
                          Sửa
                        </Button>,
                        <Popconfirm
                          key="delete"
                          title="Xoá bình luận này?"
                          okText="Xoá"
                          cancelText="Huỷ"
                          onConfirm={() => handleDeleteComment(comment)}
                        >
                          <Button type="link" size="small" danger>
                            Xoá
                          </Button>
                        </Popconfirm>,
                      ]}
                    >
                      <List.Item.Meta
                        avatar={
                          <Avatar src={author?.avatarUrl}>
                            {author?.name?.[0]}
                          </Avatar>
                        }
                        title={
                          <Space>
                            <Text strong>
                              {author?.name || 'Người dùng'}
                            </Text>
                            {comment.edited && (
                              <Tag color="default" className="text-xs">
                                Đã chỉnh sửa
                              </Tag>
                            )}
                            <Text type="secondary" className="text-xs">
                              {createdAt}
                            </Text>
                          </Space>
                        }
                        description={
                          <>
                            <Paragraph
                              className="mb-1"
                              style={{ whiteSpace: 'pre-wrap' }}
                            >
                              {comment.content}
                            </Paragraph>

                            {Array.isArray(comment.mentions) &&
                              comment.mentions.length > 0 && (
                                <Text
                                  type="secondary"
                                  className="text-xs"
                                >
                                  Nhắc tới:{' '}
                                  {comment.mentions
                                    .map((m: any) => m?.name)
                                    .filter(Boolean)
                                    .join(', ')}
                                </Text>
                              )}
                          </>
                        }
                      />
                    </List.Item>
                  );
                }}
              />
            </Space>
          </Card>
        </Col>

        {/* RIGHT COLUMN */}
        <Col xs={24} lg={8}>
          <Space direction="vertical" size="large" className="w-full">
            {/* AI INSIGHTS (mock) */}
            <Card
              title="AI Insights"
              extra={<RobotOutlined />}
              actions={[
                <Button
                  key="accept"
                  type="primary"
                  ghost
                  icon={<ThunderboltOutlined />}
                >
                  Chấp nhận gợi ý
                </Button>,
                <Button key="dismiss" type="text">
                  Bỏ qua
                </Button>,
              ]}
            >
              <Alert
                type="info"
                showIcon
                message="Khu vực này có thể hiển thị phân tích AI của task (risk, gợi ý...). Hiện chưa nối API riêng."
              />
            </Card>

            {/* CHECKLIST = subtasks view khác */}
            <Card title="Checklist báo cáo">
              <List
                dataSource={subtasks}
                locale={{ emptyText: 'Chưa có subtask nào.' }}
                renderItem={(sub) => (
                  <List.Item
                    actions={[
                      <Button
                        key="edit"
                        type="link"
                        size="small"
                        onClick={() => handleOpenSubtaskModal(sub)}
                      >
                        Sửa
                      </Button>,
                      <Popconfirm
                        key="delete"
                        title="Xoá subtask này?"
                        okText="Xoá"
                        cancelText="Huỷ"
                        onConfirm={() => handleDeleteSubtask(sub)}
                      >
                        <Button type="link" danger size="small">
                          Xoá
                        </Button>
                      </Popconfirm>,
                    ]}
                  >
                    <Space>
                      <Tag
                        color={sub.isDone ? 'green' : 'default'}
                        style={{ cursor: 'pointer' }}
                        onClick={() => handleToggleSubtask(sub)}
                      >
                        {sub.isDone ? 'ĐÃ LÀM' : 'ĐANG LÀM'}
                      </Tag>
                      <Text delete={sub.isDone}>{sub.title}</Text>
                    </Space>
                  </List.Item>
                )}
              />
            </Card>

            {/* PROGRESS CARD */}
            <Card title="Báo cáo tiến độ">
              <Space direction="vertical">
                <Text strong>Tiến độ theo subtask</Text>
                <Progress percent={subtaskProgress} status="active" />
                <Text type="secondary" className="text-sm">
                  Tiến độ được tính dựa trên số subtask đã hoàn thành.
                </Text>
              </Space>
            </Card>
          </Space>
        </Col>
      </Row>
    </div>
  );
}
