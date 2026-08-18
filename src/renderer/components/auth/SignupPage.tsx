import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { MessageSquare } from 'lucide-react';

import { useAuthStore } from '../../stores/authStore';
import { Input, Button, Spinner } from '../ui';
import { ROUTES } from '../../lib/constants';

interface FieldErrors {
  displayName?: string;
  username?: string;
  email?: string;
  password?: string;
  confirmPassword?: string;
}

export function SignupPage() {
  const navigate = useNavigate();
  const loading = useAuthStore((s) => s.loading);

  const [displayName, setDisplayName] = useState('');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [errors, setErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);

  const validate = (): boolean => {
    const next: FieldErrors = {};
    if (!displayName.trim()) next.displayName = 'Display name is required';
    if (!username.trim()) next.username = 'Username is required';
    if (!email.trim()) next.email = 'Email is required';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) next.email = 'Enter a valid email';
    if (!password) next.password = 'Password is required';
    else if (password.length < 6) next.password = 'Password must be at least 6 characters';
    if (confirmPassword !== password) next.confirmPassword = 'Passwords do not match';
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    if (!validate()) return;
    try {
      await useAuthStore.getState().register({ email, password, username, displayName });
      navigate(ROUTES.app);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Failed to create account');
    }
  };

  return (
    <div className="flex h-full w-full items-center justify-center bg-bg p-6">
      <div className="w-full max-w-[380px] rounded-xl border border-edge bg-surface p-7 shadow-panel">
        <div className="mb-6 flex flex-col items-center text-center">
          <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-lg bg-primary text-primary">
            <MessageSquare size={24} className="text-bg" />
          </div>
          <h1 className="text-xl font-semibold text-content">Create your account</h1>
          <p className="mt-1 text-sm text-content-secondary">Join LTalk in seconds</p>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <div className="flex flex-col gap-1">
            <label className="text-xs text-content-muted" htmlFor="displayName">
              Display name
            </label>
            <Input
              id="displayName"
              type="text"
              placeholder="Alex Doe"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
            />
            {errors.displayName && <p className="text-xs text-red-400">{errors.displayName}</p>}
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs text-content-muted" htmlFor="username">
              Username
            </label>
            <Input
              id="username"
              type="text"
              placeholder="alexdoe"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
            />
            {errors.username && <p className="text-xs text-red-400">{errors.username}</p>}
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs text-content-muted" htmlFor="email">
              Email
            </label>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            {errors.email && <p className="text-xs text-red-400">{errors.email}</p>}
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs text-content-muted" htmlFor="password">
              Password
            </label>
            <Input
              id="password"
              type="password"
              autoComplete="new-password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            {errors.password && <p className="text-xs text-red-400">{errors.password}</p>}
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs text-content-muted" htmlFor="confirmPassword">
              Confirm password
            </label>
            <Input
              id="confirmPassword"
              type="password"
              autoComplete="new-password"
              placeholder="••••••••"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
            />
            {errors.confirmPassword && (
              <p className="text-xs text-red-400">{errors.confirmPassword}</p>
            )}
          </div>

          {formError && <p className="text-xs text-red-400">{formError}</p>}

          <Button
            type="submit"
            disabled={loading}
            className="mt-1 flex h-9 items-center justify-center gap-2"
          >
            {loading ? <Spinner size={16} /> : 'Sign up'}
          </Button>
        </form>

        <p className="mt-5 text-center text-xs text-content-secondary">
          Already have an account?{' '}
          <button
            type="button"
            onClick={() => navigate(ROUTES.login)}
            className="text-primary hover:text-primary-hover"
          >
            Sign in
          </button>
        </p>
      </div>
    </div>
  );
}
