
import React, { useEffect } from 'react';
import { useDispatch } from 'react-redux';
// import { useSelector } from 'react-redux'; // Commented out - dark mode disabled
// import type { RootState } from '@/types'; // Commented out - dark mode disabled
import Header from './Header';
import Sidebar from './Sidebar';
import Footer from './Footer';
import CommandPalette from '@/components/command/CommandPalette';

interface AppLayoutProps {
  children: React.ReactNode;
}

export default function AppLayout({ children }: AppLayoutProps) {
  const dispatch = useDispatch();
  // const { themeMode } = useSelector((state: RootState) => state.ui); // Commented out - dark mode disabled

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

  // Dark mode - Commented out due to issues
  // useEffect(() => {
  //   if (themeMode === 'dark') {
  //     document.documentElement.classList.add('dark');
  //   } else {
  //     document.documentElement.classList.remove('dark');
  //   }
  // }, [themeMode]);

  return (
    <div className="app-shell min-h-screen flex flex-col" style={{ overflowX: 'hidden', width: '100%' }}>
      <div className="flex flex-1" style={{ overflowX: 'hidden', width: '100%' }}>
        <Sidebar />
        <div className="flex-1 flex flex-col min-h-0" style={{ overflowX: 'hidden', width: '100%' }}>
          <Header />
          <main className="flex-1 p-6 overflow-y-auto" style={{ overflowX: 'hidden', width: '100%' }}>
            {children}
          </main>
          <Footer />
        </div>
      </div>
      <CommandPalette />
    </div>
  );
}
