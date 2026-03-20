import { useState, useEffect } from 'react';
import { supabase } from '@/api/supabaseClient';
import { useNavigate } from 'react-router-dom';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { LockKeyhole } from "lucide-react";

const ResetPassword = () => {
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [isSessionReady, setIsSessionReady] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    // Check if we have a session (Supabase automatically logs them in via the email link)
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) {
        toast.error("Invalid or expired reset link.");
        // Optional: navigate('/login');
      } else {
        setIsSessionReady(true);
      }
    });
  }, []);

  const handleUpdatePassword = async (e) => {
    e.preventDefault();
    if (newPassword.length < 6) return toast.error("Password must be at least 6 characters");
    if (newPassword !== confirmPassword) return toast.error("Passwords don't match");

    setLoading(true);
    
    // This updates the user's password and clears the temporary reset state
    const { error } = await supabase.auth.updateUser({ password: newPassword });

    if (error) {
      toast.error(error.message);
      setLoading(false);
    } else {
      toast.success('Password set successfully! Redirecting...');
      // Small delay so they can see the success message
      setTimeout(() => navigate('/dashboard'), 1500);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-xl border border-slate-200 overflow-hidden">
        <div className="bg-indigo-600 p-6 text-white text-center">
          <div className="bg-white/20 w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-4">
            <LockKeyhole className="w-6 h-6 text-white" />
          </div>
          <h1 className="text-xl font-bold">Secure Your Account</h1>
          <p className="text-indigo-100 text-sm mt-1">Set a new password to access your dashboard.</p>
        </div>

        <form onSubmit={handleUpdatePassword} className="p-8 space-y-4">
          <div className="space-y-2">
            <Label htmlFor="password">New Password</Label>
            <Input 
              id="password"
              type="password" 
              placeholder="••••••••" 
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)} 
              required 
              className="bg-slate-50 border-slate-200"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="confirm">Confirm New Password</Label>
            <Input 
              id="confirm"
              type="password" 
              placeholder="••••••••" 
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)} 
              required 
              className="bg-slate-50 border-slate-200"
            />
          </div>

          <Button 
            type="submit" 
            disabled={loading || !isSessionReady} 
            className="w-full bg-indigo-600 hover:bg-indigo-700 h-11"
          >
            {loading ? 'Updating...' : 'Set Password & Login'}
          </Button>

          {!isSessionReady && !loading && (
            <p className="text-[10px] text-center text-slate-400 italic">
              Verifying security token...
            </p>
          )}
        </form>
      </div>
    </div>
  );
};

export default ResetPassword;