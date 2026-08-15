import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { authAPI } from '../services/api';
import { useAuth } from '../context/AuthContext';

/**
 * Signup page — user registration with validation feedback.
 */
const Signup = () => {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [form, setForm] = useState({ username: '', email: '', password: '', confirm: '' });
  const [loading, setLoading] = useState(false);
  const [showPass, setShowPass] = useState(false);

  const handleChange = (e) => setForm((f) => ({ ...f, [e.target.name]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (form.password !== form.confirm) {
      return toast.error('Passwords do not match');
    }
    if (form.password.length < 6) {
      return toast.error('Password must be at least 6 characters');
    }
    setLoading(true);
    try {
      const { data } = await authAPI.signup({
        username: form.username,
        email: form.email,
        password: form.password,
      });
      login(data.user, data.token);
      toast.success(`Account created! Welcome, ${data.user.username} 🎉`);
      navigate('/dashboard');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Signup failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const passwordStrength = (p) => {
    if (!p) return null;
    if (p.length < 6) return { label: 'Too short', color: 'bg-red-400', width: 'w-1/4' };
    if (p.length < 8) return { label: 'Weak', color: 'bg-orange-400', width: 'w-2/4' };
    if (/[A-Z]/.test(p) && /[0-9]/.test(p)) return { label: 'Strong', color: 'bg-green-400', width: 'w-full' };
    return { label: 'Fair', color: 'bg-yellow-400', width: 'w-3/4' };
  };

  const strength = passwordStrength(form.password);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-purple-50 via-white to-brand-50 dark:from-gray-950 dark:via-gray-900 dark:to-gray-950 p-4">
      <div className="absolute top-20 right-20 w-72 h-72 bg-purple-400/20 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-20 left-20 w-96 h-96 bg-brand-400/15 rounded-full blur-3xl pointer-events-none" />

      <div className="relative w-full max-w-md animate-slide-up">
        <div className="text-center mb-8">
          <span className="text-5xl">✦</span>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-brand-500 to-brand-700 bg-clip-text text-transparent mt-2">
            CollabNotes
          </h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1 text-sm">Real-time collaborative notes</p>
        </div>

        <div className="glass rounded-3xl p-8 shadow-2xl">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-1">Create account</h2>
          <p className="text-gray-500 dark:text-gray-400 text-sm mb-6">
            Already have an account?{' '}
            <Link to="/login" className="text-brand-500 hover:text-brand-600 font-medium">
              Sign in
            </Link>
          </p>

          <form id="signup-form" onSubmit={handleSubmit} className="space-y-4">
            {/* Username */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                Username
              </label>
              <input
                id="signup-username"
                type="text"
                name="username"
                value={form.username}
                onChange={handleChange}
                placeholder="johndoe"
                className="input"
                required
                minLength={3}
              />
            </div>

            {/* Email */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                Email address
              </label>
              <input
                id="signup-email"
                type="email"
                name="email"
                value={form.email}
                onChange={handleChange}
                placeholder="you@example.com"
                className="input"
                required
              />
            </div>

            {/* Password */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                Password
              </label>
              <div className="relative">
                <input
                  id="signup-password"
                  type={showPass ? 'text' : 'password'}
                  name="password"
                  value={form.password}
                  onChange={handleChange}
                  placeholder="Min. 6 characters"
                  className="input pr-11"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPass((s) => !s)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                  </svg>
                </button>
              </div>
              {/* Password strength bar */}
              {strength && (
                <div className="mt-2">
                  <div className="h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                    <div className={`h-full rounded-full transition-all duration-300 ${strength.color} ${strength.width}`} />
                  </div>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{strength.label}</p>
                </div>
              )}
            </div>

            {/* Confirm Password */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                Confirm password
              </label>
              <input
                id="signup-confirm"
                type="password"
                name="confirm"
                value={form.confirm}
                onChange={handleChange}
                placeholder="Re-enter password"
                className={`input ${form.confirm && form.password !== form.confirm ? 'border-red-400 focus:ring-red-400/50 focus:border-red-400' : ''}`}
                required
              />
              {form.confirm && form.password !== form.confirm && (
                <p className="text-xs text-red-500 mt-1">Passwords do not match</p>
              )}
            </div>

            <button
              id="signup-submit"
              type="submit"
              disabled={loading}
              className="btn-primary w-full mt-2"
            >
              {loading ? (
                <>
                  <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Creating account…
                </>
              ) : 'Create account'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default Signup;
