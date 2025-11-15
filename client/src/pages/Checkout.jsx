import React, { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  ArrowLeft,
  CalendarDays,
  MapPin,
  Ticket,
  CreditCard,
  Banknote,
  AlertTriangle,
  ShieldCheck,
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
  const [qty, setQty] = useState(qtyFromUrl > 0 ? qtyFromUrl : 1);

  const [event, setEvent] = useState(null);
  const [loadingEvent, setLoadingEvent] = useState(true);
  const [eventError, setEventError] = useState("");

  const [paymentMethod, setPaymentMethod] = useState("credit_card");
  const [processingOrder, setProcessingOrder] = useState(false);
  const [orderError, setOrderError] = useState("");
  const [orderSuccess, setOrderSuccess] = useState("");

  const [card, setCard] = useState({
    cardNumber: "",
    cardHolderName: "",
    expiryDate: "",
    cvv: "",
    street: "",
    city: "",
    state: "",
    zipCode: "",
    country: "",
  });

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

  useEffect(() => {
    if (!user) {
      // If not logged in, gently push to login but allow them to come back
      navigate("/login", {
        state: {
          from: `/checkout?eventId=${eventId}&qty=${qty}`,
          message: "Sign in to complete your ticket purchase.",
        },
      });
    }
  }, [user, navigate, eventId, qty]);

  const basePrice = useMemo(() => {
    if (!event?.price) return 0;
    return event.price.min || event.price.max || 0;
  }, [event]);

  const currency = event?.price?.currency || "USD";
  const symbol = currencySymbol(currency);

  const total = basePrice * qty;

  const handleCardChange = (field, value) => {
    setCard((prev) => ({ ...prev, [field]: value }));
    setOrderError("");
  };

  const handlePlaceOrder = async (e) => {
    e.preventDefault();
    setOrderError("");
    setOrderSuccess("");

    if (!event) {
      setOrderError("Event not found. Please go back and try again.");
      return;
    }

    if (!user) {
      setOrderError("You need to be signed in to place an order.");
      return;
    }

    if (qty < 1) {
      setOrderError("Please select at least one ticket.");
      return;
    }

    if (paymentMethod === "credit_card") {
      if (
        !card.cardNumber ||
        !card.cardHolderName ||
        !card.expiryDate ||
        !card.cvv || !card.street ||
        !card.city ||
        !card.state ||
        !card.country
      ) {
        setOrderError(
          "Please complete all required credit card fields before continuing."
        );
        return;
      }
    }

    try {
      setProcessingOrder(true);

      const tickets = Array.from({ length: qty }).map(() => ({
        seatNumber: "", // optional for now
        price: basePrice,
        currency,
      }));

      const paymentDetails =
        paymentMethod === "credit_card"
          ? {
              cardNumber: card.cardNumber,
              cardHolderName: card.cardHolderName,
              expiryDate: card.expiryDate,
              cvv: card.cvv,
              billingAddress: {
                street: card.street,
                city: card.city,
                state: card.state,
                zipCode: card.zipCode,
                country: card.country,
              },
            }
          : null;

      const res = await api.post("/orders", {
        eventId: event._id,
        tickets,
        paymentMethod,
        paymentDetails,
      });

      setOrderSuccess(
        res.data?.message ||
          "Your order has been placed. Watch your email for confirmation and QR tickets."
      );

      // Optional: navigate to "My Orders" after a little delay
      setTimeout(() => {
        navigate("/my-orders");
      }, 1600);
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
        {/* Top bar */}
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
            <span>Secure checkout • Encrypted payment details</span>
          </div>
        </div>

        {/* Main card */}
        <div className="grid md:grid-cols-[minmax(0,1.2fr),minmax(0,1.1fr)] gap-6 md:gap-8">
          {/* Left: Event summary */}
          <div className="rounded-3xl bg-slate-900/80 border border-slate-800 p-5 md:p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <p className="text-[11px] text-slate-400 uppercase tracking-[0.18em] mb-1">
                  Order summary
                </p>
                <p className="text-sm font-semibold text-slate-50">
                  Review your event details before paying.
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
                {/* Event mini card */}
                <div className="rounded-2xl bg-slate-950/80 border border-slate-800 p-3 flex gap-3 mb-4">
                  <div className="h-16 w-16 rounded-xl bg-slate-800 overflow-hidden shrink-0">
                    {event.images?.[0] ? (
                      // eslint-disable-next-line jsx-a11y/alt-text
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

                {/* Ticket breakdown */}
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
                      <span className="text-slate-300">
                        Number of tickets
                      </span>
                      <span className="text-slate-100 font-medium">
                        {qty}
                      </span>
                    </div>
                    <div className="flex items-center justify-between pt-1 border-t border-slate-800 mt-1">
                      <span className="text-slate-300">Estimated total</span>
                      <span className="text-amber-300 font-semibold">
                        {basePrice
                          ? `${symbol}${total.toLocaleString()}`
                          : "To be confirmed"}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-500 mt-1">
                      Final total may include any organiser fees or taxes,
                      which will be reflected in your order confirmation email.
                    </p>
                  </div>
                </div>

                <p className="text-[11px] text-slate-500">
                  Your QR ticket(s) will be sent to{" "}
                  <span className="font-semibold text-slate-200">
                    {user?.email || "your account email"}
                  </span>{" "}
                  after the payment is confirmed.
                </p>
              </>
            )}
          </div>

          {/* Right: Payment form */}
          <form
            onSubmit={handlePlaceOrder}
            className="rounded-3xl bg-slate-900/80 border border-slate-800 p-5 md:p-6 flex flex-col gap-4"
          >
            <div className="flex items-center justify-between mb-1">
              <div>
                <p className="text-[11px] text-slate-400 uppercase tracking-[0.18em] mb-1">
                  Payment
                </p>
                <p className="text-sm font-semibold text-slate-50">
                  Choose how you want to pay.
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

            {/* Payment method selector */}
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setPaymentMethod("credit_card")}
                className={`rounded-2xl border px-3 py-3 text-left text-xs flex flex-col gap-1 ${
                  paymentMethod === "credit_card"
                    ? "border-amber-500/80 bg-slate-950/90"
                    : "border-slate-800 bg-slate-950/60 hover:border-slate-700"
                }`}
              >
                <div className="flex items-center gap-2">
                  <CreditCard className="w-4 h-4 text-amber-400" />
                  <span className="font-semibold text-slate-100">
                    Card payment
                  </span>
                </div>
                <span className="text-[11px] text-slate-400">
                  Pay securely with your card details.
                </span>
              </button>

              <button
                type="button"
                onClick={() => setPaymentMethod("paypal")}
                className={`rounded-2xl border px-3 py-3 text-left text-xs flex flex-col gap-1 ${
                  paymentMethod === "paypal"
                    ? "border-amber-500/80 bg-slate-950/90"
                    : "border-slate-800 bg-slate-950/60 hover:border-slate-700"
                }`}
              >
                <div className="flex items-center gap-2">
                  <Banknote className="w-4 h-4 text-amber-400" />
                  <span className="font-semibold text-slate-100">
                    Manual payment
                  </span>
                </div>
                <span className="text-[11px] text-slate-400">
                  Pay via PayPal / CashApp / Zelle as configured by admin.
                </span>
              </button>
            </div>

            {/* Payment details */}
            {paymentMethod === "credit_card" ? (
              <div className="space-y-3 mt-2">
                <div className="space-y-1">
                  <label className="text-[11px] text-slate-400">
                    Card number
                  </label>
                  <input
                    type="text"
                    value={card.cardNumber}
                    onChange={(e) =>
                      handleCardChange("cardNumber", e.target.value)
                    }
                    placeholder="1234 5678 9012 3456"
                    className="w-full rounded-xl bg-slate-950/80 border border-slate-800 px-3 py-2 text-sm text-slate-50 placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-amber-500/70 focus:border-amber-500/70"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[11px] text-slate-400">
                    Name on card
                  </label>
                  <input
                    type="text"
                    value={card.cardHolderName}
                    onChange={(e) =>
                      handleCardChange("cardHolderName", e.target.value)
                    }
                    placeholder="As printed on the card"
                    className="w-full rounded-xl bg-slate-950/80 border border-slate-800 px-3 py-2 text-sm text-slate-50 placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-amber-500/70 focus:border-amber-500/70"
                  />
                </div>
                <div className="grid grid-cols-[minmax(0,1fr),minmax(0,0.7fr)] gap-3">
                  <div className="space-y-1">
                    <label className="text-[11px] text-slate-400">
                      Expiry (MM/YY)
                    </label>
                    <input
                      type="text"
                      value={card.expiryDate}
                      onChange={(e) =>
                        handleCardChange("expiryDate", e.target.value)
                      }
                      placeholder="08/29"
                      className="w-full rounded-xl bg-slate-950/80 border border-slate-800 px-3 py-2 text-sm text-slate-50 placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-amber-500/70 focus:border-amber-500/70"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[11px] text-slate-400">CVV</label>
                    <input
                      type="password"
                      value={card.cvv}
                      onChange={(e) =>
                        handleCardChange("cvv", e.target.value)
                      }
                      placeholder="123"
                      className="w-full rounded-xl bg-slate-950/80 border border-slate-800 px-3 py-2 text-sm text-slate-50 placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-amber-500/70 focus:border-amber-500/70"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] text-slate-400">
                    Billing address
                  </label>
                  <input
                    type="text"
                    value={card.street}
                    onChange={(e) =>
                      handleCardChange("street", e.target.value)
                    }
                    placeholder="Street address"
                    className="w-full rounded-xl bg-slate-950/80 border border-slate-800 px-3 py-2 text-sm text-slate-50 placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-amber-500/70 focus:border-amber-500/70 mb-2"
                  />
                  <div className="grid grid-cols-2 gap-2 mb-2">
                    <input
                      type="text"
                      value={card.city}
                      onChange={(e) =>
                        handleCardChange("city", e.target.value)
                      }
                      placeholder="City"
                      className="w-full rounded-xl bg-slate-950/80 border border-slate-800 px-3 py-2 text-sm text-slate-50 placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-amber-500/70 focus:border-amber-500/70"
                    />
                    <input
                      type="text"
                      value={card.state}
                      onChange={(e) =>
                        handleCardChange("state", e.target.value)
                      }
                      placeholder="State"
                      className="w-full rounded-xl bg-slate-950/80 border border-slate-800 px-3 py-2 text-sm text-slate-50 placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-amber-500/70 focus:border-amber-500/70"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      type="text"
                      value={card.zipCode}
                      onChange={(e) =>
                        handleCardChange("zipCode", e.target.value)
                      }
                      placeholder="Postal code"
                      className="w-full rounded-xl bg-slate-950/80 border border-slate-800 px-3 py-2 text-sm text-slate-50 placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-amber-500/70 focus:border-amber-500/70"
                    />
                    <input
                      type="text"
                      value={card.country}
                      onChange={(e) =>
                        handleCardChange("country", e.target.value)
                      }
                      placeholder="Country"
                      className="w-full rounded-xl bg-slate-950/80 border border-slate-800 px-3 py-2 text-sm text-slate-50 placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-amber-500/70 focus:border-amber-500/70"
                    />
                  </div>
                </div>

                <p className="text-[11px] text-slate-500">
                  Your card details are used only to validate this order and are
                  stored securely according to the configuration of this
                  environment.
                </p>
              </div>
            ) : (
              <div className="space-y-3 mt-2 text-xs text-slate-300">
                <p>
                  You’ve chosen to pay via{" "}
                  <span className="font-semibold">PayPal / CashApp / Zelle</span>{" "}.
                </p>
                <p className="text-slate-400">
                  After placing your order, you’ll receive an email with
                  specific payment instructions. Once the organiser confirms
                  your payment, your QR ticket(s) will be issued.
                </p>
                <p className="text-[11px] text-slate-500">
                  Make sure you follow the instructions exactly so your payment
                  can be matched to your order quickly.
                </p>
              </div>
            )}

            <div className="mt-3 pt-3 border-t border-slate-800 flex flex-col gap-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-300">Amount to pay</span>
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
                  !event ||
                  !user
                }
                className="mt-1 w-full inline-flex items-center justify-center gap-2 rounded-xl bg-amber-500 hover:bg-amber-400 disabled:bg-amber-500/40 text-slate-950 font-semibold text-sm py-3 transition-all shadow-lg shadow-amber-500/30"
              >
                {processingOrder ? (
                  <>
                    <span className="h-4 w-4 border-2 border-slate-900/70 border-t-transparent rounded-full animate-spin" />
                    Processing your order...
                  </>
                ) : (
                  <>
                    <Ticket className="w-4 h-4" />
                    Place order & send tickets
                  </>
                )}
              </button>

              <p className="text-[10px] text-slate-500 text-center mt-1">
                By placing this order, you agree to the organiser&apos;s event
                policy and GoTickets&apos; terms for ticket delivery and
                refunds.
              </p>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
