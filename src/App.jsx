import { Toaster } from "@/components/ui/toaster";
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClientInstance } from '@/lib/query-client';
import NavigationTracker from '@/lib/NavigationTracker';
import { pagesConfig } from './pages.config';
import { BrowserRouter as Router, Route, Routes, Navigate, useLocation } from 'react-router-dom';
import PageNotFound from './lib/PageNotFound';
import { AuthProvider, useAuth } from '@/lib/AuthContext';
import UserNotRegisteredError from '@/components/UserNotRegisteredError';
import ResetPassword from './pages/ResetPassword';
import UserDeactivatedError from '@/components/UserDeactivatedError';
import ProtectedRoute from './components/ProtectedRoute';


const { Pages, Layout, mainPage } = pagesConfig;

const formatPath = (name) => {
  return name
    .replace(/([a-z])([A-Z])/g, '$1-$2')
    .replace(/\s+/g, '-')
    .toLowerCase();
};

const mainPageKey = mainPage ?? Object.keys(Pages)[0];
const MainPage = Pages[mainPageKey] || (() => <></>);

const LayoutWrapper = ({ children, currentPageName }) => {
  if (!Layout) return <>{children}</>;
  return <Layout currentPageName={currentPageName}>{children}</Layout>;
};

const AppRoutes = () => {
  const { 
    isLoadingAuth, 
    authError, 
    isAuthenticated, 
    userProfile 
  } = useAuth();
  
  const location = useLocation();

  // 1. CRITICAL: Do not render ANY routes until the initial auth check is done.
  // If you don't do this, the 'Navigate' logic below will trigger 
  // with partial data, causing a redirect loop.
  if (isLoadingAuth) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-slate-50">
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 border-4 border-slate-200 border-t-indigo-600 rounded-full animate-spin"></div>
          <p className="text-slate-500 font-medium animate-pulse">Authenticating...</p>
        </div>
      </div>
    );
  }

  // 2. Handle specific blocked states
  if (authError?.type === 'user_not_registered') {
    return <UserNotRegisteredError />;
  }

  if (isAuthenticated && userProfile?.status === 'inactive') {
    return <UserDeactivatedError />;
  }


  return (
    <Routes>
      {/* --- PUBLIC ROUTES --- */}
      <Route 
        path="/login" 
        element={
          isAuthenticated ? (
            <Navigate to={`/${formatPath(mainPageKey)}`} replace />
          ) : (
            <LayoutWrapper currentPageName="Login">
              {Pages.Login ? <Pages.Login /> : (
                <div className="p-10 text-red-500 font-mono">
                  Error: Login component missing
                </div>
              )}
            </LayoutWrapper>
          )
        } 
      />
      
      <Route 
        path="/reset-password" 
        element={
          <LayoutWrapper currentPageName="Reset Password">
            <ResetPassword />
          </LayoutWrapper>
        } 
      />
      
      <Route path="/Login" element={<Navigate to="/login" replace />} />

      {/* --- PROTECTED ROUTES --- */}
      <Route 
        path="/" 
        element={
          <ProtectedRoute>
            <LayoutWrapper currentPageName={mainPageKey}>
              <MainPage />
            </LayoutWrapper>
          </ProtectedRoute>
        } 
      />

      {Object.entries(Pages).map(([name, PageComponent]) => {
        if (!PageComponent || name === 'Login') return null;
        const path = formatPath(name);
        return (
          <Route 
            key={name} 
            path={`/${path}`}
            element={
              <ProtectedRoute>
                <LayoutWrapper currentPageName={name}>
                  <PageComponent />
                </LayoutWrapper>
              </ProtectedRoute>
            } 
          />
        );
      })}

      <Route 
        path="*" 
        element={
          isAuthenticated ? (
            <PageNotFound />
          ) : (
            <Navigate to="/login" state={{ from: location }} replace />
          )
        } 
      />
    </Routes>
  );
};

function App() {
  return (
    <AuthProvider>
      <QueryClientProvider client={queryClientInstance}>
        <Router>
          <NavigationTracker />
          <AppRoutes />
          <Toaster />
        </Router>
      </QueryClientProvider>
    </AuthProvider>
  );
}

export default App;





// import { Toaster } from "@/components/ui/toaster";
// import { QueryClientProvider } from '@tanstack/react-query';
// import { queryClientInstance } from '@/lib/query-client';
// import NavigationTracker from '@/lib/NavigationTracker';
// import { pagesConfig } from './pages.config';
// import { BrowserRouter as Router, Route, Routes, Navigate, useLocation } from 'react-router-dom';
// import PageNotFound from './lib/PageNotFound';
// import { AuthProvider, useAuth } from '@/lib/AuthContext';
// import UserNotRegisteredError from '@/components/UserNotRegisteredError';
// import ResetPassword from './pages/ResetPassword';
// import UserDeactivatedError from '@/components/UserDeactivatedError';
// import ProtectedRoute from './components/ProtectedRoute';

