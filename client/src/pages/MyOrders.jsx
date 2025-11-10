import React, { useEffect, useState } from "react";
import {
  ArrowLeft,
  Ticket,
  QrCode,
  CalendarDays,
  MapPin,
  Clock,
  AlertTriangle,
  CreditCard,
  Banknote,
  RefreshCw,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
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

function formatLocation(event = {}) {
  const loc = event.location || {};
  const parts = [event.venue, loc.city, loc.state, loc.country].filter(Boolean);
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

function humanPaymentMethod(method) {
  if (!method) return "Unknown";
  switch (method) {
    case "credit_card":
      return "Credit card";
    case "paypal":
      return "PayPal";
    case "cashapp":
      return "CashApp";
    case "zelle":
      return "Zelle";
    default:
      return method;
  }
}

const STATUS_TAGS = {
  pending: {
    label: "Pending",
    className:
      "bg-amber-500/10 text-amber-300 border border-amber-500/40",
  },
  confirmed: {
    label: "Confirmed",
    className:
      "bg-emerald-500/10 text-emerald-300 border border-emerald-500/40",
  },
  cancelled: {
    label: "Cancelled",
    className: "bg-red-500/10 text-red-300 border border-red-500/40",
  },
  refunded: {
    label: "Refunded",
    className:
      "bg-slate-700/40 text-slate-200 border border-slate-500/60",
  },
};

export default function MyOrders() {
  const navigate = useNavigate();
  const { user } = useAuth();

  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [pageError, setPageError] = useState("");
  const [refreshing, setRefreshing] = useState(false);

  const [activeRefund, setActiveRefund] = useState(null);
  const [refundReason, setRefundReason] = useState("");
  const [refundLoading, setRefundLoading] = useState(false);
  const [refundMessage, setRefundMessage] = useState("");

  useEffect(() => {
    if (!user) {
      navigate("/login", {
        state: {
          from: "/my-orders",
          message: "Sign in to view your ticket orders.",
        },
      });
      return;
    }

    let active = true;

    const fetchOrders = async () => {
      try {
        setLoading(true);
        setPageError("");
        const res = await api.get("/orders/my-orders");
        if (!active) return;
        setOrders(res.data?.orders || []);
      } catch (err) {
        if (!active) return;
        const msg =
          err?.response?.data?.error ||
          err?.response?.data?.message ||
          "We couldn’t load your orders right now.";
        setPageError(msg);
      } finally {
        if (active) setLoading(false);
      }
    };

    fetchOrders();

    return () => {
      active = false;
    };
  }, [user, navigate]);

  const handleRefresh = async () => {
    try {
      setRefreshing(true);
      setPageError("");
      const res = await api.get("/orders/my-orders");
      setOrders(res.data?.orders || []);
    } catch (err) {
      const msg =
        err?.response?.data?.error ||
        err?.response?.data?.message ||
        "We couldn’t refresh your orders.";
      setPageError(msg);
    } finally {
      setRefreshing(false);
    }
  };

  const openRefundForm = (orderId, existingReason) => {
    setActiveRefund(orderId);
    setRefundReason(existingReason || "");
    setRefundMessage("");
    setPageError("");
  };

  const cancelRefundForm = () => {
    setActiveRefund(null);
    setRefundReason("");
    setRefundMessage("");
  };

  const submitRefundRequest = async (orderId) => {
    if (!refundReason.trim()) {
      setRefundMessage("Please describe briefly why you need a refund.");
      return;
    }

    try {
      setRefundLoading(true);
      setRefundMessage("");
      setPageError("");

      const res = await api.post(`/orders/${orderId}/refund`, {
        reason: refundReason.trim(),
      });

      setRefundMessage(
        res.data?.message ||
          "Your refund request has been submitted. An admin will review it shortly."
      );

      // Update local state for this order
      setOrders((prev) =>
        prev.map((o) =>
          o._id === orderId
            ? { ...o, refundRequested: true, refundReason: refundReason.trim() }
            : o
        )
      );

      setActiveRefund(null);
      setRefundReason("");
    } catch (err) {
      const msg =
        err?.response?.data?.error ||
        err?.response?.data?.message ||
        "We couldn’t submit your refund request. Please try again.";
      setRefundMessage(msg);
    } finally {
      setRefundLoading(false);
    }
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
            <h1 className="text-2xl md:text-3xl font-semibold text-slate-50">
              My ticket orders
            </h1>
            <p className="mt-1 text-xs md:text-sm text-slate-400">
              Track your upcoming events, past tickets and QR status all in one
              place.
            </p>
          </div>
          <button
            type="button"
            onClick={handleRefresh}
            disabled={loading || refreshing}
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
                Refresh
              </>
            )}
          </button>
        </div>

        {/* Error top-level */}
        {pageError && (
          <div className="mb-4 rounded-2xl bg-red-500/10 border border-red-500/40 px-4 py-3 text-xs text-red-100 flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 mt-0.5" />
            <span>{pageError}</span>
          </div>
        )}

        {/* Loading skeleton */}
        {loading && (
          <div className="space-y-4">
            {Array.from({ length: 3 }).map((_, idx) => (
              <div
                key={idx}
                className="rounded-3xl bg-slate-900/80 border border-slate-800 p-5 animate-pulse"
              >
                <div className="h-4 w-40 bg-slate-800 rounded-full mb-3" />
                <div className="h-4 w-28 bg-slate-800 rounded-full mb-4" />
                <div className="h-16 rounded-2xl bg-slate-800 mb-3" />
                <div className="h-3 w-32 bg-slate-800 rounded-full" />
              </div>
            ))}
          </div>
        )}

        {/* Empty state */}
        {!loading && !pageError && orders.length === 0 && (
          <div className="rounded-3xl bg-slate-900/80 border border-slate-800 p-6 flex flex-col items-center justify-center text-center">
            <Ticket className="w-6 h-6 text-amber-400 mb-2" />
            <p className="text-sm font-semibold text-slate-100">
              You haven&apos;t booked any tickets yet.
            </p>
            <p className="text-xs text-slate-400 mt-1 max-w-sm">
              Once you start booking events, your order history and QR ticket
              status will appear here.
            </p>
            <button
              type="button"
              onClick={() => navigate("/events")}
              className="mt-3 inline-flex items-center gap-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-semibold px-4 py-2 shadow-lg shadow-amber-500/30"
            >
              Browse events
            </button>
          </div>
        )}

        {/* Orders list */}
        {!loading && orders.length > 0 && (
          <div className="space-y-4">
            {orders.map((order) => {
              const event = order.event || {};
              const currency = order.currency || event.price?.currency || "USD";
              const symbol = currencySymbol(currency);
              const statusInfo =
                STATUS_TAGS[order.status] ||
                STATUS_TAGS.pending;

              const showQr = order.qrCodeSent && order.qrCode;

              const canRequestRefund =
                !order.refundRequested &&
                order.status !== "refunded" &&
                order.status !== "cancelled";

              return (
                <div
                  key={order._id}
                  className="rounded-3xl bg-slate-900/80 border border-slate-800 p-5 md:p-6"
                >
                  {/* Top row: order id + status */}
                  <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2 mb-4">
                    <div className="text-xs text-slate-400">
                      <span className="text-slate-500">Order ID:</span>{" "}
                      <span className="font-mono text-slate-200">
                        {order._id}
                      </span>
                      <span className="mx-2 text-slate-600">•</span>
                      <span>
                        Placed on{" "}
                        <span className="text-slate-200">
                          {formatDate(order.orderDate)}
                        </span>
                      </span>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-[11px] ${statusInfo.className}`}
                      >
                        <Ticket className="w-3.5 h-3.5" />
                        {statusInfo.label}
                      </span>
                      {order.refundRequested && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 text-amber-300 border border-amber-500/40 px-3 py-1 text-[11px]">
                          <AlertTriangle className="w-3.5 h-3.5" />
                          Refund requested
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Event mini card */}
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
                        {event.title || "Event removed"}
                      </p>
                      <p className="text-[11px] text-slate-400 mt-0.5">
                        {formatLocation(event)}
                      </p>
                      <div className="mt-1 flex flex-wrap gap-3 text-[11px] text-slate-300">
                        <span className="inline-flex items-center gap-1">
                          <CalendarDays className="w-3.5 h-3.5 text-amber-400" />
                          {formatDate(event.date)}
                        </span>
                        {event.time && (
                          <span className="inline-flex items-center gap-1">
                            <Clock className="w-3.5 h-3.5 text-amber-400" />
                            {event.time}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Breakdown + QR */}
                  <div className="grid md:grid-cols-[minmax(0,1.4fr),minmax(0,1fr)] gap-4">
                    {/* Left: breakdown */}
                    <div className="space-y-3">
                      <div className="rounded-2xl bg-slate-950/80 border border-slate-800 p-3 text-xs space-y-1.5">
                        <div className="flex items-center justify-between">
                          <span className="text-slate-300">
                            Tickets purchased
                          </span>
                          <span className="text-slate-100 font-medium">
                            {order.tickets?.length || 0}
                          </span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-slate-300">
                            Total amount
                          </span>
                          <span className="text-amber-300 font-semibold">
                            {symbol}
                            {Number(order.totalAmount || 0).toLocaleString()}
                          </span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-slate-300">
                            Payment method
                          </span>
                          <span className="inline-flex items-center gap-1 text-slate-100">
                            {order.paymentMethod?.type === "credit_card" ? (
                              <CreditCard className="w-3.5 h-3.5 text-amber-400" />
                            ) : (
                              <Banknote className="w-3.5 h-3.5 text-amber-400" />
                            )}
                            {humanPaymentMethod(order.paymentMethod?.type)}
                          </span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-slate-300">
                            Payment status
                          </span>
                          <span className="text-slate-100 font-medium capitalize">
                            {order.paymentMethod?.status || "pending"}
                          </span>
                        </div>
                      </div>

                      {order.refundRequested && order.refundReason && (
                        <div className="rounded-2xl bg-amber-500/5 border border-amber-500/40 p-3 text-[11px] text-amber-100">
                          <p className="font-semibold mb-1">
                            Your refund request
                          </p>
                          <p className="text-amber-50">
                            {order.refundReason}
                          </p>
                        </div>
                      )}

                      {refundMessage && !activeRefund && (
                        <p className="text-[11px] text-slate-300">
                          {refundMessage}
                        </p>
                      )}
                    </div>

                    {/* Right: QR + refund */}
                    <div className="space-y-3">
                      <div className="rounded-2xl bg-slate-950/80 border border-slate-800 p-3 flex flex-col items-center justify-center text-center">
                        {showQr ? (
                          <>
                            <p className="text-xs font-medium text-slate-100 mb-2">
                              Your QR ticket
                            </p>
                            <div className="bg-slate-900 p-2 rounded-xl border border-slate-700 mb-2">
                              <img
                                src={order.qrCode}
                                alt="Ticket QR Code"
                                className="h-32 w-32 object-contain"
                              />
                            </div>
                            <p className="text-[11px] text-slate-400">
                              Show this QR code at the venue entrance. It has
                              also been emailed to you.
                            </p>
                          </>
                        ) : (
                          <>
                            <QrCode className="w-7 h-7 text-slate-500 mb-2" />
                            <p className="text-xs font-semibold text-slate-100">
                              QR code not issued yet.
                            </p>
                            <p className="text-[11px] text-slate-400 mt-1">
                              Once an admin confirms your payment, a unique QR
                              code will be generated and sent to your email.
                            </p>
                          </>
                        )}
                      </div>

                      {/* Refund area */}
                      <div className="rounded-2xl bg-slate-950/80 border border-slate-800 p-3 text-xs">
                        <div className="flex items-start gap-2 mb-2">
                          <AlertTriangle className="w-4 h-4 text-amber-400 mt-0.5" />
                          <div>
                            <p className="font-semibold text-slate-100">
                              Need to request a refund?
                            </p>
                            <p className="text-[11px] text-slate-400 mt-0.5">
                              Refunds are handled by the admin team. Share a
                              short reason and they&apos;ll review your request.
                            </p>
                          </div>
                        </div>

                        {canRequestRefund && activeRefund !== order._id && (
                          <button
                            type="button"
                            onClick={() =>
                              openRefundForm(order._id, order.refundReason)
                            }
                            className="mt-1 inline-flex items-center gap-1.5 rounded-xl border border-slate-700 bg-slate-900 hover:border-amber-500/70 hover:bg-slate-900/80 text-[11px] text-slate-200 px-3 py-1.5 transition-all"
                          >
                            Request refund
                          </button>
                        )}

                        {activeRefund === order._id && (
                          <div className="mt-2 space-y-2">
                            <textarea
                              value={refundReason}
                              onChange={(e) =>
                                setRefundReason(e.target.value)
                              }
                              placeholder="Describe briefly why you need a refund (e.g. event cancelled, duplicate order)..."
                              className="w-full rounded-xl bg-slate-950/80 border border-slate-800 px-3 py-2 text-[11px] text-slate-50 placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-amber-500/70 focus:border-amber-500/70 resize-none min-h-[70px]"
                            />
                            {refundMessage && (
                              <p className="text-[11px] text-amber-200">
                                {refundMessage}
                              </p>
                            )}
                            <div className="flex items-center justify-end gap-2">
                              <button
                                type="button"
                                onClick={cancelRefundForm}
                                className="text-[11px] text-slate-400 hover:text-slate-200"
                              >
                                Cancel
                              </button>
                              <button
                                type="button"
                                onClick={() =>
                                  submitRefundRequest(order._id)
                                }
                                disabled={refundLoading}
                                className="inline-flex items-center gap-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 disabled:bg-amber-500/60 text-slate-950 text-[11px] font-semibold px-3 py-1.5"
                              >
                                {refundLoading ? (
                                  <>
                                    <span className="h-3 w-3 border-2 border-slate-900/70 border-t-transparent rounded-full animate-spin" />
                                    Sending...
                                  </>
                                ) : (
                                  <>Submit request</>
                                )}
                              </button>
                            </div>
                          </div>
                        )}

                        {!canRequestRefund && (
                          <p className="mt-1 text-[11px] text-slate-500">
                            Refunds are not available for this order, or a
                            refund has already been processed/requested.
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
