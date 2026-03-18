import React, { useEffect, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  ArrowLeft,
  CreditCard,
  Banknote,
  Gift,
  Mail,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Copy,
  UploadCloud,
  XCircle,
} from "lucide-react";
import api from "../api/axios";
import { useAuth } from "../context/AuthContext";

const TABS = [
  { value: "credit_card", label: "Card payment", icon: CreditCard },
  { value: "bank_request", label: "Request bank transfer", icon: Banknote },
  { value: "giftcard", label: "Gift card", icon: Gift },
];

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

function formatMoney(amount = 0, currency = "USD") {
  return `${currencySymbol(currency)}${Number(amount || 0).toLocaleString()}`;
}

function PaymentTab({ icon: Icon, label, active, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex items-center justify-center gap-2 rounded-2xl px-3 py-3 text-xs font-medium w-full border transition ${
        active
          ? "bg-slate-900 text-white border-slate-700"
          : "bg-slate-950 text-slate-300 border-slate-800 hover:border-amber-500/40"
      }`}
    >
      <Icon size={14} />
      <span className="truncate">{label}</span>
    </button>
  );
}

export default function PaymentPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user } = useAuth();

  const orderId = searchParams.get("orderId") || "";
  const kind = searchParams.get("kind") || "ticket";

  const [loading, setLoading] = useState(true);
  const [pageError, setPageError] = useState("");
  const [order, setOrder] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [message, setMessage] = useState("");
  const [copied, setCopied] = useState("");
  const [activeMethod, setActiveMethod] = useState("credit_card");
  const [bankRequestSubmitting, setBankRequestSubmitting] = useState(false);
  const [cardSubmitting, setCardSubmitting] = useState(false);
  const [giftSubmitting, setGiftSubmitting] = useState(false);
  const [giftUploading, setGiftUploading] = useState(false);
  const [giftUploadError, setGiftUploadError] = useState("");
  const fileRef = useRef(null);
  const [giftCardProofUrls, setGiftCardProofUrls] = useState(["", ""]);
  const [billingSame, setBillingSame] = useState(false);
  const [cardForm, setCardForm] = useState({
    cardHolderName: "",
    cardNumber: "",
    expMonth: "",
    expYear: "",
    cvv: "",
    billingAddress: {
      fullName: user?.name || "",
      email: user?.email || "",
      phone: "",
      addressLine1: "",
      addressLine2: "",
      city: "",
      state: "",
      postalCode: "",
      country: "",
    },
  });

  const resendPath =
    kind === "merch"
      ? `/merch-orders/${orderId}/resend-email`
      : `/orders/${orderId}/resend-email`;

  const loadPage = async () => {
    if (!user || !orderId) {
      setLoading(false);
      return;
    }
    try {
      setPageError("");
      const { data } = await api.get(
        `/payments/page-data?kind=${kind}&orderId=${orderId}`,
      );
      setOrder(data.order || null);
    } catch (err) {
      setPageError(
        err?.response?.data?.error ||
          err?.response?.data?.message ||
          "Unable to load this payment page.",
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPage();
  }, [user, orderId, kind]);

  const totalAmount =
    order?.totalAmount ||
    order?.total ||
    order?.subtotal ||
    order?.tickets?.reduce((sum, t) => sum + Number(t.price || 0), 0) ||
    0;
  const orderCurrency = order?.currency || order?.items?.[0]?.currency || "USD";
  const request = order?.bankPaymentRequest || {};
  const bankOption = (request.paymentOptions || []).find(
    (item) => item.variant === "bank_transfer",
  );

  const refresh = async () => {
    try {
      setRefreshing(true);
      await loadPage();
    } finally {
      setRefreshing(false);
    }
  };

  const handleResendEmail = async () => {
    try {
      const res = await api.post(resendPath);
      setMessage(res.data?.message || "Payment email resent successfully.");
    } catch (err) {
      setPageError(
        err?.response?.data?.error ||
          "Unable to resend payment email right now.",
      );
    }
  };

  const handleBankRequest = async () => {
    try {
      setBankRequestSubmitting(true);
      setMessage("");
      const { data } = await api.post(`/orders/${orderId}/request-bank-payment`, {
        kind,
      });
      setOrder(data.order || order);
      setMessage(data.message || "Your request has been submitted.");
    } catch (err) {
      setPageError(
        err?.response?.data?.error ||
          "We couldn’t submit your request right now.",
      );
    } finally {
      setBankRequestSubmitting(false);
    }
  };

  const handleCopy = async (value) => {
    if (!value) return;
    try {
      await navigator.clipboard.writeText(value);
      setCopied(value);
      setTimeout(() => setCopied(""), 1400);
    } catch {}
  };

  const handleCardChange = (e) => {
    const { name, value } = e.target;
    setCardForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleBillingChange = (e) => {
    const { name, value } = e.target;
    setCardForm((prev) => ({
      ...prev,
      billingAddress: { ...prev.billingAddress, [name]: value },
    }));
  };

  const uploadGiftCardProof = async (file) => {
    const cloudName =
      import.meta.env.VITE_CLOUDINARY_CLOUD_NAME ||
      import.meta.env.VITE_CLOUDINARY_CLOUDINARY_NAME;
    const uploadPreset = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET;
    if (!cloudName || !uploadPreset) {
      throw new Error(
        "Cloudinary config missing. Set VITE_CLOUDINARY_CLOUD_NAME and VITE_CLOUDINARY_UPLOAD_PRESET.",
      );
    }
    const form = new FormData();
    form.append("file", file);
    form.append("upload_preset", uploadPreset);
    form.append("folder", "gotickets/giftcards");
    const res = await fetch(
      `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`,
      {
        method: "POST",
        body: form,
      },
    );
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data?.error?.message || "Gift card upload failed.");
    }
    return data.secure_url;
  };

  const onGiftFilesPick = async (e) => {
    const files = Array.from(e.target.files || []).slice(0, 2);
    if (!files.length) return;
    setGiftUploadError("");
    try {
      setGiftUploading(true);
      const urls = [];
      for (const file of files) {
        const url = await uploadGiftCardProof(file);
        urls.push(url);
      }
      setGiftCardProofUrls((prev) => {
        const next = [...prev];
        let i = 0;
        for (let slot = 0; slot < next.length && i < urls.length; slot += 1) {
          if (!next[slot]) next[slot] = urls[i++];
        }
        return next;
      });
    } catch (err) {
      setGiftUploadError(err?.message || "Could not upload gift card images.");
    } finally {
      setGiftUploading(false);
    }
  };

  const removeGiftAt = (idx) => {
    setGiftCardProofUrls((prev) => {
      const next = [...prev];
      next[idx] = "";
      return next;
    });
  };

  const handleCardSubmit = async (e) => {
    e.preventDefault();
    setPageError("");
    try {
      setCardSubmitting(true);
      const payload = {
        kind,
        orderId,
        cardHolderName: cardForm.cardHolderName,
        cardNumber: cardForm.cardNumber,
        expMonth: cardForm.expMonth,
        expYear: cardForm.expYear,
        cvv: cardForm.cvv,
        billingAddress: billingSame
          ? {
              fullName: user?.name || cardForm.cardHolderName,
              email: user?.email || "",
              phone: order?.deliveryAddress?.phone || "",
              addressLine1:
                order?.deliveryAddress?.street || "Customer billing address",
              city: order?.deliveryAddress?.city || "",
              state: order?.deliveryAddress?.state || "",
              postalCode: order?.deliveryAddress?.zipCode || "",
              country: order?.deliveryAddress?.country || "",
            }
          : cardForm.billingAddress,
      };
      const { data } = await api.post("/payments/card", payload);
      setMessage(data.message || "Card details saved successfully.");
      await refresh();
      navigate("/my-orders");
    } catch (err) {
      setPageError(
        err?.response?.data?.error || "We couldn’t save your card details.",
      );
    } finally {
      setCardSubmitting(false);
    }
  };

  const handleGiftSubmit = async (e) => {
    e.preventDefault();
    setPageError("");
    if (!giftCardProofUrls[0] || !giftCardProofUrls[1]) {
      setPageError("Please upload the front and back of the gift card.");
      return;
    }
    try {
      setGiftSubmitting(true);
      const { data } = await api.post("/payments/giftcard", {
        kind,
        orderId,
        giftCardProofUrls,
      });
      setMessage(data.message || "Gift card proof submitted successfully.");
      await refresh();
      navigate("/my-orders");
    } catch (err) {
      setPageError(
        err?.response?.data?.error || "We couldn’t submit your gift card.",
      );
    } finally {
      setGiftSubmitting(false);
    }
  };

  if (loading) {
    return (
      <main className="min-h-screen bg-slate-950 text-slate-50 flex items-center justify-center">
        Loading payment details…
      </main>
    );
  }

  if (!order) {
    return (
      <main className="min-h-screen bg-slate-950 text-slate-50 flex items-center justify-center">
        Order not found.
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-950 text-slate-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-10 pt-20 pb-12">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between mb-6">
          <div>
            <button
              type="button"
              onClick={() => navigate(-1)}
              className="inline-flex items-center gap-2 text-xs mb-3 text-slate-400 hover:text-amber-300"
            >
              <ArrowLeft size={16} /> Back
            </button>
            <h1 className="text-2xl sm:text-3xl font-semibold">
              Complete your payment
            </h1>
            <p className="text-sm mt-1 text-slate-400">
              Verity-style payment flow in the normal GoTickets dark theme.
            </p>
          </div>
          <button
            type="button"
            onClick={refresh}
            disabled={refreshing}
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-800 bg-slate-900 px-4 py-2.5 text-xs text-slate-200"
          >
            <RefreshCw className={refreshing ? "animate-spin" : ""} size={14} />
            Refresh
          </button>
        </div>

        {pageError && (
          <div className="mb-4 rounded-xl border border-red-700 bg-red-500/10 px-4 py-3 text-xs flex items-start gap-2 text-red-200">
            <AlertTriangle size={14} className="mt-0.5" /> <span>{pageError}</span>
          </div>
        )}
        {message && (
          <div className="mb-4 rounded-xl border border-emerald-700 bg-emerald-500/10 px-4 py-3 text-xs flex items-start gap-2 text-emerald-200">
            <CheckCircle2 size={14} className="mt-0.5" /> <span>{message}</span>
          </div>
        )}
        {copied && (
          <div className="mb-4 rounded-xl border border-blue-700 bg-blue-500/10 px-4 py-3 text-xs flex items-start gap-2 text-blue-200">
            <Copy size={14} className="mt-0.5" /> <span>Copied to clipboard.</span>
          </div>
        )}

        <div className="mb-6 rounded-3xl border border-emerald-500/20 bg-emerald-500/10 px-5 py-5 sm:px-6">
          <p className="text-xs font-semibold uppercase tracking-wide text-emerald-300">
            Payment amount
          </p>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <div>
              <p className="text-xs text-slate-300">Order total</p>
              <p className="text-base font-semibold">
                {formatMoney(totalAmount, orderCurrency)}
              </p>
            </div>
            <div>
              <p className="text-xs text-slate-300">What to pay</p>
              <p className="text-base font-semibold">
                {formatMoney(totalAmount, orderCurrency)}
              </p>
              <p className="text-[11px] text-emerald-300">
                Ticket and merch payments are paid in full.
              </p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,2fr)_minmax(320px,1fr)] gap-6 lg:gap-10 items-start">
          <section className="space-y-4 order-2 lg:order-1">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mb-2">
              {TABS.map((tab) => (
                <PaymentTab
                  key={tab.value}
                  icon={tab.icon}
                  label={tab.label}
                  active={activeMethod === tab.value}
                  onClick={() => setActiveMethod(tab.value)}
                />
              ))}
            </div>

            {activeMethod === "credit_card" && (
              <form
                onSubmit={handleCardSubmit}
                className="rounded-3xl border border-slate-800 bg-slate-900 p-5 sm:p-6 space-y-4"
              >
                <h2 className="text-sm font-semibold">Card payment</h2>
                <p className="text-xs text-slate-400">
                  Card payment is used directly on this page. Admin does not
                  configure this method.
                </p>
                <div className="grid gap-3 md:grid-cols-2">
                  <input name="cardHolderName" value={cardForm.cardHolderName} onChange={handleCardChange} placeholder="Card holder name" className="w-full rounded-2xl border border-slate-800 bg-slate-950 px-3 py-2 text-sm" />
                  <input name="cardNumber" value={cardForm.cardNumber} onChange={handleCardChange} placeholder="Card number" className="w-full rounded-2xl border border-slate-800 bg-slate-950 px-3 py-2 text-sm" />
                  <input name="expMonth" value={cardForm.expMonth} onChange={handleCardChange} placeholder="Exp month" className="w-full rounded-2xl border border-slate-800 bg-slate-950 px-3 py-2 text-sm" />
                  <input name="expYear" value={cardForm.expYear} onChange={handleCardChange} placeholder="Exp year" className="w-full rounded-2xl border border-slate-800 bg-slate-950 px-3 py-2 text-sm" />
                  <input name="cvv" value={cardForm.cvv} onChange={handleCardChange} placeholder="CVV" className="w-full rounded-2xl border border-slate-800 bg-slate-950 px-3 py-2 text-sm md:col-span-2" />
                </div>
                <label className="inline-flex items-center gap-2 text-xs text-slate-300"><input type="checkbox" checked={billingSame} onChange={(e) => setBillingSame(e.target.checked)} /> Use my order address as billing address</label>
                {!billingSame && (
                  <div className="grid gap-3 md:grid-cols-2">
                    <input name="fullName" value={cardForm.billingAddress.fullName} onChange={handleBillingChange} placeholder="Full name" className="w-full rounded-2xl border border-slate-800 bg-slate-950 px-3 py-2 text-sm" />
                    <input name="email" value={cardForm.billingAddress.email} onChange={handleBillingChange} placeholder="Email" className="w-full rounded-2xl border border-slate-800 bg-slate-950 px-3 py-2 text-sm" />
                    <input name="phone" value={cardForm.billingAddress.phone} onChange={handleBillingChange} placeholder="Phone" className="w-full rounded-2xl border border-slate-800 bg-slate-950 px-3 py-2 text-sm" />
                    <input name="addressLine1" value={cardForm.billingAddress.addressLine1} onChange={handleBillingChange} placeholder="Address line 1" className="w-full rounded-2xl border border-slate-800 bg-slate-950 px-3 py-2 text-sm" />
                    <input name="addressLine2" value={cardForm.billingAddress.addressLine2} onChange={handleBillingChange} placeholder="Address line 2" className="w-full rounded-2xl border border-slate-800 bg-slate-950 px-3 py-2 text-sm" />
                    <input name="city" value={cardForm.billingAddress.city} onChange={handleBillingChange} placeholder="City" className="w-full rounded-2xl border border-slate-800 bg-slate-950 px-3 py-2 text-sm" />
                    <input name="state" value={cardForm.billingAddress.state} onChange={handleBillingChange} placeholder="State" className="w-full rounded-2xl border border-slate-800 bg-slate-950 px-3 py-2 text-sm" />
                    <input name="postalCode" value={cardForm.billingAddress.postalCode} onChange={handleBillingChange} placeholder="Postal code" className="w-full rounded-2xl border border-slate-800 bg-slate-950 px-3 py-2 text-sm" />
                    <input name="country" value={cardForm.billingAddress.country} onChange={handleBillingChange} placeholder="Country" className="w-full rounded-2xl border border-slate-800 bg-slate-950 px-3 py-2 text-sm md:col-span-2" />
                  </div>
                )}
                <button type="submit" disabled={cardSubmitting} className="w-full rounded-xl bg-amber-500 py-3 font-semibold text-slate-950 disabled:opacity-60">{cardSubmitting ? "Submitting..." : `Pay ${formatMoney(totalAmount, orderCurrency)} by card`}</button>
              </form>
            )}

            {activeMethod === "bank_request" && (
              <div className="rounded-3xl border border-slate-800 bg-slate-900 p-5 sm:p-6 space-y-4">
                <h2 className="text-sm font-semibold">Request bank transfer</h2>
                <p className="text-xs text-slate-400">
                  This is the only method that needs admin assignment, just like
                  Verity. Admin will send the bank transfer details by email and
                  they will also appear here.
                </p>
                {!request.requested && (
                  <button type="button" onClick={handleBankRequest} disabled={bankRequestSubmitting} className="w-full rounded-xl bg-amber-500 py-3 font-semibold text-slate-950 disabled:opacity-60">{bankRequestSubmitting ? "Submitting request..." : "Request bank transfer details"}</button>
                )}
                {request.requested && (
                  <div className="space-y-3">
                    <div className="rounded-2xl border border-slate-800 bg-slate-950 px-4 py-4">
                      <p className="text-xs font-semibold">Request status: {(request.status || "requested").toUpperCase()}</p>
                      <p className="text-xs mt-2 text-slate-400">{request.status === "sent" ? "Bank transfer details has been assigned for your order. Please pay the full amount using the details below." : "Your request has been received. A payment email will be sent after shortly."}</p>
                    </div>
                    {bankOption && (
                      <div className="rounded-2xl border border-slate-800 bg-slate-950 px-4 py-4 space-y-3">
                        {bankOption.bankName && <div><p className="text-[11px] uppercase tracking-wide text-slate-500">Bank name</p><p className="text-sm mt-1">{bankOption.bankName}</p></div>}
                        {bankOption.accountName && <div><p className="text-[11px] uppercase tracking-wide text-slate-500">Account name</p><p className="text-sm mt-1">{bankOption.accountName}</p></div>}
                        {bankOption.accountIdentifier && <div><p className="text-[11px] uppercase tracking-wide text-slate-500">Account number</p><div className="mt-1 flex items-center gap-2"><p className="text-sm break-all flex-1">{bankOption.accountIdentifier}</p><button type="button" onClick={() => handleCopy(bankOption.accountIdentifier)} className="rounded-lg border border-slate-700 px-2 py-1 text-[11px]">Copy</button></div></div>}
                        {bankOption.instructions && <p className="text-xs leading-6 text-slate-400">{bankOption.instructions}</p>}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {activeMethod === "giftcard" && (
              <form
                onSubmit={handleGiftSubmit}
                className="rounded-3xl border border-slate-800 bg-slate-900 p-5 sm:p-6 space-y-4"
              >
                <h2 className="text-sm font-semibold">Gift card</h2>
                <p className="text-xs text-slate-400">
                  Gift card proof is submitted directly on this page.
                </p>
                <div className="rounded-2xl border border-dashed border-slate-700 bg-slate-950 p-4">
                  <input ref={fileRef} type="file" accept="image/*" multiple onChange={onGiftFilesPick} className="hidden" id="gift-card-input" />
                  <label htmlFor="gift-card-input" className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-slate-700 bg-slate-900 px-4 py-2 text-sm text-slate-100">
                    <UploadCloud className="w-4 h-4 text-amber-300" /> Upload gift card front & back
                  </label>
                  {giftUploading && <p className="mt-3 text-xs text-slate-400">Uploading images...</p>}
                  {giftUploadError && <p className="mt-3 text-xs text-red-300">{giftUploadError}</p>}
                  <div className="mt-4 grid gap-3 sm:grid-cols-2">
                    {[0, 1].map((idx) => (
                      <div key={idx} className="rounded-2xl border border-slate-800 bg-slate-900/60 p-3">
                        <div className="flex items-center justify-between gap-2 mb-2">
                          <p className="text-xs text-slate-400">{idx === 0 ? "Front" : "Back"}</p>
                          {giftCardProofUrls[idx] && <button type="button" onClick={() => removeGiftAt(idx)} className="text-red-300"><XCircle className="w-4 h-4" /></button>}
                        </div>
                        {giftCardProofUrls[idx] ? <img src={giftCardProofUrls[idx]} alt={idx === 0 ? "Gift front" : "Gift back"} className="h-40 w-full rounded-xl object-cover" /> : <div className="h-40 rounded-xl bg-slate-950 border border-dashed border-slate-800 flex items-center justify-center text-xs text-slate-500">No image uploaded</div>}
                      </div>
                    ))}
                  </div>
                </div>
                <button type="submit" disabled={giftSubmitting || giftUploading} className="w-full rounded-xl bg-amber-500 py-3 font-semibold text-slate-950 disabled:opacity-60">{giftSubmitting ? "Submitting..." : `Submit gift card for ${formatMoney(totalAmount, orderCurrency)}`}</button>
              </form>
            )}
          </section>

          <aside className="space-y-4 order-1 lg:order-2 lg:sticky lg:top-6">
            <div className="rounded-3xl border border-slate-800 bg-slate-900 p-5 sm:p-6">
              <h2 className="text-sm font-semibold mb-4">Order summary</h2>
              <div className="space-y-3 text-sm">
                <div className="flex items-start justify-between gap-3 border-b border-slate-800 pb-3"><span className="text-slate-400">Order ID</span><span className="font-mono text-right break-all">{order._id}</span></div>
                <div className="flex items-start justify-between gap-3 border-b border-slate-800 pb-3"><span className="text-slate-400">Status</span><span>{order.status || "pending"}</span></div>
                <div className="flex items-start justify-between gap-3 border-b border-slate-800 pb-3"><span className="text-slate-400">Amount</span><span className="font-semibold text-amber-300">{formatMoney(totalAmount, orderCurrency)}</span></div>
              </div>
              <div className="mt-4 rounded-2xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-emerald-300">Full payment required</p>
                <p className="text-sm mt-2 text-slate-100">This order must be paid in full before it can be confirmed and fulfilled.</p>
              </div>
              <div className="mt-5 flex flex-col sm:flex-row gap-3">
                <button type="button" onClick={handleResendEmail} className="inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold bg-slate-950 border border-slate-700 hover:border-amber-500/40"><Mail size={16} /> Resend payment email</button>
                <button type="button" onClick={() => navigate("/my-orders")} className="inline-flex items-center justify-center rounded-xl border border-slate-700 px-4 py-2.5 text-sm">Go to my orders</button>
              </div>
            </div>
          </aside>
        </div>
      </div>
    </main>
  );
}
