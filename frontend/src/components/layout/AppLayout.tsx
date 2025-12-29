
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
  const { themeMode } = useSelector((state: RootState) => state.ui);

  // Global hotkey cho command palette
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

  useEffect(() => {
    if (themeMode === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [themeMode]);

  return (
    <div className="app-shell min-h-screen">
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
