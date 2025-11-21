// src/components/tasks/Kanban.tsx
import type { MouseEvent } from 'react';
import { Card, Button, Tag, Typography, Dropdown, Tooltip } from 'antd';
import { MoreOutlined, PlusOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons';
import { DragDropContext, Droppable, Draggable } from "@hello-pangea/dnd";
import type { DropResult } from "@hello-pangea/dnd";
import type { Task } from '@/types';
import { motion, AnimatePresence } from 'framer-motion';

const { Text } = Typography;

interface KanbanProps {
  tasks: Task[];
  onTaskUpdate: (taskId: string, updates: Partial<Task>) => void;
  onTaskDelete: (taskId: string) => void;
  onCreateTask?: (status: Task['status']) => void;
  onTaskSelect?: (task: Task) => void;
}

const statusConfig: Record<Task['status'], { title: string; color: string }> = {
  todo: { title: 'Cần làm', color: 'default' },
  in_progress: { title: 'Đang làm', color: 'blue' },
  done: { title: 'Hoàn thành', color: 'green' },
  backlog: { title: 'Tồn đọng', color: 'gray' },
  review: { title: 'Đang review', color: 'purple' },
  blocked: { title: 'Bị chặn', color: 'red' },
};

const priorityConfig: Record<string, { color: string }> = {
  low: { color: 'green' },
  normal: { color: 'blue' },
  medium: { color: 'blue' },
  high: { color: 'orange' },
  urgent: { color: 'red' },
};

export default function Kanban({
  tasks,
  onTaskUpdate,
  onTaskDelete,
  onCreateTask,
  onTaskSelect,
}: KanbanProps) {
  const handleDragEnd = (result: DropResult) => {
    if (!result.destination) return;
    const { source, destination, draggableId } = result;

    if (source.droppableId === destination.droppableId) return;

    const newStatus = destination.droppableId as Task['status'];
    onTaskUpdate(draggableId, { status: newStatus });
  };

  const getTasksByStatus = (status: Task['status']) => tasks.filter(t => t.status === status);

  const renderTask = (task: Task, index: number) => {
    const priority = task.priority || 'medium';

    const handleCardClick = (event: MouseEvent) => {
      if ((event.target as HTMLElement).closest('.ant-card-actions')) return;
      onTaskSelect?.(task);
    };

    return (
      <Draggable key={task.id} draggableId={task.id} index={index}>
        {(provided, snapshot) => (
          <div
            ref={provided.innerRef}
            {...provided.draggableProps}
            {...provided.dragHandleProps}
          >
            <motion.div
              layout
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 20 }}
              className={`mb-3`}
            >
              <Tooltip
                title={
                  <>
                    {task.description && <div>{task.description}</div>}
                    {task.storyPoints !== undefined && <div>Story Points: {task.storyPoints}</div>}
                    {task.dueDate && <div>Deadline: {new Date(task.dueDate).toLocaleDateString()}</div>}
                  </>
                }
                placement="topLeft"
              >
                <Card
                  size="small"
                  className="hover:shadow-md transition-shadow cursor-pointer"
                  actions={[
                    <Dropdown
                      menu={{
                        items: [
                          { key: 'edit', icon: <EditOutlined />, label: 'Sửa', onClick: () => {} },
                          { type: 'divider' as const },
                          { key: 'delete', icon: <DeleteOutlined />, danger: true, label: 'Xóa', onClick: () => onTaskDelete(task.id) },
                        ],
                      }}
                      trigger={['click']}
                    >
                      <MoreOutlined />
                    </Dropdown>,
                  ]}
                  onClick={handleCardClick}
                >
                  <div className="space-y-2">
                    <Text strong className="block">{task.title}</Text>

                    {task.description && (
                      <Text type="secondary" className="text-xs block">
                        {task.description.length > 100
                          ? `${task.description.substring(0, 100)}...`
                          : task.description
                        }
                      </Text>
                    )}

                    <div className="flex justify-between items-center">
                      <Tag color={priorityConfig[priority].color}>{priority}</Tag>
                      {task.dueDate && (
                        <Text type="secondary" className="text-xs">
                          {new Date(task.dueDate).toLocaleDateString()}
                        </Text>
                      )}
                    </div>

                    {task.tags && task.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {task.tags.slice(0, 2).map(tag => (
                          <Tag key={tag} color="blue">{tag}</Tag>
                        ))}
                        {task.tags.length > 2 && (
                          <Tag color="default">+{task.tags.length - 2}</Tag>
                        )}
                      </div>
                    )}
                  </div>
                </Card>
              </Tooltip>
            </motion.div>
          </div>
        )}
      </Draggable>
    );
  };

  const renderColumn = (status: Task['status']) => {
    const tasksByStatus = getTasksByStatus(status);
    const config = statusConfig[status];

    return (
      <div className="flex-1 min-w-0">
        <div className="bg-gray-50 rounded-lg p-4 h-full">
          <div className="flex justify-between items-center mb-4">
            <div className="flex items-center space-x-2">
              <Tag color={config.color}>{config.title}</Tag>
              <Text type="secondary" className="text-sm">{tasksByStatus.length}</Text>
            </div>
            <Button
              type="text"
              size="small"
              icon={<PlusOutlined />}
              disabled={!onCreateTask}
              onClick={() => onCreateTask?.(status)}
            />
          </div>

          <Droppable droppableId={status}>
            {(provided, snapshot) => (
              <div
                ref={provided.innerRef}
                {...provided.droppableProps}
                className={`min-h-32 transition-colors ${snapshot.isDraggingOver ? 'bg-blue-50' : ''}`}
              >
                <AnimatePresence>
                  {tasksByStatus.map((task, index) => renderTask(task, index))}
                </AnimatePresence>
                {provided.placeholder}
              </div>
            )}
          </Droppable>
        </div>
      </div>
    );
  };

  return (
    <DragDropContext onDragEnd={handleDragEnd}>
      <div className="flex space-x-4 h-full">
        {renderColumn('backlog')}
        {renderColumn('todo')}
        {renderColumn('in_progress')}
        {renderColumn('review')}
        {renderColumn('blocked')}
        {renderColumn('done')}
      </div>
    </DragDropContext>
  );
}
