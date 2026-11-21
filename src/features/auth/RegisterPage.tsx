import React, { useState } from 'react';
import { AlertCircle, ArrowRight, Building, Lock, Mail, ShieldCheck, User } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

export const RegisterPage: React.FC = () => {
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [tenantName, setTenantName] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { register } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Password validation per FR-001
    if (password.length < 10) {
      setError('Password must be at least 10 characters long.');
      return;
    }

    setIsSubmitting(true);
    try {
      await register({
        full_name: fullName,
        email,
        password,
        tenant_name: tenantName,
      });
      navigate('/', { replace: true });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Registration failed.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-screen w-screen items-center justify-center bg-[#09090b] p-4 text-[#fafafa] selection:bg-[#6366f1]/30">
      <div className="pointer-events-none fixed inset-0 flex items-center justify-center">
        <div className="h-[500px] w-[500px] rounded-full bg-[#6366f1]/5 blur-[120px]" />
      </div>

      <div className="relative w-full max-w-[460px] rounded-xl border border-[#27272a] bg-[#111113] p-7 shadow-2xl overlay-elevation">
        {/* Header */}
        <div className="flex flex-col items-center text-center">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-[#27272a] bg-[#18181b] text-[#6366f1]">
            <Building className="h-5 w-5" />
          </div>
          <h1 className="mt-3.5 font-display text-[20px] font-semibold tracking-tight text-[#fafafa]">
            Register Tenant Workspace
          </h1>
          <p className="mt-1 font-mono text-[11px] text-[#71717a]">
            Creates a dedicated multi-tenant boundary and assigns TenantOwner role
          </p>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="mt-4 flex items-start gap-2.5 rounded-lg border border-[#f43f5e]/30 bg-[#f43f5e]/10 p-3 text-[12px] text-[#f43f5e]">
            <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
            <div className="font-mono text-[11px] leading-snug">{error}</div>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="mt-5 space-y-3.5">
          <div>
            <label htmlFor="reg-name" className="mb-1 block font-mono text-[11px] font-medium text-[#a1a1aa]">
              Full Name
            </label>
            <div className="relative">
              <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-2.5 text-[#71717a]">
                <User className="h-4 w-4" />
              </div>
              <input
                id="reg-name"
                type="text"
                required
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Alex Mercer"
                className="h-9 w-full rounded border border-[#27272a] bg-[#18181b] pl-9 pr-3 font-mono text-[12px] text-[#fafafa] placeholder-[#52525b] focus:border-[#6366f1] focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label htmlFor="reg-email" className="mb-1 block font-mono text-[11px] font-medium text-[#a1a1aa]">
              Corporate Email Address
            </label>
            <div className="relative">
              <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-2.5 text-[#71717a]">
                <Mail className="h-4 w-4" />
              </div>
              <input
                id="reg-email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="alex.mercer@acme.com"
                className="h-9 w-full rounded border border-[#27272a] bg-[#18181b] pl-9 pr-3 font-mono text-[12px] text-[#fafafa] placeholder-[#52525b] focus:border-[#6366f1] focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label htmlFor="reg-tenant" className="mb-1 block font-mono text-[11px] font-medium text-[#a1a1aa]">
              Organization / Tenant Name
            </label>
            <div className="relative">
              <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-2.5 text-[#71717a]">
                <Building className="h-4 w-4" />
              </div>
              <input
                id="reg-tenant"
                type="text"
                required
                value={tenantName}
                onChange={(e) => setTenantName(e.target.value)}
                placeholder="Acme Global Logistics"
                className="h-9 w-full rounded border border-[#27272a] bg-[#18181b] pl-9 pr-3 font-mono text-[12px] text-[#fafafa] placeholder-[#52525b] focus:border-[#6366f1] focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label htmlFor="reg-password" className="mb-1 block font-mono text-[11px] font-medium text-[#a1a1aa]">
              Password (min 10 characters)
            </label>
            <div className="relative">
              <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-2.5 text-[#71717a]">
                <Lock className="h-4 w-4" />
              </div>
              <input
                id="reg-password"
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="SecurePassword123!"
                className="h-9 w-full rounded border border-[#27272a] bg-[#18181b] pl-9 pr-3 font-mono text-[12px] text-[#fafafa] placeholder-[#52525b] focus:border-[#6366f1] focus:outline-none"
              />
            </div>
          </div>

          <div className="rounded border border-[#27272a] bg-[#18181b] p-2.5 font-mono text-[10px] text-[#71717a] space-y-1">
            <div className="flex items-center gap-1.5 text-[#10b981]">
              <ShieldCheck className="h-3 w-3" />
              <span>Multi-Tenant Invariant: Data is strictly isolated by Tenant UUID.</span>
            </div>
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="mt-2 flex h-9 w-full items-center justify-center gap-2 rounded bg-[#6366f1] font-mono text-[12px] font-semibold text-white hover:bg-[#4f46e5] disabled:opacity-50 transition-colors"
          >
            {isSubmitting ? (
              <span className="flex items-center gap-2">
                <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                Creating Tenant...
              </span>
            ) : (
              <span className="flex items-center gap-1.5">
                Register Workspace & Login
                <ArrowRight className="h-3.5 w-3.5" />
              </span>
            )}
          </button>
        </form>

        <div className="mt-5 flex items-center justify-between border-t border-[#27272a] pt-3 text-[11px] font-mono">
          <span className="text-[#71717a]">Already have an account?</span>
          <Link to="/login" className="text-[#6366f1] hover:underline font-medium">
            Sign In to Existing Session →
          </Link>
        </div>
      </div>
    </div>
  );
};
