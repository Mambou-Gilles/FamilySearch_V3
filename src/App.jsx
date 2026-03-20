import { Toaster } from "@/components/ui/toaster";
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClientInstance } from '@/lib/query-client';
import NavigationTracker from '@/lib/NavigationTracker';
import { pagesConfig } from './pages.config';
import { BrowserRouter as Router, Route, Routes, Navigate } from 'react-router-dom';
import PageNotFound from './lib/PageNotFound';
import { AuthProvider, useAuth } from '@/lib/AuthContext';
import UserNotRegisteredError from '@/components/UserNotRegisteredError';
import ResetPassword from './pages/ResetPassword';
import UserDeactivatedError from '@/components/UserDeactivatedError';
import ProtectedRoute from './components/ProtectedRoute'; // Ensure this path is correct

const { Pages, Layout, mainPage } = pagesConfig;

const formatPath = (name) => {
  return name
    .replace(/([a-z])([A-Z])/g, '$1-$2')
    .replace(/\s+/g, '-')
    .toLowerCase();
};

const mainPageKey = mainPage ?? Object.keys(Pages)[0];
const MainPage = Pages[mainPageKey] || (() => <></>);

const LayoutWrapper = ({ children, currentPageName }) => Layout ? 
  <Layout currentPageName={currentPageName}>{children}</Layout> 
  : <>{children}</>;

const AuthenticatedApp = () => {
  const { 
    isLoadingAuth, 
    isLoadingPublicSettings, 
    authError, 
    isAuthenticated,
    userProfile 
  } = useAuth();

  // 1. GLOBAL LOADING STATE
  // Prevents the "Flash of Login" during a page refresh
  if (isLoadingPublicSettings || isLoadingAuth) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-slate-50">
        <div className="w-10 h-10 border-4 border-slate-200 border-t-indigo-600 rounded-full animate-spin"></div>
      </div>
    );
  }

  // 2. REGISTRATION ERROR (Auth exists, but no Profile)
  if (authError?.type === 'user_not_registered') {
    return <UserNotRegisteredError />;
  }

  // 3. DEACTIVATED GUARD
  if (isAuthenticated && userProfile?.status === 'inactive') {
    return <UserDeactivatedError />;
  }

  return (
    <Routes>
      {/* --- PUBLIC ROUTES --- */}
      <Route path="/login" element={
        Pages.Login ? (
          <LayoutWrapper currentPageName="Login">
            <Pages.Login />
          </LayoutWrapper>
        ) : (
          <div className="p-10 text-red-500 font-mono">Error: Login component missing</div>
        )
      } />
      
      <Route path="/reset-password" element={
        <LayoutWrapper currentPageName="Reset Password">
          <ResetPassword />
        </LayoutWrapper>
      } />
      
      <Route path="/Login" element={<Navigate to="/login" replace />} />

      {/* --- PROTECTED ROUTES --- */}
      {/* Wrap everything in ProtectedRoute so the session is verified before rendering */}
      <Route path="/" element={
        <ProtectedRoute>
          <LayoutWrapper currentPageName={mainPageKey}>
            <MainPage />
          </LayoutWrapper>
        </ProtectedRoute>
      } />

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
      
      {/* --- FALLBACKS --- */}
      {/* If the user is definitely NOT authenticated, send them to login */}
      {/* 1. If we are NOT loading and NOT authenticated, then and ONLY THEN redirect */}
      {!isLoadingAuth && !isAuthenticated && (
        <Route path="*" element={<Navigate to="/login" replace />} />
      )}
      
      {/* 2. If we ARE authenticated but the page doesn't exist, show 404 */}
      {isAuthenticated && (
        <Route path="*" element={<PageNotFound />} />
      )}
    </Routes>
  );
};

