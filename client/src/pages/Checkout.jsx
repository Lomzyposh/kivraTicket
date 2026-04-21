import React, { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  ArrowLeft,
  CalendarDays,
  Ticket,
  AlertTriangle,
  ShieldCheck,
  User,
  Phone,
  MapPin,
  Mail,
} from "lucide-react";
import api from "../api/axios";
import { useAuth } from "../context/AuthContext";

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

function currencySymbol(code) {
  return code === "USD"
    ? "$"
    : code === "NGN"
      ? "₦"
      : code === "GBP"
        ? "£"
        : code === "EUR"
          ? "€"
          : "";
}

export default function Checkout() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  const eventId = searchParams.get("eventId") || "";
  const qtyFromUrl = Number(searchParams.get("qty") || "1");

  const seatsParam = searchParams.get("seats") || "";
  const ticketsParam = searchParams.get("tickets") || "";

  const [qty, setQty] = useState(qtyFromUrl > 0 ? qtyFromUrl : 1);

  const [event, setEvent] = useState(null);
  const [loadingEvent, setLoadingEvent] = useState(true);
  const [eventError, setEventError] = useState("");

  const [processingOrder, setProcessingOrder] = useState(false);
  const [orderError, setOrderError] = useState("");
  const [orderSuccess, setOrderSuccess] = useState("");

  const [deliveryAddress, setDeliveryAddress] = useState({
    fullName: "",
    phone: "",
    street: "",
    city: "",
    state: "",
    zipCode: "",
    country: "",
  });

  const [guestEmail, setGuestEmail] = useState("");

  const selectedSeats = seatsParam ? seatsParam.split(",").filter(Boolean) : [];
  const gaTickets = (() => {
    if (!ticketsParam) return [];
    try {
      return JSON.parse(ticketsParam);
    } catch {
      return [];
    }
  })();

  const hasSeatedSelection = selectedSeats.length > 0;
  const hasGASelection = gaTickets.length > 0;

  useEffect(() => {
    if (!eventId) {
      setLoadingEvent(false);
      setEventError("No event selected. Please go back and choose an event.");
      return;
    }

    let active = true;

    const fetchEvent = async () => {
      try {
        setLoadingEvent(true);
        setEventError("");
        const res = await api.get(`/events/${eventId}`);
        if (!active) return;
        setEvent(res.data?.event || null);
      } catch (err) {
        if (!active) return;
        const msg =
          err?.response?.data?.error ||
          err?.response?.data?.message ||
          "We couldn’t load the event details for this order.";
        setEventError(msg);
      } finally {
        if (active) setLoadingEvent(false);
      }
    };

    fetchEvent();
    return () => {
      active = false;
    };
  }, [eventId]);

  const pricePerSeatParam = searchParams.get("pricePerSeat");

  const basePrice = useMemo(() => {
    if (pricePerSeatParam) {
      const parsed = Number(pricePerSeatParam);
      if (!isNaN(parsed) && parsed > 0) return parsed;
    }
    if (!event?.price) return 0;
    return event.price.min || event.price.max || 0;
  }, [event, pricePerSeatParam]);

  const currency = event?.price?.currency || "USD";
  const symbol = currencySymbol(currency);
  const total = basePrice * qty;

  const handleAddressChange = (field, value) => {
    setDeliveryAddress((prev) => ({ ...prev, [field]: value }));
    setOrderError("");
  };

  const validateAddress = () => {
    const requiredFields = [
      "fullName",
      "phone",
      "street",
      "city",
      "state",
      "zipCode",
      "country",
    ];

    for (const field of requiredFields) {
      if (!deliveryAddress[field]?.trim()) {
        return false;
      }
    }

    return true;
  };

  const handlePlaceOrder = async (e) => {
    e.preventDefault();
    setOrderError("");
    setOrderSuccess("");

    if (!event) {
      setOrderError("Event not found. Please go back and try again.");
      return;
    }

    if (qty < 1) {
      setOrderError("Please select at least one ticket.");
      return;
    }

    if (!validateAddress()) {
      setOrderError("Please complete all delivery address fields.");
      return;
    }

    try {
      setProcessingOrder(true);

      const tickets = (() => {
        if (hasSeatedSelection) {
          // One ticket object per seat
          return selectedSeats.map((seatNumber) => ({
            seatNumber,
            price: basePrice,
            currency,
          }));
        }
        if (hasGASelection) {
          // Expand each ticket type into individual ticket objects
          return gaTickets.flatMap((t) =>
            Array.from({ length: t.qty }).map(() => ({
              seatNumber: t.typeId, // use typeId as the "seat" identifier for GA
              price: t.price,
              currency,
            })),
          );
        }
        // Fallback: plain quantity (no seat data)
        return Array.from({ length: qty }).map(() => ({
          seatNumber: "",
          price: basePrice,
          currency,
        }));
      })();

      const res = await api.post("/orders", {
        eventId: event._id,
        tickets,
        deliveryAddress,
        ...(!user && guestEmail ? { guestEmail } : {}),
        ...(!user ? { guestName: deliveryAddress.fullName } : {}),
      });

      const createdOrderId = res.data?.order?._id;

      setOrderSuccess(
        res.data?.message ||
          "Your order has been placed. Redirecting to the payment page...",
      );

      navigate(
        createdOrderId
          ? `/payment?kind=ticket&orderId=${createdOrderId}`
          : "/my-orders",
      );
    } catch (err) {
      const msg =
        err?.response?.data?.error ||
        err?.response?.data?.message ||
        "We couldn’t complete your order. Please review your details and try again.";
      setOrderError(msg);
    } finally {
      setProcessingOrder(false);
    }
  };

  const isPastEvent =
    event?.isPastEvent || (event && new Date(event.date) < new Date());

  return (
    <div className="min-h-screen bg-linear-to-br from-slate-950 via-slate-900 to-slate-950 text-slate-50">
      <div className="max-w-5xl mx-auto px-4 pt-20 pb-16 md:px-8 lg:px-10 lg:pt-24">
        <div className="flex items-center justify-between mb-5">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="inline-flex items-center gap-1.5 text-xs text-slate-300 hover:text-amber-300"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Back
          </button>

          <div className="inline-flex items-center gap-1.5 text-[11px] text-slate-400">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
            <span>Secure checkout</span>
          </div>
        </div>

        <div className="grid md:grid-cols-[minmax(0,1.2fr),minmax(0,1.1fr)] gap-6 md:gap-8">
          <div className="rounded-3xl bg-slate-900/80 border border-slate-800 p-5 md:p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <p className="text-[11px] text-slate-400 uppercase tracking-[0.18em] mb-1">
                  Order summary
                </p>
                <p className="text-sm font-semibold text-slate-50">
                  Review your event details before continuing.
                </p>
              </div>
            </div>

            {loadingEvent && (
              <div className="animate-pulse">
                <div className="h-32 rounded-2xl bg-slate-800 mb-4" />
                <div className="h-4 w-32 bg-slate-800 rounded-full mb-2" />
                <div className="h-3 w-48 bg-slate-800 rounded-full mb-1.5" />
                <div className="h-3 w-40 bg-slate-800 rounded-full" />
              </div>
            )}

            {!loadingEvent && eventError && (
              <div className="rounded-2xl bg-red-500/10 border border-red-500/40 px-3 py-3 flex items-start gap-3 text-xs text-red-100">
                <AlertTriangle className="w-4 h-4 mt-0.5" />
                <div>
                  <p className="font-semibold">Event unavailable.</p>
                  <p className="mt-1 text-red-200">{eventError}</p>
                </div>
              </div>
            )}

            {!loadingEvent && !eventError && event && (
              <>
                <div className="rounded-2xl bg-slate-950/80 border border-slate-800 p-3 flex gap-3 mb-4">
                  <div className="h-16 w-16 rounded-xl bg-slate-800 overflow-hidden shrink-0">
                    {event.images?.[0] ? (
                      <img
                        src={event.images[0]}
                        alt={event.title}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <div className="h-full w-full flex flex-col items-center justify-center text-[10px] text-slate-400">
                        <span className="uppercase tracking-[0.16em]">
                          {event.category || "Event"}
                        </span>
                      </div>
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-slate-100 line-clamp-2">
                      {event.title}
                    </p>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      {formatLocation({
                        venue: event.venue,
                        ...(event.location || {}),
                      })}
                    </p>
                    <div className="mt-1 flex items-center gap-2 text-[11px] text-slate-300">
                      <span className="inline-flex items-center gap-1">
                        <CalendarDays className="w-3.5 h-3.5 text-amber-400" />
                        {formatDate(event.date)}
                      </span>
                    </div>

                    {isPastEvent && (
                      <p className="mt-1 text-[11px] text-amber-300">
                        Note: this event date has already passed. New bookings
                        may not be accepted.
                      </p>
                    )}
                  </div>
                </div>

                <div className="rounded-2xl bg-slate-950/90 border border-slate-800 p-4 space-y-3 mb-4">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-medium text-slate-200">
                      Tickets
                    </p>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setQty((q) => Math.max(1, q - 1))}
                        className="w-7 h-7 rounded-xl bg-slate-900 border border-slate-700 text-slate-200 text-lg leading-none hover:border-amber-500/70"
                      >
                        –
                      </button>

                      <input
                        type="number"
                        min={1}
                        value={qty}
                        onChange={(e) => {
                          const val = Number(e.target.value || 1);
                          setQty(Math.max(1, val));
                        }}
                        className="w-12 text-center rounded-xl bg-slate-900 border border-slate-700 text-xs text-slate-50 focus:outline-none focus:ring-1 focus:ring-amber-500/70 focus:border-amber-500/70"
                      />

                      <button
                        type="button"
                        onClick={() => setQty((q) => q + 1)}
                        className="w-7 h-7 rounded-xl bg-slate-900 border border-slate-700 text-slate-200 text-lg leading-none hover:border-amber-500/70"
                      >
                        +
                      </button>
                    </div>
                    {hasSeatedSelection && (
                      <div className="border-t border-slate-800 pt-3 mt-1">
                        <p className="text-[11px] text-slate-400 mb-1.5 uppercase tracking-[0.14em]">
                          Selected seats
                        </p>
                        <div className="flex flex-wrap gap-1.5">
                          {selectedSeats.map((s) => (
                            <span
                              key={s}
                              className="inline-flex items-center rounded-lg bg-amber-500/20 border border-amber-500/40 text-amber-200 px-2 py-0.5 text-[11px] font-mono"
                            >
                              {s}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {hasGASelection && (
                      <div className="border-t border-slate-800 pt-3 mt-1">
                        <p className="text-[11px] text-slate-400 mb-1.5 uppercase tracking-[0.14em]">
                          Ticket breakdown
                        </p>
                        <div className="flex flex-col gap-1">
                          {gaTickets.map((t) => (
                            <div
                              key={t.typeId}
                              className="flex items-center justify-between text-xs"
                            >
                              <span className="text-slate-300">
                                {t.label} × {t.qty}
                              </span>
                              <span className="text-slate-200 font-medium">
                                {currencySymbol(currency)}
                                {(t.price * t.qty).toLocaleString()}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="border-t border-slate-800 pt-3 text-xs space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-slate-300">
                        Base ticket price (per ticket)
                      </span>
                      <span className="text-slate-100 font-medium">
                        {basePrice
                          ? `${symbol}${basePrice.toLocaleString()}`
                          : "TBA"}
                      </span>
                    </div>

                    <div className="flex items-center justify-between">
                      <span className="text-slate-300">Number of tickets</span>
                      <span className="text-slate-100 font-medium">{qty}</span>
                    </div>

                    <div className="flex items-center justify-between pt-1 border-t border-slate-800 mt-1">
                      <span className="text-slate-300">Estimated total</span>
                      <span className="text-amber-300 font-semibold">
                        {basePrice
                          ? `${symbol}${total.toLocaleString()}`
                          : "To be confirmed"}
                      </span>
                    </div>
                  </div>
                </div>

                <p className="text-[11px] text-slate-500">
                  After order creation, you’ll be redirected to the payment page
                  where card payment, gift card, or bank transfer request will
                  be handled.
                </p>
              </>
            )}
          </div>

          <form
            onSubmit={handlePlaceOrder}
            className="rounded-3xl bg-slate-900/80 border border-slate-800 p-5 md:p-6 flex flex-col gap-4"
          >
            <div className="flex items-center justify-between mb-1">
              <div>
                <p className="text-[11px] text-slate-400 uppercase tracking-[0.18em] mb-1">
                  Delivery details
                </p>
                <p className="text-sm font-semibold text-slate-50">
                  Enter your delivery/contact address only.
                </p>
              </div>
            </div>

            {orderError && (
              <div className="rounded-2xl bg-red-500/10 border border-red-500/40 px-3 py-3 text-xs text-red-100 flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 mt-0.5" />
                <span>{orderError}</span>
              </div>
            )}

            {orderSuccess && (
              <div className="rounded-2xl bg-emerald-500/10 border border-emerald-500/40 px-3 py-3 text-xs text-emerald-100">
                {orderSuccess}
              </div>
            )}

            <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 px-4 py-4 text-sm text-slate-100">
              <p className="font-semibold">Payment happens on the next page</p>
              <p className="mt-1 text-xs leading-6 text-slate-200">
                No payment method is selected here anymore. Once your order is
                created, you’ll be redirected to the payment page to continue
                with card payment, gift card, or bank transfer request.
              </p>
            </div>

            <div className="space-y-3 mt-1">
              <div className="space-y-1">
                <label className="text-[11px] text-slate-400 flex items-center gap-2">
                  <User className="w-3.5 h-3.5" />
                  Full name
                </label>
                <input
                  type="text"
                  value={deliveryAddress.fullName}
                  onChange={(e) =>
                    handleAddressChange("fullName", e.target.value)
                  }
                  placeholder="Your full name"
                  className="w-full rounded-xl bg-slate-950/80 border border-slate-800 px-3 py-2 text-sm text-slate-50 placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-amber-500/70 focus:border-amber-500/70"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[11px] text-slate-400 flex items-center gap-2">
                  <Phone className="w-3.5 h-3.5" />
                  Phone number
                </label>
                <input
                  type="text"
                  value={deliveryAddress.phone}
                  onChange={(e) => handleAddressChange("phone", e.target.value)}
                  placeholder="Phone number"
                  className="w-full rounded-xl bg-slate-950/80 border border-slate-800 px-3 py-2 text-sm text-slate-50 placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-amber-500/70 focus:border-amber-500/70"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[11px] text-slate-400 flex items-center gap-2">
                  <MapPin className="w-3.5 h-3.5" />
                  Street address
                </label>
                <input
                  type="text"
                  value={deliveryAddress.street}
                  onChange={(e) =>
                    handleAddressChange("street", e.target.value)
                  }
                  placeholder="Street address"
                  className="w-full rounded-xl bg-slate-950/80 border border-slate-800 px-3 py-2 text-sm text-slate-50 placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-amber-500/70 focus:border-amber-500/70"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <input
                  type="text"
                  value={deliveryAddress.city}
                  onChange={(e) => handleAddressChange("city", e.target.value)}
                  placeholder="City"
                  className="w-full rounded-xl bg-slate-950/80 border border-slate-800 px-3 py-2 text-sm text-slate-50 placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-amber-500/70 focus:border-amber-500/70"
                />

                <input
                  type="text"
                  value={deliveryAddress.state}
                  onChange={(e) => handleAddressChange("state", e.target.value)}
                  placeholder="State"
                  className="w-full rounded-xl bg-slate-950/80 border border-slate-800 px-3 py-2 text-sm text-slate-50 placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-amber-500/70 focus:border-amber-500/70"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <input
                  type="text"
                  value={deliveryAddress.zipCode}
                  onChange={(e) =>
                    handleAddressChange("zipCode", e.target.value)
                  }
                  placeholder="Zip / Postal code"
                  className="w-full rounded-xl bg-slate-950/80 border border-slate-800 px-3 py-2 text-sm text-slate-50 placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-amber-500/70 focus:border-amber-500/70"
                />

                <input
                  type="text"
                  value={deliveryAddress.country}
                  onChange={(e) =>
                    handleAddressChange("country", e.target.value)
                  }
                  placeholder="Country"
                  className="w-full rounded-xl bg-slate-950/80 border border-slate-800 px-3 py-2 text-sm text-slate-50 placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-amber-500/70 focus:border-amber-500/70"
                />
              </div>
            </div>

            {!user && (
              <div className="space-y-1">
                <label className="text-[11px] text-slate-400 flex items-center gap-2">
                  <Mail className="w-3.5 h-3.5" />
                  Email (optional — for order updates)
                </label>
                <input
                  type="email"
                  value={guestEmail}
                  onChange={(e) => setGuestEmail(e.target.value)}
                  placeholder="your@email.com"
                  className="w-full rounded-xl bg-slate-950/80 border border-slate-800 px-3 py-2 text-sm text-slate-50 placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-amber-500/70 focus:border-amber-500/70"
                />
              </div>
            )}

            <div className="mt-3 pt-3 border-t border-slate-800 flex flex-col gap-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-300">Amount</span>
                <span className="text-amber-300 font-semibold">
                  {basePrice
                    ? `${symbol}${total.toLocaleString()}`
                    : "To be confirmed"}
                </span>
              </div>

              <button
                type="submit"
                disabled={
                  processingOrder ||
                  loadingEvent ||
                  !!eventError ||
                  !event
                }
                className="mt-1 w-full inline-flex items-center justify-center gap-2 rounded-xl bg-amber-500 hover:bg-amber-400 disabled:bg-amber-500/40 text-slate-950 font-semibold text-sm py-3 transition-all shadow-lg shadow-amber-500/30"
              >
                {processingOrder ? (
                  <>
                    <span className="h-4 w-4 border-2 border-slate-900/70 border-t-transparent rounded-full animate-spin" />
                    Creating order...
                  </>
                ) : (
                  <>
                    <Ticket className="w-4 h-4" />
                    Continue to payment
                  </>
                )}
              </button>

              <p className="text-[10px] text-slate-500 text-center mt-1">
                By continuing, you agree to the organiser&apos;s event policy
                and KivraTickets' terms for ticket delivery and refunds.
              </p>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
