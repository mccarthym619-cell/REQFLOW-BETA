import { useState } from 'react';
import { api } from '../../api/client';
import { LogIn, Loader2, KeyRound } from 'lucide-react';
import { useSession } from '../../context/SessionContext';

type Step = 'email' | 'password' | 'set-password';

export function LoginPage() {
  const { setUser } = useSession();
  const [step, setStep] = useState<Step>('email');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleEmailSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) return;

    setError('');
    setLoading(true);

    try {
      const res = await api.post('/auth/check-email', { email: email.trim() });
      if (res.data.data.needs_password_setup) {
        setStep('set-password');
      } else {
        setStep('password');
      }
    } catch {
      setError('Account not found or inactive. Contact your administrator.');
    } finally {
      setLoading(false);
    }
  }

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    if (!password) return;

    setError('');
    setLoading(true);

    try {
      const res = await api.post('/auth/login', { email, password });
      setUser(res.data.data.user);
    } catch {
      setError('Invalid password. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  async function handleSetPassword(e: React.FormEvent) {
    e.preventDefault();
    if (!password || !confirmPassword) return;

    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    if (password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }

    setError('');
    setLoading(true);

    try {
      const res = await api.post('/auth/set-password', { email, password });
      setUser(res.data.data.user);
    } catch (err: any) {
      const msg = err.response?.data?.error?.message || 'Failed to set password. Please try again.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  }

  function handleBack() {
    setStep('email');
    setPassword('');
    setConfirmPassword('');
    setError('');
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-950 px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-blue-100 dark:bg-blue-900/40 mb-4">
            {step === 'set-password' ? (
              <KeyRound className="w-8 h-8 text-blue-600 dark:text-blue-400" />
            ) : (
              <LogIn className="w-8 h-8 text-blue-600 dark:text-blue-400" />
            )}
          </div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
            ReqFlow
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            {step === 'email' && 'Sign in to your account'}
            {step === 'password' && 'Enter your password'}
            {step === 'set-password' && 'Set up your password'}
          </p>
        </div>

        {/* Email step */}
        {step === 'email' && (
          <form onSubmit={handleEmailSubmit} className="card p-6 space-y-4">
            <div>
              <label htmlFor="email" className="label">Email Address</label>
              <input
                id="email"
                type="email"
                className="input"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={loading}
                autoFocus
              />
            </div>
            {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
            <button type="submit" disabled={loading || !email.trim()} className="btn btn-primary w-full">
              {loading ? <><Loader2 className="w-4 h-4 animate-spin mr-2" />Checking...</> : 'Continue'}
            </button>
          </form>
        )}

        {/* Password step */}
        {step === 'password' && (
          <form onSubmit={handleLogin} className="card p-6 space-y-4">
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-3">
                Signing in as <span className="font-medium text-gray-900 dark:text-gray-100">{email}</span>
              </p>
              <label htmlFor="password" className="label">Password</label>
              <input
                id="password"
                type="password"
                className="input"
                placeholder="Enter your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={loading}
                autoFocus
              />
            </div>
            {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
            <button type="submit" disabled={loading || !password} className="btn btn-primary w-full">
              {loading ? <><Loader2 className="w-4 h-4 animate-spin mr-2" />Signing in...</> : 'Sign In'}
            </button>
            <button type="button" onClick={handleBack} className="btn btn-secondary w-full">
              Back
            </button>
          </form>
        )}

        {/* Set password step */}
        {step === 'set-password' && (
          <form onSubmit={handleSetPassword} className="card p-6 space-y-4">
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-3">
                Setting up password for <span className="font-medium text-gray-900 dark:text-gray-100">{email}</span>
              </p>
              <label htmlFor="new-password" className="label">New Password</label>
              <input
                id="new-password"
                type="password"
                className="input"
                placeholder="At least 8 characters"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={loading}
                autoFocus
              />
            </div>
            <div>
              <label htmlFor="confirm-password" className="label">Confirm Password</label>
              <input
                id="confirm-password"
                type="password"
                className="input"
                placeholder="Re-enter your password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                disabled={loading}
              />
            </div>
            {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
            <button type="submit" disabled={loading || !password || !confirmPassword} className="btn btn-primary w-full">
              {loading ? <><Loader2 className="w-4 h-4 animate-spin mr-2" />Setting password...</> : 'Set Password & Sign In'}
            </button>
            <button type="button" onClick={handleBack} className="btn btn-secondary w-full">
              Back
            </button>
          </form>
        )}

        <p className="text-center text-xs text-gray-400 mt-6">
          Contact your administrator if you need an account.
        </p>
      </div>
    </div>
  );
}
