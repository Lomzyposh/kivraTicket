import React, { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  Globe2,
  Download,
  AlertTriangle,
  RefreshCw,
  CalendarDays,
  MapPin,
  Ticket,
  Layers,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import api from "../../api/axios";
import { useAuth } from "../../context/AuthContext";

const SOURCE_OPTIONS = [
  { value: "seatgeek", label: "SeatGeek" },
  { value: "serpapi", label: "SerpAPI" },
  { value: "custom", label: "Custom integration" },
];

function formatShortDate(value) {
  if (!value) return "Date TBA";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "Date TBA";
  return d.toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function formatLocation(event = {}) {
  const loc = event.location || {};
  const parts = [event.venue, loc.city, loc.state, loc.country].filter(Boolean);
  return parts.join(" • ") || "Location TBA";
}

export default function AdminFetchEvents() {
  const navigate = useNavigate();
  const { user } = useAuth();

  const [query, setQuery] = useState("");
  const [source, setSource] = useState("seatgeek");
  const [limit, setLimit] = useState("20");

  const [importMessage, setImportMessage] = useState("");
  const [importError, setImportError] = useState("");
  const [importing, setImporting] = useState(false);

  const [events, setEvents] = useState([]);
  const [loadingEvents, setLoadingEvents] = useState(true);
  const [eventsError, setEventsError] = useState("");
  const [refreshing, setRefreshing] = useState(false);

  const [showOnlyImported, setShowOnlyImported] = useState(true);

  // Guard
  useEffect(() => {
    if (!user) {
      navigate("/login", {
        state: {
          from: "/admin/fetch-events",
          message: "Sign in with an admin account to import events.",
        },
      });
      return;
    }
    if (user.role !== "admin") {
      navigate("/");
    }
  }, [user, navigate]);

  const loadEvents = async ({ showLoader = true } = {}) => {
    try {
      if (showLoader) setLoadingEvents(true);
      setEventsError("");
      // Using public /events; we’ll filter imported ones client-side by apiSource
      const res = await api.get("/events");
      setEvents(res.data?.events || []);
    } catch (err) {
      const msg =
        err?.response?.data?.error ||
        err?.response?.data?.message ||
        "Unable to load events.";
      setEventsError(msg);
    } finally {
      if (showLoader) setLoadingEvents(false);
    }
  };

  useEffect(() => {
    if (!user || user.role !== "admin") return;
    loadEvents();
  }, [user]);

  const handleRefresh = async () => {
    try {
      setRefreshing(true);
      await loadEvents({ showLoader: false });
    } finally {
      setRefreshing(false);
    }
  };

  const handleImport = async (e) => {
    e.preventDefault();
    setImportError("");
    setImportMessage("");

    if (!query.trim()) {
      setImportError(
        "Enter a search term, e.g. 'Afrobeats Lagos' or 'NBA games'."
      );
      return;
    }

    const lim = Number(limit || 0);
    if (Number.isNaN(lim) || lim <= 0) {
      setImportError("Limit must be a positive number.");
      return;
    }

    try {
      setImporting(true);
      const body = {
        query: query.trim(),
        source,
        limit: lim,
      };

      const res = await api.post("/admin/fetch-events", body);

      setImportMessage(
        res.data?.message ||
          `Imported events from ${source}. Check the list below to confirm.`
      );
      await loadEvents({ showLoader: false });
    } catch (err) {
      const msg =
        err?.response?.data?.error ||
        err?.response?.data?.message ||
        "Unable to import events. Check your API keys / server logs.";
      setImportError(msg);
    } finally {
      setImporting(false);
    }
  };

  const importedEvents = useMemo(
    () =>
      events.filter(
        (ev) =>
          ev.apiSource && ev.apiSource !== "manual" && ev.apiSource !== "local"
      ),
    [events]
  );

  const visibleEvents = showOnlyImported ? importedEvents : events;

  return (
    <div className="min-h-screen bg-linear-to-br from-slate-950 via-slate-900 to-slate-950 text-slate-50">
      <div className="max-w-6xl mx-auto px-4 pt-20 pb-16 md:px-8 lg:px-10 lg:pt-24">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
          <div>
            <button
              type="button"
              onClick={() => navigate(-1)}
              className="inline-flex items-center gap-1.5 text-xs text-slate-300 hover:text-amber-300 mb-2"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              Back
            </button>
            <h1 className="text-2xl md:text-3xl font-semibold text-slate-50 flex items-center gap-2">
              <Globe2 className="w-5 h-5 text-amber-400" />
              Import live events
            </h1>
            <p className="mt-1 text-xs md:text-sm text-slate-400 max-w-xl">
              Pull real events from SeatGeek / SerpAPI into your MongoDB, then
              manage them alongside your manual listings.
            </p>
          </div>
          <div className="flex flex-col items-end gap-2">
            <button
              type="button"
              onClick={handleRefresh}
              disabled={loadingEvents || refreshing}
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-700 bg-slate-950/80 hover:border-amber-500/70 hover:bg-slate-900/80 text-[11px] text-slate-200 px-3 py-1.5 transition-all"
            >
              {refreshing ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  Refreshing
                </>
              ) : (
                <>
                  <RefreshCw className="w-3.5 h-3.5" />
                  Refresh events
                </>
              )}
            </button>
            <p className="text-[11px] text-slate-500">
              Imported: {importedEvents.length} • Total: {events.length}
            </p>
          </div>
        </div>

        {/* Import form */}
        <form
          onSubmit={handleImport}
          className="rounded-3xl bg-slate-900/80 border border-slate-800 p-5 mb-6 flex flex-col gap-3"
        >
          <div className="flex items-center justify-between mb-1">
            <div>
              <p className="text-[11px] text-slate-400 uppercase tracking-[0.18em] mb-1">
                Import parameters
              </p>
              <p className="text-xs text-slate-300">
                Describe the kind of events you want fetched, choose the data
                source, set a limit, and GoTickets will do the rest.
              </p>
            </div>
            <Download className="w-4 h-4 text-sky-400" />
          </div>

          {importError && (
            <div className="rounded-2xl bg-red-500/10 border border-red-500/40 px-3 py-2 text-[11px] text-red-100 flex items-start gap-2">
              <AlertTriangle className="w-3.5 h-3.5 mt-0.5" />
              <span>{importError}</span>
            </div>
          )}

          {importMessage && !importError && (
            <div className="rounded-2xl bg-emerald-500/10 border border-emerald-500/40 px-3 py-2 text-[11px] text-emerald-100">
              {importMessage}
            </div>
          )}

          <div className="space-y-1">
            <label className="text-[11px] text-slate-400">
              Search query / location
            </label>
            <input
              type="text"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setImportError("");
                setImportMessage("");
              }}
              placeholder="e.g. Afrobeats Lagos, Premier League London, Comedy shows Abuja..."
              className="w-full rounded-xl bg-slate-950/80 border border-slate-800 px-3 py-2 text-xs text-slate-50 placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-sky-500/70 focus:border-sky-500/70"
            />
          </div>

          <div className="grid sm:grid-cols-[minmax(0,1.1fr),minmax(0,0.9fr),minmax(0,0.6fr)] gap-3">
            <div className="space-y-1">
              <label className="text-[11px] text-slate-400">Data source</label>
              <select
                value={source}
                onChange={(e) => {
                  setSource(e.target.value);
                  setImportError("");
                  setImportMessage("");
                }}
                className="w-full rounded-xl bg-slate-950/80 border border-slate-800 px-3 py-2 text-[11px] text-slate-50 focus:outline-none focus:ring-1 focus:ring-sky-500/70 focus:border-sky-500/70"
              >
                {SOURCE_OPTIONS.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-[11px] text-slate-400">
                Max events to import
              </label>
              <input
                type="number"
                min="1"
                value={limit}
                onChange={(e) => {
                  setLimit(e.target.value);
                  setImportError("");
                  setImportMessage("");
                }}
                className="w-full rounded-xl bg-slate-950/80 border border-slate-800 px-3 py-2 text-xs text-slate-50 placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-sky-500/70 focus:border-sky-500/70"
              />
            </div>
            <div className="flex items-end">
              <button
                type="submit"
                disabled={importing}
                className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-sky-500 hover:bg-sky-400 disabled:bg-sky-500/60 text-slate-950 text-xs font-semibold px-4 py-2.5 transition-all"
              >
                {importing ? (
                  <>
                    <span className="h-4 w-4 border-2 border-slate-900/70 border-t-transparent rounded-full animate-spin" />
                    Importing...
                  </>
                ) : (
                  <>
                    <Globe2 className="w-4 h-4" />
                    Import events
                  </>
                )}
              </button>
            </div>
          </div>

          <p className="text-[11px] text-slate-500">
            Your server uses the configured API keys (SeatGeek, SerpAPI, etc.)
            to fetch events and save them to MongoDB. You can always clean or
            edit them later from the Events admin page.
          </p>
        </form>

        {/* Imported events list */}
        <div className="rounded-3xl bg-slate-900/80 border border-slate-800 p-5">
          <div className="flex items-center justify-between mb-3">
            <div>
              <p className="text-[11px] text-slate-400 uppercase tracking-[0.18em] mb-1">
                Imported events overview
              </p>
              <p className="text-xs text-slate-300">
                You&apos;re currently viewing{" "}
                {showOnlyImported ? "only imported events" : "all events"}.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setShowOnlyImported((prev) => !prev)}
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-700 bg-slate-950/80 hover:border-amber-500/70 hover:bg-slate-900/80 text-[11px] text-slate-200 px-3 py-1.5 transition-all"
            >
              <Layers className="w-3.5 h-3.5 text-amber-400" />
              {showOnlyImported ? "Show all events" : "Show only imported"}
            </button>
          </div>

          {eventsError && (
            <div className="mb-3 rounded-2xl bg-red-500/10 border border-red-500/40 px-3 py-2 text-[11px] text-red-100 flex items-start gap-2">
              <AlertTriangle className="w-3.5 h-3.5 mt-0.5" />
              <span>{eventsError}</span>
            </div>
          )}

          {loadingEvents ? (
            <div className="space-y-3">
              {Array.from({ length: 4 }).map((_, idx) => (
                <div
                  key={idx}
                  className="rounded-2xl bg-slate-950/80 border border-slate-800 p-4 animate-pulse"
                >
                  <div className="h-4 w-40 bg-slate-800 rounded-full mb-2" />
                  <div className="h-3 w-32 bg-slate-800 rounded-full mb-2" />
                  <div className="h-3 w-24 bg-slate-800 rounded-full" />
                </div>
              ))}
            </div>
          ) : visibleEvents.length === 0 ? (
            <div className="rounded-2xl bg-slate-950/80 border border-slate-800 p-6 flex flex-col items-center justify-center text-center">
              <Globe2 className="w-6 h-6 text-amber-400 mb-2" />
              <p className="text-sm font-semibold text-slate-100">
                No imported events found yet.
              </p>
              <p className="text-xs text-slate-400 mt-1 max-w-sm">
                Start by importing from SeatGeek or SerpAPI above. Once the data
                lands in MongoDB, you&apos;ll see it show up in this list.
              </p>
            </div>
          ) : (
            <div className="space-y-3 max-h-[460px] overflow-y-auto pr-1">
              {visibleEvents.map((ev) => (
                <div
                  key={ev._id}
                  className="rounded-2xl bg-slate-950/80 border border-slate-800 px-3 py-3 flex flex-col sm:flex-row gap-3 items-start"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <p className="text-xs font-semibold text-slate-100 truncate">
                        {ev.title}
                      </p>
                      <span className="text-[10px] text-slate-500 uppercase tracking-[0.18em]">
                        {ev.apiSource || "manual"}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-400 truncate">
                      {formatLocation(ev)}
                    </p>
                    <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-slate-300">
                      <span className="inline-flex items-center gap-1">
                        <CalendarDays className="w-3.5 h-3.5 text-amber-400" />
                        {formatShortDate(ev.date)}
                      </span>
                      {ev.totalTickets != null && (
                        <span className="inline-flex items-center gap-1">
                          <Ticket className="w-3.5 h-3.5 text-emerald-400" />
                          {ev.availableTickets ?? "?"}/{ev.totalTickets} left
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="text-[10px] text-slate-500 sm:text-right">
                    {ev.category && <p>Category: {ev.category}</p>}
                    {ev.price?.min != null && (
                      <p>
                        Price from {ev.price.currency || ""}{" "}
                        {ev.price.min.toLocaleString()}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
