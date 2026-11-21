import React from 'react';
import { ShieldAlert } from 'lucide-react';
import { Navigate, useLocation } from 'react-router-dom';
import { LoadingState } from '../../components/LoadingState';
import { useAuth } from '../../context/AuthContext';
import { AppPermission, hasPermission } from '../../context/rbac';
import { TenantRole } from '../../types';

interface ProtectedRouteProps {
  children: React.ReactNode;
  requiredRole?: TenantRole;
  requiredPermission?: AppPermission;
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({
  children,
  requiredRole,
  requiredPermission,
}) => {
  const { isAuthenticated, isLoading, role } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-[#09090b]">
        <LoadingState message="Verifying authentication and tenant permissions..." />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // Permission check
  if (requiredPermission && !hasPermission(role, requiredPermission)) {
    return (
      <div className="flex h-[calc(100vh-48px)] flex-col items-center justify-center p-6 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-full border border-[#f43f5e]/30 bg-[#f43f5e]/10 text-[#f43f5e]">
          <ShieldAlert className="h-6 w-6" />
        </div>
        <h2 className="mt-4 font-display text-[18px] font-semibold text-[#fafafa]">
          Insufficient Role Permissions
        </h2>
        <p className="mt-1.5 max-w-md font-mono text-[12px] text-[#a1a1aa] leading-relaxed">
          Your current membership role <span className="text-[#f59e0b] font-semibold">[{role}]</span> does not possess the <span className="font-semibold text-[#fafafa]">'{requiredPermission}'</span> permission required to access this resource.
        </p>
        <div className="mt-4 rounded border border-[#27272a] bg-[#111113] p-2.5 font-mono text-[11px] text-[#71717a]">
          Contact your TenantOwner to elevate your membership role.
        </div>
      </div>
    );
  }

  if (requiredRole && role !== requiredRole && role !== 'TenantOwner') {
    return (
      <div className="flex h-[calc(100vh-48px)] flex-col items-center justify-center p-6 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-full border border-[#f43f5e]/30 bg-[#f43f5e]/10 text-[#f43f5e]">
          <ShieldAlert className="h-6 w-6" />
        </div>
        <h2 className="mt-4 font-display text-[18px] font-semibold text-[#fafafa]">
          Access Denied
        </h2>
        <p className="mt-1.5 max-w-md font-mono text-[12px] text-[#a1a1aa]">
          This section requires <span className="text-[#6366f1] font-semibold">{requiredRole}</span> role access. Current role: <span className="text-[#f59e0b] font-semibold">{role}</span>.
        </p>
      </div>
    );
  }

  return <>{children}</>;
};
