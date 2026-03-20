import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const ProtectedRoute = ({ children, allowedRoles = [] }) => {
  const { user, profile, loading } = useAuth();
  const location = useLocation();

  // 1. Still loading the session/profile? Show nothing or a spinner.
  if (loading) {
    return <div className="flex h-screen items-center justify-center">Loading...</div>;
  }

  // 2. Not logged in? Send them to login page.
  // We save the 'from' location so we can redirect them back after login.
  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // 3. Role-based check: If the page requires specific roles, check the profile.
  // Example: allowedRoles = ['admin', 'manager']
  if (allowedRoles.length > 0 && !allowedRoles.includes(profile?.system_role)) {
    return <Navigate to="/unauthorized" replace />;
  }

  // 4. Everything is good? Render the page.
  return children;
};

export default ProtectedRoute;