import React, { useState, useEffect } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { Lock, Hash, ArrowLeft, Ticket } from "lucide-react";
import api from "../api/axios";

export default function ResetPassword() {
  const navigate = useNavigate();
  const location = useLocation();

  const [form, setForm] = useState({
    email: location.state?.email || "Ignore this value",
    code: "",
    newPassword: "",
    confirmPassword: "",
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
    setError("");
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!form.email || !form.code || !form.newPassword || !form.confirmPassword) {
      setError("Please complete all the fields.");
      return;
    }

    if (form.newPassword.length < 6) {
      setError("Password must be at least 6 characters long.");
      return;
    }

    if (form.newPassword !== form.confirmPassword) {
      setError("The passwords do not match.");
      return;
    }

    try {
      setSubmitting(true);
      setError("");
      setSuccess("");

      await api.post("/auth/reset-password", {
        email: form.email,
        code: form.code,
        newPassword: form.newPassword,
      });

      setSuccess("Your password has been reset successfully.");
      // Optional: navigate back to login after a short delay or via button:
      setTimeout(() => {
        navigate("/login");
      }, 1200);
    } catch (err) {
      const msg =
        err?.response?.data?.error ||
        err?.response?.data?.message ||
        "We couldn’t reset your password. Please check the code and try again.";
      setError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-linear-to-br from-slate-950 via-slate-900 to-slate-950 text-slate-50 flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-lg bg-slate-900/80 border border-slate-800 rounded-3xl shadow-2xl p-8 md:p-10 space-y-6 backdrop-blur">
        <div className="inline-flex items-center gap-2 rounded-full bg-slate-950/70 px-4 py-1 text-[11px] uppercase tracking-[0.18em] text-amber-300 border border-amber-500/40">
          <Ticket className="w-3 h-3" />
          <span>Secure reset</span>
        </div>

        <div>
          <h1 className="text-2xl font-semibold mb-1">
            Reset your password.
          </h1>
          <p className="text-sm text-slate-400">
            Enter the email you requested the code with, the 6-digit reset code
            from your inbox, and your new password. For security, each code
            can only be used once.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          {error && (
            <div className="rounded-xl border border-red-500/40 bg-red-500/10 text-red-200 text-sm px-4 py-3">
              {error}
            </div>
          )}
          {success && (
            <div className="rounded-xl border border-emerald-500/40 bg-emerald-500/10 text-emerald-200 text-sm px-4 py-3">
              {success}
            </div>
          )}

          <div className="space-y-1.5">
            <label className="text-sm font-medium text-slate-100">
              Email address
            </label>
            <input
              type="email"
              name="email"
              value={form.email}
              required
              className="w-full rounded-xl bg-slate-950/70 border border-slate-700 px-4 py-3 text-sm text-slate-50 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-500/70 focus:border-amber-500/70 transition-all"
              placeholder="you@example.com"
              disabled
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium text-slate-100 flex items-center gap-2">
              <Hash className="w-4 h-4 text-amber-400" />
              Reset code
            </label>
            <input
              type="text"
              name="code"
              value={form.code}
              onChange={handleChange}
              required
              className="w-full rounded-xl bg-slate-950/70 border border-slate-700 px-4 py-3 text-sm text-slate-50 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-500/70 focus:border-amber-500/70 transition-all tracking-[0.2em]"
              placeholder="••••••"
              maxLength={6}
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium text-slate-100 flex items-center gap-2">
              <Lock className="w-4 h-4 text-amber-400" />
              New password
            </label>
            <input
              type="password"
              name="newPassword"
              value={form.newPassword}
              onChange={handleChange}
              required
              minLength={6}
              className="w-full rounded-xl bg-slate-950/70 border border-slate-700 px-4 py-3 text-sm text-slate-50 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-500/70 focus:border-amber-500/70 transition-all"
              placeholder="Choose a strong password"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium text-slate-100">
              Confirm new password
            </label>
            <input
              type="password"
              name="confirmPassword"
              value={form.confirmPassword}
              onChange={handleChange}
              required
              minLength={6}
              className="w-full rounded-xl bg-slate-950/70 border border-slate-700 px-4 py-3 text-sm text-slate-50 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-500/70 focus:border-amber-500/70 transition-all"
              placeholder="Type the new password again"
            />
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-amber-500 hover:bg-amber-400 disabled:bg-amber-500/70 text-slate-950 font-semibold text-sm py-3 mt-1 transition-all shadow-lg shadow-amber-500/25"
          >
            {submitting ? (
              <>
                <span className="h-4 w-4 border-2 border-slate-900/70 border-t-transparent rounded-full animate-spin" />
                Updating password...
              </>
            ) : (
              <>
                <Lock className="w-4 h-4" />
                <span>Reset password</span>
              </>
            )}
          </button>
        </form>

        <div className="flex items-center justify-between text-xs text-slate-400">
          <Link
            to="/forgot-password"
            className="inline-flex items-center gap-1 text-slate-400 hover:text-amber-300"
          >
            <ArrowLeft className="w-3 h-3" />
            Back to reset code
          </Link>

          <Link
            to="/login"
            className="text-amber-400 hover:text-amber-300 font-medium"
          >
            Return to login
          </Link>
        </div>
      </div>
    </div>
  );
}
