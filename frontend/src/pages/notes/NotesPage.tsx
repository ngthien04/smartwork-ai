import React, { useState } from 'react';
import {
  Row,
  Col,
  Card,
  Button,
  Input,
  List,
  Typography,
  Space,
  Tag,
  Modal,
  Form,
} from 'antd';
import {
  PlusOutlined,
  SearchOutlined,
  EditOutlined,
  DeleteOutlined,
  RobotOutlined,
} from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { noteServices } from '@/services/noteServices';

const { Title, Text } = Typography;
const { TextArea } = Input;


type Note = {
  id: string;
  title: string;
  content: string;
  tags?: string[];
  createdAt: string;
  updatedAt: string;
};


const Markdown: React.FC<React.ComponentProps<typeof ReactMarkdown>> =
  ReactMarkdown as any;

export default function NotesPage() {
  const { t } = useTranslation();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingNote, setEditingNote] = useState<Note | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedNote, setSelectedNote] = useState<Note | null>(null);

  const [form] = Form.useForm();
  const queryClient = useQueryClient();

  
  const { data: notesData, isLoading } = useQuery<Note[]>({
    queryKey: ['notes', { q: searchQuery }],
    queryFn: async () => {
      const res = await noteServices.list({ q: searchQuery });
      return res.data as Note[];
    },
  });

  const notes: Note[] = notesData || [];

  
  const createNoteMutation = useMutation({
    mutationFn: noteServices.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notes'] });
      form.resetFields();
      setIsModalOpen(false);
    },
  });

  const updateNoteMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) =>
      noteServices.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notes'] });
      form.resetFields();
      setIsModalOpen(false);
    },
  });

  const deleteNoteMutation = useMutation({
    mutationFn: noteServices.remove,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notes'] });
    },
  });

  const summarizeMutation = useMutation({
    mutationFn: (noteId: string) => noteServices.aiSummarize(noteId),
    onSuccess: (data) => {
      Modal.info({
        title: 'AI Tóm tắt',
        content: (
          <div>
            {(data as any)?.data?.summary || (data as any)?.summary || 'Không có nội dung tóm tắt'}
          </div>
        ),
      });
    },
  });

  
  const handleCreateNote = () => {
    setEditingNote(null);
    form.resetFields();
    setIsModalOpen(true);
  };

  const handleEditNote = (note: Note) => {
    setEditingNote(note);
    form.setFieldsValue({
      title: note.title,
      content: note.content,
      tags: note.tags?.join(', ') || '',
    });
    setIsModalOpen(true);
  };

  const handleDeleteNote = (noteId: string) => {
    Modal.confirm({
      title: 'Xác nhận xóa',
      content: 'Bạn có chắc chắn muốn xóa ghi chú này?',
      onOk: () => deleteNoteMutation.mutate(noteId),
    });
  };

  const handleModalSubmit = (values: any) => {
    
    const tagsArray: string[] =
      typeof values.tags === 'string'
        ? values.tags
            .split(',')
            .map((t: string) => t.trim())
            .filter(Boolean)
        : Array.isArray(values.tags)
        ? values.tags
        : [];

    const noteData = {
      title: values.title,
      content: values.content,
      tags: tagsArray,
    };

    if (editingNote) {
      updateNoteMutation.mutate({ id: editingNote.id, data: noteData });
    } else {
      createNoteMutation.mutate(noteData);
    }
  };

  const handleAiSummarize = (noteId: string) => {
    summarizeMutation.mutate(noteId);
  };

  return (
    <div className="notes-page">
      <div className="mb-6">
        <Title level={2} className="m-0">
          {t('notes.title')}
        </Title>
      </div>

      <Row gutter={[24, 24]}>
        {/* Notes List */}
        <Col xs={24} lg={8}>
          <Card className="h-full">
            <div className="mb-4">
              <Space className="w-full">
                <Input
                  placeholder="Tìm kiếm ghi chú..."
                  prefix={<SearchOutlined />}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="flex-1"
                />
                <Button
                  type="primary"
                  icon={<PlusOutlined />}
                  onClick={handleCreateNote}
                >
                  Tạo ghi chú
                </Button>
              </Space>
            </div>

            <List
              dataSource={notes}
              loading={isLoading}
              renderItem={(note: Note) => (
                <List.Item
                  className={`cursor-pointer hover:bg-gray-50 p-3 rounded ${
                    selectedNote?.id === note.id
                      ? 'bg-blue-50 border-blue-200'
                      : ''
                  }`}
                  onClick={() => setSelectedNote(note)}
                  actions={[
                    <Button
                      key="edit"
                      type="text"
                      size="small"
                      icon={<EditOutlined />}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleEditNote(note);
                      }}
                    />,
                    <Button
                      key="delete"
                      type="text"
                      size="small"
                      danger
                      icon={<DeleteOutlined />}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteNote(note.id);
                      }}
                    />,
                  ]}
                >
                  <List.Item.Meta
                    title={
                      <div className="flex justify-between items-start">
                        <Text strong className="block">{note.title}</Text>
                        <Text type="secondary" className="text-xs">
                          {new Date(note.updatedAt).toLocaleDateString()}
                        </Text>
                      </div>
                    }
                    description={
                      <div>
                        <Text type="secondary" className="text-sm block mb-2">
                          {note.content.length > 100
                            ? `${note.content.substring(0, 100)}...`
                            : note.content}
                        </Text>
                        {note.tags && note.tags.length > 0 && (
                          <div className="flex flex-wrap gap-1">
                            {note.tags.map((tag: string) => (
                              <Tag key={tag} color="blue">
                                {tag}
                              </Tag>
                            ))}
                          </div>
                        )}
                      </div>
                    }
                  />
                </List.Item>
              )}
            />
          </Card>
        </Col>

        {/* Note Content */}
        <Col xs={24} lg={16}>
          <Card className="h-full">
            {selectedNote ? (
              <div className="h-full">
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <Title level={3} className="m-0">
                      {selectedNote.title}
                    </Title>
                    <Text type="secondary">
                      Cập nhật:{' '}
                      {new Date(selectedNote.updatedAt).toLocaleString()}
                    </Text>
                  </div>
                  <Space>
                    <Button
                      icon={<RobotOutlined />}
                      onClick={() => handleAiSummarize(selectedNote.id)}
                      loading={summarizeMutation.isPending}
                    >
                      AI Tóm tắt
                    </Button>
                    <Button
                      icon={<EditOutlined />}
                      onClick={() => handleEditNote(selectedNote)}
                    >
                      Sửa
                    </Button>
                  </Space>
                </div>
                <div className="border-t pt-4">
                  <div className="prose max-w-none">
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>
                      {selectedNote.content}
                    </ReactMarkdown>
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-center h-full text-gray-500">
                <div className="text-center">
                  <Text type="secondary">
                    Chọn một ghi chú để xem nội dung
                  </Text>
                </div>
              </div>
            )}
          </Card>
        </Col>
      </Row>

      {/* Note Modal */}
      <Modal
        title={editingNote ? t('notes.editNote') : t('notes.createNote')}
        open={isModalOpen}
        onCancel={() => setIsModalOpen(false)}
        footer={null}
        width={800}
        destroyOnClose
      >
        <Form layout="vertical" form={form} onFinish={handleModalSubmit}>
          <Form.Item
            name="title"
            label={t('notes.noteTitle')}
            rules={[{ required: true, message: 'Vui lòng nhập tiêu đề' }]}
          >
            <Input placeholder="Nhập tiêu đề ghi chú..." />
          </Form.Item>

          <Form.Item
            name="content"
            label={t('notes.noteContent')}
            rules={[{ required: true, message: 'Vui lòng nhập nội dung' }]}
          >
            <TextArea
              rows={12}
              placeholder="Nhập nội dung ghi chú (hỗ trợ **Markdown**, _italic_, danh sách, v.v.)..."
            />
          </Form.Item>

          <Form.Item name="tags" label="Thẻ">
            <Input placeholder="Nhập thẻ, cách nhau bằng dấu phẩy (VD: học, công việc, ý tưởng)" />
          </Form.Item>

          <Form.Item className="mb-0">
            <Space className="w-full justify-end">
              <Button onClick={() => setIsModalOpen(false)}>
                {t('common.cancel')}
              </Button>
              <Button
                type="primary"
                htmlType="submit"
                loading={
                  createNoteMutation.isPending || updateNoteMutation.isPending
                }
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
