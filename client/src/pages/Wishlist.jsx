import React, { useEffect, useState } from "react";
import {
  ArrowLeft,
  Heart,
  Ticket,
  CalendarDays,
  MapPin,
  AlertTriangle,
  Trash2,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import api from "../api/axios";
import { useAuth } from "../context/AuthContext";

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

function formatLocation(event = {}) {
  const loc = event.location || {};
  const parts = [event.venue, loc.city, loc.state, loc.country].filter(Boolean);
  return parts.join(" • ") || "Location TBA";
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

export default function Wishlist() {
  const navigate = useNavigate();
  const { user } = useAuth();

  const [wishlist, setWishlist] = useState([]);
  const [loading, setLoading] = useState(true);
  const [pageError, setPageError] = useState("");
  const [actionMessage, setActionMessage] = useState("");

  useEffect(() => {
    if (!user) {
      navigate("/login", {
        state: {
          from: "/wishlist",
          message: "Sign in to view and manage your wishlist.",
        },
      });
      return;
    }

    let active = true;

    const fetchWishlist = async () => {
      try {
        setLoading(true);
        setPageError("");
        const res = await api.get("/wishlist");
        if (!active) return;
        setWishlist(res.data?.wishlist || []);
      } catch (err) {
        if (!active) return;
        const msg =
          err?.response?.data?.error ||
          err?.response?.data?.message ||
          "We couldn’t load your wishlist right now.";
        setPageError(msg);
      } finally {
        if (active) setLoading(false);
      }
    };

    fetchWishlist();

    return () => {
      active = false;
    };
  }, [user, navigate]);

  const handleRemove = async (eventId) => {
    try {
      setPageError("");
      setActionMessage("");
      await api.delete(`/wishlist/${eventId}`);
      setWishlist((prev) => prev.filter((e) => e._id !== eventId));
      setActionMessage("Event removed from your wishlist.");
    } catch (err) {
      const msg =
        err?.response?.data?.error ||
        err?.response?.data?.message ||
        "We couldn’t update your wishlist. Please try again.";
      setPageError(msg);
    }
  };

  const handleViewEvent = (id) => {
    navigate(`/events/${id}`);
  };

  return (
    <div className="min-h-screen bg-linear-to-br from-slate-950 via-slate-900 to-slate-950 text-slate-50">
      <div className="max-w-5xl mx-auto px-4 pt-20 pb-16 md:px-8 lg:px-10 lg:pt-24">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
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
              <Heart className="w-5 h-5 text-amber-400" />
              My wishlist
            </h1>
            <p className="mt-1 text-xs md:text-sm text-slate-400">
              Save events you&apos;re interested in and come back when
              you&apos;re ready to book.
            </p>
          </div>
        </div>

        {pageError && (
          <div className="mb-4 rounded-2xl bg-red-500/10 border border-red-500/40 px-4 py-3 text-xs text-red-100 flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 mt-0.5" />
            <span>{pageError}</span>
          </div>
        )}

        {actionMessage && !pageError && (
          <div className="mb-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/40 px-4 py-3 text-xs text-emerald-100">
            {actionMessage}
          </div>
        )}

        {/* Loading skeleton */}
        {loading && (
          <div className="grid sm:grid-cols-2 gap-4">
            {Array.from({ length: 4 }).map((_, idx) => (
              <div
                key={idx}
                className="rounded-3xl bg-slate-900/80 border border-slate-800 p-4 animate-pulse"
              >
                <div className="h-28 rounded-2xl bg-slate-800 mb-3" />
                <div className="h-3 w-32 bg-slate-800 rounded-full mb-2" />
                <div className="h-2.5 w-24 bg-slate-800 rounded-full mb-1.5" />
                <div className="h-2.5 w-20 bg-slate-800 rounded-full" />
              </div>
            ))}
          </div>
        )}

        {/* Empty state */}
        {!loading && !pageError && wishlist.length === 0 && (
          <div className="rounded-3xl bg-slate-900/80 border border-slate-800 p-6 flex flex-col items-center justify-center text-center">
            <Heart className="w-6 h-6 text-amber-400 mb-2" />
            <p className="text-sm font-semibold text-slate-100">
              Your wishlist is empty for now.
            </p>
            <p className="text-xs text-slate-400 mt-1 max-w-sm">
              Whenever you see an event you like, tap the heart icon to save it
              here. It&apos;s an easy way to keep track of shows, games and
              festivals you don&apos;t want to forget.
            </p>
            <button
              type="button"
              onClick={() => navigate("/events")}
              className="mt-3 inline-flex items-center gap-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-semibold px-4 py-2 shadow-lg shadow-amber-500/30"
            >
              <Ticket className="w-3.5 h-3.5" />
              Explore events
            </button>
          </div>
        )}

        {/* Wishlist grid */}
        {!loading && wishlist.length > 0 && (
          <div className="grid sm:grid-cols-2 gap-4">
            {wishlist.map((event) => (
              <div
                key={event._id}
                className="group rounded-3xl bg-slate-900/80 border border-slate-800 hover:border-amber-500/80 hover:-translate-y-1 transition-all p-4 flex flex-col"
              >
                <div className="relative h-28 w-full rounded-2xl bg-slate-800 overflow-hidden mb-3">
                  {event.images?.[0] ? (
                    // eslint-disable-next-line jsx-a11y/alt-text
                    <img
                      src={event.images[0]}
                      alt={event.title}
                      className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                  ) : (
                    <div className="h-full w-full flex flex-col items-center justify-center text-[11px] text-slate-400">
                      <span className="uppercase tracking-[0.18em]">
                        {event.category || "Event"}
                      </span>
                      <span className="text-slate-500 mt-1">
                        Image coming soon
                      </span>
                    </div>
                  )}
                  <button
                    type="button"
                    onClick={() => handleRemove(event._id)}
                    className="absolute top-2 right-2 rounded-full bg-slate-950/80 border border-slate-700 p-1.5 text-slate-300 hover:border-amber-500/70 hover:text-amber-300 transition-all"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>

                <p className="text-sm font-semibold text-slate-100 line-clamp-2">
                  {event.title}
                </p>
                <p className="text-xs text-slate-400 mt-1 line-clamp-2">
                  {event.description || "No description provided yet."}
                </p>

                <div className="mt-2 flex items-center justify-between text-[11px] text-slate-300">
                  <span className="inline-flex items-center gap-1">
                    <CalendarDays className="w-3.5 h-3.5 text-amber-400" />
                    {formatDate(event.date)}
                  </span>
                  <span className="text-slate-200">
                    {formatPrice(event.price)}
                  </span>
                </div>

                <p className="mt-1 text-[11px] text-slate-400">
                  {formatLocation(event)}
                </p>

                <div className="mt-3 flex items-center justify-between gap-2">
                  <button
                    type="button"
                    onClick={() => handleViewEvent(event._id)}
                    className="inline-flex items-center justify-center flex-1 gap-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-semibold px-3 py-2 transition-all shadow-lg shadow-amber-500/30"
                  >
                    <Ticket className="w-3.5 h-3.5" />
                    View event
                  </button>
                  <button
                    type="button"
                    onClick={() => handleRemove(event._id)}
                    className="inline-flex items-center justify-center rounded-xl border border-slate-700 bg-slate-950/80 hover:border-red-500/70 hover:text-red-200 text-[11px] text-slate-300 px-3 py-2 transition-all"
                  >
                    <Trash2 className="w-3.5 h-3.5 mr-1" />
                    Remove
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}