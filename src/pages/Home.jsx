import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/lib/AuthContext";
import { Loader2 } from "lucide-react"; // Matching your login style

const ROLE_ROUTES = {
  admin: "AdminDashboard",
  manager: "ManagerDashboard",
  team_lead: "TeamLeadDashboard",
  reviewer: "ReviewerDashboard",
  contributor: "ContributorDashboard",
  client: "ClientDashboard"
};

export default function Home() {
  // ✅ Use userProfile instead of just 'user'
  const { isAuthenticated, userProfile, isLoadingAuth, authError } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    // 1. Wait for AuthContext to finish its work
    if (isLoadingAuth) return;

    // 2. If not logged in, go to login
    if (!isAuthenticated && !authError) {
      navigate("/login", { replace: true });
      return;
    }

    // 3. If there is a registration error, App.jsx handles the UI, 
    // but we stop the redirect logic here.
    if (authError?.type === 'user_not_registered') {
      return;
    }

    // 4. ✅ FIX: Use the role from the profile, not the auth user
    if (userProfile) {
      const role = userProfile.system_role || "contributor";
      const targetPage = ROLE_ROUTES[role] || "ContributorDashboard";
      
      // Convert "AdminDashboard" to "admin-dashboard" for the URL
      const targetPath = targetPage
        .replace(/([a-z])([A-Z])/g, '$1-$2')
        .toLowerCase();

      navigate(`/${targetPath}`, { replace: true });
    }
    
  }, [isAuthenticated, userProfile, isLoadingAuth, authError, navigate]);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50">
      <div className="text-center space-y-6">
        <Loader2 className="w-12 h-12 text-indigo-600 animate-spin mx-auto" />
        <div className="space-y-2">
          <h2 className="text-xl font-semibold text-slate-800">
            Project Hub
          </h2>
          <p className="text-sm text-slate-500 animate-pulse">
            Loading your workspace...
          </p>
        </div>
      </div>
    </div>
  );
}