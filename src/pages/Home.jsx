import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/lib/AuthContext";
import { createPageUrl } from "@/utils";

const ROLE_ROUTES = {
  admin: "AdminDashboard",
  manager: "ManagerDashboard",
  team_lead: "TeamLeadDashboard",
  reviewer: "ReviewerDashboard",
  contributor: "ContributorDashboard",
  client: "ClientDashboard"
};

export default function Home() {
  const { user, isAuthenticated, isLoadingAuth, authError } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    // 1. If still loading the session, do nothing yet
    if (isLoadingAuth) return;

    // 2. If not authenticated, send to Login
    if (!isAuthenticated) {
      navigate(createPageUrl("Login"), { replace: true });
      return;
    }

    // 3. If there is a registration error, the App.jsx will catch it, 
    // but we stay here to prevent infinite redirect loops.
    if (authError) return;

    // 4. Determine destination based on the 'role' we mapped in AuthContext
    const role = user?.role || "contributor";
    const targetPage = ROLE_ROUTES[role] || "ContributorDashboard";

    // 5. Navigate internally (No page reload = Much faster)
    navigate(createPageUrl(targetPage), { replace: true });
    
  }, [user, isAuthenticated, isLoadingAuth, authError, navigate]);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50">
      <div className="text-center space-y-6">
        {/* Modern Spinner */}
        <div className="relative w-16 h-16 mx-auto">
          <div className="absolute inset-0 border-4 border-indigo-100 rounded-full"></div>
          <div className="absolute inset-0 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
        </div>
        
        <div className="space-y-2">
          <h2 className="text-xl font-semibold text-slate-800 tracking-tight">
            FamilySearch Project Hub
          </h2>
          <p className="text-sm text-slate-500 animate-pulse">
            Verifying your permissions...
          </p>
        </div>
      </div>
    </div>
  );
}