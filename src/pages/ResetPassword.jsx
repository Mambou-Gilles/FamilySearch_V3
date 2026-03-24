import { useState, useEffect } from 'react';
import { supabase } from '@/api/supabaseClient';
import { useNavigate } from 'react-router-dom';
import { Eye, EyeOff, Lock, CheckCircle2, XCircle } from 'lucide-react';

const ResetPassword = () => {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [success, setSuccess] = useState(false);
  
  const navigate = useNavigate();

  // Password Strength Logic
  const passwordRequirements = [
    { label: 'At least 8 characters', test: (pw) => pw.length >= 8 },
    { label: 'Contains a number', test: (pw) => /[0-9]/.test(pw) },
    { label: 'Contains a special character', test: (pw) => /[!@#$%^&*]/.test(pw) },
    { label: 'Passwords match', test: (pw) => pw === confirmPassword && pw !== '' },
  ];

  const isPasswordValid = passwordRequirements.every(req => req.test(password));

  const handleReset = async (e) => {
    e.preventDefault();
    if (!isPasswordValid) return;

    setLoading(true);
    setErrorMsg('');

    try {
      // ✅ Supabase handles the session via the URL fragment automatically
      const { error } = await supabase.auth.updateUser({
        password: password
      });

      if (error) {
        setErrorMsg(error.message);
      } else {
        setSuccess(true);
        // Delay redirect so user sees success message
        setTimeout(() => navigate('/login', { replace: true }), 3000);
      }
    } catch (err) {
      setErrorMsg('An unexpected error occurred.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-xl border border-slate-200 p-8">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-slate-900">Set New Password</h1>
          <p className="text-slate-500 mt-2">Ensure your account is secure with a strong password.</p>
        </div>

        {success ? (
          <div className="text-center py-6">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-green-100 text-green-600 rounded-full mb-4">
              <CheckCircle2 size={32} />
            </div>
            <h2 className="text-xl font-semibold text-slate-900">Password Updated!</h2>
            <p className="text-slate-500 mt-2">Redirecting you to login...</p>
          </div>
        ) : (
          <form onSubmit={handleReset} className="space-y-5">
            {errorMsg && (
              <div className="p-3 bg-red-50 text-red-700 rounded-lg text-sm border border-red-100">
                {errorMsg}
              </div>
            )}

            {/* New Password Field */}
            <div className="relative">
              <label className="block text-sm font-medium text-slate-700 mb-1">New Password</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                  <Lock size={18} />
                </div>
                <input
                  type={showPassword ? "text" : "password"}
                  className="w-full pl-10 pr-10 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-indigo-600"
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            {/* Confirm Password Field */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Confirm Password</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                  <Lock size={18} />
                </div>
                <input
                  type={showPassword ? "text" : "password"}
                  className="w-full pl-10 pr-3 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                />
              </div>
            </div>

            {/* Strength Requirements List */}
            <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 space-y-2">
              {passwordRequirements.map((req, index) => (
                <div key={index} className="flex items-center text-sm">
                  {req.test(password) ? (
                    <CheckCircle2 size={14} className="text-green-500 mr-2" />
                  ) : (
                    <XCircle size={14} className="text-slate-300 mr-2" />
                  )}
                  <span className={req.test(password) ? "text-slate-700" : "text-slate-400"}>
                    {req.label}
                  </span>
                </div>
              ))}
            </div>

            <button
              type="submit"
              disabled={loading || !isPasswordValid}
              className="w-full py-3 px-4 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl transition-all shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Updating...' : 'Update Password'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
};

export default ResetPassword;