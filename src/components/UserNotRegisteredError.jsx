import React from 'react';
import { supabase } from "@/api/supabaseClient"; // Adjust this path to where your supabase client is defined

const UserNotRegisteredError = () => {
  const handleLogout = async () => {
    await supabase.auth.signOut();
    window.location.href = "/login"; // Redirect to login after signing out
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gradient-to-b from-white to-slate-50 p-4">
      <div className="max-w-md w-full p-8 bg-white rounded-2xl shadow-xl border border-slate-100">
        <div className="text-center">
          <div className="inline-flex items-center justify-center w-20 h-20 mb-6 rounded-full bg-orange-50 border-4 border-white shadow-sm">
            <svg className="w-10 h-10 text-orange-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>

          <h1 className="text-3xl font-extrabold text-slate-900 mb-3 tracking-tight">Access Restricted</h1>
          <p className="text-slate-600 mb-8 leading-relaxed">
            Your account is not currently registered to use this application. Please contact your administrator to request access.
          </p>

          <div className="p-5 bg-slate-50 rounded-xl text-sm text-slate-600 text-left mb-8 border border-slate-100">
            <p className="font-bold text-slate-800 mb-2">Troubleshooting Steps:</p>
            <ul className="list-disc list-inside space-y-2 opacity-90">
              <li>Verify you are using your authorized work email</li>
              <li>Ensure your Team Lead has assigned you to a project</li>
              <li>Refresh the page if access was recently granted</li>
            </ul>
          </div>

          <div className="flex flex-col gap-3">
            <button 
              onClick={() => window.location.reload()}
              className="w-full py-3 px-4 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl transition-all shadow-lg"
            >
              Retry Access
            </button>
            <button 
              onClick={handleLogout}
              className="w-full py-3 px-4 bg-white border border-slate-200 text-slate-600 font-semibold rounded-xl hover:bg-slate-50 transition-colors"
            >
              Sign Out & Switch Account
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default UserNotRegisteredError;