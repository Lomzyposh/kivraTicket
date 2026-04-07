import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, AlertTriangle, ShieldCheck } from "lucide-react";
import api from "../api/axios";
import { useAuth } from "../context/AuthContext";

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

export default function CartCheckout() {
  const navigate = useNavigate();
  const { user, loading: authLoading} = useAuth();

  const [cart, setCart] = useState(null);
  const [totals, setTotals] = useState(null);
  const [loadingCart, setLoadingCart] = useState(true);
  const [cartError, setCartError] = useState("");

  const [processingOrder, setProcessingOrder] = useState(false);
  const [orderError, setOrderError] = useState("");
  const [orderSuccess, setOrderSuccess] = useState("");

  const [address, setAddress] = useState({
    fullName: "",
    phone: "",
    street: "",
    city: "",
    state: "",
    zipCode: "",
    country: "",
  });

  const handleAddressChange = (field, value) => {
    setAddress((prev) => ({ ...prev, [field]: value }));
    setOrderError("");
  };

  useEffect(() => {
    if (!user && !authLoading) {
      navigate("/login", {
        state: {
          from: "/checkout-cart",
          message: "Sign in to complete your merch purchase.",
        },
      });
    }
  }, [user, navigate]);

  useEffect(() => {
    let active = true;

    const fetchCart = async () => {
      try {
        setLoadingCart(true);
        setCartError("");
        const { data } = await api.get("/cart");
        if (!active) return;
        setCart(data.cart || { items: [] });
        setTotals(data.totals || null);
      } catch (err) {
        if (!active) return;
        const msg =
          err?.response?.data?.error ||
          "We couldn’t load your cart for checkout.";
        setCartError(msg);
      } finally {
        if (active) setLoadingCart(false);
      }
    };

    fetchCart();
    return () => {
      active = false;
    };
  }, []);

  const currency = useMemo(() => cart?.items?.[0]?.currency || "USD", [cart]);
  const symbol = currencySymbol(currency);

  const totalQty = totals?.totalQuantity || 0;
  const totalAmount = totals?.totalAmount || 0;

  const isEmpty =
    !loadingCart && (!cart || !cart.items || cart.items.length === 0);

  const handlePlaceOrder = async (e) => {
    e.preventDefault();
    setOrderError("");
    setOrderSuccess("");

    if (!user) {
      setOrderError("You must be signed in to place an order.");
      return;
    }

    if (isEmpty) {
      setOrderError("Your cart is empty.");
      return;
    }

    for (const key of [
      "fullName",
      "phone",
      "street",
      "city",
      "state",
      "zipCode",
      "country",
    ]) {
      if (!String(address[key] || "").trim()) {
        setOrderError("Please complete all required delivery address fields.");
        return;
      }
    }

    try {
      setProcessingOrder(true);

      const res = await api.post("/cart/checkout", {
        deliveryAddress: address,
      });

      const createdOrderId = res.data?.order?._id;
      setOrderSuccess(
        res.data?.message ||
          "Your merch order has been placed successfully. Redirecting to the payment page...",
      );

      navigate(
        createdOrderId
          ? `/payment?kind=merch&orderId=${createdOrderId}`
          : "/my-orders",
      );
    } catch (err) {
      const msg =
        err?.response?.data?.error || "We couldn’t complete your checkout.";
      setOrderError(msg);
    } finally {
      setProcessingOrder(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-50">
      <div className="max-w-5xl mx-auto px-4 pt-20 pb-16">
        <div className="flex items-center justify-between mb-5">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="flex items-center gap-1.5 text-xs text-slate-300 hover:text-amber-300"
          >
            <ArrowLeft className="w-3.5 h-3.5" /> Back
          </button>

          <div className="flex items-center gap-1 text-[11px] text-slate-400">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
            Secure checkout
          </div>
        </div>

        <div className="grid md:grid-cols-[1.1fr,1fr] gap-8">
          <div className="rounded-3xl bg-slate-900 border border-slate-800 p-6">
            <h2 className="text-sm font-semibold mb-3">Order Summary</h2>

            {loadingCart && <p className="text-sm">Loading cart...</p>}

            {!loadingCart && cartError && (
              <div className="rounded-xl bg-red-500/20 border border-red-700 text-xs text-red-200 px-3 py-2">
                {cartError}
              </div>
            )}

            {!loadingCart &&
              !cartError &&
              cart?.items?.map((it) => {
                const img =
                  it.image ||
                  it.merch?.images?.[0] ||
                  "https://via.placeholder.com/300x300?text=Merch";

                const lineTotal = Number(it.quantity) * Number(it.price);

                return (
                  <div
                    key={it._id}
                    className="flex gap-3 border-b border-slate-800 py-3"
                  >
                    <div className="h-16 w-16 rounded-xl overflow-hidden bg-slate-800">
                      <img
                        src={img}
                        alt={it.title}
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-semibold">{it.title}</p>
                      <p className="text-xs text-slate-400">
                        {it.size} • {it.color}
                      </p>
                      <p className="text-xs text-amber-300 mt-1">
                        {symbol}
                        {lineTotal.toLocaleString()}
                      </p>
                    </div>
                  </div>
                );
              })}

            {!loadingCart && totals && (
              <div className="mt-4 text-sm">
                <div className="flex justify-between">
                  <span>Total Quantity</span>
                  <span>{totalQty}</span>
                </div>
                <div className="flex justify-between font-semibold text-amber-300 mt-2">
                  <span>Total</span>
                  <span>
                    {symbol}
                    {totalAmount.toLocaleString()}
                  </span>
                </div>
              </div>
            )}
          </div>

          <form
            onSubmit={handlePlaceOrder}
            className="rounded-3xl bg-slate-900 border border-slate-800 p-6 flex flex-col gap-5"
          >
            {orderError && (
              <div className="rounded-xl bg-red-500/20 border border-red-700 text-xs text-red-200 px-3 py-2 flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 mt-0.5" />
                <span>{orderError}</span>
              </div>
            )}

            {orderSuccess && (
              <div className="rounded-xl bg-emerald-500/20 border border-emerald-700 text-xs text-emerald-200 px-3 py-2">
                {orderSuccess}
              </div>
            )}

            <div>
              <p className="text-xs text-slate-400 uppercase tracking-wide mb-2">
                Delivery address
              </p>

              <div className="space-y-3">
                <input
                  type="text"
                  placeholder="Full name"
                  value={address.fullName}
                  onChange={(e) =>
                    handleAddressChange("fullName", e.target.value)
                  }
                  className="w-full bg-slate-950/60 border border-slate-800 px-3 py-2 rounded-lg text-sm text-slate-100"
                />

                <input
                  type="text"
                  placeholder="Phone number"
                  value={address.phone}
                  onChange={(e) => handleAddressChange("phone", e.target.value)}
                  className="w-full bg-slate-950/60 border border-slate-800 px-3 py-2 rounded-lg text-sm text-slate-100"
                />

                <input
                  type="text"
                  placeholder="Street address"
                  value={address.street}
                  onChange={(e) =>
                    handleAddressChange("street", e.target.value)
                  }
                  className="w-full bg-slate-950/60 border border-slate-800 px-3 py-2 rounded-lg text-sm text-slate-100"
                />

                <div className="grid grid-cols-2 gap-3">
                  <input
                    type="text"
                    placeholder="City"
                    value={address.city}
                    onChange={(e) =>
                      handleAddressChange("city", e.target.value)
                    }
                    className="bg-slate-950/60 border border-slate-800 px-3 py-2 rounded-lg text-sm text-slate-100"
                  />

                  <input
                    type="text"
                    placeholder="State"
                    value={address.state}
                    onChange={(e) =>
                      handleAddressChange("state", e.target.value)
                    }
                    className="bg-slate-950/60 border border-slate-800 px-3 py-2 rounded-lg text-sm text-slate-100"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <input
                    type="text"
                    placeholder="Zip / Postal Code"
                    value={address.zipCode}
                    onChange={(e) =>
                      handleAddressChange("zipCode", e.target.value)
                    }
                    className="bg-slate-950/60 border border-slate-800 px-3 py-2 rounded-lg text-sm text-slate-100"
                  />

                  <input
                    type="text"
                    placeholder="Country"
                    value={address.country}
                    onChange={(e) =>
                      handleAddressChange("country", e.target.value)
                    }
                    className="bg-slate-950/60 border border-slate-800 px-3 py-2 rounded-lg text-sm text-slate-100"
                  />
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 px-4 py-4 text-sm text-slate-100">
              <div className="flex items-start gap-3">
                <ShieldCheck className="w-5 h-5 text-amber-300 mt-0.5" />
                <div>
                  <p className="font-semibold">Payment happens on the next page</p>
                  <p className="mt-1 text-xs leading-6 text-slate-200">
                    No payment method is selected here anymore. Your merch order
                    will be created first, then you’ll be redirected to the
                    payment page to complete card payment, gift card submission,
                    or request bank transfer details.
                  </p>
                </div>
              </div>
            </div>

            <div className="pt-4 border-t border-slate-800">
              <div className="flex justify-between text-sm mb-3">
                <span>Total amount</span>
                <span className="text-amber-300 font-semibold">
                  {symbol}
                  {totalAmount.toLocaleString()}
                </span>
              </div>

              <button
                type="submit"
                disabled={processingOrder}
                className="w-full bg-amber-500 disabled:bg-amber-500/40 text-slate-950 rounded-xl py-3 font-semibold hover:bg-amber-400 transition"
              >
                {processingOrder
                  ? "Processing..."
                  : "Place order and continue to payment"}
              </button>

              <p className="text-[10px] text-slate-500 text-center mt-2">
                By placing this order, you agree to our merch delivery and
                refund policy.
              </p>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
