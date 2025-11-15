import React, { useEffect, useState } from "react";
import {
  ArrowLeft,
  Settings,
  Banknote,
  AlertTriangle,
  Save,
  CreditCard,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import api from "../../api/axios";
import { useAuth } from "../../context/AuthContext";

const METHODS = [
  { value: "paypal", label: "PayPal" },
  { value: "cashapp", label: "CashApp" },
  { value: "zelle", label: "Zelle" },
  { value: "bank_transfer", label: "Bank Transfer" },
];

const emptyConfig = {
  isActive: false,
  recipientInfo: {
    email: "",
    username: "",
    phone: "",
    bankName: "",
    accountName: "",
    accountNumber: "",
  },
  instructions: "",
};

export default function AdminPaymentConfig() {
  const navigate = useNavigate();
  const { user } = useAuth();

  // Guard
  useEffect(() => {
    if (!user) {
      navigate("/login", {
        state: {
          from: "/admin/payment-config",
          message: "Sign in with an admin account to manage payment settings.",
        },
      });
      return;
    }
    if (user.role !== "admin") {
      navigate("/");
    }
  }, [user, navigate]);

  const [configs, setConfigs] = useState({});
  const [loading, setLoading] = useState(true);
  const [pageError, setPageError] = useState("");

  const [currentMethod, setCurrentMethod] = useState(METHODS[0].value);
  const [form, setForm] = useState(emptyConfig);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");
  const [formSuccess, setFormSuccess] = useState("");

  const loadConfigs = async () => {
    try {
      setLoading(true);
      setPageError("");
      const res = await api.get("/admin/payment-configs");
      const list = res.data?.configs || [];

      const map = {};
      list.forEach((cfg) => {
        map[cfg.method] = {
          isActive: cfg.isActive ?? false,
          recipientInfo: {
            email: cfg.recipientInfo?.email || "",
            username: cfg.recipientInfo?.username || "",
            phone: cfg.recipientInfo?.phone || "",
            bankName: cfg.recipientInfo?.bankName || "",
            accountName: cfg.recipientInfo?.accountName || "",
            accountNumber: cfg.recipientInfo?.accountNumber || "",
          },
          instructions: cfg.instructions || "",
        };
      });

      setConfigs(map);
      const initial = map[currentMethod] || emptyConfig;
      setForm(initial);
    } catch (err) {
      const msg =
        err?.response?.data?.error ||
        err?.response?.data?.message ||
        "Unable to load payment configuration.";
      setPageError(msg);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!user || user.role !== "admin") return;
    loadConfigs();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const handleMethodChange = (value) => {
    setCurrentMethod(value);
    setFormError("");
    setFormSuccess("");
    setForm(configs[value] || emptyConfig);
  };

  const handleToggleActive = () => {
    setForm((prev) => ({
      ...prev,
      isActive: !prev.isActive,
    }));
    setFormError("");
    setFormSuccess("");
  };

  const handleRecipientChange = (field, value) => {
    setForm((prev) => ({
      ...prev,
      recipientInfo: {
        ...prev.recipientInfo,
        [field]: value,
      },
    }));
    setFormError("");
    setFormSuccess("");
  };

  const handleInstructionsChange = (value) => {
    setForm((prev) => ({ ...prev, instructions: value }));
    setFormError("");
    setFormSuccess("");
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setFormError("");
    setFormSuccess("");

    // Basic validation per method
    if (form.isActive) {
      if (currentMethod === "paypal" && !form.recipientInfo.email) {
        setFormError("For PayPal, recipient email is required.");
        return;
      }
      if (currentMethod === "cashapp" && !form.recipientInfo.username) {
        setFormError("For CashApp, $tag / username is required.");
        return;
      }
      if (currentMethod === "zelle" && !form.recipientInfo.email && !form.recipientInfo.phone) {
        setFormError("For Zelle, email or phone is required.");
        return;
      }
      if (
        currentMethod === "bank_transfer" &&
        (!form.recipientInfo.bankName ||
          !form.recipientInfo.accountName ||
          !form.recipientInfo.accountNumber)
      ) {
        setFormError(
          "For Bank Transfer, bank name, account name and account number are required."
        );
        return;
      }
    }

    try {
      setSaving(true);
      const payload = {
        method: currentMethod,
        isActive: form.isActive,
        recipientInfo: form.recipientInfo,
        instructions: form.instructions || "",
      };
      await api.put(`/admin/payment-config/${currentMethod}`, payload);

      const newConfigs = {
        ...configs,
        [currentMethod]: payload,
      };
      setConfigs(newConfigs);
      setFormSuccess("Payment configuration saved.");
    } catch (err) {
      const msg =
        err?.response?.data?.error ||
        err?.response?.data?.message ||
        "Unable to save this payment configuration.";
      setFormError(msg);
    } finally {
      setSaving(false);
    }
  };

  const currentLabel =
    METHODS.find((m) => m.value === currentMethod)?.label || currentMethod;

  const anyActive = METHODS.filter(
    (m) => configs[m.value]?.isActive
  ).map((m) => m.label);

  return (
    <div className="min-h-screen bg-linear-to-br from-slate-950 via-slate-900 to-slate-950 text-slate-50">
      <div className="max-w-4xl mx-auto px-4 pt-20 pb-16 md:px-8 lg:px-10 lg:pt-24">
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
              <Settings className="w-5 h-5 text-amber-400" />
              Payment configuration
            </h1>
            <p className="mt-1 text-xs md:text-sm text-slate-400 max-w-xl">
              Control how customers pay when they choose manual payment methods
              like PayPal, CashApp, Zelle or bank transfers.
            </p>
          </div>

          <div className="rounded-2xl bg-slate-900/80 border border-slate-800 px-3 py-2 text-[11px] text-slate-300 flex flex-col items-end gap-1">
            <div className="inline-flex items-center gap-1">
              <Banknote className="w-3.5 h-3.5 text-emerald-400" />
              <span>Active channels:</span>
            </div>
            <p className="text-[11px] text-slate-200">
              {anyActive.length > 0 ? anyActive.join(", ") : "None active"}
            </p>
          </div>
        </div>

        {pageError && (
          <div className="mb-4 rounded-2xl bg-red-500/10 border border-red-500/40 px-4 py-3 text-xs text-red-100 flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 mt-0.5" />
            <span>{pageError}</span>
          </div>
        )}

        {loading ? (
          <div className="rounded-3xl bg-slate-900/80 border border-slate-800 p-6 animate-pulse">
            <div className="h-8 w-40 bg-slate-800 rounded-2xl mb-4" />
            <div className="h-4 w-32 bg-slate-800 rounded-full mb-2" />
            <div className="h-4 w-44 bg-slate-800 rounded-full" />
          </div>
        ) : (
          <form
            onSubmit={handleSave}
            className="rounded-3xl bg-slate-900/80 border border-slate-800 p-5 md:p-6 flex flex-col gap-4"
          >
            {/* Method selector */}
            <div className="flex items-center justify-between gap-3">
              <div className="space-y-1">
                <p className="text-[11px] text-slate-400 uppercase tracking-[0.18em]">
                  Payment channel
                </p>
                <p className="text-xs text-slate-300">
                  You&apos;re editing settings for{" "}
                  <span className="font-semibold text-slate-100">
                    {currentLabel}
                  </span>
                  .
                </p>
              </div>
              <select
                value={currentMethod}
                onChange={(e) => handleMethodChange(e.target.value)}
                className="rounded-xl bg-slate-950/80 border border-slate-800 px-3 py-2 text-[11px] text-slate-50 focus:outline-none focus:ring-1 focus:ring-amber-500/70 focus:border-amber-500/70"
              >
                {METHODS.map((m) => (
                  <option key={m.value} value={m.value}>
                    {m.label}
                  </option>
                ))}
              </select>
            </div>

            {formError && (
              <div className="rounded-2xl bg-red-500/10 border border-red-500/40 px-3 py-2 text-[11px] text-red-100 flex items-start gap-2">
                <AlertTriangle className="w-3.5 h-3.5 mt-0.5" />
                <span>{formError}</span>
              </div>
            )}

            {formSuccess && (
              <div className="rounded-2xl bg-emerald-500/10 border border-emerald-500/40 px-3 py-2 text-[11px] text-emerald-100">
                {formSuccess}
              </div>
            )}

            {/* Active toggle */}
            <div className="flex items-center justify-between rounded-2xl bg-slate-950/80 border border-slate-800 px-3 py-2.5">
              <div className="flex items-center gap-2">
                <CreditCard className="w-4 h-4 text-emerald-400" />
                <div>
                  <p className="text-[11px] text-slate-200 font-medium">
                    Enable {currentLabel}
                  </p>
                  <p className="text-[11px] text-slate-500">
                    When active, customers will see this as a payment option at
                    checkout.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={handleToggleActive}
                className={`relative inline-flex h-6 w-10 items-center rounded-full border transition-colors ${
                  form.isActive
                    ? "bg-emerald-500/80 border-emerald-400"
                    : "bg-slate-800 border-slate-600"
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-slate-950 shadow transition-transform ${
                    form.isActive ? "translate-x-4" : "translate-x-1"
                  }`}
                />
              </button>
            </div>

            {/* Fields per method */}
            {currentMethod === "paypal" && (
              <div className="space-y-3">
                <div className="space-y-1">
                  <label className="text-[11px] text-slate-400">
                    PayPal email
                  </label>
                  <input
                    type="email"
                    value={form.recipientInfo.email}
                    onChange={(e) =>
                      handleRecipientChange("email", e.target.value)
                    }
                    placeholder="merchant@example.com"
                    className="w-full rounded-xl bg-slate-950/80 border border-slate-800 px-3 py-2 text-xs text-slate-50 placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-amber-500/70 focus:border-amber-500/70"
                  />
                </div>
                <p className="text-[11px] text-slate-500">
                  This email will be shown to the customer as the PayPal
                  recipient. Make sure it matches your actual business account.
                </p>
              </div>
            )}

            {currentMethod === "cashapp" && (
              <div className="space-y-3">
                <div className="space-y-1">
                  <label className="text-[11px] text-slate-400">
                    CashApp $tag / username
                  </label>
                  <input
                    type="text"
                    value={form.recipientInfo.username}
                    onChange={(e) =>
                      handleRecipientChange("username", e.target.value)
                    }
                    placeholder="$YourTagHere"
                    className="w-full rounded-xl bg-slate-950/80 border border-slate-800 px-3 py-2 text-xs text-slate-50 placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-amber-500/70 focus:border-amber-500/70"
                  />
                </div>
                <p className="text-[11px] text-slate-500">
                  Customers will be instructed to send funds to this handle, so
                  double-check spelling.
                </p>
              </div>
            )}

            {currentMethod === "zelle" && (
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-[11px] text-slate-400">
                      Zelle email
                    </label>
                    <input
                      type="email"
                      value={form.recipientInfo.email}
                      onChange={(e) =>
                        handleRecipientChange("email", e.target.value)
                      }
                      placeholder="zelle@example.com"
                      className="w-full rounded-xl bg-slate-950/80 border border-slate-800 px-3 py-2 text-xs text-slate-50 placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-amber-500/70 focus:border-amber-500/70"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[11px] text-slate-400">
                      Zelle phone
                    </label>
                    <input
                      type="tel"
                      value={form.recipientInfo.phone}
                      onChange={(e) =>
                        handleRecipientChange("phone", e.target.value)
                      }
                      placeholder="+1..."
                      className="w-full rounded-xl bg-slate-950/80 border border-slate-800 px-3 py-2 text-xs text-slate-50 placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-amber-500/70 focus:border-amber-500/70"
                    />
                  </div>
                </div>
                <p className="text-[11px] text-slate-500">
                  Customers can pay via email or phone, depending on how their
                  bank supports Zelle.
                </p>
              </div>
            )}

            {currentMethod === "bank_transfer" && (
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-[11px] text-slate-400">
                      Bank name
                    </label>
                    <input
                      type="text"
                      value={form.recipientInfo.bankName}
                      onChange={(e) =>
                        handleRecipientChange("bankName", e.target.value)
                      }
                      placeholder="GTBank, Access..."
                      className="w-full rounded-xl bg-slate-950/80 border border-slate-800 px-3 py-2 text-xs text-slate-50 placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-amber-500/70 focus:border-amber-500/70"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[11px] text-slate-400">
                      Account name
                    </label>
                    <input
                      type="text"
                      value={form.recipientInfo.accountName}
                      onChange={(e) =>
                        handleRecipientChange(
                          "accountName",
                          e.target.value
                        )
                      }
                      placeholder="Your Business Name"
                      className="w-full rounded-xl bg-slate-950/80 border border-slate-800 px-3 py-2 text-xs text-slate-50 placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-amber-500/70 focus:border-amber-500/70"
                    />
                  </div>
                </div>
                <div className="space-y-1">
                  <label className="text-[11px] text-slate-400">
                    Account number
                  </label>
                  <input
                    type="text"
                    value={form.recipientInfo.accountNumber}
                    onChange={(e) =>
                      handleRecipientChange("accountNumber", e.target.value)
                    }
                    placeholder="0000000000"
                    className="w-full rounded-xl bg-slate-950/80 border border-slate-800 px-3 py-2 text-xs text-slate-50 placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-amber-500/70 focus:border-amber-500/70"
                  />
                </div>
                <p className="text-[11px] text-slate-500">
                  These details will be displayed exactly as entered, so make
                  sure they match your bank account.
                </p>
              </div>
            )}

            {/* General instructions */}
            <div className="space-y-1">
              <label className="text-[11px] text-slate-400">
                Extra instructions (shown to customer)
              </label>
              <textarea
                value={form.instructions}
                onChange={(e) => handleInstructionsChange(e.target.value)}
                placeholder="Explain how to confirm payment, what reference to use, etc."
                className="w-full rounded-xl bg-slate-950/80 border border-slate-800 px-3 py-2 text-[11px] text-slate-50 placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-amber-500/70 focus:border-amber-500/70 resize-none min-h-20"
              />
              <p className="text-[11px] text-slate-500">
                This text appears on the checkout page when a user chooses this
                payment method. Keep it short but clear.
              </p>
            </div>

            {/* Save */}
            <div className="flex items-center justify-between mt-2">
              <button
                type="submit"
                disabled={saving}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-amber-500 hover:bg-amber-400 disabled:bg-amber-500/60 text-slate-950 font-semibold text-sm px-4 py-2.5 transition-all shadow-lg shadow-amber-500/30"
              >
                {saving ? (
                  <>
                    <span className="h-4 w-4 border-2 border-slate-900/70 border-t-transparent rounded-full animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4" />
                    Save configuration
                  </>
                )}
              </button>
              <p className="text-[11px] text-slate-500">
                Changes apply immediately for new orders.
              </p>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
