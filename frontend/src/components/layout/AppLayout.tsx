
import React, { useEffect } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import type { RootState } from '@/types';
import Header from './Header';
import Sidebar from './Sidebar';
import CommandPalette from '@/components/command/CommandPalette';

interface AppLayoutProps {
  children: React.ReactNode;
}

export default function AppLayout({ children }: AppLayoutProps) {
  const dispatch = useDispatch();
  const { sidebarCollapsed } = useSelector((state: RootState) => state.ui);

  
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        dispatch({ type: 'ui/setCommandPaletteOpen', payload: true });
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [dispatch]);

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="flex">
        <Sidebar />
        <div className="flex-1 flex flex-col">
          <Header />
          <main className="flex-1 p-6">
            {children}
          </main>
        </div>
      </div>
      <CommandPalette />
    </div>
  );
}
