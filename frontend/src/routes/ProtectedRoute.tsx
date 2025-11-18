// src/routes/ProtectedRoute.tsx
import { Spin } from 'antd';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useEffect } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import type { RootState } from '@/types';
import type { AppDispatch } from '@/store/store';
import { fetchCurrentUser, logout } from '@/store/slices/authSlice';
import { ROUTES } from './path';

interface ProtectedRouteProps {
  requireAdmin?: boolean;
}

export default function ProtectedRoute({ requireAdmin = false }: ProtectedRouteProps) {
  const { user, token, status } = useSelector((state: RootState) => state.auth);
  const dispatch = useDispatch<AppDispatch>();
  const location = useLocation();

  useEffect(() => {
    if (token && !user && status === 'idle') {
      dispatch(fetchCurrentUser())
        .unwrap()
        .catch(() => {
          dispatch(logout());
        });
    }
  }, [dispatch, token, user, status]);

  if (!token) {
    return <Navigate to={ROUTES.AUTH} state={{ from: location }} replace />;
  }

  if (status === 'loading' || (token && !user)) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Spin size="large" />
      </div>
    );
  }

  if (requireAdmin && !user?.isAdmin) {
    return <Navigate to={ROUTES.DASHBOARD} replace />;
  }

  return <Outlet />;
}
