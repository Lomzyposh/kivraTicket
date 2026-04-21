import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { User, Mail, Lock, Eye, EyeOff, Ticket } from "lucide-react";
import { useAuth } from "../context/AuthContext";

export default function Signup() {
  const { register } = useAuth();
  const navigate = useNavigate();

  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
    confirmPassword: "",
  });
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [hint, setHint] = useState(
    "Use a strong password — at least 6 characters with a mix of letters and numbers."
  );

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
    setError("");
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!form.name || !form.email || !form.password || !form.confirmPassword) {
      setError("Please fill in all the fields.");
      return;
    }

    if (form.password.length < 6) {
      setError("Password must be at least 6 characters long.");
      return;
    }

    if (form.password !== form.confirmPassword) {
      setError("The passwords do not match.");
      return;
    }

    try {
      setSubmitting(true);
      setError("");
      setHint("Creating your KivraTickets profile...");
      await register(form.name, form.email, form.password);
      navigate("/"); // or navigate("/events")
    } catch (err) {
      const msg =
        err?.response?.data?.error ||
        err?.response?.data?.message ||
        "We couldn’t create your account. Please try again.";
      setError(msg);
      setHint(
        "Double-check your email and password, or try again with a different email."
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-linear-to-br from-slate-950 via-slate-900 to-slate-950 text-slate-50 flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-5xl grid md:grid-cols-2 gap-10 bg-slate-900/80 border border-slate-800 rounded-3xl shadow-2xl overflow-hidden backdrop-blur">
        {/* Left / Story side */}
        <div className="hidden md:flex flex-col justify-between bg-linear-to-br from-amber-500/20 via-amber-500/5 to-transparent p-10 border-r border-slate-800">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full bg-slate-950/70 px-4 py-1 text-[11px] uppercase tracking-[0.18em] text-amber-300 border border-amber-500/40 mb-6">
              <Ticket className="w-3 h-3" />
              <span>KivraTickets</span>
            </div>
            <h1 className="text-3xl font-semibold leading-tight mb-3">
              Create your{" "}
              <span className="text-amber-400">KivraTickets</span> account.
            </h1>
            <p className="text-slate-300 text-sm leading-relaxed">
              Build your event life in one place. Save your favorite shows,
              track upcoming matches, and never dig through email for tickets
              again.
            </p>
          </div>

          <div className="mt-8 space-y-3 text-sm text-slate-200">
            <div className="flex items-start gap-3">
              <span className="mt-1 h-5 w-5 rounded-full border border-amber-400/70 flex items-center justify-center text-[10px] text-amber-200">
                ✓
              </span>
              <p>
                <span className="font-semibold text-slate-50">
                  Personalised dashboard
                </span>
                <br />
                See all your upcoming events and ticket history at a glance.
              </p>
            </div>
            <div className="flex items-start gap-3">
              <span className="mt-1 h-5 w-5 rounded-full border border-amber-400/70 flex items-center justify-center text-[10px] text-amber-200">
                ✓
              </span>
              <p>
                <span className="font-semibold text-slate-50">
                  Wishlist & quick checkout
                </span>
                <br />
                Save events you care about and book the moment you’re ready.
              </p>
            </div>
            <div className="flex items-start gap-3">
              <span className="mt-1 h-5 w-5 rounded-full border border-amber-400/70 flex items-center justify-center text-[10px] text-amber-200">
                ✓
              </span>
              <p>
                <span className="font-semibold text-slate-50">
                  Secure QR tickets
                </span>
                <br />
                Every ticket is verified with a unique QR for safe, fast entry.
              </p>
            </div>
          </div>

          <p className="text-[11px] text-slate-400 mt-6">
            You can update your details or delete your account anytime in
            settings. We’ll only email you about events and orders you care
            about.
          </p>
        </div>

        {/* Right / Form */}
        <div className="p-8 md:p-10 flex flex-col justify-center">
          <div className="mb-6 md:mb-8 md:hidden">
            <h1 className="text-2xl font-semibold">
              Join <span className="text-amber-400">KivraTickets</span>
            </h1>
            <p className="text-slate-400 text-sm mt-1">
              Create an account to save events, manage tickets and check out
              faster.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            {error && (
              <div className="rounded-xl border border-red-500/40 bg-red-500/10 text-red-200 text-sm px-4 py-3">
                {error}
              </div>
            )}

            <div className="space-y-1.5">
              <label className="text-sm font-medium text-slate-100 flex items-center gap-2">
                <User className="w-4 h-4 text-amber-400" />
                Full name
              </label>
              <input
                type="text"
                name="name"
                value={form.name}
                onChange={handleChange}
                required
                className="w-full rounded-xl bg-slate-950/70 border border-slate-700 px-4 py-3 text-sm text-slate-50 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-500/70 focus:border-amber-500/70 transition-all"
                placeholder="e.g. John Doe"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium text-slate-100 flex items-center gap-2">
                <Mail className="w-4 h-4 text-amber-400" />
                Email address
              </label>
              <input
                type="email"
                name="email"
                value={form.email}
                onChange={handleChange}
                required
                className="w-full rounded-xl bg-slate-950/70 border border-slate-700 px-4 py-3 text-sm text-slate-50 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-500/70 focus:border-amber-500/70 transition-all"
                placeholder="you@example.com"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium text-slate-100 flex items-center gap-2">
                <Lock className="w-4 h-4 text-amber-400" />
                Password
              </label>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  name="password"
                  value={form.password}
                  onChange={handleChange}
                  required
                  minLength={6}
                  className="w-full rounded-xl bg-slate-950/70 border border-slate-700 px-4 py-3 pr-11 text-sm text-slate-50 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-500/70 focus:border-amber-500/70 transition-all"
                  placeholder="Create a strong password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute inset-y-0 right-0 flex items-center pr-3 text-slate-400 hover:text-slate-200 transition-colors"
                >
                  {showPassword ? (
                    <EyeOff className="w-4 h-4" />
                  ) : (
                    <Eye className="w-4 h-4" />
                  )}
                </button>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium text-slate-100">
                Confirm password
              </label>
              <input
                type={showPassword ? "text" : "password"}
                name="confirmPassword"
                value={form.confirmPassword}
                onChange={handleChange}
                required
                minLength={6}
                className="w-full rounded-xl bg-slate-950/70 border border-slate-700 px-4 py-3 text-sm text-slate-50 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-500/70 focus:border-amber-500/70 transition-all"
                placeholder="Type it again"
              />
            </div>

            <p className="text-xs text-slate-400">{hint}</p>

            <button
              type="submit"
              disabled={submitting}
              className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-amber-500 hover:bg-amber-400 disabled:bg-amber-500/70 text-slate-950 font-semibold text-sm py-3 mt-1 transition-all shadow-lg shadow-amber-500/25"
            >
              {submitting ? (
                <>
                  <span className="h-4 w-4 border-2 border-slate-900/70 border-t-transparent rounded-full animate-spin" />
                  Creating your account...
                </>
              ) : (
                <>
                  <User className="w-4 h-4" />
                  <span>Create account</span>
                </>
              )}
            </button>

            <p className="text-xs text-slate-400 text-center mt-2">
              Already have an account?{" "}
              <Link
                to="/login"
                className="text-amber-400 hover:text-amber-300 font-medium"
              >
                Sign in
              </Link>
            </p>
          </form>
        </div>
      </div>
    </div>
  );
}