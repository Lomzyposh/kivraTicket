import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Mail, Lock, LogIn, Eye, EyeOff, Ticket } from "lucide-react";
import { useAuth } from "../context/AuthContext";

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();

  const [form, setForm] = useState({ email: "", password: "" });
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
    setError("");
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.email || !form.password) {
      setError("Please enter both your email and password.");
      return;
    }

    try {
      setSubmitting(true);
      setError("");
      await login(form.email, form.password);
      navigate("/"); // Redirect after successful login
    } catch (err) {
      console.error("Login error:", err);
      const msg =
        err?.response?.data?.error ||
        err?.response?.data?.message ||
        "We couldn’t sign you in. Please check your details and try again.";
      setError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-linear-to-br from-slate-950 via-slate-900 to-slate-950 text-slate-50 flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-5xl grid md:grid-cols-2 gap-10 bg-slate-900/80 border border-slate-800 rounded-3xl shadow-2xl overflow-hidden backdrop-blur">
        <div className="hidden md:flex flex-col justify-between bg-linear-to-br from-amber-500/20 via-amber-500/5 to-transparent p-10 border-r border-slate-800">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full bg-slate-950/70 px-4 py-1 text-[11px] uppercase tracking-[0.18em] text-amber-300 border border-amber-500/40 mb-6">
              <Ticket className="w-3 h-3" />
              <span>GoTickets</span>
            </div>
            <h1 className="text-3xl font-semibold leading-tight mb-3">
              Welcome back to <span className="text-amber-400">GoTickets</span>.
            </h1>
            <p className="text-slate-300 text-sm leading-relaxed">
              Log in to discover live concerts, stadium nights, comedy tours,
              festivals and more. Your next experience might just be one ticket
              away.
            </p>
          </div>

          <div className="space-y-3 text-sm text-slate-200 mt-8">
            <div className="flex items-start gap-3">
              <span className="mt-1 h-5 w-5 rounded-full border border-amber-400/70 flex items-center justify-center text-[10px] text-amber-200">
                1
              </span>
              <p>
                <span className="font-semibold text-slate-50">
                  Smart event discovery
                </span>
                <br />
                Filter by city, price, category and date in seconds.
              </p>
            </div>
            <div className="flex items-start gap-3">
              <span className="mt-1 h-5 w-5 rounded-full border border-amber-400/70 flex items-center justify-center text-[10px] text-amber-200">
                2
              </span>
              <p>
                <span className="font-semibold text-slate-50">
                  Secure, seamless tickets
                </span>
                <br />
                Every order gets a unique QR code for smooth entry at the gate.
              </p>
            </div>
            <div className="flex items-start gap-3">
              <span className="mt-1 h-5 w-5 rounded-full border border-amber-400/70 flex items-center justify-center text-[10px] text-amber-200">
                3
              </span>
              <p>
                <span className="font-semibold text-slate-50">
                  Keep everything in one place
                </span>
                <br />
                View upcoming tickets, past events and payment methods in your
                dashboard.
              </p>
            </div>
          </div>

          <p className="text-[11px] text-slate-400 mt-6">
            By continuing, you agree to GoTickets&apos; terms and understand how
            we use your data to secure your account.
          </p>
        </div>

        {/* Right / Form */}
        <div className="p-8 md:p-10 flex flex-col justify-center">
          <div className="mb-6 md:mb-8 md:hidden">
            <h1 className="text-2xl font-semibold">
              Welcome back to <span className="text-amber-400">GoTickets</span>
            </h1>
            <p className="text-slate-400 text-sm mt-1">
              Sign in to manage your tickets, wishlist and orders.
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
                <Mail className="w-4 h-4 text-amber-400" />
                Email address
              </label>
              <div className="relative">
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
                  className="w-full rounded-xl bg-slate-950/70 border border-slate-700 px-4 py-3 pr-11 text-sm text-slate-50 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-500/70 focus:border-amber-500/70 transition-all"
                  placeholder="••••••••"
                  minLength={6}
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

            <div className="flex items-center justify-between text-xs text-slate-400">
              <div />
              <Link
                to="/forgot-password"
                className="text-amber-400 hover:text-amber-300 font-medium"
              >
                Forgot your password?
              </Link>
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-amber-500 hover:bg-amber-400 disabled:bg-amber-500/70 text-slate-950 font-semibold text-sm py-3 mt-1 transition-all shadow-lg shadow-amber-500/25"
            >
              {submitting ? (
                <>
                  <span className="h-4 w-4 border-2 border-slate-900/70 border-t-transparent rounded-full animate-spin" />
                  Signing you in...
                </>
              ) : (
                <>
                  <LogIn className="w-4 h-4" />
                  <span>Sign in</span>
                </>
              )}
            </button>

            <p className="text-xs text-slate-400 text-center mt-2">
              New to GoTickets?{" "}
              <Link
                to="/signup"
                className="text-amber-400 hover:text-amber-300 font-medium"
              >
                Create an account
              </Link>
            </p>
          </form>
        </div>
      </div>
    </div>
  );
}
