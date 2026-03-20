// src/components/UserDeactivatedError.jsx
import { ShieldAlert } from "lucide-react";
import { supabase } from "@/api/supabaseClient";

export default function UserDeactivatedError() {
  const handleLogout = () => supabase.auth.signOut();

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4 text-center">
      <div className="max-w-md w-full bg-white p-8 rounded-2xl shadow-xl border border-slate-200">
        <div className="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-6">
          <ShieldAlert className="w-8 h-8 text-red-500" />
        </div>
        <h1 className="text-2xl font-bold text-slate-900 mb-2">Account Deactivated</h1>
        <p className="text-slate-600 mb-8 leading-relaxed">
          Your account is currently inactive. Please contact your manager or the system administrator to restore access.
        </p>
        <button 
          onClick={handleLogout}
          className="w-full py-3 px-4 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-lg transition-colors"
        >
          Sign Out
        </button>
      </div>
    </div>
  );
}