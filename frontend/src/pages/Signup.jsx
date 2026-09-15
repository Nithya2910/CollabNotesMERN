import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { authAPI } from '../services/api';
import { useAuth } from '../context/AuthContext';

/**
 * Signup page with 2-step registration & OTP email verification.
 */
const Signup = () => {
  const navigate = useNavigate();
  const { login } = useAuth();

  // Step: 'form' | 'verify'
  const [step, setStep] = useState('form');
  const [form, setForm] = useState({ username: '', email: '', password: '', confirm: '' });
  const [otp, setOtp] = useState('');
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [showPass, setShowPass] = useState(false);
  const [timeLeft, setTimeLeft] = useState(600); // 10 minutes in seconds
  const [resendCooldown, setResendCooldown] = useState(0);

  // 10-minute expiry countdown timer
  useEffect(() => {
    let timer;
    if (step === 'verify' && timeLeft > 0) {
      timer = setInterval(() => {
        setTimeLeft((prev) => prev - 1);
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [step, timeLeft]);

  // Resend cooldown timer (30s)
  useEffect(() => {
    let timer;
    if (resendCooldown > 0) {
      timer = setInterval(() => {
        setResendCooldown((prev) => prev - 1);
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [resendCooldown]);

  const handleChange = (e) => setForm((f) => ({ ...f, [e.target.name]: e.target.value }));

  // Step 1: Submit signup form to request verification OTP
  const handleSubmitForm = async (e) => {
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
        username: form.username.trim(),
        email: form.email.trim(),
        password: form.password,
      });

      if (data.requiresVerification) {
        setStep('verify');
        setTimeLeft(600); // Reset to 10 minutes
        setResendCooldown(30); // 30s cooldown before resend
        setOtp('');
        toast.success('Verification code sent to your email! ✉️');
      } else if (data.token && data.user) {
        // Fallback for legacy immediate response
        login(data.user, data.token);
        toast.success(`Account created! Welcome, ${data.user.username} 🎉`);
        navigate('/dashboard');
      }
    } catch (err) {
      const msg = err.response?.data?.message || 'Signup failed. Please try again.';
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  // Step 2: Verify OTP
  const handleVerifyOtp = async (e) => {
    e.preventDefault();
    const cleanOtp = otp.trim();
    if (cleanOtp.length !== 6) {
      return toast.error('Please enter a valid 6-digit OTP');
    }

    setLoading(true);
    try {
      const { data } = await authAPI.verifyOtp({
        email: form.email.trim(),
        otp: cleanOtp,
      });

      login(data.user, data.token);
      toast.success(`Email verified! Welcome to CollabNotes, ${data.user.username} 🎉`);
      navigate('/dashboard');
    } catch (err) {
      const msg = err.response?.data?.message || 'Verification failed. Please check the code.';
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  // Resend OTP
  const handleResendOtp = async () => {
    if (resendCooldown > 0) return;
    setResending(true);
    try {
      const { data } = await authAPI.resendOtp({ email: form.email.trim() });
      toast.success(data.message || 'New verification code sent! ✉️');
      setTimeLeft(600); // Reset 10 minutes
      setResendCooldown(30);
      setOtp('');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to resend code');
    } finally {
      setResending(false);
    }
  };

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
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
          {step === 'form' ? (
            <>
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-1">Create account</h2>
              <p className="text-gray-500 dark:text-gray-400 text-sm mb-6">
                Already have an account?{' '}
                <Link to="/login" className="text-brand-500 hover:text-brand-600 font-medium">
                  Sign in
                </Link>
              </p>

              <form id="signup-form" onSubmit={handleSubmitForm} className="space-y-4">
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
                      Sending verification code…
                    </>
                  ) : 'Continue to Verification'}
                </button>
              </form>
            </>
          ) : (
            /* Step 2: OTP Verification Screen */
            <div className="animate-fade-in">
              <div className="flex items-center justify-between mb-4">
                <button
                  type="button"
                  onClick={() => setStep('form')}
                  className="text-xs text-gray-500 hover:text-brand-600 flex items-center gap-1 font-medium transition-colors"
                >
                  ← Change Email
                </button>
                <span className="text-xs px-2.5 py-1 rounded-full bg-brand-100 dark:bg-brand-950 text-brand-700 dark:text-brand-300 font-medium">
                  Step 2 of 2
                </span>
              </div>

              <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-1">Verify your email</h2>
              <p className="text-gray-500 dark:text-gray-400 text-sm mb-6">
                We sent a 6-digit code to{' '}
                <span className="font-semibold text-gray-800 dark:text-gray-200">{form.email}</span>. Please enter it below.
              </p>

              <form id="otp-form" onSubmit={handleVerifyOtp} className="space-y-5">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 text-center">
                    Enter 6-Digit Code
                  </label>
                  <input
                    id="otp-input"
                    type="text"
                    maxLength={6}
                    value={otp}
                    onChange={(e) => setOtp(e.target.value.replace(/[^0-9]/g, ''))}
                    placeholder="••••••"
                    className="input text-center text-2xl font-mono tracking-widest py-3 font-bold"
                    autoFocus
                    required
                  />
                </div>

                {/* Expiry Timer */}
                <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-800/60 p-3 rounded-xl border border-gray-100 dark:border-gray-800">
                  <span className="flex items-center gap-1.5">
                    <span className={`w-2 h-2 rounded-full ${timeLeft > 60 ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`} />
                    Code expires in:
                  </span>
                  <span className={`font-mono font-bold ${timeLeft < 60 ? 'text-red-500' : 'text-brand-600 dark:text-brand-400'}`}>
                    {formatTime(timeLeft)}
                  </span>
                </div>

                <button
                  id="otp-submit"
                  type="submit"
                  disabled={loading || otp.length !== 6 || timeLeft === 0}
                  className="btn-primary w-full"
                >
                  {loading ? (
                    <>
                      <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>
                      Verifying…
                    </>
                  ) : 'Verify & Activate Account'}
                </button>

                {/* Resend Section */}
                <div className="text-center pt-2">
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    Didn't receive the email?{' '}
                    <button
                      type="button"
                      onClick={handleResendOtp}
                      disabled={resending || resendCooldown > 0}
                      className={`font-semibold text-brand-600 dark:text-brand-400 hover:underline disabled:opacity-50 disabled:no-underline`}
                    >
                      {resending
                        ? 'Resending…'
                        : resendCooldown > 0
                        ? `Resend in ${resendCooldown}s`
                        : 'Resend code'}
                    </button>
                  </p>
                </div>
              </form>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Signup;
