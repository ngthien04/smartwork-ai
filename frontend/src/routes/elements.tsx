// src/routes/elements.tsx
import { useRoutes, Navigate, Outlet } from 'react-router-dom';
import ProtectedRoute from './ProtectedRoute';
import { ROUTES } from './path';
import AppLayout from '@/components/layout/AppLayout';

// pages
import Dashboard from '@/pages/dashboard/Dashboard';
import TasksPage from '@/pages/tasks/TasksPage';
import TaskDetailPage from '@/pages/tasks/TaskDetailPage';
import NotesPage from '@/pages/notes/NotesPage';
import AssistantPage from '@/pages/assistant/AssistantPage';
import CalendarPage from '@/pages/calendar/CalendarPage';
import SettingsPage from '@/pages/settings/SettingsPage';
import ProjectListPage from '@/pages/projects/ProjectListPage';
import ProjectDetailPage from '@/pages/projects/ProjectDetailPage';
import TeamManagementPage from '@/pages/team/TeamManagementPage';
import AuthPage from '@/pages/auth/AuthPage';
import ResetPasswordPage from '@/pages/auth/ResetPasswordPage';
import AdminPage from '@/pages/admin/AdminPage';
import AcceptInvitePage from '@/pages/invite/AcceptInvitePage';

const LayoutWrapper = () => (
  <AppLayout>
    <Outlet />
  </AppLayout>
);

export default function useRouterElements() {
  return useRoutes([
    { path: ROUTES.HOME, element: <Navigate to={ROUTES.DASHBOARD} replace /> },
    {
      element: <ProtectedRoute />,
      children: [
        {
          element: <LayoutWrapper />,
          children: [
            { path: ROUTES.DASHBOARD, element: <Dashboard /> },
            { path: ROUTES.TASKS, element: <TasksPage /> },
            { path: ROUTES.TASK_DETAIL, element: <TaskDetailPage /> },
            { path: ROUTES.PROJECTS, element: <ProjectListPage /> },
            { path: ROUTES.PROJECT_DETAIL, element: <ProjectDetailPage /> },
            { path: ROUTES.NOTES, element: <NotesPage /> },
            { path: ROUTES.ASSISTANT, element: <AssistantPage /> },
            { path: ROUTES.CALENDAR, element: <CalendarPage /> },
            { path: ROUTES.SETTINGS, element: <SettingsPage /> },
            { path: ROUTES.TEAMS, element: <TeamManagementPage /> },
            { path: ROUTES.TEAM_MEMBERS, element: <TeamManagementPage /> },
            { path: ROUTES.INVITE_ACCEPT, element: <AcceptInvitePage /> },
          ],
        },
      ],
    },
    {
      path: ROUTES.ADMIN,
      element: <ProtectedRoute requireAdmin />,
      children: [
        {
          element: <LayoutWrapper />,
          children: [{ index: true, element: <AdminPage /> }],
        },
      ],
    },
    { path: ROUTES.AUTH, element: <AuthPage /> },
    { path: ROUTES.LOGIN, element: <AuthPage /> },
    { path: ROUTES.REGISTER, element: <AuthPage /> },
    { path: ROUTES.RESET_PASSWORD, element: <ResetPasswordPage /> },
  ]);
}
