import React, { useState } from "react";
import { Link } from "react-router-dom";
import { Mail, ArrowLeft, Ticket } from "lucide-react";
import api from "../api/axios";

export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email) {
      setError("Please enter the email linked to your GoTickets account.");
      return;
    }

    try {
      setSubmitting(true);
      setError("");
      setSuccess("");

      await api.post("/auth/forgot-password", { email });

      setSuccess(
        "If this email is registered, we’ve sent a 6-digit reset code. It will expire in 1 hour."
      );
    } catch (err) {
      const msg =
        err?.response?.data?.error ||
        err?.response?.data?.message ||
        "Something went wrong while sending the reset code. Please try again.";
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
          <span>Password reset</span>
        </div>

        <div>
          <h1 className="text-2xl font-semibold mb-1">
            Forgot your password?
          </h1>
          <p className="text-sm text-slate-400">
            No worries. Enter your email and we&apos;ll send you a one-time
            reset code. You&apos;ll use this code on the next step to create a
            new password.
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
            <label className="text-sm font-medium text-slate-100 flex items-center gap-2">
              <Mail className="w-4 h-4 text-amber-400" />
              Email address
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                setError("");
              }}
              required
              className="w-full rounded-xl bg-slate-950/70 border border-slate-700 px-4 py-3 text-sm text-slate-50 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-500/70 focus:border-amber-500/70 transition-all"
              placeholder="you@example.com"
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
                Sending reset code...
              </>
            ) : (
              <>
                <Mail className="w-4 h-4" />
                Send reset code
              </>
            )}
          </button>
        </form>

        <div className="flex items-center justify-between text-xs text-slate-400">
          <Link
            to="/login"
            className="inline-flex items-center gap-1 text-slate-400 hover:text-amber-300"
          >
            <ArrowLeft className="w-3 h-3" />
            Back to login
          </Link>

          <Link
            to="/reset-password"
            className="text-amber-400 hover:text-amber-300 font-medium"
          >
            Already have a code? Reset here
          </Link>
        </div>
      </div>
    </div>
  );
}
