import React, { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft,
  CalendarDays,
  Clock,
  MapPin,
  Ticket,
  Heart,
  AlertTriangle,
} from "lucide-react";
import api from "../api/axios";
import { useAuth } from "../context/AuthContext";
import SeatPicker from "../components/SeatPicker";
import SVGSeatPicker from "../components/SVGSeatPicker";

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
  const parts = [loc.venue, loc.city, loc.state, loc.country].filter(Boolean);
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

// ── Determine which picker to show ───────────────────────────────
// Returns "svg" | "generic" | null
function pickerType(event) {
  if (!event) return null;
  if (event.venueType === "svg-stadium" || event.venueType === "svg-concert") {
    return "svg";
  }
  if (event.seatingLayout?.hasSeats || event.venueType) {
    return "generic";
  }
  return null;
}

export default function EventDetails() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [event, setEvent] = useState(null);
  const [loading, setLoading] = useState(true);
  const [qty, setQty] = useState(1);
  const [error, setError] = useState("");
  const [wishlistMessage, setWishlistMessage] = useState("");
  const [addingWishlist, setAddingWishlist] = useState(false);
  const [seatSelection, setSeatSelection] = useState(null);
  const [showSeatPicker, setShowSeatPicker] = useState(false);

  useEffect(() => {
    let active = true;

    const fetchEvent = async () => {
      try {
        setLoading(true);
        setError("");
        const res = await api.get(`/events/${id}`);
        if (!active) return;
        setEvent(res.data?.event || null);
      } catch (err) {
        if (!active) return;
        const msg =
          err?.response?.data?.error ||
          err?.response?.data?.message ||
          "We couldn't load this event. It may have been removed.";
        setError(msg);
      } finally {
        if (active) setLoading(false);
      }
    };

    if (id) fetchEvent();

    return () => {
      active = false;
    };
  }, [id]);

  const handleBook = () => {
    if (!event) return;
    if (pickerType(event)) {
      setShowSeatPicker(true);
      return;
    }
    const params = new URLSearchParams();
    params.set("eventId", event._id);
    params.set("qty", String(qty));
    navigate(`/checkout?${params.toString()}`);
  };

  // ── Unified seat confirm handler ──────────────────────────────
  // Works for both SVGSeatPicker and legacy SeatPicker payloads
  const handleSeatConfirm = (selection) => {
    setSeatSelection(selection);
    const params = new URLSearchParams();
    params.set("eventId", event._id);

    if (selection.seats) {
      params.set("qty", String(selection.qty ?? selection.seats.length));
      params.set(
        "seats",
        Array.isArray(selection.seats)
          ? selection.seats.join(",")
          : String(selection.seats),
      );
    } else if (selection.tickets) {
      const totalQty = selection.tickets.reduce((a, t) => a + t.qty, 0);
      params.set("qty", String(totalQty));
      params.set("tickets", JSON.stringify(selection.tickets));
    }

    if (selection.pricePerSeat) {
      params.set("pricePerSeat", String(selection.pricePerSeat));
    }
    if (selection.sectionId) {
      params.set("section", selection.sectionId);
    }
    if (selection.category) {
      params.set("category", selection.category);
    }

    setShowSeatPicker(false);
    navigate(`/checkout?${params.toString()}`);
  };

  const handleWishlist = async () => {
    if (!user) {
      setWishlistMessage("Sign in to save events to your wishlist.");
      return;
    }
    try {
      setAddingWishlist(true);
      setWishlistMessage("");
      await api.post(`/wishlist/${event._id}`);
      setWishlistMessage("Added to your wishlist.");
    } catch (err) {
      const msg =
        err?.response?.data?.error ||
        err?.response?.data?.message ||
        "We couldn't update your wishlist. Please try again.";
      setWishlistMessage(msg);
    } finally {
      setAddingWishlist(false);
    }
  };

  const isPastEvent = event?.isPastEvent ?? false;
  const availableTickets = event?.availableTickets ?? null;
  const pType = pickerType(event);

  return (
    <div className="min-h-screen bg-linear-to-br from-slate-950 via-slate-900 to-slate-950 text-slate-50">
      <div className="max-w-5xl mx-auto px-4 pt-20 pb-16 md:px-8 lg:px-10 lg:pt-24">
        {/* Back bar */}
        <div className="flex items-center justify-between mb-5">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="inline-flex items-center gap-1.5 text-xs text-slate-300 hover:text-amber-300"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Back
          </button>
        </div>

        {/* Loading */}
        {loading && (
          <div className="rounded-3xl bg-slate-900/80 border border-slate-800 p-6 animate-pulse">
            <div className="h-40 rounded-2xl bg-slate-800 mb-5" />
            <div className="h-5 w-56 bg-slate-800 rounded-full mb-3" />
            <div className="h-3 w-40 bg-slate-800 rounded-full mb-2" />
            <div className="h-3 w-32 bg-slate-800 rounded-full" />
          </div>
        )}

        {/* Error */}
        {!loading && error && (
          <div className="rounded-3xl bg-red-500/10 border border-red-500/40 p-6 flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-red-300 mt-0.5" />
            <div>
              <h2 className="text-sm font-semibold text-red-100">
                We couldn't find this event.
              </h2>
              <p className="text-xs text-red-200 mt-1">{error}</p>
            </div>
          </div>
        )}

        {/* Event card */}
        {!loading && !error && event && (
          <div className="rounded-3xl bg-slate-900/80 border border-slate-800 overflow-hidden shadow-2xl shadow-black/50">
            <div className="relative h-52 md:h-64 w-full bg-slate-800 overflow-hidden">
              {event.images?.[0] ? (
                <img
                  src={event.images[0]}
                  alt={event.title}
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="h-full w-full flex flex-col items-center justify-center text-xs text-slate-400">
                  <span className="uppercase tracking-[0.18em]">
                    {event.category || "Event"}
                  </span>
                  <span className="text-slate-500 mt-1">
                    Event artwork coming soon
                  </span>
                </div>
              )}
              <div className="absolute inset-0 bg-linear-to-t from-slate-950/90 via-slate-950/40 to-transparent" />
              <div className="absolute bottom-4 left-4 right-4 flex flex-col md:flex-row md:items-end md:justify-between gap-3">
                <div>
                  <p className="text-xs uppercase tracking-[0.2em] text-amber-300 mb-1">
                    {event.category || "Event"}
                  </p>
                  <h1 className="text-xl md:text-2xl font-semibold text-slate-50 max-w-2xl">
                    {event.title}
                  </h1>
                  <p className="text-xs text-slate-300 mt-1">
                    {formatLocation({
                      venue: event.venue,
                      ...(event.location || {}),
                    })}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <div className="rounded-2xl bg-slate-950/80 border border-slate-700 px-4 py-2 text-right">
                    <p className="text-[11px] text-slate-400">Ticket range</p>
                    <p className="text-sm font-semibold text-amber-300">
                      {formatPrice(event.price)}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Content */}
            <div className="p-5 md:p-7 lg:p-8 grid md:grid-cols-[minmax(0,1.4fr),minmax(0,1fr)] gap-8">
              {/* Left */}
              <div className="space-y-5">
                <div className="grid sm:grid-cols-2 gap-4">
                  <div className="rounded-2xl bg-slate-950/80 border border-slate-800 p-3 flex items-start gap-3">
                    <div className="rounded-xl bg-slate-900 p-2">
                      <CalendarDays className="w-4 h-4 text-amber-400" />
                    </div>
                    <div>
                      <p className="text-[11px] text-slate-400 uppercase tracking-[0.16em]">
                        Date
                      </p>
                      <p className="text-sm font-medium text-slate-100">
                        {formatDate(event.date)}
                      </p>
                    </div>
                  </div>

                  <div className="rounded-2xl bg-slate-950/80 border border-slate-800 p-3 flex items-start gap-3">
                    <div className="rounded-xl bg-slate-900 p-2">
                      <Clock className="w-4 h-4 text-amber-400" />
                    </div>
                    <div>
                      <p className="text-[11px] text-slate-400 uppercase tracking-[0.16em]">
                        Time
                      </p>
                      <p className="text-sm font-medium text-slate-100">
                        {event.time || "Check event details"}
                      </p>
                    </div>
                  </div>

                  <div className="sm:col-span-2 rounded-2xl bg-slate-950/80 border border-slate-800 p-3 flex items-start gap-3">
                    <div className="rounded-xl bg-slate-900 p-2">
                      <MapPin className="w-4 h-4 text-amber-400" />
                    </div>
                    <div>
                      <p className="text-[11px] text-slate-400 uppercase tracking-[0.16em]">
                        Venue
                      </p>
                      <p className="text-sm font-medium text-slate-100">
                        {event.venue || "Venue to be announced"}
                      </p>
                      <p className="text-xs text-slate-400 mt-1">
                        {formatLocation({
                          venue: null,
                          ...(event.location || {}),
                        })}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="rounded-2xl bg-slate-950/80 border border-slate-800 p-4">
                  <p className="text-[11px] text-slate-400 uppercase tracking-[0.16em] mb-2">
                    About this event
                  </p>
                  <p className="text-sm text-slate-200 leading-relaxed whitespace-pre-line">
                    {event.description ||
                      "No additional description has been added for this event yet. Your ticket will still include all relevant entry details once your order is confirmed."}
                  </p>
                </div>
              </div>

              {/* Right: booking card */}
              <div className="space-y-4">
                <div className="rounded-2xl bg-slate-950/90 border border-slate-800 p-4 md:p-5 shadow-lg shadow-black/30">
                  <div className="flex items-center justify-between mb-3">
                    <h2 className="text-sm font-semibold text-slate-100">
                      Book tickets
                    </h2>
                  </div>

                  {/* Only show qty picker for non-SVG events */}
                  {pType !== "svg" && (
                    <div className="space-y-3">
                      <div className="space-y-1">
                        <label className="text-[11px] text-slate-400">
                          Number of tickets
                        </label>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => setQty((q) => Math.max(1, q - 1))}
                            className="w-8 h-8 rounded-xl bg-slate-900 border border-slate-700 text-slate-200 text-lg leading-none hover:border-amber-500/70"
                          >
                            –
                          </button>
                          <input
                            type="number"
                            min={1}
                            max={availableTickets || undefined}
                            value={qty}
                            onChange={(e) => {
                              const val = Number(e.target.value || 1);
                              if (availableTickets) {
                                setQty(
                                  Math.min(
                                    Math.max(1, val),
                                    Number(availableTickets),
                                  ),
                                );
                              } else {
                                setQty(Math.max(1, val));
                              }
                            }}
                            className="w-16 text-center rounded-xl bg-slate-900 border border-slate-700 text-sm text-slate-50 focus:outline-none focus:ring-1 focus:ring-amber-500/70 focus:border-amber-500/70"
                          />
                          <button
                            type="button"
                            onClick={() =>
                              setQty((q) =>
                                availableTickets
                                  ? Math.min(q + 1, availableTickets)
                                  : q + 1,
                              )
                            }
                            className="w-8 h-8 rounded-xl bg-slate-900 border border-slate-700 text-slate-200 text-lg leading-none hover:border-amber-500/70"
                          >
                            +
                          </button>
                        </div>
                      </div>

                      <div className="rounded-xl bg-slate-900 border border-slate-800 p-3 text-xs flex justify-between items-center">
                        <div>
                          <p className="text-slate-400">Estimated total</p>
                          <p className="text-sm font-semibold text-amber-300">
                            {(() => {
                              const base =
                                event.price?.min || event.price?.max || 0;
                              const curr = event.price?.currency || "USD";
                              const sym =
                                curr === "USD"
                                  ? "$"
                                  : curr === "NGN"
                                    ? "₦"
                                    : curr === "GBP"
                                      ? "£"
                                      : curr === "EUR"
                                        ? "€"
                                        : "";
                              const total = base * qty;
                              if (!base) return "To be confirmed at checkout";
                              return `${sym}${total.toLocaleString()} (${qty} × ${sym}${base.toLocaleString()})`;
                            })()}
                          </p>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* SVG event — show seat map hint */}
                  {pType === "svg" && (
                    <div className="rounded-xl bg-slate-900 border border-slate-800 p-3 mb-3">
                      <p className="text-[11px] text-slate-400">
                        Select your section on the interactive stadium map.
                        Prices vary by section.
                      </p>
                      <p className="text-xs text-amber-300 mt-1 font-medium">
                        {formatPrice(event.price)}
                      </p>
                    </div>
                  )}

                  <button
                    type="button"
                    onClick={handleBook}
                    disabled={isPastEvent || availableTickets === 0}
                    className="mt-4 w-full inline-flex items-center justify-center gap-2 rounded-xl bg-amber-500 hover:bg-amber-400 disabled:bg-amber-500/40 text-slate-950 font-semibold text-sm py-3 transition-all shadow-lg shadow-amber-500/30"
                  >
                    <Ticket className="w-4 h-4" />
                    {isPastEvent
                      ? "Event has ended"
                      : availableTickets === 0
                        ? "Sold out"
                        : pType
                          ? "Choose seats"
                          : "Continue to checkout"}
                  </button>

                  {/* {!user && !isPastEvent && (
                    <p className="mt-2 text-[11px] text-slate-400">
                      You'll need to sign in or create an account to complete
                      your booking.
                    </p>
                  )} */}
                </div>

                {/* Wishlist */}
                {/* <div className="rounded-2xl bg-slate-950/90 border border-slate-800 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-medium text-slate-100">
                        Save for later
                      </p>
                      <p className="text-xs text-slate-400 mt-1">
                        Add this event to your wishlist so you can find it
                        quickly when you're ready to book.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={handleWishlist}
                      disabled={addingWishlist}
                      className="inline-flex items-center justify-center rounded-full bg-slate-900 border border-slate-700 p-2 hover:border-amber-500/80 hover:text-amber-400 text-slate-200 transition-all"
                    >
                      <Heart className="w-4 h-4" />
                    </button>
                  </div>
                  {wishlistMessage && (
                    <p className="mt-2 text-[11px] text-slate-300">
                      {wishlistMessage}
                    </p>
                  )}
                </div> */}

                <p className="text-[11px] text-slate-500">
                  Once your payment is confirmed, KivraTickets will email your QR
                  ticket(s) along with a full breakdown of your order and entry
                  instructions.
                </p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ── SVG Seat Picker modal ── */}
      {showSeatPicker && event && pType === "svg" && (
        <SVGSeatPicker
          event={event}
          onConfirm={handleSeatConfirm}
          onClose={() => setShowSeatPicker(false)}
        />
      )}

      {/* ── Legacy Seat Picker modal ── */}
      {showSeatPicker && event && pType === "generic" && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-start justify-center overflow-y-auto p-4 pt-20">
          <div className="w-full max-w-4xl">
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs text-slate-400">Select your seats</p>
              <button
                type="button"
                onClick={() => setShowSeatPicker(false)}
                className="text-xs text-slate-400 hover:text-slate-100 border border-slate-700 rounded-lg px-3 py-1"
              >
                Close
              </button>
            </div>
            <SeatPicker event={event} onConfirm={handleSeatConfirm} />
          </div>
        </div>
      )}
    </div>
  );
}
