import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/lib/AuthContext'; // Pointing to the consolidated lib file

const ProtectedRoute = ({ children, allowedRoles = [] }) => {
  const { user, userProfile, isLoadingAuth } = useAuth();
  const location = useLocation();

  // 1. Still loading the session or profile? 
  // This prevents the "flash of login" on refresh.
  if (isLoadingAuth) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-50">
        <div className="w-10 h-10 border-4 border-slate-200 border-t-indigo-600 rounded-full animate-spin"></div>
      </div>
    );
  }

  // 2. Not logged in at all? 
  // Redirect to login but remember where they were trying to go.
  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // 3. Role-based check: 
  // If the page requires specific roles (e.g. ['admin']), check the profile.
  if (allowedRoles.length > 0 && !allowedRoles.includes(userProfile?.system_role)) {
    return <Navigate to="/unauthorized" replace />;
  }

  // 4. Everything is good? Render the child component (the page).
  return children;
};

export default ProtectedRoute;