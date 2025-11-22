// src/components/tasks/Kanban.tsx
import type { MouseEvent } from 'react';
import { Card, Tag, Typography, Tooltip } from 'antd';
import { DragDropContext, Droppable, Draggable } from "@hello-pangea/dnd";
import type { DropResult } from "@hello-pangea/dnd";
import type { Task } from '@/types';
import { motion, AnimatePresence } from 'framer-motion';

const { Text } = Typography;

interface KanbanProps {
  tasks: Task[];
  onTaskUpdate: (taskId: string, updates: Partial<Task>) => void;
  onTaskDelete: (taskId: string) => void;      // vẫn giữ prop nếu chỗ khác còn dùng
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
  onTaskDelete,     // chưa dùng nữa trong Kanban, nhưng có thể chỗ khác vẫn pass vào
  onTaskSelect,
}: KanbanProps) {
  const handleDragEnd = (result: DropResult) => {
    if (!result.destination) return;
    const { source, destination, draggableId } = result;
    if (source.droppableId === destination.droppableId) return;
    const newStatus = destination.droppableId as Task['status'];
    onTaskUpdate(draggableId, { status: newStatus });
  };

  const getTasksByStatus = (status: Task['status']) =>
    tasks.filter((t) => t.status === status);

  const renderTask = (task: Task, index: number) => {
    const priority = task.priority || 'medium';

    // Lấy tên project từ task.project (có thể là id hoặc object)
    const project: any = (task as any).project;
    let projectName = '';

    if (project) {
      if (typeof project === 'string') {
        // nếu backend chỉ trả về id string, tạm hiển thị id
        projectName = project;
      } else if (typeof project === 'object') {
        projectName = project.name || project.key || '';
      }
    }

    const handleCardClick = (_event: MouseEvent) => {
      onTaskSelect?.(task);
    };

    return (
      <Draggable key={task.id} draggableId={task.id} index={index}>
        {(provided) => (
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
              className="mb-3"
            >
              <Tooltip
                title={
                  <>
                    {task.description && <div>{task.description}</div>}
                    {task.storyPoints !== undefined && (
                      <div>Story Points: {task.storyPoints}</div>
                    )}
                    {task.dueDate && (
                      <div>
                        Deadline:{' '}
                        {new Date(task.dueDate).toLocaleDateString()}
                      </div>
                    )}
                    {projectName && (
                      <div>Project: {projectName}</div>
                    )}
                  </>
                }
                placement="topLeft"
              >
                <Card
                  size="small"
                  className="hover:shadow-md transition-shadow cursor-pointer"
                  // ❌ Bỏ hoàn toàn actions => không còn icon ⋮, không xoá/sửa trong Kanban nữa
                  onClick={handleCardClick}
                >
                  <div className="space-y-2">
                    {/* Tiêu đề + tên project */}
                    <div className="flex flex-col">
                      <Text strong className="block">
                        {task.title}
                      </Text>
                      {projectName && (
                        <Text
                          type="secondary"
                          className="text-xs block"
                        >
                          {projectName}
                        </Text>
                      )}
                    </div>

                    {task.description && (
                      <Text type="secondary" className="text-xs block">
                        {task.description.length > 100
                          ? `${task.description.substring(0, 100)}...`
                          : task.description}
                      </Text>
                    )}

                    {/* Priority + Due Date */}
                    <div className="flex flex-col">
                      <Tag color={priorityConfig[priority].color}>
                        {priority}
                      </Tag>
                      {task.dueDate && (
                        <Text
                          type="secondary"
                          className="text-xs mt-1"
                        >
                          {new Date(task.dueDate).toLocaleDateString()}
                        </Text>
                      )}
                    </div>

                    {task.tags && task.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {task.tags.map((tag) => (
                          <Tag key={tag} color="blue">
                            {tag}
                          </Tag>
                        ))}
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
        <div className="bg-gray-50 rounded-lg p-4 h-full flex flex-col">
          <div className="flex justify-between items-center mb-4">
            <div className="flex items-center space-x-2">
              <Tag color={config.color}>{config.title}</Tag>
              <Text type="secondary" className="text-sm">
                {tasksByStatus.length}
              </Text>
            </div>
          </div>
          <Droppable droppableId={status}>
            {(provided, snapshot) => (
              <div
                ref={provided.innerRef}
                {...provided.droppableProps}
                className={`min-h-32 pr-1 overflow-y-auto max-h-[calc(100vh-280px)] transition-colors ${
                  snapshot.isDraggingOver ? 'bg-blue-50' : ''
                }`}
              >
                <AnimatePresence>
                  {tasksByStatus.map((task, index) =>
                    renderTask(task, index),
                  )}
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