function App() {
  return (
    <AuthProvider>
      <QueryClientProvider client={queryClientInstance}>
        <Router>
          <NavigationTracker />
          <AuthenticatedApp />
        </Router>
        <Toaster />
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
// import { BrowserRouter as Router, Route, Routes, Navigate } from 'react-router-dom';
// import PageNotFound from './lib/PageNotFound';
// import { AuthProvider, useAuth } from '@/lib/AuthContext';
// import UserNotRegisteredError from '@/components/UserNotRegisteredError';
// import ResetPassword from './pages/ResetPassword';
// import UserDeactivatedError from '@/components/UserDeactivatedError';

// const { Pages, Layout, mainPage } = pagesConfig;

// // Helper to match your createPageUrl utility logic
// const formatPath = (name) => {
//   return name
//     .replace(/([a-z])([A-Z])/g, '$1-$2')
//     .replace(/\s+/g, '-')
//     .toLowerCase();
// };

// const mainPageKey = mainPage ?? Object.keys(Pages)[0];
// const MainPage = Pages[mainPageKey] || (() => <></>);

// const LayoutWrapper = ({ children, currentPageName }) => Layout ? 
//   <Layout currentPageName={currentPageName}>{children}</Layout> 
//   : <>{children}</>;

// const AuthenticatedApp = () => {
//   const { 
//     isLoadingAuth, 
//     isLoadingPublicSettings, 
//     authError, 
//     isAuthenticated,
//     userProfile 
//   } = useAuth();

//   // 1. Loading state
//   if (isLoadingPublicSettings || isLoadingAuth) {
//     return (
//       <div className="fixed inset-0 flex items-center justify-center bg-slate-50">
//         <div className="w-10 h-10 border-4 border-slate-200 border-t-indigo-600 rounded-full animate-spin"></div>
//       </div>
//     );
//   }

//   // 2. Registration Error state (Auth exists, but no Profile yet)
//   if (authError?.type === 'user_not_registered') {
//     return <UserNotRegisteredError />;
//   }

//   // 3. DEACTIVATED GUARD
//   // If the user is authenticated but their profile status is 'inactive', 
//   // we return the Error component immediately, blocking all routes.
//   if (isAuthenticated && userProfile?.status === 'inactive') {
//     return <UserDeactivatedError />;
//   }

//   return (
//     <Routes>
//       {/* PUBLIC ROUTE: Login */}
//       <Route path="/login" element={
//         Pages.Login ? (
//           <LayoutWrapper currentPageName="Login">
//             <Pages.Login />
//           </LayoutWrapper>
//         ) : (
//           <div className="p-10 text-red-500 font-mono">Error: Login component missing in pages.config.js</div>
//         )
//       } />
      
//       {/* PUBLIC ROUTE: Reset Password */}
//       <Route path="/reset-password" element={
//         <LayoutWrapper currentPageName="Reset Password">
//           <ResetPassword />
//         </LayoutWrapper>
//       } />
      
//       {/* Compatibility redirect for uppercase /Login */}
//       <Route path="/Login" element={<Navigate to="/login" replace />} />

//       {/* 4. AUTH GATEWAY */}
//       {!isAuthenticated ? (
//         <Route path="*" element={<Navigate to="/login" replace />} />
//       ) : (
//         <>
//           {/* 5. PROTECTED ROUTES */}
//           <Route path="/" element={
//             <LayoutWrapper currentPageName={mainPageKey}>
//               <MainPage />
//             </LayoutWrapper>
//           } />

//           {Object.entries(Pages).map(([name, PageComponent]) => {
//             if (!PageComponent || name === 'Login') return null;
//             const path = formatPath(name);

//             return (
//               <Route
//                 key={name}
//                 path={`/${path}`}
//                 element={
//                   <LayoutWrapper currentPageName={name}>
//                     <PageComponent />
//                   </LayoutWrapper>
//                 }
//               />
//             );
//           })}
          
//           {/* Catch-all 404 for authenticated users */}
//           <Route path="*" element={<PageNotFound />} />
//         </>
//       )}
//     </Routes>
//   );
// };

// function App() {
//   return (
//     <AuthProvider>
//       <QueryClientProvider client={queryClientInstance}>
//         <Router>
//           <NavigationTracker />
//           <AuthenticatedApp />
//         </Router>
//         <Toaster />
//       </QueryClientProvider>
//     </AuthProvider>
//   );
// }

// export default App;