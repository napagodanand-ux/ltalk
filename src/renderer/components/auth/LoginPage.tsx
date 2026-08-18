import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { MessageSquare } from 'lucide-react';

import { useAuthStore } from '../../stores/authStore';
import { Input, Button, Spinner } from '../ui';
import { ROUTES } from '../../lib/constants';

export function LoginPage() {
  const navigate = useNavigate();
  const loading = useAuthStore((s) => s.loading);

  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      await useAuthStore.getState().login(identifier, password);
      navigate(ROUTES.app);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to sign in');
    }
  };

  return (
    <div className="flex h-full w-full items-center justify-center bg-bg p-6">
      <div className="w-full max-w-[380px] rounded-xl border border-edge bg-surface p-7 shadow-panel">
        <div className="mb-6 flex flex-col items-center text-center">
          <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-lg bg-primary text-primary">
            <MessageSquare size={24} className="text-bg" />
          </div>
          <h1 className="text-xl font-semibold text-content">LTalk</h1>
          <p className="mt-1 text-sm text-content-secondary">Sign in to continue</p>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <div className="flex flex-col gap-1">
            <label className="text-xs text-content-muted" htmlFor="identifier">
              Email or username
            </label>
            <Input
              id="identifier"
              type="text"
              autoComplete="username"
              placeholder="you@example.com"
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
            />
          </div>

          <div className="flex flex-col gap-1">
            <div className="flex items-center justify-between">
              <label className="text-xs text-content-muted" htmlFor="password">
                Password
              </label>
              <button
                type="button"
                onClick={() => navigate(ROUTES.forgotPassword)}
                className="text-xs text-primary hover:text-primary-hover"
              >
                Forgot password?
              </button>
            </div>
            <Input
              id="password"
              type="password"
              autoComplete="current-password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>

          {error && <p className="text-xs text-red-400">{error}</p>}

          <Button
            type="submit"
            disabled={loading || !identifier || !password}
            className="mt-1 flex h-9 items-center justify-center gap-2"
          >
            {loading ? <Spinner size={16} /> : 'Sign in'}
          </Button>
        </form>

        <p className="mt-5 text-center text-xs text-content-secondary">
          Don&apos;t have an account?{' '}
          <button
            type="button"
            onClick={() => navigate(ROUTES.signup)}
            className="text-primary hover:text-primary-hover"
          >
            Create an account
          </button>
        </p>
      </div>
    </div>
  );
}
