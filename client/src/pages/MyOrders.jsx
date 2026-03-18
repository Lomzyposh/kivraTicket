import React, { useEffect, useState } from "react";
import {
  ArrowLeft,
  Ticket,
  ShoppingBag,
  QrCode,
  CalendarDays,
  Clock,
  AlertTriangle,
  CreditCard,
  Banknote,
  RefreshCw,
  Mail,
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
  if (!method || method === "pending_selection") return "Not selected yet";
  switch (method) {
    case "credit_card":
      return "Credit / Debit Card";
    case "giftcard":
      return "Gift Card";
    case "bank_transfer":
      return "Bank Transfer";
    default:
      return method;
  }
}

const STATUS_TAGS = {
  pending: {
    label: "Pending",
    className: "bg-amber-500/10 text-amber-300 border border-amber-500/40",
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
  rejected: {
    label: "Rejected",
    className: "bg-red-500/10 text-red-300 border border-red-500/40",
  },
  refunded: {
    label: "Refunded",
    className: "bg-slate-700/40 text-slate-200 border border-slate-500/60",
  },
};

export default function MyOrders() {
  const navigate = useNavigate();
  const { user } = useAuth();

  const [ticketOrders, setTicketOrders] = useState([]);
  const [merchOrders, setMerchOrders] = useState([]);
  const [merchResendStatus, setMerchResendStatus] = useState({});

  const [loading, setLoading] = useState(true);
  const [pageError, setPageError] = useState("");

  const [refreshing, setRefreshing] = useState(false);

  const [activeRefund, setActiveRefund] = useState(null);
  const [refundReason, setRefundReason] = useState("");
  const [refundLoading, setRefundLoading] = useState(false);
  const [refundMessage, setRefundMessage] = useState("");

  const [resendStatus, setResendStatus] = useState({});

  useEffect(() => {
    if (!user) {
      navigate("/login", {
        state: {
          from: "/my-orders",
          message: "Sign in to view your orders.",
        },
      });
      return;
    }

    let active = true;

    const loadAllOrders = async () => {
      try {
        setLoading(true);
        const res = await api.get("/orders/my-all-orders");

        if (!active) return;

        setTicketOrders(res.data?.ticketOrders || []);
        setMerchOrders(res.data?.merchOrders || []);
      } catch (err) {
        const msg =
          err?.response?.data?.error ||
          "We couldn’t load your orders right now.";
        setPageError(msg);
      } finally {
        if (active) setLoading(false);
      }
    };

    loadAllOrders();
    return () => {
      active = false;
    };
  }, [user, navigate]);

  const handleRefresh = async () => {
    try {
      setRefreshing(true);
      const res = await api.get("/orders/my-all-orders");
      setTicketOrders(res.data?.ticketOrders || []);
      setMerchOrders(res.data?.merchOrders || []);
    } catch (err) {
      const msg =
        err?.response?.data?.error || "We couldn’t refresh your orders.";
      setPageError(msg);
    } finally {
      setRefreshing(false);
    }
  };

  const openRefundForm = (orderId, existingReason) => {
    setActiveRefund(orderId);
    setRefundReason(existingReason || "");
    setRefundMessage("");
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
      const res = await api.post(`/orders/${orderId}/refund`, {
        reason: refundReason.trim(),
      });

      setRefundMessage(res.data?.message || "Refund requested.");
      setActiveRefund(null);
      setRefundReason("");

      setTicketOrders((prev) =>
        prev.map((o) =>
          o._id === orderId ? { ...o, refundRequested: true, refundReason } : o,
        ),
      );
    } catch {
      setRefundMessage("Unable to request refund now.");
    } finally {
      setRefundLoading(false);
    }
  };

  const handleResendEmail = async (orderId) => {
    setResendStatus((prev) => ({
      ...prev,
      [orderId]: { loading: true, message: "", error: "" },
    }));

    try {
      const res = await api.post(`/orders/${orderId}/resend-email`);
      setResendStatus((prev) => ({
        ...prev,
        [orderId]: { loading: false, message: res.data?.message, error: "" },
      }));
    } catch {
      setResendStatus((prev) => ({
        ...prev,
        [orderId]: { loading: false, message: "", error: "Unable to resend." },
      }));
    }
  };

  const handleResendMerchEmail = async (orderId) => {
    setMerchResendStatus((prev) => ({
      ...prev,
      [orderId]: { loading: true, message: "", error: "" },
    }));

    try {
      const res = await api.post(`/merch-orders/${orderId}/resend-email`);
      const message =
        res.data?.message ||
        "Email resent successfully. Check your inbox and spam folder.";

      setMerchResendStatus((prev) => ({
        ...prev,
        [orderId]: { loading: false, message, error: "" },
      }));
    } catch (err) {
      const errorMsg =
        err?.response?.data?.error ||
        err?.response?.data?.message ||
        "Failed to resend email. Please try again.";

      setMerchResendStatus((prev) => ({
        ...prev,
        [orderId]: { loading: false, message: "", error: errorMsg },
      }));
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-50">
      <div className="max-w-5xl mx-auto px-4 pt-20 pb-24">
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
              My Orders
            </h1>
            <p className="mt-1 text-xs md:text-sm text-slate-400">
              Your ticket bookings and merch purchases appear here.
            </p>
          </div>

          <button
            type="button"
            onClick={handleRefresh}
            disabled={loading || refreshing}
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-700 bg-slate-900/80 hover:border-amber-500/70 hover:bg-slate-900/80 text-[11px] text-slate-200 px-3 py-1.5 transition-all"
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

        {pageError && (
          <div className="mb-4 rounded-xl bg-red-500/10 border border-red-500/40 px-4 py-3 text-xs text-red-100 flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 mt-0.5" />
            <span>{pageError}</span>
          </div>
        )}

        {loading && (
          <div className="space-y-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <div
                key={i}
                className="rounded-3xl bg-slate-900 border border-slate-800 p-6 animate-pulse"
              >
                <div className="h-4 w-40 bg-slate-800 rounded mb-4"></div>
                <div className="h-24 bg-slate-800 rounded"></div>
              </div>
            ))}
          </div>
        )}

        {!loading && ticketOrders.length > 0 && (
          <div className="mt-10">
            <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
              <Ticket className="w-5 h-5 text-amber-400" />
              Ticket Orders
            </h2>

            {ticketOrders.map((order) => {
              const event = order.event || {};
              const symbol = currencySymbol(order.currency);

              const statusInfo =
                STATUS_TAGS[order.status] || STATUS_TAGS.pending;

              const thisResend = resendStatus[order._id] || {
                loading: false,
                message: "",
                error: "",
              };

              return (
                <div
                  key={order._id}
                  className="rounded-3xl bg-slate-900/80 border border-slate-800 p-5 mt-4"
                >
                  <div className="flex items-center justify-between mb-4">
                    <div className="text-xs text-slate-400">
                      Order ID: {" "}
                      <span className="text-slate-200 font-mono">
                        {order._id}
                      </span>
                      <span className="mx-2 text-slate-600">•</span>
                      Placed {formatDate(order.orderDate)}
                    </div>

                    <span
                      className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-[11px] ${statusInfo.className}`}
                    >
                      <Ticket className="w-3.5 h-3.5" />
                      {statusInfo.label}
                    </span>
                  </div>

                  <div className="rounded-2xl bg-slate-950 border border-slate-800 p-3 flex gap-3 mb-4">
                    <div className="h-16 w-16 rounded-xl bg-slate-800 overflow-hidden">
                      {event.images?.[0] ? (
                        <img
                          src={event.images[0]}
                          alt=""
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <div className="h-full w-full flex items-center justify-center text-[10px] text-slate-500 uppercase">
                          Event
                        </div>
                      )}
                    </div>

                    <div className="flex-1">
                      <p className="font-semibold text-sm text-slate-100">
                        {event.title}
                      </p>
                      <p className="text-[11px] text-slate-400 mt-0.5">
                        {event.venue}
                      </p>
                      <p className="flex items-center gap-2 text-[11px] text-slate-300 mt-1">
                        <CalendarDays className="w-3.5 h-3.5 text-amber-400" />
                        {formatDate(event.date)}
                        <Clock className="w-3.5 h-3.5 text-amber-400" />
                        {event.time}
                      </p>
                    </div>
                  </div>

                  <div className="grid md:grid-cols-2 gap-4">
                    <div className="rounded-2xl bg-slate-950 border border-slate-800 p-3 text-xs space-y-2">
                      <div className="flex justify-between">
                        <span>Tickets</span>
                        <span>{order.tickets.length}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Total</span>
                        <span className="text-amber-300 font-semibold">
                          {symbol}
                          {Number(order.totalAmount).toLocaleString()}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span>Payment</span>
                        <span className="flex items-center gap-1">
                          <CreditCard className="w-3.5 h-3.5 text-amber-400" />
                          {humanPaymentMethod(order.paymentMethod?.type)}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span>Status</span>
                        <span>{order.paymentMethod?.status || "pending"}</span>
                      </div>
                    </div>

                    <div className="rounded-2xl bg-slate-950 border border-slate-800 p-3 text-center">
                      {order.qrCodeSent ? (
                        <>
                          <p className="text-xs text-slate-300 mb-2">
                            Your QR Ticket
                          </p>
                          <img
                            src={order.qrCode}
                            className="h-32 w-32 mx-auto border border-slate-700 rounded-xl"
                            alt="QR"
                          />
                          <p className="text-[11px] text-slate-400 mt-2">
                            Show this QR at the venue entrance.
                          </p>
                        </>
                      ) : (
                        <>
                          <QrCode className="w-7 h-7 text-slate-500 mx-auto mb-2" />
                          <p className="text-xs text-slate-200">
                            QR not issued yet
                          </p>
                        </>
                      )}

                      <button
                        type="button"
                        onClick={() => handleResendEmail(order._id)}
                        disabled={thisResend.loading}
                        className="mt-3 inline-flex items-center gap-1.5 rounded-xl border border-slate-700 bg-slate-900 px-3 py-1.5 text-[11px] text-slate-200 hover:border-amber-500/70 transition"
                      >
                        {thisResend.loading ? "Sending..." : "Resend email"}
                      </button>

                      {!order.qrCodeSent && (
                        <button
                          type="button"
                          onClick={() =>
                            navigate(`/payment?kind=ticket&orderId=${order._id}`)
                          }
                          className="mt-2 inline-flex items-center gap-1.5 rounded-xl border border-amber-500/40 bg-amber-500/10 px-3 py-1.5 text-[11px] text-amber-200 hover:border-amber-400/80 transition"
                        >
                          <Banknote className="w-3.5 h-3.5" />
                          Open payment page
                        </button>
                      )}

                      {thisResend.message && (
                        <p className="text-[11px] text-emerald-300 mt-1">
                          {thisResend.message}
                        </p>
                      )}
                      {thisResend.error && (
                        <p className="text-[11px] text-red-300 mt-1">
                          {thisResend.error}
                        </p>
                      )}
                    </div>
                  </div>

                  {activeRefund === order._id && (
                    <div className="mt-4 rounded-2xl bg-slate-950 border border-slate-800 p-4">
                      <p className="text-xs font-semibold text-slate-100 mb-2">
                        Refund request
                      </p>
                      <textarea
                        value={refundReason}
                        onChange={(e) => setRefundReason(e.target.value)}
                        placeholder="Tell us why you need a refund"
                        className="w-full min-h-[100px] rounded-xl bg-slate-900 border border-slate-800 px-3 py-2 text-sm text-slate-100"
                      />
                      {refundMessage && (
                        <p className="mt-2 text-xs text-amber-300">
                          {refundMessage}
                        </p>
                      )}
                      <div className="mt-3 flex gap-2">
                        <button
                          type="button"
                          onClick={() => submitRefundRequest(order._id)}
                          disabled={refundLoading}
                          className="rounded-xl bg-amber-500 px-4 py-2 text-xs font-semibold text-slate-950"
                        >
                          {refundLoading ? "Submitting..." : "Submit refund"}
                        </button>
                        <button
                          type="button"
                          onClick={cancelRefundForm}
                          className="rounded-xl border border-slate-700 px-4 py-2 text-xs text-slate-200"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}

                  {!order.refundRequested && ["pending", "confirmed"].includes(order.status) && (
                    <button
                      type="button"
                      onClick={() => openRefundForm(order._id, order.refundReason)}
                      className="mt-4 text-[11px] text-amber-300 hover:text-amber-200"
                    >
                      Request refund
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {!loading && merchOrders.length > 0 && (
          <div className="mt-14">
            <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
              <ShoppingBag className="w-5 h-5 text-amber-400" />
              Merch Orders
            </h2>

            {merchOrders.map((mo) => {
              const symbol = currencySymbol(mo.currency);
              const statusInfo = STATUS_TAGS[mo.status] || STATUS_TAGS.pending;

              return (
                <div
                  key={mo._id}
                  className="rounded-3xl bg-slate-900/80 border border-slate-800 p-5 mt-4"
                >
                  <div className="flex items-center justify-between mb-3">
                    <div className="text-xs text-slate-400">
                      Order ID:{" "}
                      <span className="font-mono text-slate-200">{mo._id}</span>
                      <span className="mx-2 text-slate-600">•</span>
                      Placed {formatDate(mo.orderDate)}
                    </div>

                    <span
                      className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-[11px] ${statusInfo.className}`}
                    >
                      <ShoppingBag className="w-3.5 h-3.5" />
                      {statusInfo.label}
                    </span>
                  </div>

                  <div className="space-y-3">
                    {mo.items.map((it, i) => (
                      <div
                        key={i}
                        className="rounded-xl bg-slate-950 border border-slate-800 p-3 flex gap-3"
                      >
                        <div className="h-16 w-16 rounded-xl bg-slate-800 overflow-hidden">
                          {it.image ? (
                            <img
                              src={it.image}
                              className="h-full w-full object-cover"
                              alt={it.title}
                            />
                          ) : (
                            <div className="h-full w-full flex items-center justify-center text-[10px] text-slate-500 uppercase">
                              Item
                            </div>
                          )}
                        </div>

                        <div className="flex-1">
                          <p className="text-sm font-semibold text-slate-100">
                            {it.title}{" "}
                            <span className="text-slate-400 text-xs">
                              ({it.brand})
                            </span>
                          </p>
                          <p className="text-[11px] text-slate-400">
                            Size: {it.size} • Color: {it.color}
                          </p>
                          <p className="text-[11px] text-slate-400">
                            Qty: {it.quantity}
                          </p>
                          <p className="text-[11px] text-amber-300 mt-1">
                            {symbol}
                            {Number(it.price).toLocaleString()}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="mt-3 w-full">
                    <p className="text-[11px] text-slate-400">
                      Didn’t receive the mail?
                    </p>

                    <button
                      type="button"
                      onClick={() => handleResendMerchEmail(mo._id)}
                      disabled={merchResendStatus[mo._id]?.loading}
                      className="mt-1 inline-flex items-center gap-1.5 rounded-xl border border-slate-700 bg-slate-900 hover:border-amber-500/70 hover:bg-slate-900/80 disabled:opacity-60 text-[11px] text-slate-200 px-3 py-1.5 transition-all"
                    >
                      {merchResendStatus[mo._id]?.loading ? (
                        <>
                          <span className="h-3 w-3 border-2 border-slate-500 border-t-transparent rounded-full animate-spin" />
                          Sending...
                        </>
                      ) : (
                        <>
                          <Mail className="w-3.5 h-3.5" />
                          Resend email
                        </>
                      )}
                    </button>

                    {merchResendStatus[mo._id]?.message && (
                      <p className="mt-1 text-[11px] text-emerald-300">
                        {merchResendStatus[mo._id].message}
                      </p>
                    )}

                    {merchResendStatus[mo._id]?.error && (
                      <p className="mt-1 text-[11px] text-red-300">
                        {merchResendStatus[mo._id].error}
                      </p>
                    )}

                    <button
                      type="button"
                      onClick={() => navigate(`/payment?kind=merch&orderId=${mo._id}`)}
                      className="mt-2 inline-flex items-center gap-1.5 rounded-xl border border-amber-500/40 bg-amber-500/10 px-3 py-1.5 text-[11px] text-amber-200 hover:border-amber-400/80 transition"
                    >
                      <Banknote className="w-3.5 h-3.5" />
                      Open payment page
                    </button>
                  </div>

                  <div className="mt-3 rounded-xl bg-slate-950 border border-slate-800 p-3 text-xs flex justify-between">
                    <span className="text-slate-300">Total</span>
                    <span className="text-amber-300 font-semibold">
                      {symbol}
                      {Number(mo.totalAmount).toLocaleString()}
                    </span>
                  </div>

                  <div className="mt-3 text-xs text-slate-300">
                    Payment Method:{" "}
                    <span className="text-slate-100 ml-1">
                      {humanPaymentMethod(mo.paymentMethod?.type)}
                    </span>
                  </div>

                  {mo.paymentMethod?.status && (
                    <div className="mt-1 text-xs text-slate-400">
                      Payment Status:{" "}
                      <span className="text-slate-200 ml-1">
                        {mo.paymentMethod.status}
                      </span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {!loading && ticketOrders.length === 0 && merchOrders.length === 0 && (
          <div className="rounded-3xl bg-slate-900 border border-slate-800 p-6 text-center mt-10">
            <ShoppingBag className="w-6 h-6 text-amber-400 mx-auto mb-2" />
            <p className="text-sm font-semibold text-slate-100">
              You haven’t made any purchases yet.
            </p>
            <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
              Once you book events or buy merch, your order history will appear
              here.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
