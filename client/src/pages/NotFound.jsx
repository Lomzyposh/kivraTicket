import React from "react";
import { useNavigate, Link } from "react-router-dom";
import { Compass, Home, Ticket } from "lucide-react";

export default function NotFound() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-linear-to-br from-slate-950 via-slate-900 to-slate-950 text-slate-50 flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-lg bg-slate-900/80 border border-slate-800 rounded-3xl shadow-2xl p-8 md:p-10 text-center space-y-5">
        <div className="inline-flex items-center justify-center h-12 w-12 rounded-2xl bg-slate-950 border border-slate-700 shadow-lg shadow-slate-950/60 mx-auto">
          <Compass className="w-6 h-6 text-amber-400" />
        </div>

        <div>
          <p className="text-xs uppercase tracking-[0.25em] text-slate-500 mb-1">
            404 • Page not found
          </p>
          <h1 className="text-2xl md:text-3xl font-semibold text-slate-50">
            This page got lost in the crowd.
          </h1>
          <p className="mt-2 text-sm text-slate-400">
            The link you followed doesn&apos;t exist or may have moved.
            Let&apos;s head back to where the action is — live events and your
            tickets.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 mt-2">
          <button
            type="button"
            onClick={() => navigate("/")}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-semibold text-sm px-4 py-2.5 transition-all shadow-lg shadow-amber-500/30 w-full sm:w-auto"
          >
            <Home className="w-4 h-4" />
            Back to home
          </button>

          <Link
            to="/events"
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-700 bg-slate-950/80 hover:border-amber-500/70 hover:bg-slate-900/80 text-slate-100 font-medium text-sm px-4 py-2.5 transition-all w-full sm:w-auto"
          >
            <Ticket className="w-4 h-4" />
            Browse events
          </Link>
        </div>

        <p className="text-[11px] text-slate-500 mt-2">
          If you typed the address manually, double-check the spelling.
          Otherwise, use the navigation to find your way back.
        </p>
      </div>
    </div>
  );
}
