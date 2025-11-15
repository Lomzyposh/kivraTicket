// FULL UPDATED CHECKOUT PAGE WITH DELIVERY ADDRESS INCLUDED

import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  ShoppingCart,
  CreditCard,
  Banknote,
  AlertTriangle,
  ShieldCheck,
} from "lucide-react";
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
  const { user } = useAuth();

  const [cart, setCart] = useState(null);
  const [totals, setTotals] = useState(null);
  const [loadingCart, setLoadingCart] = useState(true);
  const [cartError, setCartError] = useState("");

  const [paymentMethod, setPaymentMethod] = useState("credit_card");
  const [processingOrder, setProcessingOrder] = useState(false);
  const [orderError, setOrderError] = useState("");
  const [orderSuccess, setOrderSuccess] = useState("");

  /* Delivery Address */
  const [address, setAddress] = useState({
    fullName: "",
    phone: "",
    street: "",
    city: "",
    state: "",
    zipCode: "",
    country: "",
  });

  /* Billing + Card */
  const [card, setCard] = useState({
    cardNumber: "",
    cardHolderName: "",
    expiryDate: "",
    cvv: "",
  });

  const handleAddressChange = (field, value) => {
    setAddress((prev) => ({ ...prev, [field]: value }));
    setOrderError("");
  };

  const handleCardChange = (field, value) => {
    setCard((prev) => ({ ...prev, [field]: value }));
    setOrderError("");
  };

  // Redirect to login
  useEffect(() => {
    if (!user) {
      navigate("/login", {
        state: {
          from: "/checkout-cart",
          message: "Sign in to complete your merch purchase.",
        },
      });
    }
  }, [user, navigate]);

  // Load cart
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

  const itemCount = totals?.itemCount || 0;
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

    // Validate Delivery Address
    for (let key of [
      "fullName",
      "phone",
      "street",
      "city",
      "state",
      "zipCode",
      "country",
    ]) {
      if (!address[key].trim()) {
        setOrderError("Please complete all required delivery address fields.");
        return;
      }
    }

    // Validate Card fields if card payment
    if (paymentMethod === "credit_card") {
      for (let key of ["cardNumber", "cardHolderName", "expiryDate", "cvv"]) {
        if (!card[key].trim()) {
          setOrderError(
            "Please complete all required credit card fields before continuing."
          );
          return;
        }
      }
    }

    try {
      setProcessingOrder(true);

      const paymentDetails =
        paymentMethod === "credit_card" ? { ...card } : null;

      const res = await api.post("/cart/checkout", {
        paymentMethod,
        paymentDetails,
        deliveryAddress: address,
      });

      setOrderSuccess(
        res.data?.message || "Your merch order has been placed successfully."
      );

      setTimeout(() => navigate("/my-orders"), 1400);
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
          {/* LEFT SIDE – CART SUMMARY */}
          <div className="rounded-3xl bg-slate-900 border border-slate-800 p-6">
            <h2 className="text-sm font-semibold mb-3">Order Summary</h2>

            {loadingCart && <p className="text-sm">Loading cart...</p>}

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
                      <img src={img} className="w-full h-full object-cover" />
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

          {/* RIGHT SIDE – DELIVERY + PAYMENT */}
          <form
            onSubmit={handlePlaceOrder}
            className="rounded-3xl bg-slate-900 border border-slate-800 p-6 flex flex-col gap-5"
          >
            {orderError && (
              <div className="rounded-xl bg-red-500/20 border border-red-700 text-xs text-red-200 px-3 py-2">
                {orderError}
              </div>
            )}

            {orderSuccess && (
              <div className="rounded-xl bg-emerald-500/20 border border-emerald-700 text-xs text-emerald-200 px-3 py-2">
                {orderSuccess}
              </div>
            )}

            {/* DELIVERY SECTION */}
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

            {/* PAYMENT SECTION */}
            <div>
              <p className="text-xs text-slate-400 uppercase tracking-wide mb-2">
                Payment method
              </p>

              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setPaymentMethod("credit_card")}
                  className={`border rounded-xl p-3 text-left text-xs ${
                    paymentMethod === "credit_card"
                      ? "border-amber-500 text-slate-100"
                      : "border-slate-800"
                  }`}
                >
                  <CreditCard className="w-4 h-4 text-amber-400 mb-1" />
                  <div className="font-semibold">Card payment</div>
                </button>

                <button
                  type="button"
                  onClick={() => setPaymentMethod("paypal")}
                  className={`border rounded-xl p-3 text-left text-xs ${
                    paymentMethod === "paypal"
                      ? "border-amber-500 text-slate-100"
                      : "border-slate-800"
                  }`}
                >
                  <Banknote className="w-4 h-4 text-amber-400 mb-1" />
                  <div className="font-semibold">Manual payment</div>
                  <span className="text-[11px] text-slate-400">
                    Pay via PayPal / CashApp / Zelle as configured by admin.
                  </span>
                </button>
              </div>
            </div>

            {paymentMethod === "credit_card" && (
              <div className="space-y-3">
                <input
                  type="text"
                  placeholder="Card number"
                  value={card.cardNumber}
                  onChange={(e) =>
                    handleCardChange("cardNumber", e.target.value)
                  }
                  className="w-full bg-slate-950/60 border border-slate-800 px-3 py-2 rounded-lg text-sm text-slate-100"
                />

                <input
                  type="text"
                  placeholder="Name on card"
                  value={card.cardHolderName}
                  onChange={(e) =>
                    handleCardChange("cardHolderName", e.target.value)
                  }
                  className="w-full bg-slate-950/60 border border-slate-800 px-3 py-2 rounded-lg text-sm text-slate-100"
                />

                <div className="grid grid-cols-2 gap-3">
                  <input
                    type="text"
                    placeholder="MM/YY"
                    value={card.expiryDate}
                    onChange={(e) =>
                      handleCardChange("expiryDate", e.target.value)
                    }
                    className="bg-slate-950/60 border border-slate-800 px-3 py-2 rounded-lg text-sm text-slate-100"
                  />

                  <input
                    type="password"
                    placeholder="CVV"
                    value={card.cvv}
                    onChange={(e) => handleCardChange("cvv", e.target.value)}
                    className="bg-slate-950/60 border border-slate-800 px-3 py-2 rounded-lg text-sm text-slate-100"
                  />
                </div>
              </div>
            )}

            {/* AMOUNT + SUBMIT */}
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
                className="w-full bg-amber-500 text-slate-950 rounded-xl py-3 font-semibold hover:bg-amber-400 transition"
              >
                {processingOrder ? "Processing..." : "Place merch order"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
