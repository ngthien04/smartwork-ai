import { useEffect, useState } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { 
  SearchOutlined, 
  MenuFoldOutlined, 
  MenuUnfoldOutlined,
  UserOutlined,
  BellOutlined
} from '@ant-design/icons';
import { Badge, Dropdown, List, Spin, Empty, Typography, Popconfirm } from 'antd';
import type { MenuProps } from 'antd';
import { useLocation, useNavigate } from 'react-router-dom';

import { Button } from '@/components/ui/button';
import type { RootState } from '@/types';
import { toggleSidebar, setCommandPaletteOpen } from '@/store/slices/uiSlice';
import notificationServices, { type Notification } from '@/services/notificationServices';
import { logout } from '@/store/slices/authSlice';
import { ROUTES } from '@/routes/path';

const { Text } = Typography;

export default function Header() {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const location = useLocation();

  const sidebarCollapsed = useSelector((state: RootState) => state.ui.sidebarCollapsed);
  const { user } = useSelector((state: RootState) => state.auth);

  
  const [notiOpen, setNotiOpen] = useState(false);
  const [notiLoading, setNotiLoading] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);

  const handleSearchClick = () => {
    dispatch(setCommandPaletteOpen(true));
  };

  const handleLogout = () => {
    dispatch(logout());
    navigate(ROUTES.AUTH);
  };

  
  const fetchUnreadCount = async () => {
    try {
      const res = await notificationServices.unreadCount();
      setUnreadCount(res.data.unread);
    } catch (e) {
      console.error('fetchUnreadCount error', e);
    }
  };

  const fetchNotifications = async () => {
    try {
      setNotiLoading(true);
      const res = await notificationServices.list({ page: 1, limit: 10 });
      setNotifications(res.data.items);
    } catch (e) {
      console.error('fetchNotifications error', e);
    } finally {
      setNotiLoading(false);
    }
  };

  useEffect(() => {
    fetchUnreadCount();
    const interval = setInterval(fetchUnreadCount, 30000); 
    return () => clearInterval(interval);
  }, []);

  const handleNotiOpenChange = async (open: boolean) => {
    setNotiOpen(open);
    if (open) {
      await fetchNotifications();
    }
  };

  const handleMarkAllRead = async () => {
    try {
      await notificationServices.markAllRead();
      setNotifications((prev) =>
        prev.map((n) => ({
          ...n,
          isRead: true,
          readAt: n.readAt || new Date().toISOString(),
        })),
      );
      setUnreadCount(0);
    } catch (e) {
      console.error('markAllRead error', e);
    }
  };

  const handleMarkRead = async (id: string) => {
    try {
      await notificationServices.markRead(id);
      setNotifications((prev) =>
        prev.map((n) =>
          n._id === id ? { ...n, isRead: true, readAt: n.readAt || new Date().toISOString() } : n,
        ),
      );
      setUnreadCount((c) => Math.max(0, c - 1));
    } catch (e) {
      console.error('markRead error', e);
    }
  };

  const handleDeleteNotification = async (id: string) => {
    try {
      await notificationServices.remove(id);
      const deleted = notifications.find((n) => n._id === id);
      setNotifications((prev) => prev.filter((n) => n._id !== id));
      if (deleted?.isRead === false) {
        setUnreadCount((c) => Math.max(0, c - 1));
      }
    } catch (e) {
      console.error('delete notification error', e);
    }
  };

  
  const renderNotificationText = (n: Notification) => {
    const payload = n.payload || {};

    switch (n.type) {
      case 'task_comment':
        return (
          <>
            <Text strong>{payload.authorName || 'Ai đó'}</Text>{' '}
            đã bình luận trong task{' '}
            <Text strong>{payload.taskTitle || 'Không rõ task'}</Text>
          </>
        );

      case 'comment_mention':
        return (
          <>
            <Text strong>{payload.authorName || 'Ai đó'}</Text>{' '}
            đã nhắc tới bạn trong task{' '}
            <Text strong>{payload.taskTitle || 'Không rõ task'}</Text>
          </>
        );

      case 'task_assigned':
        return (
          <>
            Bạn được giao task{' '}
            <Text strong>{payload.taskTitle || 'Không rõ task'}</Text>
          </>
        );

      case 'task_due':
        return (
          <>
            Task{' '}
            <Text strong>{payload.taskTitle || 'Không rõ task'}</Text>{' '}
            sắp đến hạn
          </>
        );

      case 'sprint_status':
        return <>Cập nhật sprint: {payload.sprintName || ''}</>;

      case 'ai_alert':
        return <>AI cảnh báo: {payload.message || ''}</>;
      
      case 'task_updated':
        return (
          <>
            Task <Text strong>{payload.taskTitle || 'Không rõ task'}</Text> vừa được cập nhật
          </>
        );

      case 'task_status_changed':
        return (
          <>
            Trạng thái task <Text strong>{payload.taskTitle || 'Không rõ task'}</Text>{' '}
            đã đổi sang <Text strong>{payload.status}</Text>
          </>
        );

      case 'subtask_updated':
        return (
          <>
            Subtask <Text strong>{payload.title || 'Không rõ subtask'}</Text>{' '}
            ({payload.action || 'updated'}) trong task{' '}
            <Text strong>{payload.taskTitle || 'Không rõ task'}</Text>
          </>
        );
      default:
        return <>Thông báo hệ thống</>;
    }
  };

  const notificationMenu = (
    <div className="bg-white shadow-lg rounded-md w-96 border border-gray-100">
      {/* Header */}
      <div className="px-4 py-3 flex items-center justify-between border-b border-gray-200">
        <Text strong className="text-gray-800">Thông báo</Text>
        {notifications.length > 0 && (
          <Button
            variant="ghost"
            className="text-xs text-blue-600 hover:text-blue-700"
            onClick={handleMarkAllRead}
          >
            Đánh dấu tất cả đã đọc
          </Button>
        )}
      </div>

      {/* Body */}
      <div className="p-4 max-h-96 overflow-y-auto"> {/* <-- thêm p-4 ở đây */}
        {notiLoading ? (
          <div className="flex justify-center items-center py-10">
            <Spin />
          </div>
        ) : notifications.length === 0 ? (
          <div className="py-10 flex justify-center items-center">
            <Empty description="Không có thông báo" />
          </div>
        ) : (
          <List
            itemLayout="vertical"
            dataSource={notifications}
            split={false}
            renderItem={(item) => (
              <List.Item
                className={`px-4 py-3 rounded-lg mb-2 transition-colors ${
                  item.isRead ? 'bg-white' : 'bg-blue-50'
                } hover:bg-gray-50`}
                actions={[
                  !item.isRead && (
                    <Button
                      key="read"
                      variant="ghost"
                      className="text-xs text-blue-600"
                      onClick={() => handleMarkRead(item._id)}
                    >
                      Đã đọc
                    </Button>
                  ),
                  <Popconfirm
                    key="delete"
                    title="Xoá thông báo này?"
                    okText="Xoá"
                    cancelText="Huỷ"
                    onConfirm={() => handleDeleteNotification(item._id)}
                  >
                    <Button variant="ghost" className="text-xs text-red-500">
                      Xoá
                    </Button>
                  </Popconfirm>,
                ]}
              >
                <List.Item.Meta
                  title={
                    <div className="flex items-start gap-2">
                      {!item.isRead && (
                        <span className="w-2 h-2 rounded-full bg-blue-500 mt-1" />
                      )}
                      <div className="text-sm text-gray-700">{renderNotificationText(item)}</div>
                    </div>
                  }
                  description={
                    <Text type="secondary" className="text-xs mt-1 block">
                      {new Date(item.createdAt).toLocaleString()}
                    </Text>
                  }
                />
              </List.Item>
            )}
          />
        )}
      </div>
    </div>
  );
  const isAdminUser = !!user?.isAdmin;
  const isOnAdminPage = location.pathname.startsWith(ROUTES.ADMIN);

  const userMenuItems: MenuProps['items'] = [];

  if (isAdminUser) {
    userMenuItems.push({
      key: 'switch-admin',
      label: isOnAdminPage ? 'Trang chủ' : 'Trang quản trị',
      onClick: () => {
        navigate(
          isOnAdminPage
            ? ROUTES.DASHBOARD
            : `${ROUTES.ADMIN}?tab=users`
        );
      },
    });
    userMenuItems.push({ type: 'divider' } as any);
  }

  userMenuItems.push({
    key: 'logout',
    label: 'Đăng xuất',
    onClick: handleLogout,
  });

  return (
    <header className="app-header shadow-sm border-b px-4 flex items-center justify-between h-16">
      <div className="flex items-center">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => dispatch(toggleSidebar())}
          className="mr-4"
        >
          {sidebarCollapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
        </Button>
        
        <div className="flex items-center">
          <h1 className="text-xl font-bold text-gray-800 m-0">SmartWork AI</h1>
        </div>
      </div>

      <div className="flex items-center space-x-4">
        <Button
          variant="ghost"
          size="icon"
          onClick={handleSearchClick}
          className="text-gray-500 hover:text-gray-700"
        >
          <SearchOutlined />
        </Button>

        {/* Bell + dropdown thông báo */}
        <Dropdown
          trigger={['click']}
          open={notiOpen}
          onOpenChange={handleNotiOpenChange}
          dropdownRender={() => notificationMenu}
          placement="bottomRight"
        >
          <div>
            <Badge count={unreadCount} size="small" offset={[-2, 2]}>
              <Button
                variant="ghost"
                size="icon"
                className="text-gray-500 hover:text-gray-700"
              >
                <BellOutlined />
              </Button>
            </Badge>
          </div>
        </Dropdown>

        <Dropdown menu={{ items: userMenuItems }} trigger={['click']} placement="bottomRight">
          <div className="flex items-center cursor-pointer hover:bg-gray-50 px-2 py-1 rounded">
            <div className="w-8 h-8 bg-gray-200 rounded-full flex items-center justify-center mr-2">
              <UserOutlined className="text-sm" />
            </div>
            <span className="text-sm font-medium text-gray-700">
              {user?.name || 'User'}
            </span>
          </div>
        </Dropdown>
      </div>
    </header>
  );
}