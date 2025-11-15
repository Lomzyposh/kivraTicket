import React from "react";
import { Ticket } from "lucide-react";

export default function Loader({ fullScreen = false, message = "Loading..." }) {
  return (
    <div
      className={`flex flex-col items-center justify-center gap-4 ${
        fullScreen
          ? "fixed inset-0 z-50 bg-slate-950/95 text-slate-50"
          : "py-12 text-slate-100"
      }`}
    >
      {/* Spinning ticket icon */}
      <div className="relative flex items-center justify-center">
        <div className="absolute h-14 w-14 rounded-full border-2 border-amber-500/20 border-t-amber-500 animate-spin" />
        <Ticket className="w-6 h-6 text-amber-400 animate-pulse" />
      </div>

      <div className="text-center">
        <p className="text-sm font-medium tracking-wide text-slate-300">
          {message}
        </p>
        {fullScreen && (
          <p className="text-[11px] text-slate-500 mt-1 animate-pulse">
            Please wait, good things take a moment ✨
          </p>
        )}
      </div>
    </div>
  );
}
