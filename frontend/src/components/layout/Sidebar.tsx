// src/components/layout/Sidebar.tsx
import React from 'react';
import { Button } from '@/components/ui/button';
import { 
  DashboardOutlined,
  CheckSquareOutlined,
  FileTextOutlined,
  RobotOutlined,
  CalendarOutlined,
  SettingOutlined,
  ProjectOutlined,
  TeamOutlined,
} from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { useSelector } from 'react-redux';
import { useNavigate, useLocation } from 'react-router-dom';
import type { RootState } from '@/types';
import { ROUTES } from '@/routes/path';

export default function Sidebar() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const { sidebarCollapsed } = useSelector((state: RootState) => state.ui);

  const menuItems = [
    {
      key: ROUTES.DASHBOARD,
      icon: <DashboardOutlined />,
      label: t('nav.dashboard'),
    },
    {
      key: ROUTES.TASKS,
      icon: <CheckSquareOutlined />,
      label: t('nav.tasks'),
    },
    {
      key: ROUTES.PROJECTS,
      icon: <ProjectOutlined />,
      label: t('nav.projects'),
    },
    {
      key: ROUTES.NOTES,
      icon: <FileTextOutlined />,
      label: t('nav.notes'),
    },
    {
      key: ROUTES.ASSISTANT,
      icon: <RobotOutlined />,
      label: t('nav.assistant'),
    },
    {
      key: ROUTES.CALENDAR,
      icon: <CalendarOutlined />,
      label: t('nav.calendar'),
    },
    {
      key: ROUTES.TEAMS,
      icon: <TeamOutlined />,
      label: t('nav.team'),
    },
    {
      key: ROUTES.SETTINGS,
      icon: <SettingOutlined />,
      label: t('nav.settings'),
    },
  ];

  const handleMenuClick = (key: string) => {
    navigate(key);
  };

  return (
    <aside className={`bg-white border-r border-gray-200 transition-all duration-300 ${
      sidebarCollapsed ? 'w-20' : 'w-64'
    }`}>
      <div className="h-full flex flex-col">
        <div className="p-4 border-b border-gray-200">
          {!sidebarCollapsed && (
            <h2 className="text-lg font-semibold text-gray-800 m-0">
              SmartWork AI
            </h2>
          )}
        </div>
        
        <nav className="flex-1 p-2">
          <div className="space-y-1">
            {menuItems.map((item) => (
              <Button
                key={item.key}
                variant={location.pathname === item.key ? "default" : "ghost"}
                className={`w-full justify-start ${
                  sidebarCollapsed ? 'px-2' : 'px-3'
                }`}
                onClick={() => handleMenuClick(item.key)}
              >
                <span className="mr-3">{item.icon}</span>
                {!sidebarCollapsed && <span>{item.label}</span>}
              </Button>
            ))}
          </div>
        </nav>
      </div>
    </aside>
  );
}