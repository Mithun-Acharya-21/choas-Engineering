import React, { useState } from 'react';
import { AlertCircle, ArrowRight, Eye, EyeOff, Lock, Mail, ShieldCheck } from 'lucide-react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

export const LoginPage: React.FC = () => {
  const [email, setEmail] = useState('sre.lead@acme.com');
  const [password, setPassword] = useState('SecurePassword123!');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const from = (location.state as { from?: { pathname: string } })?.from?.pathname || '/';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      await login(email, password);
      navigate(from, { replace: true });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Authentication failed. Please verify credentials.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleQuickFill = (demoEmail: string) => {
    setEmail(demoEmail);
    setPassword('SecurePassword123!');
    setError(null);
  };

  return (
    <div className="flex min-h-screen w-screen items-center justify-center bg-[#09090b] p-4 text-[#fafafa] selection:bg-[#6366f1]/30">
      {/* Background ambient radial gradient */}
      <div className="pointer-events-none fixed inset-0 flex items-center justify-center">
        <div className="h-[500px] w-[500px] rounded-full bg-[#6366f1]/5 blur-[120px]" />
      </div>

      <div className="relative w-full max-w-[420px] rounded-xl border border-[#27272a] bg-[#111113] p-7 shadow-2xl overlay-elevation">
        {/* Header / Brand */}
        <div className="flex flex-col items-center text-center">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-[#27272a] bg-[#18181b] text-[#6366f1] shadow-inner">
            <svg width="20" height="20" viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <path
                d="M8 1.5L14 5V11L8 14.5L2 11V5L8 1.5Z"
                stroke="currentColor"
                strokeWidth="1.4"
              />
              <circle cx="8" cy="8" r="2.2" fill="#6366f1" />
            </svg>
          </div>
          <h1 className="mt-3.5 font-display text-[20px] font-semibold tracking-tight text-[#fafafa]">
            ChaosEngine AI
          </h1>
          <p className="mt-1 font-mono text-[11px] text-[#71717a]">
            Mission-Control Telemetry & Resilience Console
          </p>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="mt-4 flex items-start gap-2.5 rounded-lg border border-[#f43f5e]/30 bg-[#f43f5e]/10 p-3 text-[12px] text-[#f43f5e]">
            <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
            <div className="font-mono text-[11px] leading-snug">{error}</div>
          </div>
        )}

        {/* Login Form */}
        <form onSubmit={handleSubmit} className="mt-5 space-y-3.5">
          <div>
            <label htmlFor="login-email" className="mb-1 block font-mono text-[11px] font-medium text-[#a1a1aa]">
              Corporate Email Address
            </label>
            <div className="relative">
              <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-2.5 text-[#71717a]">
                <Mail className="h-4 w-4" />
              </div>
              <input
                id="login-email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="engineer@acme.com"
                className="h-9 w-full rounded border border-[#27272a] bg-[#18181b] pl-9 pr-3 font-mono text-[12px] text-[#fafafa] placeholder-[#52525b] focus:border-[#6366f1] focus:outline-none transition-colors"
              />
            </div>
          </div>

          <div>
            <div className="mb-1 flex items-center justify-between">
              <label htmlFor="login-password" className="font-mono text-[11px] font-medium text-[#a1a1aa]">
                Password
              </label>
            </div>
            <div className="relative">
              <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-2.5 text-[#71717a]">
                <Lock className="h-4 w-4" />
              </div>
              <input
                id="login-password"
                type={showPassword ? 'text' : 'password'}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••••••"
                className="h-9 w-full rounded border border-[#27272a] bg-[#18181b] pl-9 pr-9 font-mono text-[12px] text-[#fafafa] placeholder-[#52525b] focus:border-[#6366f1] focus:outline-none transition-colors"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute inset-y-0 right-0 flex items-center pr-2.5 text-[#71717a] hover:text-[#a1a1aa]"
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="mt-2 flex h-9 w-full items-center justify-center gap-2 rounded bg-[#6366f1] font-mono text-[12px] font-semibold text-white hover:bg-[#4f46e5] disabled:opacity-50 transition-colors shadow-sm"
          >
            {isSubmitting ? (
              <span className="flex items-center gap-2">
                <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                Authenticating...
              </span>
            ) : (
              <span className="flex items-center gap-1.5">
                Authenticate Session
                <ArrowRight className="h-3.5 w-3.5" />
              </span>
            )}
          </button>
        </form>

        {/* Demo Credentials Quick-Fill Pills */}
        <div className="mt-5 border-t border-[#27272a] pt-4">
          <span className="mb-2 block font-mono text-[10px] uppercase tracking-wider text-[#71717a]">
            Demo Role Quick-Fill
          </span>
          <div className="flex flex-wrap gap-1.5">
            <button
              type="button"
              onClick={() => handleQuickFill('sre.lead@acme.com')}
              className="rounded border border-[#27272a] bg-[#18181b] px-2 py-1 font-mono text-[10px] text-[#10b981] hover:border-[#10b981]/50 transition-colors"
            >
              👑 SRE Lead (Owner)
            </button>
            <button
              type="button"
              onClick={() => handleQuickFill('dev.engineer@acme.com')}
              className="rounded border border-[#27272a] bg-[#18181b] px-2 py-1 font-mono text-[10px] text-[#38bdf8] hover:border-[#38bdf8]/50 transition-colors"
            >
              ⚡ Chaos Engineer
            </button>
            <button
              type="button"
              onClick={() => handleQuickFill('auditor.compliance@acme.com')}
              className="rounded border border-[#27272a] bg-[#18181b] px-2 py-1 font-mono text-[10px] text-[#a1a1aa] hover:border-[#71717a] transition-colors"
            >
              👁️ Auditor (Viewer)
            </button>
          </div>
        </div>

        {/* Footer Navigation */}
        <div className="mt-5 flex items-center justify-between border-t border-[#27272a] pt-3 text-[11px] font-mono">
          <span className="text-[#71717a]">New organization?</span>
          <Link to="/register" className="text-[#6366f1] hover:underline font-medium">
            Register Tenant Workspace →
          </Link>
        </div>
      </div>
    </div>
  );
};
