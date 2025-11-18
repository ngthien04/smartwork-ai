// src/components/command/CommandPalette.tsx
import React, { useState, useEffect, useMemo } from 'react';
import { Modal, Input, List, Typography, Space, Tag } from 'antd';
import { SearchOutlined, FileTextOutlined, CalendarOutlined, RobotOutlined, SettingOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { useSelector, useDispatch } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import type { RootState } from '@/types';
import { setCommandPaletteOpen } from '@/store/slices/uiSlice';
import { ROUTES } from '@/routes/path';

const { Text } = Typography;

interface Command {
  id: string;
  title: string;
  description: string;
  icon: React.ReactNode;
  action: () => void;
  keywords: string[];
  category: string;
}

export default function CommandPalette() {
  const { t } = useTranslation();
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { commandPaletteOpen } = useSelector((state: RootState) => state.ui);
  
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);

  const commands: Command[] = useMemo(() => [
    // Navigation
    {
      id: 'nav-dashboard',
      title: t('nav.dashboard'),
      description: 'Go to dashboard',
      icon: <FileTextOutlined />,
      action: () => navigate(ROUTES.DASHBOARD),
      keywords: ['dashboard', 'home', 'tổng quan'],
      category: 'navigation',
    },
    {
      id: 'nav-tasks',
      title: t('nav.tasks'),
      description: 'Go to tasks page',
      icon: <FileTextOutlined />,
      action: () => navigate(ROUTES.TASKS),
      keywords: ['tasks', 'công việc', 'todo'],
      category: 'navigation',
    },
    {
      id: 'nav-notes',
      title: t('nav.notes'),
      description: 'Go to notes page',
      icon: <FileTextOutlined />,
      action: () => navigate(ROUTES.NOTES),
      keywords: ['notes', 'ghi chú', 'note'],
      category: 'navigation',
    },
    {
      id: 'nav-assistant',
      title: t('nav.assistant'),
      description: 'Go to AI assistant',
      icon: <RobotOutlined />,
      action: () => navigate(ROUTES.ASSISTANT),
      keywords: ['assistant', 'ai', 'trợ lý'],
      category: 'navigation',
    },
    {
      id: 'nav-calendar',
      title: t('nav.calendar'),
      description: 'Go to calendar',
      icon: <CalendarOutlined />,
      action: () => navigate(ROUTES.CALENDAR),
      keywords: ['calendar', 'lịch', 'schedule'],
      category: 'navigation',
    },
    {
      id: 'nav-settings',
      title: t('nav.settings'),
      description: 'Go to settings',
      icon: <SettingOutlined />,
      action: () => navigate(ROUTES.SETTINGS),
      keywords: ['settings', 'cài đặt', 'config'],
      category: 'navigation',
    },
    
    // Actions
    {
      id: 'action-new-task',
      title: 'New Task',
      description: 'Create a new task',
      icon: <FileTextOutlined />,
      action: () => {
        navigate(ROUTES.TASKS);
        // TODO: Trigger new task modal
      },
      keywords: ['new task', 'tạo công việc', 'add task'],
      category: 'actions',
    },
    {
      id: 'action-new-note',
      title: 'New Note',
      description: 'Create a new note',
      icon: <FileTextOutlined />,
      action: () => {
        navigate(ROUTES.NOTES);
        // TODO: Trigger new note modal
      },
      keywords: ['new note', 'tạo ghi chú', 'add note'],
      category: 'actions',
    },
    {
      id: 'action-ai-plan',
      title: 'AI Planning',
      description: 'Plan with AI assistant',
      icon: <RobotOutlined />,
      action: () => navigate(ROUTES.ASSISTANT),
      keywords: ['ai plan', 'lập kế hoạch', 'planning'],
      category: 'actions',
    },
  ], [t, navigate]);

  const filteredCommands = useMemo(() => {
    if (!searchQuery.trim()) return commands;
    
    const query = searchQuery.toLowerCase();
    return commands.filter(command => 
      command.title.toLowerCase().includes(query) ||
      command.description.toLowerCase().includes(query) ||
      command.keywords.some(keyword => keyword.toLowerCase().includes(query))
    );
  }, [commands, searchQuery]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedIndex(prev => 
          prev < filteredCommands.length - 1 ? prev + 1 : 0
        );
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSelectedIndex(prev => 
          prev > 0 ? prev - 1 : filteredCommands.length - 1
        );
        break;
      case 'Enter':
        e.preventDefault();
        if (filteredCommands[selectedIndex]) {
          filteredCommands[selectedIndex].action();
          handleClose();
        }
        break;
      case 'Escape':
        handleClose();
        break;
    }
  };

  const handleClose = () => {
    dispatch(setCommandPaletteOpen(false));
    setSearchQuery('');
    setSelectedIndex(0);
  };

  useEffect(() => {
    setSelectedIndex(0);
  }, [searchQuery]);

  return (
    <Modal
      open={commandPaletteOpen}
      onCancel={handleClose}
      footer={null}
      width={600}
      className="command-palette-modal"
      destroyOnHidden
    >
      <div className="command-palette">
        <Input
          size="large"
          placeholder={t('commandPalette.placeholder')}
          prefix={<SearchOutlined />}
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          autoFocus
        />
        
        <div className="command-list mt-4">
          {filteredCommands.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              {t('commandPalette.noResults')}
            </div>
          ) : (
            <List
              dataSource={filteredCommands}
              renderItem={(command, index) => (
                <List.Item
                  className={`command-item cursor-pointer p-3 rounded-lg transition-colors ${
                    index === selectedIndex ? 'bg-blue-50 border-blue-200' : 'hover:bg-gray-50'
                  }`}
                  onClick={() => {
                    command.action();
                    handleClose();
                  }}
                >
                  <Space>
                    <div className="text-lg">{command.icon}</div>
                    <div className="flex-1">
                      <div className="font-medium">{command.title}</div>
                      <Text type="secondary" className="text-sm">
                        {command.description}
                      </Text>
                    </div>
                    <Tag color="blue" className="text-xs">
                      {command.category}
                    </Tag>
                  </Space>
                </List.Item>
              )}
            />
          )}
        </div>
        
        <div className="command-help mt-4 text-xs text-gray-500 text-center">
          <Space split={<span>•</span>}>
            <span>↑↓ Navigate</span>
            <span>Enter Select</span>
            <span>Esc Close</span>
          </Space>
        </div>
      </div>
    </Modal>
  );
}
