import { useState, useEffect } from 'react';
import { api } from '../../api/client';
import { LogIn, Loader2, KeyRound, UserPlus } from 'lucide-react';
import { useSession } from '../../context/SessionContext';
import type { Command } from '@req-tracker/shared';

type Step = 'email' | 'password' | 'set-password' | 'register' | 'register-success';

export function LoginPage() {
  const { setUser } = useSession();
  const [step, setStep] = useState<Step>('email');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // Registration fields
  const [regName, setRegName] = useState('');
  const [regCommandId, setRegCommandId] = useState<number | ''>('');
  const [regJustification, setRegJustification] = useState('');
  const [commands, setCommands] = useState<Command[]>([]);

  useEffect(() => {
    if (step === 'register' && commands.length === 0) {
      api.get('/users/commands').then(res => setCommands(res.data.data)).catch(() => {});
    }
  }, [step]);

  async function handleEmailSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) return;

    setError('');
    setLoading(true);

    try {
      const res = await api.post('/auth/check-email', { email: email.trim() });
      const data = res.data.data;
      if (!data.exists) {
        setStep('register');
      } else if (data.needs_password_setup) {
        setStep('set-password');
      } else {
        setStep('password');
      }
    } catch {
      setError('Something went wrong. Please try again.');
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

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault();
    if (!regName.trim() || !email.trim()) return;

    setError('');
    setLoading(true);

    try {
      await api.post('/auth/register', {
        email: email.trim(),
        display_name: regName.trim(),
        ...(regCommandId ? { command_id: regCommandId } : {}),
        ...(regJustification.trim() ? { justification: regJustification.trim() } : {}),
      });
      setStep('register-success');
    } catch (err: any) {
      const msg = err.response?.data?.error?.message || 'Failed to submit registration. Please try again.';
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
            ) : step === 'register' || step === 'register-success' ? (
              <UserPlus className="w-8 h-8 text-blue-600 dark:text-blue-400" />
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
            {step === 'register' && 'Request access'}
            {step === 'register-success' && 'Request submitted'}
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

        {/* Registration step */}
        {step === 'register' && (
          <form onSubmit={handleRegister} className="card p-6 space-y-4">
            <p className="text-sm text-gray-500 dark:text-gray-400">
              No account found for <span className="font-medium text-gray-900 dark:text-gray-100">{email}</span>. Request access below.
            </p>
            <div>
              <label htmlFor="reg-name" className="label">Full Name</label>
              <input
                id="reg-name"
                type="text"
                className="input"
                placeholder="First and last name"
                value={regName}
                onChange={(e) => setRegName(e.target.value)}
                disabled={loading}
                autoFocus
              />
            </div>
            <div>
              <label htmlFor="reg-command" className="label">Command</label>
              <select
                id="reg-command"
                className="input"
                value={regCommandId}
                onChange={(e) => setRegCommandId(e.target.value ? Number(e.target.value) : '')}
                disabled={loading}
              >
                <option value="">— Select Command —</option>
                {commands.map(cmd => (
                  <option key={cmd.id} value={cmd.id}>{cmd.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="reg-justification" className="label">Justification (optional)</label>
              <textarea
                id="reg-justification"
                className="input"
                rows={3}
                placeholder="Why do you need access?"
                value={regJustification}
                onChange={(e) => setRegJustification(e.target.value)}
                disabled={loading}
              />
            </div>
            {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
            <button type="submit" disabled={loading || !regName.trim()} className="btn btn-primary w-full">
              {loading ? <><Loader2 className="w-4 h-4 animate-spin mr-2" />Submitting...</> : 'Request Access'}
            </button>
            <button type="button" onClick={handleBack} className="btn btn-secondary w-full">
              Back
            </button>
          </form>
        )}

        {/* Registration success */}
        {step === 'register-success' && (
          <div className="card p-6 space-y-4 text-center">
            <p className="text-green-600 dark:text-green-400 font-medium">
              Your access request has been submitted.
            </p>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              An administrator will review your request. You'll be able to sign in once approved.
            </p>
            <button type="button" onClick={handleBack} className="btn btn-secondary w-full">
              Back to Sign In
            </button>
          </div>
        )}

        <p className="text-center text-xs text-gray-400 mt-6">
          Enter your email to sign in or request access.
        </p>
      </div>
    </div>
  );
}
