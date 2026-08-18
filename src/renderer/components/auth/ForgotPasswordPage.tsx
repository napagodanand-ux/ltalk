import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Mail } from 'lucide-react';

import { supabase } from '../../lib/supabase';
import { Input, Button } from '../ui';
import { ROUTES } from '../../lib/constants';

export function ForgotPasswordPage() {
  const navigate = useNavigate();

  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<'idle' | 'loading' | 'sent' | 'error'>('idle');
  const [message, setMessage] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(null);
    setStatus('loading');
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: undefined
      });
      if (error) throw error;
      setStatus('sent');
    } catch (err) {
      setStatus('error');
      setMessage(err instanceof Error ? err.message : 'Failed to send reset link');
    }
  };

  return (
    <div className="flex h-full w-full items-center justify-center bg-bg p-6">
      <div className="w-full max-w-[380px] rounded-xl border border-edge bg-surface p-7 shadow-panel">
        <div className="mb-6 flex flex-col items-center text-center">
          <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-lg bg-primary text-bg">
            <Mail size={22} className="text-bg" />
          </div>
          <h1 className="text-xl font-semibold text-content">Reset password</h1>
          <p className="mt-1 text-sm text-content-secondary">
            Enter your email and we&apos;ll send a reset link.
          </p>
        </div>

        {status === 'sent' ? (
          <div className="flex flex-col gap-4">
            <div className="rounded-md border border-edge bg-bg-secondary p-3 text-sm text-content">
              Check your email for a reset link.
            </div>
            <button
              type="button"
              onClick={() => navigate(ROUTES.login)}
              className="text-xs text-primary hover:text-primary-hover"
            >
              Back to sign in
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-col gap-3">
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
            </div>

            {status === 'error' && message && (
              <p className="text-xs text-red-400">{message}</p>
            )}

            <Button
              type="submit"
              disabled={status === 'loading' || !email}
              className="mt-1 flex h-9 items-center justify-center"
            >
              {status === 'loading' ? 'Sending…' : 'Send reset link'}
            </Button>

            <button
              type="button"
              onClick={() => navigate(ROUTES.login)}
              className="text-xs text-content-secondary hover:text-content"
            >
              Back to sign in
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
