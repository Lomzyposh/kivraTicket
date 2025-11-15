import { useEffect, useState, useMemo } from "react";
import { useNavigate, Link } from "react-router-dom";
import api from "../api/axios";
import { useAuth } from "../context/AuthContext";
import {
  ArrowLeft,
  ShoppingCart,
  Ticket,
  AlertTriangle,
  Loader2,
} from "lucide-react";

function classNames(...xs) {
  return xs.filter(Boolean).join(" ");
}

function currencySymbol(code) {
  if (!code) return "";
  if (code === "USD") return "$";
  if (code === "NGN") return "₦";
  if (code === "GBP") return "£";
  if (code === "EUR") return "€";
  return "";
}

export default function Cart() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [cart, setCart] = useState(null);
  const [totals, setTotals] = useState(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  useEffect(() => {
    if (!user) {
      navigate("/login?next=/cart", { replace: true });
      return;
    }

    const fetchCart = async () => {
      try {
        setLoading(true);
        setErr("");
        const { data } = await api.get("/cart");
        setCart(data.cart || { items: [] });
        setTotals(data.totals || null);
      } catch (e) {
        const msg =
          e?.response?.data?.error ||
          e?.response?.data?.message ||
          "We couldn't load your cart.";
        setErr(msg);
      } finally {
        setLoading(false);
      }
    };

    fetchCart();
  }, [user, navigate]);

  const currency = useMemo(() => cart?.items?.[0]?.currency || "USD", [cart]);

  const symbol = currencySymbol(currency);

  const itemCount = totals?.itemCount || 0;
  const totalQty = totals?.totalQuantity || 0;
  const totalAmount = totals?.totalAmount || 0;

  const bg = "#020617";
  const surface = "#0b1220";
  const border = "#1f2937";
  const text = "#e5e7eb";
  const muted = "#9ca3af";
  const accent = "#fbbf24";

  const isEmpty = !loading && (!cart || !cart.items || cart.items.length === 0);

  return (
    <div style={{ background: bg, color: text, minHeight: "100dvh" }}>
      <div className="mx-auto w-full max-w-6xl px-4 py-6 sm:py-8 lg:py-10">
        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <div>
            <button
              type="button"
              onClick={() => navigate(-1)}
              className="inline-flex items-center gap-1.5 text-xs text-slate-300 hover:text-amber-300 mb-2"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              Back
            </button>
            <h1 className="text-2xl sm:text-3xl font-bold flex items-center gap-2">
              <ShoppingCart className="w-6 h-6 text-amber-400" />
              Cart
            </h1>
            <p className="text-xs sm:text-sm" style={{ color: muted }}>
              All your merch and lifestyle items ready to check out.
            </p>
          </div>

          <Link
            to="/merch"
            className="hidden sm:inline-flex items-center gap-1.5 rounded-xl px-4 py-2 text-xs font-semibold"
            style={{
              background: surface,
              color: text,
              border: `1px solid ${border}`,
            }}
          >
            <Ticket className="w-3.5 h-3.5 text-amber-400" />
            Continue shopping
          </Link>
        </div>

        {/* Error */}
        {err && (
          <div
            className="mb-4 rounded-2xl px-4 py-3 text-xs flex items-start gap-2"
            style={{
              background: "rgba(248, 113, 113, 0.08)",
              border: "1px solid rgba(248, 113, 113, 0.6)",
              color: "#fecaca",
            }}
          >
            <AlertTriangle className="w-4 h-4 mt-0.5" />
            <span>{err}</span>
          </div>
        )}

        {/* Loading */}
        {loading && (
          <div
            className="rounded-2xl px-4 py-6 flex items-center justify-center gap-2 text-sm"
            style={{ background: surface, border: `1px solid ${border}` }}
          >
            <Loader2 className="w-4 h-4 animate-spin text-amber-400" />
            <span>Loading your cart…</span>
          </div>
        )}

        {/* Empty state */}
        {isEmpty && (
          <div
            className="rounded-3xl px-6 py-10 text-center flex flex-col items-center justify-center gap-3"
            style={{ background: surface, border: `1px solid ${border}` }}
          >
            <ShoppingCart className="w-7 h-7 text-amber-400 mb-1" />
            <p className="text-sm font-semibold text-slate-100">
              Your cart is empty.
            </p>
            <p className="text-xs text-slate-400 max-w-sm">
              Add some merch and lifestyle items from our store, then come back
              here to review your order before checkout.
            </p>
            <Link
              to="/merch"
              className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-amber-400/90 text-slate-950 px-4 py-1.5 text-xs font-semibold hover:bg-amber-300 transition-colors"
            >
              <Ticket className="w-3.5 h-3.5" />
              Browse merch
            </Link>
          </div>
        )}

        {/* Cart content */}
        {!loading && !isEmpty && (
          <div className="grid gap-4 lg:grid-cols-[minmax(0,3fr),minmax(260px,1.2fr)] mt-3">
            {/* Left: items */}
            <div
              className="rounded-3xl p-4 sm:p-5 space-y-3"
              style={{ background: surface, border: `1px solid ${border}` }}
            >
              {cart.items.map((it) => {
                const lineTotal = (it.quantity || 0) * (it.price || 0);
                const title = it.title || it.merch?.title || "Merch item";
                const brand = it.brand || it.merch?.brand;
                const img =
                  it.image ||
                  it.merch?.images?.[0] ||
                  "https://via.placeholder.com/400x300?text=Merch";

                return (
                  <div
                    key={it._id}
                    className="flex gap-3 sm:gap-4 border-b border-slate-800/70 pb-3 last:border-b-0 last:pb-0"
                  >
                    {/* image */}
                    <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-2xl overflow-hidden border border-slate-800/80 flex-shrink-0">
                      <img
                        src={img}
                        alt={title}
                        className="w-full h-full object-cover"
                      />
                    </div>

                    {/* details */}
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-1">
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-slate-50 truncate">
                            {title}
                          </p>
                          {brand && (
                            <p className="text-[11px] text-slate-400">
                              {brand}
                            </p>
                          )}
                          <p className="text-[11px] text-slate-400 mt-0.5">
                            Size:{" "}
                            <span className="text-slate-200 font-medium">
                              {it.size}
                            </span>{" "}
                            • Color:{" "}
                            <span className="text-slate-200 font-medium">
                              {it.color}
                            </span>
                          </p>
                        </div>

                        <div className="text-right sm:text-right text-xs">
                          <p className="text-slate-300">
                            Unit:{" "}
                            <span className="font-semibold text-slate-50">
                              {symbol}
                              {Number(it.price || 0).toLocaleString()}
                            </span>
                          </p>
                          <p className="text-slate-300">
                            Qty:{" "}
                            <span className="font-semibold text-slate-50">
                              {it.quantity}
                            </span>
                          </p>
                        </div>
                      </div>

                      {/* line total */}
                      <div className="mt-1 flex items-center justify-between text-xs">
                        <span className="text-slate-400">Line total</span>
                        <span className="text-slate-100 font-semibold">
                          {symbol}
                          {lineTotal.toLocaleString()}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Right: summary */}
            <div
              className="rounded-3xl p-4 sm:p-5 h-fit space-y-3"
              style={{ background: surface, border: `1px solid ${border}` }}
            >
              <h2 className="text-sm font-semibold text-slate-100 flex items-center gap-2">
                Order summary
              </h2>

              <div className="space-y-2 text-xs">
                <div className="flex items-center justify-between">
                  <span style={{ color: muted }}>Unique items</span>
                  <span className="text-slate-100 font-medium">
                    {itemCount}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span style={{ color: muted }}>Total quantity</span>
                  <span className="text-slate-100 font-medium">{totalQty}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span style={{ color: muted }}>Merch total</span>
                  <span className="text-slate-100 font-semibold">
                    {symbol}
                    {totalAmount.toLocaleString()}
                  </span>
                </div>
              </div>

              <div className="rounded-2xl px-3 py-2 text-[11px] bg-slate-950/80 border border-slate-800/80">
                <p className="text-slate-300">
                  This total is for <span style={{ color: accent }}>merch</span>{" "}
                  only. Your event tickets and fees will be calculated during
                  checkout.
                </p>
              </div>

              <button
                type="button"
                disabled={itemCount === 0}
                className={classNames(
                  "w-full mt-1 inline-flex items-center justify-center gap-1.5 rounded-xl px-4 py-2 text-xs font-semibold transition",
                  itemCount === 0
                    ? "opacity-50 cursor-not-allowed"
                    : "hover:opacity-90"
                )}
                style={{
                  background: accent,
                  color: "#020617",
                }}
                onClick={() => navigate("/checkout-cart")}
              >
                Proceed to checkout
              </button>

              <button
                type="button"
                onClick={() => navigate("/merch")}
                className="w-full inline-flex items-center justify-center gap-1.5 rounded-xl px-4 py-2 text-xs font-semibold border mt-2"
                style={{
                  borderColor: border,
                  background: surface,
                  color: text,
                }}
              >
                <Ticket className="w-3.5 h-3.5 text-amber-400" />
                Continue shopping
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
