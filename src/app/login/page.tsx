'use client';
import { useState } from 'react';
import { Shield, Eye, EyeOff, AlertCircle, CheckCircle2 } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { GikenLogo } from '@/components/GikenLogo';

import { toast } from 'sonner';

export default function LoginPage() {
  const [badge, setBadge]       = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw]     = useState(false);
  const [error, setError]       = useState('');
  const [loading, setLoading]   = useState(false);

  const { login } = useAuth();


  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    await new Promise(r => setTimeout(r, 600)); // slight delay for UX

    const ok = await login(badge, password);
    if (ok) {
      toast.success('Welcome back!');
      window.location.href = '/';
    } else {
      setError('Badge Number or Password is incorrect. Please try again.');
    }
    setLoading(false);
  };

  const inputClass = `w-full rounded-xl px-4 py-3 text-sm text-foreground border transition-all focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary`;

  return (
    <div className="min-h-screen flex flex-col lg:flex-row" style={{ background: 'var(--background)' }}>
      {/* Left Pane - Branding & Details (Visible on lg screens mostly, but stacked on mobile) */}
      <div className="relative flex-1 p-8 lg:p-16 flex flex-col justify-between overflow-hidden" 
        style={{ background: 'linear-gradient(135deg, rgba(15,23,42,1) 0%, rgba(30,58,138,0.2) 100%)' }}
      >
        <div className="absolute inset-0 z-0">
          <div className="absolute top-1/4 left-1/4 w-[500px] h-[500px] rounded-full blur-[100px] opacity-20 bg-primary pointer-events-none" />
          <div className="absolute bottom-1/4 right-1/4 w-[400px] h-[400px] rounded-full blur-[100px] opacity-10 bg-secondary pointer-events-none" />
        </div>

        {/* Top Logo */}
        <div className="relative z-10">
          <GikenLogo className="h-10 text-white" />
        </div>

        {/* Middle Content */}
        <div className="relative z-10 flex-1 flex flex-col justify-center mt-12 lg:mt-0 max-w-xl">
          <h1 className="text-4xl lg:text-5xl font-bold text-white leading-tight mb-6">
            PCBA Sections Management System
          </h1>
          <p className="text-lg text-slate-300 mb-10 leading-relaxed">
            Integrated platform designed specifically for managing PCBA Sections operations, tasks, attendance, and assets at GIKEN.
          </p>

          <div className="space-y-4">
            {[
              "Real-time Task & Ticket Board",
              "Automated Shift & Leave Roster",
              "Data-driven Dashboard & Reporting",
              "Inventory & Asset Tracking"
            ].map((feature, idx) => (
              <div key={idx} className="flex items-center gap-3">
                <CheckCircle2 className="w-5 h-5 text-primary flex-shrink-0 drop-shadow-[0_0_8px_rgba(59,130,246,0.6)]" />
                <span className="text-slate-200 font-medium">{feature}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Bottom Footer */}
        <div className="relative z-10 mt-12 pt-8 border-t border-white/10 flex items-center gap-4">
          <div className="flex -space-x-2">
            {[1, 2, 3].map((i) => (
              <div key={i} className="w-8 h-8 rounded-full bg-slate-800 border-2 border-slate-900 flex items-center justify-center text-xs font-bold text-slate-300">
                IT
              </div>
            ))}
          </div>
          <p className="text-sm font-medium text-slate-400">Developed by <span className="text-slate-200">IT PCBA Team</span></p>
        </div>
      </div>

      {/* Right Pane - Login Form */}
      <div className="flex-1 flex items-center justify-center p-6 sm:p-12 lg:p-16 relative bg-background">
        <div className="w-full max-w-lg relative">
          
          <div className="rounded-3xl p-8 sm:p-12 border shadow-2xl relative z-10"
            style={{ 
              background: 'var(--surface)', 
              borderColor: 'var(--border)',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25), 0 0 40px rgba(var(--primary-rgb), 0.05)'
            }}
          >
            <div className="text-center mb-10">
              <h2 className="text-2xl sm:text-3xl font-bold text-foreground mb-2">Welcome Back</h2>
              <p className="text-sm text-muted-foreground">Sign in to your account to continue</p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Badge Number */}
              <div>
                <input
                  type="text"
                  value={badge}
                  onChange={e => setBadge(e.target.value)}
                  placeholder="Badge Number (e.g. 36443)"
                  required
                  autoFocus
                  className={inputClass + ' bg-transparent'}
                  style={{ borderColor: 'var(--border)' }}
                />
              </div>

              {/* Password */}
              <div>
                <div className="relative">
                  <input
                    type={showPw ? 'text' : 'password'}
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder="Password"
                    required
                    className={`${inputClass} bg-transparent pr-11`}
                    style={{ borderColor: 'var(--border)' }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPw(!showPw)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Error */}
              {error && (
                <div className="flex items-start gap-2.5 p-3.5 rounded-xl border text-sm"
                  style={{ background: 'rgba(239,68,68,0.08)', borderColor: 'rgba(239,68,68,0.25)', color: 'var(--destructive)' }}
                >
                  <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                  <span>{error}</span>
                </div>
              )}

              {/* Submit */}
              <button
                type="submit"
                disabled={loading}
                className="w-full py-3.5 rounded-xl font-semibold text-white transition-all disabled:opacity-60 disabled:cursor-not-allowed hover:opacity-90 active:scale-[0.98] shadow-lg mt-4 group flex items-center justify-center gap-2"
                style={{ background: 'var(--foreground)', color: 'var(--background)' }}
              >
                {loading ? (
                  <>
                    <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    Signing in...
                  </>
                ) : (
                  <>
                    Sign In
                    <span className="group-hover:translate-x-1 transition-transform">→</span>
                  </>
                )}
              </button>
            </form>

            <div className="mt-8 text-center flex items-center justify-center gap-1.5 text-xs text-muted-foreground opacity-60">
              <Shield className="w-3.5 h-3.5" /> Encrypted data • Restricted IT Access
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
