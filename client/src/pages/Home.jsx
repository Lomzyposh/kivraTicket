import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Ticket,
  Search,
  MapPin,
  CalendarDays,
  ChevronRight,
  Music2,
  Trophy,
  Music4,
  Mic2,
} from "lucide-react";
import api from "../api/axios";

const categories = [
  { id: "concert", label: "Concerts", icon: Music2 },
  { id: "sports", label: "Sports", icon: Trophy },
  { id: "theater", label: "Theatre", icon: Music4 },
  { id: "comedy", label: "Comedy", icon: Mic2 },
];

function formatDate(dateString) {
  if (!dateString) return "Date TBA";
  const d = new Date(dateString);
  if (Number.isNaN(d.getTime())) return "Date TBA";
  return d.toLocaleDateString(undefined, {
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

export default function Home() {
  const navigate = useNavigate();

  const [search, setSearch] = useState("");
  const [location, setLocation] = useState("");
  const [featured, setFeatured] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Load some featured/upcoming events
  useEffect(() => {
    let active = true;

    const fetchFeatured = async () => {
      try {
        setLoading(true);
        setError("");

        const res = await api.get("/events", {
          params: { sortBy: "date-asc" },
        });

        if (!active) return;

        const events = res.data?.events || [];

        // Pick first 6 upcoming events as "featured"
        setFeatured(events.slice(0, 6));
      } catch (err) {
        if (!active) return;
        const msg =
          err?.response?.data?.error ||
          err?.response?.data?.message ||
          "We couldn’t load events right now. Please try again.";
        setError(msg);
      } finally {
        if (active) setLoading(false);
      }
    };

    fetchFeatured();

    return () => {
      active = false;
    };
  }, []);

  const handleSearch = (e) => {
    e.preventDefault();
    const params = new URLSearchParams();
    if (search.trim()) params.set("search", search.trim());
    if (location.trim()) params.set("location", location.trim());

    navigate(`/events?${params.toString()}`);
  };

  const handleCategoryClick = (categoryId) => {
    const params = new URLSearchParams();
    params.set("category", categoryId);
    navigate(`/events?${params.toString()}`);
  };

  return (
    
    <div className="min-h-screen bg-linear-to-br from-slate-950 via-slate-900 to-slate-950 text-slate-50">
      {/* Hero section */}
      <section className="px-4 pt-20 pb-12 sm:px-6 md:px-10 lg:px-16 lg:pt-24">
        <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-[1.15fr,0.9fr] gap-10 items-center">
          {/* Left hero text */}
          <div>
            <div className="inline-flex items-center gap-2 rounded-full bg-slate-950/80 px-4 py-1 text-[11px] uppercase tracking-[0.18em] text-amber-300 border border-amber-500/40 mb-4">
              <Ticket className="w-3 h-3" />
              <span>KivraTickets</span>
              <span className="w-1 h-1 rounded-full bg-amber-400" />
              <span>Live events, simplified</span>
            </div>

            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-semibold leading-tight text-slate-50">
              Find tickets for{" "}
              <span className="text-amber-400">concerts, games</span> and
              everything in-between.
            </h1>

            <p className="mt-3 text-sm md:text-base text-slate-300 max-w-xl">
              Browse curated events, compare prices at a glance, and check out
              with secure QR tickets. From stadium nights to intimate shows, we
              help you get in the door — not lost in your email.
            </p>

            {/* Search form */}
            <form
              onSubmit={handleSearch}
              className="mt-6 grid gap-3 sm:grid-cols-1 md:grid-cols-[minmax(0,1.2fr),minmax(0,1fr)] bg-slate-900/80 border border-slate-800 rounded-2xl p-3 shadow-xl shadow-slate-950/60 backdrop-blur"
            >
              <div className="flex items-center gap-2 bg-slate-950/80 rounded-xl px-3 py-2 border border-slate-800 focus-within:border-amber-500/70 focus-within:ring-1 focus-within:ring-amber-500/60">
                <Search className="w-4 h-4 text-slate-400 shrink-0" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search for an artist, team or event"
                  className="w-full bg-transparent outline-none text-sm text-slate-50 placeholder:text-slate-500"
                />
              </div>

              <div className="flex flex-col sm:flex-row gap-2">
                <div className="flex-1 flex items-center gap-2 bg-slate-950/80 rounded-xl px-3 py-2 border border-slate-800 focus-within:border-amber-500/70 focus-within:ring-1 focus-within:ring-amber-500/60">
                  <MapPin className="w-4 h-4 text-slate-400 shrink-0" />
                  <input
                    type="text"
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                    placeholder="City or country"
                    className="w-full bg-transparent outline-none text-sm text-slate-50 placeholder:text-slate-500"
                  />
                </div>
                <button
                  type="submit"
                  className="inline-flex items-center justify-center px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-semibold text-sm whitespace-nowrap transition-all shadow-lg shadow-amber-500/30"
                >
                  <Search className="w-4 h-4 mr-1.5" />
                  Find events
                </button>
              </div>
            </form>

            {/* Category shortcuts */}
            <div className="mt-5 flex flex-wrap items-center gap-2">
              <p className="text-[11px] uppercase tracking-[0.18em] text-slate-500 mr-1">
                Browse by category
              </p>
              {categories.map((cat) => {
                const Icon = cat.icon;
                return (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => handleCategoryClick(cat.id)}
                    className="inline-flex items-center gap-1.5 rounded-full border border-slate-700/80 bg-slate-950/70 px-3 py-1.5 text-xs text-slate-200 hover:border-amber-500/70 hover:text-amber-300 transition-all"
                  >
                    <Icon className="w-3.5 h-3.5 text-amber-400" />
                    <span>{cat.label}</span>
                  </button>
                );
              })}
            </div>

            {/* Reassurance line */}
            <p className="mt-4 text-[11px] text-slate-500 max-w-md">
              No print-outs, no confusion — just a QR code on your phone and a
              clear order history whenever you need it.
            </p>
          </div>

          {/* Right hero card (featured list) */}
          <div className="relative">
            <div className="pointer-events-none absolute -inset-6 rounded-full bg-amber-500/10 blur-3xl" />
            <div className="relative bg-slate-900 border border-slate-800 rounded-3xl p-4 sm:p-5 md:p-6 shadow-2xl shadow-black/60">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
                <div>
                  <p className="text-xs text-slate-400">Tonight on KivraTickets</p>
                  <p className="text-sm font-semibold text-slate-100">
                    Live events near you
                  </p>
                </div>
                <div className="inline-flex items-center gap-1 rounded-full bg-slate-950/80 px-2.5 py-1 border border-slate-700 text-[11px] text-slate-300">
                  <CalendarDays className="w-3.5 h-3.5 text-amber-400" />
                  <span>Real-time listings</span>
                </div>
              </div>

              <div className="space-y-3 max-h-[280px] overflow-y-auto pr-1">
                {loading ? (
                  Array.from({ length: 4 }).map((_, idx) => (
                    <div
                      key={idx}
                      className="flex items-center gap-3 p-2 rounded-xl bg-slate-950/70 border border-slate-800 animate-pulse"
                    >
                      <div className="h-12 w-12 rounded-xl bg-slate-800" />
                      <div className="flex-1 space-y-1.5">
                        <div className="h-3 w-32 bg-slate-800 rounded-full" />
                        <div className="h-2.5 w-24 bg-slate-800 rounded-full" />
                        <div className="h-2.5 w-20 bg-slate-800 rounded-full" />
                      </div>
                    </div>
                  ))
                ) : error ? (
                  <div className="text-sm text-red-300 bg-red-500/10 border border-red-500/40 rounded-xl px-3 py-2">
                    {error}
                  </div>
                ) : featured.length === 0 ? (
                  <p className="text-sm text-slate-400">
                    No upcoming events yet. Once events are created, you’ll see
                    highlights here.
                  </p>
                ) : (
                  featured.map((event) => (
                    <button
                      key={event._id}
                      type="button"
                      onClick={() => navigate(`/events/${event._id}`)}
                      className="flex items-center gap-3 p-2 rounded-xl bg-slate-950/80 border border-slate-800 hover:border-amber-500/80 hover:bg-slate-900/80 transition-all text-left w-full group"
                    >
                      <div className="relative h-12 w-12 rounded-xl overflow-hidden bg-linear-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center text-[10px] text-slate-300">
                        {event.images?.[0] ? (
                          <img
                            src={event.images[0]}
                            alt={event.title}
                            className="h-full w-full object-cover object-center transition-transform duration-500 group-hover:scale-105 group-hover:brightness-110"
                            loading="lazy"
                          />
                        ) : (
                          <span className="uppercase tracking-[0.18em]">
                            {event.category || "EVT"}
                          </span>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-slate-100 truncate">
                          {event.title}
                        </p>
                        <p className="text-[11px] text-slate-400 truncate">
                          {formatLocation(event.location)}
                        </p>
                        <p className="text-[11px] text-amber-300 mt-0.5">
                          {formatDate(event.date)} • {formatPrice(event.price)}
                        </p>
                      </div>
                      <ChevronRight className="w-4 h-4 text-slate-500 group-hover:text-amber-400 transition-colors" />
                    </button>
                  ))
                )}
              </div>

              <button
                type="button"
                onClick={() => navigate("/events")}
                className="mt-4 w-full inline-flex items-center justify-center gap-1.5 rounded-xl border border-slate-700 bg-slate-950/80 hover:border-amber-500/70 hover:bg-slate-900/80 text-xs text-slate-200 py-2.5 transition-all"
              >
                Browse all events
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Featured grid */}
      <section className="px-4 pb-16 sm:px-6 md:px-10 lg:px-16">
        <div className="max-w-6xl mx-auto">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-4">
            <div>
              <h2 className="text-lg md:text-xl font-semibold text-slate-50">
                Handpicked highlights
              </h2>
              <p className="text-xs md:text-sm text-slate-400">
                A quick snapshot of what’s coming up soon across categories.
              </p>
            </div>
            <button
              type="button"
              onClick={() => navigate("/events")}
              className="hidden sm:inline-flex items-center gap-1.5 text-xs text-amber-300 hover:text-amber-200"
            >
              View full listings
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {loading ? (
              Array.from({ length: 6 }).map((_, idx) => (
                <div
                  key={idx}
                  className="rounded-2xl bg-slate-900/80 border border-slate-800 p-4 animate-pulse"
                >
                  <div className="h-32 rounded-xl bg-slate-800 mb-3" />
                  <div className="h-3 w-32 bg-slate-800 rounded-full mb-2" />
                  <div className="h-2.5 w-24 bg-slate-800 rounded-full mb-1.5" />
                  <div className="h-2.5 w-20 bg-slate-800 rounded-full" />
                </div>
              ))
            ) : featured.length === 0 ? (
              <div className="col-span-full rounded-2xl bg-slate-900/80 border border-slate-800 p-6 text-sm text-slate-400">
                No events to display yet. Once admins add events, your homepage
                will show a mix of concerts, sports and more here.
              </div>
            ) : (
              featured.map((event) => (
                <button
                  key={event._id}
                  type="button"
                  onClick={() => navigate(`/events/${event._id}`)}
                  className="group rounded-2xl bg-slate-900/80 border border-slate-800 hover:border-amber-500/80 hover:-translate-y-1 transition-all p-4 text-left flex flex-col"
                >
                  <div className="relative h-40 w-full rounded-2xl overflow-hidden bg-linear-to-br from-slate-900 via-slate-800 to-slate-900 mb-3 shadow-md shadow-slate-900/40">
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
                  </div>

                  <p className="text-sm font-semibold text-slate-100">
                    {event.title}
                  </p>
                  <p className="text-xs text-slate-400 mt-1">
                    {formatLocation(event.location)}
                  </p>
                  <div className="mt-2 flex items-center justify-between text-[11px]">
                    <span className="text-amber-300">
                      {formatDate(event.date)}
                    </span>
                    <span className="text-slate-300">
                      {formatPrice(event.price)}
                    </span>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
