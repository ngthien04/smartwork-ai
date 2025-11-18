// src/components/layout/Header.tsx
import { Button } from '@/components/ui/button';
import { 
  SearchOutlined, 
  MenuFoldOutlined, 
  MenuUnfoldOutlined,
  UserOutlined,
  BellOutlined
} from '@ant-design/icons';
import { useSelector, useDispatch } from 'react-redux';
import type { RootState } from '@/types';
import { toggleSidebar, setCommandPaletteOpen } from '@/store/slices/uiSlice';

export default function Header() {
  const dispatch = useDispatch();
  const { sidebarCollapsed } = useSelector((state: RootState) => state.ui);
  const { user } = useSelector((state: RootState) => state.auth);

  const handleSearchClick = () => {
    dispatch(setCommandPaletteOpen(true));
  };

  return (
    <header className="bg-white shadow-sm border-b border-gray-200 px-4 flex items-center justify-between h-16">
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

        <Button
          variant="ghost"
          size="icon"
          className="text-gray-500 hover:text-gray-700"
        >
          <BellOutlined />
        </Button>

        <div className="flex items-center cursor-pointer hover:bg-gray-50 px-2 py-1 rounded">
          <div className="w-8 h-8 bg-gray-200 rounded-full flex items-center justify-center mr-2">
            <UserOutlined className="text-sm" />
          </div>
          <span className="text-sm font-medium text-gray-700">
            {user?.name || 'User'}
          </span>
        </div>
      </div>
    </header>
  );
}