// const { Pages, Layout, mainPage } = pagesConfig;

// // Utility to format page names to URL paths
// const formatPath = (name) => {
//   return name
//     .replace(/([a-z])([A-Z])/g, '$1-$2')
//     .replace(/\s+/g, '-')
//     .toLowerCase();
// };

// const mainPageKey = mainPage ?? Object.keys(Pages)[0];
// const MainPage = Pages[mainPageKey] || (() => <></>);

// // Layout wrapper component
// const LayoutWrapper = ({ children, currentPageName }) => {
//   if (!Layout) return <>{children}</>;
//   return <Layout currentPageName={currentPageName}>{children}</Layout>;
// };

// // --- ROUTE LOGIC COMPONENT ---
// const AppRoutes = () => {
//   const { 
//     isLoadingAuth, 
//     isLoadingPublicSettings, 
//     authError, 
//     isAuthenticated, 
//     userProfile 
//   } = useAuth();
  
//   const location = useLocation();

//   // 1. GLOBAL LOADING STATE
//   // Keeps the screen clean while checking Supabase session + Profile table
//   if (isLoadingPublicSettings || isLoadingAuth) {
//     return (
//       <div className="fixed inset-0 flex items-center justify-center bg-slate-50">
//         <div className="w-10 h-10 border-4 border-slate-200 border-t-indigo-600 rounded-full animate-spin"></div>
//       </div>
//     );
//   }

//   // 2. REGISTRATION ERROR (Auth exists, but Profile row is missing in DB)
//   if (authError?.type === 'user_not_registered') {
//     return <UserNotRegisteredError />;
//   }

//   // 3. DEACTIVATED GUARD
//   if (isAuthenticated && userProfile?.status === 'inactive') {
//     return <UserDeactivatedError />;
//   }

//   return (
//     <Routes>
//       {/* --- PUBLIC ROUTES --- */}
//       <Route 
//         path="/login" 
//         element={
//           isAuthenticated ? (
//             <Navigate to={`/${formatPath(mainPageKey)}`} replace />
//           ) : (
//             <LayoutWrapper currentPageName="Login">
//               {Pages.Login ? <Pages.Login /> : (
//                 <div className="p-10 text-red-500 font-mono">
//                   Error: Login component missing
//                 </div>
//               )}
//             </LayoutWrapper>
//           )
//         } 
//       />
      
//       {/* ✅ CRITICAL FIX: Removed the 'isAuthenticated' redirect from /reset-password.
//         Supabase creates a temporary session when clicking an email recovery link.
//         If we redirect 'isAuthenticated' users here, they can never finish resetting!
//       */}
//       <Route 
//         path="/reset-password" 
//         element={
//           <LayoutWrapper currentPageName="Reset Password">
//             <ResetPassword />
//           </LayoutWrapper>
//         } 
//       />
      
//       {/* Redirect legacy /Login to /login */}
//       <Route path="/Login" element={<Navigate to="/login" replace />} />

//       {/* --- PROTECTED ROUTES --- */}
//       {/* Root path redirects to the designated main page */}
//       <Route 
//         path="/" 
//         element={
//           <ProtectedRoute>
//             <LayoutWrapper currentPageName={mainPageKey}>
//               <MainPage />
//             </LayoutWrapper>
//           </ProtectedRoute>
//         } 
//       />

//       {/* Dynamic protected routes for all pages defined in pages.config */}
//       {Object.entries(Pages).map(([name, PageComponent]) => {
//         if (!PageComponent || name === 'Login') return null;
        
//         const path = formatPath(name);
        
//         return (
//           <Route 
//             key={name} 
//             path={`/${path}`}
//             element={
//               <ProtectedRoute>
//                 <LayoutWrapper currentPageName={name}>
//                   <PageComponent />
//                 </LayoutWrapper>
//               </ProtectedRoute>
//             } 
//           />
//         );
//       })}

//       {/* --- FALLBACKS --- */}
//       <Route 
//         path="*" 
//         element={
//           isAuthenticated ? (
//             <PageNotFound />
//           ) : (
//             <Navigate to="/login" state={{ from: location }} replace />
//           )
//         } 
//       />
//     </Routes>
//   );
// };

// // --- MAIN APP COMPONENT ---
// function App() {
//   return (
//     <AuthProvider>
//       <QueryClientProvider client={queryClientInstance}>
//         <Router>
//           <NavigationTracker />
//           <AppRoutes />
//           <Toaster />
//         </Router>
//       </QueryClientProvider>
//     </AuthProvider>
//   );
// }

// export default App;