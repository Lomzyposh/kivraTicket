import React, { useEffect, useState } from "react";
import {
  ArrowLeft,
  Ticket,
  QrCode,
  AlertTriangle,
  CalendarDays,
  MapPin,
  Clock,
  RefreshCw,
  Mail,
  DollarSign,
} from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import api from "../../api/axios";
import { useAuth } from "../../context/AuthContext";

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

const STATUS_OPTIONS = [
  { value: "all", label: "All statuses" },
  { value: "pending", label: "Pending" },
  { value: "confirmed", label: "Confirmed" },
  { value: "cancelled", label: "Cancelled" },
  { value: "refunded", label: "Refunded" },
];

export default function AdminOrders() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();

  const [orders, setOrders] = useState([]);
  const [statusFilter, setStatusFilter] = useState("all");
  const [loading, setLoading] = useState(true);
  const [pageError, setPageError] = useState("");
  const [refreshing, setRefreshing] = useState(false);
  const [sendingQrFor, setSendingQrFor] = useState(null);

  const highlightOrderId = location.state?.highlight || null;

  // Guard: only admins
  useEffect(() => {
    if (!user) {
      navigate("/login", {
        state: {
          from: "/admin/orders",
          message: "Sign in with an admin account to manage orders.",
        },
      });
      return;
    }
    if (user.role !== "admin") {
      navigate("/");
    }
  }, [user, navigate]);

  const fetchOrders = async ({ showLoader = true } = {}) => {
    try {
      if (showLoader) setLoading(true);
      setPageError("");

      const params = {};
      if (statusFilter !== "all") params.status = statusFilter;

      const res = await api.get("/admin/orders", { params });
      setOrders(res.data?.orders || []);
    } catch (err) {
      const msg =
        err?.response?.data?.error ||
        err?.response?.data?.message ||
        "Unable to load orders.";
      setPageError(msg);
    } finally {
      if (showLoader) setLoading(false);
    }
  };

  // Initial load + when filter changes
  useEffect(() => {
    if (!user || user.role !== "admin") return;
    fetchOrders();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter, user]);

  const handleRefresh = async () => {
    try {
      setRefreshing(true);
      await fetchOrders({ showLoader: false });
    } finally {
      setRefreshing(false);
    }
  };

  const handleSendQr = async (orderId) => {
    try {
      setSendingQrFor(orderId);
      setPageError("");

      const res = await api.post(`/admin/orders/${orderId}/send-qr`);
      const updatedOrder = res.data?.order;

      if (updatedOrder) {
        setOrders((prev) =>
          prev.map((o) => (o._id === orderId ? updatedOrder : o))
        );
      }
    } catch (err) {
      const msg =
        err?.response?.data?.error ||
        err?.response?.data?.message ||
        "Unable to send QR code for this order.";
      setPageError(msg);
    } finally {
      setSendingQrFor(null);
    }
  };

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
              <Ticket className="w-5 h-5 text-amber-400" />
              Manage orders
            </h1>
            <p className="mt-1 text-xs md:text-sm text-slate-400 max-w-xl">
              Review bookings, track QR status and act on refund requests in
              one place.
            </p>
          </div>

          <div className="flex flex-col items-end gap-2">
            <div className="flex items-center gap-2">
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="rounded-xl bg-slate-950/80 border border-slate-800 px-3 py-2 text-[11px] text-slate-50 focus:outline-none focus:ring-1 focus:ring-amber-500/70 focus:border-amber-500/70"
              >
                {STATUS_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
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
            <p className="text-[11px] text-slate-500">
              Showing {orders.length} order
              {orders.length === 1 ? "" : "s"}.
            </p>
          </div>
        </div>

        {pageError && (
          <div className="mb-4 rounded-2xl bg-red-500/10 border border-red-500/40 px-4 py-3 text-xs text-red-100 flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 mt-0.5" />
            <span>{pageError}</span>
          </div>
        )}

        {/* Loading skeleton */}
        {loading && (
          <div className="space-y-3">
            {Array.from({ length: 4 }).map((_, idx) => (
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

        {!loading && orders.length === 0 && !pageError && (
          <div className="rounded-3xl bg-slate-900/80 border border-slate-800 p-6 flex flex-col items-center justify-center text-center">
            <Ticket className="w-6 h-6 text-amber-400 mb-2" />
            <p className="text-sm font-semibold text-slate-100">
              No orders match this filter yet.
            </p>
            <p className="text-xs text-slate-400 mt-1 max-w-sm">
              Try switching the status filter to &quot;All statuses&quot; or
              &quot;Pending&quot; to see more activity.
            </p>
          </div>
        )}

        {/* Orders list */}
        {!loading && orders.length > 0 && (
          <div className="space-y-4">
            {orders.map((order) => {
              const event = order.event || {};
              const highlight = highlightOrderId === order._id;
              const currency = order.currency || event.price?.currency || "USD";
              const symbol = currencySymbol(currency);
              const canSendQr =
                !order.qrCodeSent &&
                order.status !== "cancelled" &&
                order.status !== "refunded";

              const hasRefundRequest = order.refundRequested;

              return (
                <div
                  key={order._id}
                  className={`rounded-3xl border p-5 md:p-6 bg-slate-900/80 transition-all ${
                    highlight
                      ? "border-amber-500/80 shadow-lg shadow-amber-500/20"
                      : "border-slate-800"
                  }`}
                >
                  {/* Top row: IDs and statuses */}
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
                      <span className="inline-flex items-center gap-1 rounded-full px-3 py-1 text-[11px] bg-slate-950/80 border border-slate-700 text-slate-100 capitalize">
                        <Ticket className="w-3.5 h-3.5 text-amber-400" />
                        {order.status}
                      </span>
                      <span className="inline-flex items-center gap-1 rounded-full px-3 py-1 text-[11px] bg-slate-950/80 border border-slate-700 text-slate-100 capitalize">
                        <DollarSign className="w-3.5 h-3.5 text-emerald-400" />
                        {order.paymentMethod?.status || "pending"}
                      </span>
                      {hasRefundRequest && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 text-amber-300 border border-amber-500/40 px-3 py-1 text-[11px]">
                          <AlertTriangle className="w-3.5 h-3.5" />
                          Refund requested
                        </span>
                      )}
                    </div>
                  </div>

                  {/* User + event row */}
                  <div className="grid md:grid-cols-[minmax(0,1.5fr),minmax(0,1.2fr)] gap-4 mb-4">
                    {/* Event & user */}
                    <div className="rounded-2xl bg-slate-950/80 border border-slate-800 p-3 flex gap-3">
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

                    {/* User info */}
                    <div className="rounded-2xl bg-slate-950/80 border border-slate-800 p-3 flex flex-col justify-between text-xs">
                      <div className="flex items-start gap-2 mb-1.5">
                        <Mail className="w-3.5 h-3.5 text-amber-400 mt-0.5" />
                        <div>
                          <p className="text-slate-300">Customer</p>
                          <p className="text-slate-100 font-medium">
                            {order.user?.name || "Unknown user"}
                          </p>
                          <p className="text-[11px] text-slate-400">
                            {order.user?.email || "No email"}
                          </p>
                        </div>
                      </div>
                      <p className="text-[11px] text-slate-500">
                        Payment method:{" "}
                        <span className="text-slate-200">
                          {humanPaymentMethod(order.paymentMethod?.type)}
                        </span>
                      </p>
                    </div>
                  </div>

                  {/* Lower row: breakdown + actions */}
                  <div className="grid md:grid-cols-[minmax(0,1.4fr),minmax(0,1.1fr)] gap-4">
                    {/* Breakdown */}
                    <div className="space-y-3 text-xs">
                      <div className="rounded-2xl bg-slate-950/80 border border-slate-800 p-3 space-y-1.5">
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
                            QR code status
                          </span>
                          <span className="inline-flex items-center gap-1 text-slate-100">
                            <QrCode
                              className={`w-3.5 h-3.5 ${
                                order.qrCodeSent
                                  ? "text-emerald-400"
                                  : "text-slate-500"
                              }`}
                            />
                            {order.qrCodeSent ? "Sent" : "Not sent"}
                          </span>
                        </div>
                      </div>

                      {hasRefundRequest && order.refundReason && (
                        <div className="rounded-2xl bg-amber-500/5 border border-amber-500/40 p-3 text-[11px] text-amber-100">
                          <p className="font-semibold mb-1">
                            Customer refund note
                          </p>
                          <p className="text-amber-50">
                            {order.refundReason}
                          </p>
                        </div>
                      )}
                    </div>

                    {/* Actions */}
                    <div className="space-y-3 text-xs">
                      <div className="rounded-2xl bg-slate-950/80 border border-slate-800 p-3 flex flex-col gap-2">
                        <p className="text-slate-100 font-medium">
                          QR ticket actions
                        </p>
                        <p className="text-[11px] text-slate-400">
                          Generate and email a QR code for this order. This
                          will also mark the order as confirmed.
                        </p>
                        <button
                          type="button"
                          disabled={!canSendQr || sendingQrFor === order._id}
                          onClick={() => handleSendQr(order._id)}
                          className="mt-1 inline-flex items-center justify-center gap-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 disabled:bg-amber-500/40 text-slate-950 text-xs font-semibold px-4 py-2 transition-all shadow-lg shadow-amber-500/30"
                        >
                          {sendingQrFor === order._id ? (
                            <>
                              <span className="h-3.5 w-3.5 border-2 border-slate-900/70 border-t-transparent rounded-full animate-spin" />
                              Sending QR...
                            </>
                          ) : (
                            <>
                              <QrCode className="w-3.5 h-3.5" />
                              {order.qrCodeSent
                                ? "Resend QR code"
                                : "Send QR code"}
                            </>
                          )}
                        </button>
                        {!canSendQr && (
                          <p className="text-[11px] text-slate-500">
                            QR sending is disabled for cancelled/refunded
                            orders.
                          </p>
                        )}
                      </div>

                      <p className="text-[11px] text-slate-500">
                        For now, status changes beyond QR sending (e.g.
                        confirming refunds) should be handled through the admin
                        tools connected to this API or directly in the
                        database, depending on your workflow.
                      </p>
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
