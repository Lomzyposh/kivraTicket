import React, { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  AlertTriangle,
  Banknote,
  CheckCircle2,
  RefreshCw,
  Save,
  Search,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import api from "../../api/axios";
import { useAuth } from "../../context/AuthContext";

function formatMoney(amount = 0, currency = "USD") {
  const symbol =
    currency === "USD"
      ? "$"
      : currency === "NGN"
        ? "₦"
        : currency === "GBP"
          ? "£"
          : currency === "EUR"
            ? "€"
            : "";
  return `${symbol}${Number(amount || 0).toLocaleString()}`;
}

function formatDate(value) {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString();
}

const emptyOption = {
  label: "Bank Transfer",
  recipientName: "",
  recipientValue: "",
  instructions: "",
};

export default function AdminPaymentConfig() {
  const navigate = useNavigate();
  const { user } = useAuth();

  const [ticketOrders, setTicketOrders] = useState([]);
  const [merchOrders, setMerchOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [pageError, setPageError] = useState("");
  const [search, setSearch] = useState("");

  const [selectedOrder, setSelectedOrder] = useState(null);
  const [selectedKind, setSelectedKind] = useState("ticket");

  const [expiresAt, setExpiresAt] = useState("");
  const [paymentOptions, setPaymentOptions] = useState([{ ...emptyOption }]);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");
  const [formSuccess, setFormSuccess] = useState("");

  useEffect(() => {
    if (!user) {
      navigate("/login", {
        state: {
          from: "/admin/payment-config",
          message: "Sign in with an admin account to manage payment requests.",
        },
      });
      return;
    }

    if (user.role !== "admin") {
      navigate("/");
    }
  }, [user, navigate]);

  const loadRequests = async ({ silent = false } = {}) => {
    try {
      if (!silent) setLoading(true);
      setPageError("");
      const res = await api.get("/admin/payment-requests");
      setTicketOrders(res.data?.ticketOrders || []);
      setMerchOrders(res.data?.merchOrders || []);
    } catch (err) {
      setPageError(
        err?.response?.data?.error ||
          err?.response?.data?.message ||
          "Unable to load bank payment requests.",
      );
    } finally {
      if (!silent) setLoading(false);
    }
  };

  useEffect(() => {
    if (!user || user.role !== "admin") return;
    loadRequests();
  }, [user]);

  const mergedOrders = useMemo(() => {
    const tickets = ticketOrders.map((order) => ({ ...order, _kind: "ticket" }));
    const merch = merchOrders.map((order) => ({ ...order, _kind: "merch" }));

    return [...tickets, ...merch]
      .filter((order) => order?.bankPaymentRequest?.requested)
      .sort(
        (a, b) =>
          new Date(b.orderDate || b.createdAt || 0) -
          new Date(a.orderDate || a.createdAt || 0),
      );
  }, [ticketOrders, merchOrders]);

  const filteredOrders = useMemo(() => {
    const q = search.trim().toLowerCase();

    return mergedOrders.filter((order) => {
      if (!q) return true;

      const haystack = [
        order._id,
        order.user?.name,
        order.user?.email,
        order.event?.title,
        ...(order.items || []).map((item) => item.title),
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return haystack.includes(q);
    });
  }, [mergedOrders, search]);

  const requestCounts = useMemo(
    () => ({
      all: mergedOrders.length,
      requested: mergedOrders.filter(
        (item) => (item.bankPaymentRequest?.status || "requested") === "requested",
      ).length,
      sent: mergedOrders.filter(
        (item) => item.bankPaymentRequest?.status === "sent",
      ).length,
    }),
    [mergedOrders],
  );

  const handleRefresh = async () => {
    try {
      setRefreshing(true);
      await loadRequests({ silent: true });
    } finally {
      setRefreshing(false);
    }
  };

  const openOrder = (order) => {
    setSelectedOrder(order);
    setSelectedKind(order._kind || "ticket");

    const existingOptions = Array.isArray(order.bankPaymentRequest?.paymentOptions)
      ? order.bankPaymentRequest.paymentOptions
      : [];

    setPaymentOptions(
      existingOptions.length
        ? existingOptions.map((option) => ({
            label: option.label || "Bank Transfer",
            recipientName:
              option.recipientName || option.accountName || "",
            recipientValue:
              option.recipientValue || option.accountIdentifier || "",
            instructions: option.instructions || "",
          }))
        : [{ ...emptyOption }],
    );

    setExpiresAt(
      order.bankPaymentRequest?.expiresAt
        ? new Date(order.bankPaymentRequest.expiresAt).toISOString().slice(0, 16)
        : "",
    );

    setFormError("");
    setFormSuccess("");
  };

  const updateOption = (index, field, value) => {
    setPaymentOptions((prev) =>
      prev.map((option, idx) =>
        idx === index ? { ...option, [field]: value } : option,
      ),
    );
  };

  const addOption = () => {
    setPaymentOptions((prev) => [...prev, { ...emptyOption }]);
  };

  const removeOption = (index) => {
    setPaymentOptions((prev) => prev.filter((_, idx) => idx !== index));
  };

  const handleAssign = async (e) => {
    e.preventDefault();
    setFormError("");
    setFormSuccess("");

    if (!selectedOrder) return;

    const cleaned = paymentOptions
      .map((option) => ({
        label: String(option.label || "Bank Transfer").trim(),
        recipientName: String(option.recipientName || "").trim(),
        recipientValue: String(option.recipientValue || "").trim(),
        instructions: String(option.instructions || "").trim(),
      }))
      .filter(
        (option) =>
          option.label ||
          option.recipientName ||
          option.recipientValue ||
          option.instructions,
      );

    if (!cleaned.length) {
      setFormError("Enter at least one payment method the customer can use.");
      return;
    }

    const hasInvalid = cleaned.some(
      (option) => !option.label || !option.recipientValue,
    );

    if (hasInvalid) {
      setFormError("Each payment method needs a label and a payment handle/detail.");
      return;
    }

    try {
      setSaving(true);
      const { data } = await api.post(
        `/admin/payment-requests/${selectedOrder._id}/assign`,
        {
          kind: selectedKind,
          expiresAt: expiresAt ? new Date(expiresAt).toISOString() : null,
          paymentOptions: cleaned,
        },
      );

      setFormSuccess(data.message || "Payment details sent successfully.");
      await loadRequests({ silent: true });
    } catch (err) {
      setFormError(
        err?.response?.data?.error ||
          err?.response?.data?.message ||
          "Unable to send payment details.",
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-linear-to-br from-slate-950 via-slate-900 to-slate-950 text-slate-50">
      <div className="max-w-7xl mx-auto px-4 pt-20 pb-16 md:px-8 lg:px-10 lg:pt-24">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
          <div>
            <button
              type="button"
              onClick={() => navigate(-1)}
              className="inline-flex items-center gap-1.5 text-xs text-slate-300 hover:text-amber-300 mb-2"
            >
              <ArrowLeft className="w-3.5 h-3.5" /> Back
            </button>
            <h1 className="text-2xl md:text-3xl font-semibold text-slate-50 flex items-center gap-2">
              <Banknote className="w-5 h-5 text-amber-400" /> Bank payment requests
            </h1>
            <p className="mt-1 text-xs md:text-sm text-slate-400 max-w-xl">
              This page only shows customers who requested bank payment. Pick one request and manually type the payment details you want to send.
            </p>
          </div>
          <button
            type="button"
            onClick={handleRefresh}
            disabled={refreshing}
            className="inline-flex items-center gap-2 rounded-2xl border border-slate-800 bg-slate-900/80 px-4 py-2 text-xs text-slate-200"
          >
            <RefreshCw className={refreshing ? "w-4 h-4 animate-spin" : "w-4 h-4"} /> Refresh
          </button>
        </div>

        {pageError && (
          <div className="mb-4 rounded-2xl bg-red-500/10 border border-red-500/40 px-4 py-3 text-xs text-red-100 flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 mt-0.5" />
            <span>{pageError}</span>
          </div>
        )}

        <div className="grid gap-6 lg:grid-cols-[1.1fr,0.9fr]">
          <div className="rounded-3xl bg-slate-900/80 border border-slate-800 p-5 md:p-6">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-4">
              <div className="grid grid-cols-3 gap-2 w-full md:w-auto">
                <div className="rounded-2xl border border-slate-800 bg-slate-950 px-3 py-3 text-center">
                  <p className="text-[11px] text-slate-400">All</p>
                  <p className="text-lg font-semibold">{requestCounts.all}</p>
                </div>
                <div className="rounded-2xl border border-slate-800 bg-slate-950 px-3 py-3 text-center">
                  <p className="text-[11px] text-slate-400">Requested</p>
                  <p className="text-lg font-semibold text-amber-300">{requestCounts.requested}</p>
                </div>
                <div className="rounded-2xl border border-slate-800 bg-slate-950 px-3 py-3 text-center">
                  <p className="text-[11px] text-slate-400">Sent</p>
                  <p className="text-lg font-semibold text-emerald-300">{requestCounts.sent}</p>
                </div>
              </div>

              <div className="relative w-full md:max-w-xs">
                <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search orders"
                  className="w-full rounded-2xl border border-slate-800 bg-slate-950 pl-9 pr-3 py-2 text-sm text-slate-50"
                />
              </div>
            </div>

            {loading ? (
              <div className="text-sm text-slate-400">Loading requests...</div>
            ) : filteredOrders.length === 0 ? (
              <div className="text-sm text-slate-400">No bank payment requests yet.</div>
            ) : (
              <div className="space-y-3">
                {filteredOrders.map((order) => {
                  const status = order.bankPaymentRequest?.status || "requested";
                  const title =
                    order._kind === "ticket"
                      ? order.event?.title || "Ticket order"
                      : order.items?.[0]?.title || "Merch order";

                  return (
                    <button
                      key={`${order._kind}-${order._id}`}
                      type="button"
                      onClick={() => openOrder(order)}
                      className={`w-full text-left rounded-3xl border p-4 transition ${
                        selectedOrder?._id === order._id
                          ? "border-amber-500/60 bg-slate-950"
                          : "border-slate-800 bg-slate-950/60 hover:border-slate-700"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="text-sm font-semibold text-slate-100">{title}</p>
                          <p className="text-[11px] text-slate-400 mt-1">
                            {order.user?.name || "Customer"} • {order.user?.email}
                          </p>
                        </div>
                        <span
                          className={`rounded-full px-2.5 py-1 text-[10px] uppercase ${
                            status === "sent"
                              ? "bg-emerald-500/10 text-emerald-300 border border-emerald-500/40"
                              : "bg-amber-500/10 text-amber-300 border border-amber-500/40"
                          }`}
                        >
                          {status}
                        </span>
                      </div>
                      <div className="mt-3 flex flex-wrap gap-3 text-[11px] text-slate-400">
                        <span>Kind: {order._kind}</span>
                        <span>Total: {formatMoney(order.totalAmount, order.currency || "USD")}</span>
                        <span>Placed: {formatDate(order.orderDate || order.createdAt)}</span>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          <form
            onSubmit={handleAssign}
            className="rounded-3xl bg-slate-900/80 border border-slate-800 p-5 md:p-6 space-y-4"
          >
            <h2 className="text-base font-semibold text-slate-50">
              Type payment details manually
            </h2>

            {!selectedOrder ? (
              <p className="text-sm text-slate-400">
                Select a request from the left to type the payment details manually.
              </p>
            ) : (
              <>
                <div className="rounded-2xl border border-slate-800 bg-slate-950 p-4 text-sm">
                  <p className="font-semibold text-slate-100">
                    {selectedKind === "ticket"
                      ? selectedOrder.event?.title || "Ticket order"
                      : selectedOrder.items?.[0]?.title || "Merch order"}
                  </p>
                  <p className="text-xs text-slate-400 mt-1">
                    {selectedOrder.user?.name || "Customer"} • {selectedOrder.user?.email}
                  </p>
                  <p className="text-xs text-slate-400 mt-1">Order ID: {selectedOrder._id}</p>
                </div>

                {formError && (
                  <div className="rounded-2xl bg-red-500/10 border border-red-500/40 px-4 py-3 text-xs text-red-100 flex items-start gap-2">
                    <AlertTriangle className="w-4 h-4 mt-0.5" />
                    <span>{formError}</span>
                  </div>
                )}

                {formSuccess && (
                  <div className="rounded-2xl bg-emerald-500/10 border border-emerald-500/40 px-4 py-3 text-xs text-emerald-100 flex items-start gap-2">
                    <CheckCircle2 className="w-4 h-4 mt-0.5" />
                    <span>{formSuccess}</span>
                  </div>
                )}

                <div>
                  <label className="text-[11px] text-slate-400 block mb-1">
                    Optional expiry time
                  </label>
                  <input
                    type="datetime-local"
                    value={expiresAt}
                    onChange={(e) => setExpiresAt(e.target.value)}
                    className="w-full rounded-2xl border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-slate-50"
                  />
                </div>

                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold text-slate-100">Payment methods</p>
                  <button
                    type="button"
                    onClick={addOption}
                    className="rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-slate-200"
                  >
                    Add method
                  </button>
                </div>

                <div className="space-y-3">
                  {paymentOptions.map((option, index) => (
                    <div
                      key={index}
                      className="rounded-2xl border border-slate-800 bg-slate-950 p-4 space-y-3"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-sm font-semibold text-slate-100">
                          Method {index + 1}
                        </p>
                        {paymentOptions.length > 1 && (
                          <button
                            type="button"
                            onClick={() => removeOption(index)}
                            className="rounded-xl border border-slate-700 bg-slate-900 px-3 py-1.5 text-[11px] text-slate-200"
                          >
                            Remove
                          </button>
                        )}
                      </div>

                      <div className="grid gap-3 md:grid-cols-2">
                        <input
                          value={option.label}
                          onChange={(e) => updateOption(index, "label", e.target.value)}
                          placeholder="Label e.g. Zelle / PayPal / Bank Transfer"
                          className="w-full rounded-2xl border border-slate-800 bg-slate-900 px-3 py-2 text-sm text-slate-50"
                        />

                        <input
                          value={option.recipientName}
                          onChange={(e) => updateOption(index, "recipientName", e.target.value)}
                          placeholder="Name e.g. GoTickets / John Doe"
                          className="w-full rounded-2xl border border-slate-800 bg-slate-900 px-3 py-2 text-sm text-slate-50"
                        />

                        <input
                          value={option.recipientValue}
                          onChange={(e) => updateOption(index, "recipientValue", e.target.value)}
                          placeholder="Payment handle / email / phone / account number"
                          className="w-full rounded-2xl border border-slate-800 bg-slate-900 px-3 py-2 text-sm text-slate-50 md:col-span-2"
                        />

                        <textarea
                          value={option.instructions}
                          onChange={(e) => updateOption(index, "instructions", e.target.value)}
                          rows={4}
                          placeholder="Instructions for the customer"
                          className="w-full rounded-2xl border border-slate-800 bg-slate-900 px-3 py-2 text-sm text-slate-50 md:col-span-2 resize-y"
                        />
                      </div>
                    </div>
                  ))}
                </div>

                <button
                  type="submit"
                  disabled={saving}
                  className="inline-flex items-center justify-center gap-2 rounded-2xl bg-amber-500 px-4 py-3 text-sm font-semibold text-slate-950 disabled:opacity-60"
                >
                  <Save className="w-4 h-4" />
                  {saving ? "Sending..." : "Send payment details"}
                </button>
              </>
            )}
          </form>
        </div>
      </div>
    </div>
  );
}
