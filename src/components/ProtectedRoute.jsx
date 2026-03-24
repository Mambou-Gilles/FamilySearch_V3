import { useState, useEffect } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/lib/AuthContext';
import { Loader2, AlertCircle, RefreshCw } from 'lucide-react';

const ProtectedRoute = ({ children, allowedRoles = [] }) => {
  const { user, userProfile, isLoadingAuth, authError, logout } = useAuth();
  const location = useLocation();
  const [timedOut, setTimedOut] = useState(false);

  // --- SAFETY: Timeout Guard ---
  // If we are stuck in 'loading' for more than 5 seconds, 
  // show a "Taking too long?" message instead of an infinite spinner.
  useEffect(() => {
    let timer;
    if (isLoadingAuth) {
      timer = setTimeout(() => setTimedOut(true), 5000);
    } else {
      setTimedOut(false);
    }
    return () => clearTimeout(timer);
  }, [isLoadingAuth]);

  // 1. STILL LOADING (With Timeout Check)
  if (isLoadingAuth) {
    return (
      <div className="flex h-screen flex-col items-center justify-center bg-slate-50 p-6 text-center">
        <Loader2 className="w-10 h-10 text-indigo-600 animate-spin mb-4" />
        <p className="text-slate-600 font-medium">Verifying Session...</p>
        
        {timedOut && (
          <div className="mt-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <p className="text-sm text-slate-400 mb-4">This is taking longer than usual.</p>
            <div className="flex gap-3">
              <button 
                onClick={() => window.location.reload()}
                className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-lg text-sm font-medium hover:bg-slate-50 transition-colors"
              >
                <RefreshCw className="w-4 h-4" /> Refresh
              </button>
              <button 
                onClick={logout}
                className="px-4 py-2 bg-slate-800 text-white rounded-lg text-sm font-medium hover:bg-slate-900 transition-colors"
              >
                Sign Out
              </button>
            </div>
          </div>
        )}
      </div>
    );
  }

  // 2. NOT LOGGED IN
  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // 3. LOGGED IN BUT NO PROFILE FOUND (The "White Screen" Fix)
  // If the user exists but the profile record is missing from the DB.
  if (!userProfile) {
    return (
      <div className="flex h-screen flex-col items-center justify-center bg-slate-50 p-6 text-center">
        <div className="w-16 h-16 bg-amber-100 rounded-full flex items-center justify-center mb-6">
          <AlertCircle className="w-8 h-8 text-amber-600" />
        </div>
        <h1 className="text-xl font-bold text-slate-900">Profile Not Found</h1>
        <p className="text-slate-500 mt-2 max-w-sm">
          Successfully logged in as <span className="font-semibold text-slate-700">{user.email}</span>, 
          but your account profile is missing or inactive in the database.
        </p>
        
        <div className="mt-8 flex flex-col gap-3 w-full max-w-xs">
          <button 
            onClick={() => window.location.reload()}
            className="w-full py-2 bg-indigo-600 text-white rounded-lg font-semibold hover:bg-indigo-700 transition-colors"
          >
            Check Again
          </button>
          <button 
            onClick={logout}
            className="w-full py-2 text-slate-500 hover:text-slate-700 text-sm"
          >
            Sign out and try another account
          </button>
        </div>
      </div>
    );
  }

  // 4. ROLE-BASED ACCESS CONTROL
  if (allowedRoles.length > 0 && !allowedRoles.includes(userProfile?.system_role)) {
    return <Navigate to="/unauthorized" replace />;
  }

  // 5. SUCCESS: Render the requested page
  return children;
};

export default ProtectedRoute;







// import { Navigate, useLocation } from 'react-router-dom';
// import { useAuth } from '@/lib/AuthContext';

// const ProtectedRoute = ({ children, allowedRoles = [] }) => {
//   const { user, userProfile, isLoadingAuth } = useAuth();
//   const location = useLocation();

//   if (isLoadingAuth) {
//     return (
//       <div className="flex h-screen items-center justify-center bg-slate-50">
//         <div className="w-10 h-10 border-4 border-slate-200 border-t-indigo-600 rounded-full animate-spin"></div>
//       </div>
//     );
//   }

//   if (!user) {
//     return <Navigate to="/login" state={{ from: location }} replace />;
//   }

//   if (allowedRoles.length > 0 && !allowedRoles.includes(userProfile?.system_role)) {
//     return <Navigate to="/unauthorized" replace />;
//   }
//   console.log("PROTECTED ROUTE PASSED");

//   return children;
// };

// export default ProtectedRoute;