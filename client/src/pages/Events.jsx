import React, { useEffect, useMemo, useState } from "react";
import {
  Search,
  MapPin,
  SlidersHorizontal,
  Ticket,
  CalendarDays,
  ArrowUpDown,
  AlertTriangle,
} from "lucide-react";
import { useSearchParams, useNavigate } from "react-router-dom";
import api from "../api/axios";

const CATEGORY_OPTIONS = [
  { value: "all", label: "All" },
  { value: "concert", label: "Concerts" },
  { value: "sports", label: "Sports" },
  { value: "theater", label: "Theatre" },
  { value: "comedy", label: "Comedy" },
  { value: "other", label: "Other" },
];

const SORT_OPTIONS = [
  { value: "date-asc", label: "Soonest first" },
  { value: "date-desc", label: "Latest first" },
  { value: "price-low", label: "Price: Low to High" },
  { value: "price-high", label: "Price: High to Low" },
];

function formatDate(dateString) {
  if (!dateString) return "Date TBA";
  const d = new Date(dateString);
  if (Number.isNaN(d.getTime())) return "Date TBA";
  return d.toLocaleDateString(undefined, {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function formatLocation(loc = {}) {
  const parts = [loc.city, loc.state, loc.country].filter(Boolean);
  return parts.join(", ") || "Location TBA";
}

function formatPrice(price = {}) {
  const symbol =
    price.currency === "USD"
      ? "$"
      : price.currency === "NGN"
      ? "₦"
      : price.currency === "GBP"
      ? "£"
      : price.currency === "EUR"
      ? "€"
      : "";
  if (price.min && price.max && price.min !== price.max) {
    return `${symbol}${price.min.toLocaleString()} – ${symbol}${price.max.toLocaleString()}`;
  }
  if (price.min) {
    return `From ${symbol}${price.min.toLocaleString()}`;
  }
  return "Price TBA";
}

export default function Events() {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();

  const [filters, setFilters] = useState({
    search: searchParams.get("search") || "",
    location: searchParams.get("location") || "",
    category: searchParams.get("category") || "all",
    minPrice: searchParams.get("minPrice") || "",
    maxPrice: searchParams.get("maxPrice") || "",
    sortBy: searchParams.get("sortBy") || "date-asc",
  });

  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [touched, setTouched] = useState(false);
  const [hasSyncedReal, setHasSyncedReal] = useState(false);

  // Build params object from filters for API + URL
  const paramsForApi = useMemo(() => {
    const params = {};
    if (filters.search.trim()) params.search = filters.search.trim();
    if (filters.location.trim()) params.location = filters.location.trim();
    if (filters.category && filters.category !== "all")
      params.category = filters.category;
    if (filters.minPrice) params.minPrice = filters.minPrice;
    if (filters.maxPrice) params.maxPrice = filters.maxPrice;
    if (filters.sortBy) params.sortBy = filters.sortBy;
    return params;
  }, [filters]);

  // Sync filters to URL whenever they change (after first touch)
  useEffect(() => {
    if (!touched) return;
    const urlParams = new URLSearchParams();
    Object.entries(paramsForApi).forEach(([key, value]) => {
      if (value !== "" && value != null) {
        urlParams.set(key, value);
      }
    });
    setSearchParams(urlParams);
  }, [paramsForApi, setSearchParams, touched]);

  useEffect(() => {
    let active = true;

    const fetchEvents = async () => {
      try {
        setLoading(true);
        setError("");

        const params = {};
        searchParams.forEach((value, key) => {
          params[key] = value;
        });

        const res = await api.get("/events", { params });
        if (!active) return;

        setEvents(res.data?.events || []);
        if (!hasSyncedReal) setHasSyncedReal(true);
      } catch (err) {
        if (!active) return;
        const msg =
          err?.response?.data?.error ||
          err?.response?.data?.message ||
          "We couldn’t load events. Please try again.";
        setError(msg);
      } finally {
        if (active) setLoading(false);
      }
    };

    fetchEvents();

    return () => {
      active = false;
    };
  }, [searchParams, hasSyncedReal]);

  const handleFilterChange = (key, value) => {
    setTouched(true);
    setFilters((prev) => ({ ...prev, [key]: value }));
  };

  const handleResetFilters = () => {
    setTouched(true);
    const base = {
      search: "",
      location: "",
      category: "all",
      minPrice: "",
      maxPrice: "",
      sortBy: "date-asc",
    };
    setFilters(base);
    const urlParams = new URLSearchParams();
    urlParams.set("sortBy", "date-asc");
    setSearchParams(urlParams);
  };

  const handleCardClick = (id) => {
    navigate(`/events/${id}`);
  };

  return (
    <div className="min-h-screen bg-linear-to-br from-slate-950 via-slate-900 to-slate-950 text-slate-50">
      <div className="max-w-6xl mx-auto px-4 pt-20 pb-16 md:px-10 lg:px-16 lg:pt-24">

        <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4 mb-6">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full bg-slate-950/80 px-4 py-1 text-[11px] uppercase tracking-[0.18em] text-amber-300 border border-amber-500/40 mb-3">
              <Ticket className="w-3 h-3" />
              <span>Event listings</span>
            </div>
            <h1 className="text-2xl md:text-3xl font-semibold text-slate-50">
              Explore live events and tickets.
            </h1>
            <p className="mt-1 text-xs md:text-sm text-slate-400 max-w-xl">
              Use filters to narrow down by city, category, date and price.
              Every ticket issued through KivraTickets comes with a secure QR code
              for entry.
            </p>
          </div>

          <div className="flex items-center gap-2 text-[11px] text-slate-400">
            <CalendarDays className="w-3.5 h-3.5 text-amber-400" />
            <span>
              Showing{" "}
              <span className="text-slate-100 font-semibold">
                {events.length}
              </span>{" "}
              event{events.length === 1 ? "" : "s"} based on your filters
            </span>
          </div>
        </div>

        {/* Filters */}
        <div className="mb-6 rounded-2xl bg-slate-900/80 border border-slate-800 p-4 md:p-5 shadow-xl shadow-slate-950/60">
          <div className="flex items-center gap-2 mb-3">
            <SlidersHorizontal className="w-4 h-4 text-amber-400" />
            <p className="text-xs font-medium text-slate-200 uppercase tracking-[0.18em]">
              Filters
            </p>
          </div>

          <div className="grid md:grid-cols-[minmax(0,1.2fr),minmax(0,1.1fr),minmax(0,0.9fr)] gap-3">
            {/* Search */}
            <div className="space-y-1">
              <label className="text-[11px] text-slate-400 flex items-center gap-1">
                <Search className="w-3.5 h-3.5" />
                Search
              </label>
              <div className="flex items-center gap-2 bg-slate-950/80 rounded-xl px-3 py-2 border border-slate-800 focus-within:border-amber-500/70 focus-within:ring-1 focus-within:ring-amber-500/60">
                <Search className="w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  value={filters.search}
                  onChange={(e) => handleFilterChange("search", e.target.value)}
                  placeholder="Artist, team, event or venue"
                  className="w-full bg-transparent outline-none text-sm text-slate-50 placeholder:text-slate-500"
                />
              </div>
            </div>

            {/* Location & Category */}
            <div className="grid sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-[11px] text-slate-400 flex items-center gap-1">
                  <MapPin className="w-3.5 h-3.5" />
                  Location
                </label>
                <div className="flex items-center gap-2 bg-slate-950/80 rounded-xl px-3 py-2 border border-slate-800 focus-within:border-amber-500/70 focus-within:ring-1 focus-within:ring-amber-500/60">
                  <MapPin className="w-4 h-4 text-slate-400" />
                  <input
                    type="text"
                    value={filters.location}
                    onChange={(e) =>
                      handleFilterChange("location", e.target.value)
                    }
                    placeholder="City, state or country"
                    className="w-full bg-transparent outline-none text-sm text-slate-50 placeholder:text-slate-500"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[11px] text-slate-400">Category</label>
                <select
                  value={filters.category}
                  onChange={(e) =>
                    handleFilterChange("category", e.target.value)
                  }
                  className="w-full rounded-xl bg-slate-950/80 border border-slate-800 px-3 py-2 text-sm text-slate-50 focus:outline-none focus:ring-1 focus:ring-amber-500/70 focus:border-amber-500/70"
                >
                  {CATEGORY_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Price & Sort */}
            <div className="grid sm:grid-cols-[minmax(0,1.1fr),minmax(0,1.2fr)] gap-3">
              <div className="space-y-1">
                <label className="text-[11px] text-slate-400">
                  Price range
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min={0}
                    value={filters.minPrice}
                    onChange={(e) =>
                      handleFilterChange("minPrice", e.target.value)
                    }
                    placeholder="Min"
                    className="w-full rounded-xl bg-slate-950/80 border border-slate-800 px-3 py-2 text-xs text-slate-50 placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-amber-500/70 focus:border-amber-500/70"
                  />
                  <span className="text-[11px] text-slate-500">–</span>
                  <input
                    type="number"
                    min={0}
                    value={filters.maxPrice}
                    onChange={(e) =>
                      handleFilterChange("maxPrice", e.target.value)
                    }
                    placeholder="Max"
                    className="w-full rounded-xl bg-slate-950/80 border border-slate-800 px-3 py-2 text-xs text-slate-50 placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-amber-500/70 focus:border-amber-500/70"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[11px] text-slate-400 flex items-center gap-1">
                  <ArrowUpDown className="w-3.5 h-3.5" />
                  Sort by
                </label>
                <select
                  value={filters.sortBy}
                  onChange={(e) => handleFilterChange("sortBy", e.target.value)}
                  className="w-full rounded-xl bg-slate-950/80 border border-slate-800 px-3 py-2 text-sm text-slate-50 focus:outline-none focus:ring-1 focus:ring-amber-500/70 focus:border-amber-500/70"
                >
                  {SORT_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Bottom filter bar */}
          <div className="mt-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <p className="text-[11px] text-slate-500">
              Tip: Start with a broad search, then narrow down with price and
              category.
            </p>
            <button
              type="button"
              onClick={handleResetFilters}
              className="inline-flex items-center gap-1.5 text-[11px] text-slate-300 hover:text-amber-300"
            >
              <SlidersHorizontal className="w-3.5 h-3.5" />
              Reset filters
            </button>
          </div>
        </div>

        {/* Events grid */}
        <div className="space-y-4">
          {loading && (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {Array.from({ length: 6 }).map((_, idx) => (
                <div
                  key={idx}
                  className="rounded-2xl bg-slate-900/80 border border-slate-800 p-4 animate-pulse"
                >
                  <div className="h-32 rounded-xl bg-slate-800 mb-3" />
                  <div className="h-3 w-32 bg-slate-800 rounded-full mb-2" />
                  <div className="h-2.5 w-24 bg-slate-800 rounded-full mb-1.5" />
                  <div className="h-2.5 w-20 bg-slate-800 rounded-full" />
                </div>
              ))}
            </div>
          )}

          {!loading && error && (
            <div className="rounded-2xl bg-red-500/10 border border-red-500/40 p-4 flex items-start gap-3 text-sm text-red-100">
              <AlertTriangle className="w-4 h-4 mt-0.5" />
              <div>
                <p className="font-medium">We hit a snag loading events.</p>
                <p className="text-xs text-red-200 mt-1">{error}</p>
              </div>
            </div>
          )}

          {!loading && !error && events.length === 0 && (
            <div className="rounded-2xl bg-slate-900/80 border border-slate-800 p-6 flex flex-col items-center justify-center text-center">
              <AlertTriangle className="w-6 h-6 text-amber-400 mb-2" />
              <p className="text-sm font-medium text-slate-100">
                No events match your filters yet.
              </p>
              <p className="text-xs text-slate-400 mt-1 max-w-sm">
                Try widening your search, clearing the price range or exploring
                a different category. New events may be added by admins at any
                time.
              </p>
              <button
                type="button"
                onClick={handleResetFilters}
                className="mt-3 inline-flex items-center gap-1.5 rounded-xl border border-slate-700 bg-slate-950/80 hover:border-amber-500/70 hover:bg-slate-900/80 text-xs text-slate-200 px-3 py-2 transition-all"
              >
                Reset filters
              </button>
            </div>
          )}

          {!loading && !error && events.length > 0 && (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {events.map((event) => {
                const isPast = event.isPastEvent;
                return (
                  <button
                    key={event._id}
                    type="button"
                    onClick={() => handleCardClick(event._id)}
                    className="group rounded-2xl bg-slate-900/80 border border-slate-800 hover:border-amber-500/80 hover:-translate-y-1 transition-all p-4 text-left flex flex-col"
                  >
                    <div className="relative h-40 w-full rounded-2xl overflow-hidden bg-linear-to-br from-slate-900 via-slate-800 to-slate-900 shadow-md shadow-slate-900/40 mb-4 group">
                      {event.images?.[0] ? (
                        <img
                          src={event.images[0]}
                          alt={event.title}
                          className="h-full w-full object-cover object-center transition-transform duration-500 group-hover:scale-105 group-hover:brightness-110"
                          loading="lazy"
                        />
                      ) : (
                        <div className="h-full w-full flex flex-col items-center justify-center text-center px-4 text-[11px] text-slate-400 bg-slate-950/60">
                          <span className="uppercase tracking-[0.18em] font-semibold text-slate-300">
                            {event.category || "Event"}
                          </span>
                          <span className="text-slate-500 mt-1">
                            Image coming soon
                          </span>
                        </div>
                      )}

                      {/* Overlay gradient for readability */}
                      <div className="absolute inset-0 bg-linear-to-t from-slate-950/70 via-slate-950/10 to-transparent" />

                      {/* Title overlay (optional if used in list view) */}
                      <div className="absolute bottom-2 left-3 right-3">
                        <p className="text-xs sm:text-sm font-semibold text-slate-50 truncate drop-shadow-[0_1px_2px_rgba(0,0,0,0.9)]">
                          {event.title}
                        </p>
                      </div>

                      {/* Past badge */}
                      {isPast && (
                        <div className="absolute top-2 left-2 rounded-full bg-slate-950/90 border border-slate-700/70 px-2 py-0.5 text-[10px] text-slate-300 uppercase tracking-[0.16em] shadow-md">
                          Past event
                        </div>
                      )}
                    </div>

                    <p className="text-sm font-semibold text-slate-100 line-clamp-2">
                      {event.title}
                    </p>
                    <p className="text-xs text-slate-400 mt-1 line-clamp-2">
                      {event.description || "No description provided."}
                    </p>

                    <div className="mt-3 flex items-center justify-between text-[11px] text-slate-300">
                      <span className="text-amber-300">
                        {formatDate(event.date)}
                      </span>
                      <span>{formatLocation(event.location)}</span>
                    </div>

                    <div className="mt-2 flex items-center justify-between text-[11px]">
                      <span className="text-slate-200">
                        {formatPrice(event.price)}
                      </span>
                      {/* {typeof event.availableTickets === "number" && (
                        <span className="text-slate-400">
                          {event.availableTickets} ticket
                          {event.availableTickets === 1 ? "" : "s"} left
                        </span>
                      )} */}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
