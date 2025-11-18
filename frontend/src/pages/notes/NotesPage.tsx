// src/pages/notes/NotesPage.tsx
import React, { useState } from 'react';
import { Row, Col, Card, Button, Input, List, Typography, Space, Tag, Modal, Form } from 'antd';
import { PlusOutlined, SearchOutlined, EditOutlined, DeleteOutlined, RobotOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { noteServices } from '@/services/noteServices';

const { Title, Text } = Typography;
const { TextArea } = Input;

export default function NotesPage() {
  const { t } = useTranslation();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingNote, setEditingNote] = useState<any>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedNote, setSelectedNote] = useState<any>(null);

  const queryClient = useQueryClient();

  // Fetch notes
  const { data: notesData, isLoading } = useQuery({
    queryKey: ['notes', { q: searchQuery }],
    queryFn: () => noteServices.list({ q: searchQuery }),
  });

  const notes = notesData?.data || [];

  // Create note mutation
  const createNoteMutation = useMutation({
    mutationFn: noteServices.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notes'] });
      setIsModalOpen(false);
    },
  });

  // Update note mutation
  const updateNoteMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => 
      noteServices.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notes'] });
    },
  });

  // Delete note mutation
  const deleteNoteMutation = useMutation({
    mutationFn: noteServices.remove,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notes'] });
    },
  });

  // AI Summarize mutation
  const summarizeMutation = useMutation({
    mutationFn: (noteId: string) => noteServices.aiSummarize(noteId),
    onSuccess: (data, noteId) => {
      // TODO: Show summary in modal or update note
      console.log('AI Summary:', data);
    },
  });

  const handleCreateNote = () => {
    setEditingNote(null);
    setIsModalOpen(true);
  };

  const handleEditNote = (note: any) => {
    setEditingNote(note);
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
    const noteData = {
      ...values,
      createdAt: editingNote?.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
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
        <Title level={2} className="m-0">{t('notes.title')}</Title>
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
              renderItem={(note) => (
                <List.Item
                  className={`cursor-pointer hover:bg-gray-50 p-3 rounded ${
                    selectedNote?.id === note.id ? 'bg-blue-50 border-blue-200' : ''
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
                            : note.content
                          }
                        </Text>
                        {note.tags && note.tags.length > 0 && (
                          <div className="flex flex-wrap gap-1">
                            {note.tags.map(tag => (
                              <Tag key={tag} size="small" color="blue">
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
                    <Title level={3} className="m-0">{selectedNote.title}</Title>
                    <Text type="secondary">
                      Cập nhật: {new Date(selectedNote.updatedAt).toLocaleString()}
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
                  <ReactMarkdown 
                    remarkPlugins={[remarkGfm]}
                    className="prose max-w-none"
                  >
                    {selectedNote.content}
                  </ReactMarkdown>
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-center h-full text-gray-500">
                <div className="text-center">
                  <Text type="secondary">Chọn một ghi chú để xem nội dung</Text>
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
      >
        <Form
          layout="vertical"
          onFinish={handleModalSubmit}
          initialValues={editingNote || {}}
        >
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
              placeholder="Nhập nội dung ghi chú (hỗ trợ Markdown)..." 
            />
          </Form.Item>

          <Form.Item
            name="tags"
            label="Thẻ"
          >
            <Input
              placeholder="Nhập thẻ, cách nhau bằng dấu phẩy"
              onChange={(e) => {
                // Convert comma-separated string to array
                const tags = e.target.value.split(',').map(tag => tag.trim()).filter(tag => tag);
                // Update form value
              }}
            />
          </Form.Item>

          <Form.Item className="mb-0">
            <Space className="w-full justify-end">
              <Button onClick={() => setIsModalOpen(false)}>
                {t('common.cancel')}
              </Button>
              <Button 
                type="primary" 
                htmlType="submit"
                loading={createNoteMutation.isPending || updateNoteMutation.isPending}
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
