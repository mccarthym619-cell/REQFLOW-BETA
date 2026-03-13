import { useState } from 'react';
import { api } from '../../api/client';
import { Shield, Loader2 } from 'lucide-react';
import { useAccessGate } from '../../context/AccessGateContext';

export function AccessCodePage() {
  const { checkAccess } = useAccessGate();
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!code.trim()) return;

    setError('');
    setLoading(true);

    try {
      await api.post('/auth/verify-code', { code: code.trim() });
      await checkAccess();
    } catch {
      setError('Invalid access code. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-950 px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-blue-100 dark:bg-blue-900/40 mb-4">
            <Shield className="w-8 h-8 text-blue-600 dark:text-blue-400" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
            Requisition Tracker
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            Enter your access code to continue
          </p>
        </div>

        <form onSubmit={handleSubmit} className="card p-6 space-y-4">
          <div>
            <label htmlFor="access-code" className="label">
              Access Code
            </label>
            <input
              id="access-code"
              type="password"
              className="input"
              placeholder="Enter access code"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              disabled={loading}
              autoFocus
            />
          </div>

          {error && (
            <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
          )}

          <button
            type="submit"
            disabled={loading || !code.trim()}
            className="btn btn-primary w-full"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
                Verifying...
              </>
            ) : (
              'Continue'
            )}
          </button>
        </form>

        <p className="text-center text-xs text-gray-400 mt-6">
          Contact your administrator if you need an access code.
        </p>
      </div>
    </div>
  );
}
