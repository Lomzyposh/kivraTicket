// FULL UPDATED CHECKOUT PAGE WITH DELIVERY ADDRESS + GIFT CARD (FRONT & BACK)

import React, { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  CreditCard,
  Banknote,
  AlertTriangle,
  ShieldCheck,
  Gift,
  UploadCloud,
  CheckCircle2,
  XCircle,
  Image as ImageIcon,
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

  // ---------------------------
  // Gift card proof (front & back)
  // ---------------------------
  const fileRef = useRef(null);
  const [giftUploading, setGiftUploading] = useState(false);
  const [giftUploadError, setGiftUploadError] = useState("");
  // Index 0 = front, 1 = back
  const [giftCardProofUrls, setGiftCardProofUrls] = useState(["", ""]);

  const hasGiftFront = !!giftCardProofUrls[0];
  const hasGiftBack = !!giftCardProofUrls[1];
  const giftReady = hasGiftFront && hasGiftBack;

  const handleAddressChange = (field, value) => {
    setAddress((prev) => ({ ...prev, [field]: value }));
    setOrderError("");
  };

  const handleCardChange = (field, value) => {
    setCard((prev) => ({ ...prev, [field]: value }));
    setOrderError("");
  };

  const resetGiftInputs = () => {
    setGiftUploadError("");
    setGiftCardProofUrls(["", ""]);
    if (fileRef.current) fileRef.current.value = "";
  };

  const removeGiftAt = (idx) => {
    setGiftUploadError("");
    setGiftCardProofUrls((prev) => {
      const next = [...prev];
      next[idx] = "";
      return next;
    });
  };

  // Upload helper (unsigned upload preset)
  const uploadGiftCardProof = async (file) => {
    const cloudName =
      import.meta.env.VITE_CLOUDINARY_CLOUD_NAME ||
      import.meta.env.VITE_CLOUDINARY_CLOUDINARY_NAME;
    const uploadPreset = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET;

    if (!cloudName || !uploadPreset) {
      throw new Error(
        "Cloudinary config missing. Set VITE_CLOUDINARY_CLOUD_NAME and VITE_CLOUDINARY_UPLOAD_PRESET."
      );
    }

    const form = new FormData();
    form.append("file", file);
    form.append("upload_preset", uploadPreset);
    form.append("folder", "gotickets/giftcards");

    const res = await fetch(
      `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`,
      { method: "POST", body: form }
    );

    const data = await res.json();
    if (!res.ok) {
      const msg = data?.error?.message || "Gift card upload failed.";
      throw new Error(msg);
    }

    return data.secure_url;
  };

  const onGiftFilesPick = async (e) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;

    setOrderError("");
    setOrderSuccess("");
    setGiftUploadError("");

    const picked = files.slice(0, 2);

    for (const file of picked) {
      const okType = /^image\/(png|jpe?g|webp|gif)$/i.test(file.type);
      if (!okType) {
        setGiftUploadError(
          "Please upload only images (PNG, JPG, WEBP, or GIF)."
        );
        return;
      }
      const maxMb = 8;
      if (file.size > maxMb * 1024 * 1024) {
        setGiftUploadError(
          `Image too large. Please use files under ${maxMb}MB.`
        );
        return;
      }
    }

    try {
      setGiftUploading(true);

      const urls = [];
      for (const file of picked) {
        const url = await uploadGiftCardProof(file);
        urls.push(url);
      }

      // Fill empty slots first (front then back)
      setGiftCardProofUrls((prev) => {
        const next = [...prev];
        let i = 0;
        for (let slot = 0; slot < next.length && i < urls.length; slot++) {
          if (!next[slot]) next[slot] = urls[i++];
        }
        // If user re-uploads and both filled, overwrite from start
        while (i < urls.length) {
          next[i - (urls.length - 2) > 1 ? 1 : 0] = urls[i++];
        }
        return next;
      });
    } catch (err) {
      setGiftUploadError(
        err?.message || "Could not upload gift card images. Try again."
      );
      setGiftCardProofUrls(["", ""]);
    } finally {
      setGiftUploading(false);
    }
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

    // Validate gift card images (front + back)
    if (paymentMethod === "giftcard") {
      if (giftUploading) {
        setOrderError("Please wait for the gift card uploads to finish.");
        return;
      }
      if (!giftReady) {
        setOrderError(
          "Please upload BOTH the front and back of the scratched gift card before placing the order."
        );
        return;
      }
    }

    try {
      setProcessingOrder(true);

      const paymentDetails =
        paymentMethod === "credit_card"
          ? { ...card }
          : paymentMethod === "giftcard"
          ? { giftCardProofUrls }
          : null;

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

              <div className="grid grid-cols-3 gap-3">
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
                  <div className="font-semibold">Card</div>
                </button>
                {/* 
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
                  <div className="font-semibold">Manual</div>
                  <div className="text-[11px] text-slate-400 mt-1">
                    PayPal / CashApp / Zelle
                  </div>
                </button> */}

                <button
                  type="button"
                  onClick={() => setPaymentMethod("giftcard")}
                  className={`border rounded-xl p-3 text-left text-xs ${
                    paymentMethod === "giftcard"
                      ? "border-amber-500 text-slate-100"
                      : "border-slate-800"
                  }`}
                >
                  <Gift className="w-4 h-4 text-amber-400 mb-1" />
                  <div className="font-semibold">Gift card</div>
                  <div className="text-[11px] text-slate-400 mt-1">
                    Front & back
                  </div>
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

            {/* Gift card upload UI */}
            {paymentMethod === "giftcard" && (
              <div className="rounded-2xl border border-slate-800 bg-slate-950/40 p-4">
                <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-3 mb-3">
                  <p className="text-[12px] text-amber-100 font-semibold">
                    Gift card instructions
                  </p>
                  <p className="mt-1 text-[11px] text-slate-200 leading-relaxed">
                    Upload <strong>two clear photos</strong>:
                    <br />• <strong>Front</strong> of the scratched card (code
                    visible)
                    <br />• <strong>Back</strong> of the card
                  </p>
                </div>

                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-2">
                    <UploadCloud className="w-4 h-4 text-amber-400 mt-0.5" />
                    <div>
                      <p className="text-slate-100 font-semibold text-xs">
                        Upload gift card photos
                      </p>
                      <p className="text-[11px] text-slate-400">
                        Select up to <strong>2 images</strong> (front & back).
                      </p>
                    </div>
                  </div>

                  {hasGiftFront || hasGiftBack ? (
                    <button
                      type="button"
                      onClick={resetGiftInputs}
                      className="text-[11px] text-slate-300 hover:text-amber-300"
                    >
                      Clear all
                    </button>
                  ) : null}
                </div>

                <input
                  ref={fileRef}
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={onGiftFilesPick}
                  className="mt-3 block w-full text-[11px] text-slate-300 file:mr-3 file:rounded-lg file:border-0 file:bg-slate-800 file:px-3 file:py-2 file:text-[11px] file:font-semibold file:text-slate-50 hover:file:bg-slate-700"
                />

                {giftUploading && (
                  <div className="mt-3 flex items-center gap-2 text-[11px] text-slate-300">
                    <span className="h-3.5 w-3.5 border-2 border-slate-400/70 border-t-transparent rounded-full animate-spin" />
                    Uploading…
                  </div>
                )}

                {giftUploadError && (
                  <div className="mt-3 rounded-xl bg-red-500/10 border border-red-500/30 px-3 py-2 text-[11px] text-red-100 flex items-start gap-2">
                    <XCircle className="w-3.5 h-3.5 mt-0.5" />
                    <span>{giftUploadError}</span>
                  </div>
                )}

                <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="rounded-2xl border border-slate-800 bg-slate-950/60 overflow-hidden">
                    <div className="px-3 py-2 border-b border-slate-800 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <ImageIcon className="w-4 h-4 text-amber-300" />
                        <span className="text-[11px] text-slate-200 font-semibold">
                          Front
                        </span>
                      </div>
                      {hasGiftFront ? (
                        <button
                          type="button"
                          onClick={() => removeGiftAt(0)}
                          className="text-[11px] text-slate-300 hover:text-amber-300"
                        >
                          Remove
                        </button>
                      ) : (
                        <span className="text-[10px] text-slate-500">
                          Pending
                        </span>
                      )}
                    </div>

                    <div className="h-32 bg-slate-900/50 flex items-center justify-center">
                      {hasGiftFront ? (
                        <img
                          src={giftCardProofUrls[0]}
                          alt="Gift card front"
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="text-[11px] text-slate-500 flex items-center gap-2">
                          <UploadCloud className="w-4 h-4" />
                          Upload front
                        </div>
                      )}
                    </div>

                    {hasGiftFront && (
                      <div className="px-3 py-2 text-[10px] text-slate-500 flex items-center gap-2">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                        Uploaded
                      </div>
                    )}
                  </div>

                  <div className="rounded-2xl border border-slate-800 bg-slate-950/60 overflow-hidden">
                    <div className="px-3 py-2 border-b border-slate-800 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <ImageIcon className="w-4 h-4 text-amber-300" />
                        <span className="text-[11px] text-slate-200 font-semibold">
                          Back
                        </span>
                      </div>
                      {hasGiftBack ? (
                        <button
                          type="button"
                          onClick={() => removeGiftAt(1)}
                          className="text-[11px] text-slate-300 hover:text-amber-300"
                        >
                          Remove
                        </button>
                      ) : (
                        <span className="text-[10px] text-slate-500">
                          Pending
                        </span>
                      )}
                    </div>

                    <div className="h-32 bg-slate-900/50 flex items-center justify-center">
                      {hasGiftBack ? (
                        <img
                          src={giftCardProofUrls[1]}
                          alt="Gift card back"
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="text-[11px] text-slate-500 flex items-center gap-2">
                          <UploadCloud className="w-4 h-4" />
                          Upload back
                        </div>
                      )}
                    </div>

                    {hasGiftBack && (
                      <div className="px-3 py-2 text-[10px] text-slate-500 flex items-center gap-2">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                        Uploaded
                      </div>
                    )}
                  </div>
                </div>

                {!giftReady && (
                  <p className="mt-3 text-[10px] text-slate-500">
                    Upload <strong>both</strong> front & back before placing the
                    order.
                  </p>
                )}
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
                disabled={
                  processingOrder ||
                  (paymentMethod === "giftcard" &&
                    (giftUploading || !giftReady))
                }
                className="w-full bg-amber-500 disabled:bg-amber-500/40 text-slate-950 rounded-xl py-3 font-semibold hover:bg-amber-400 transition"
              >
                {processingOrder ? "Processing..." : "Place merch order"}
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
