import React, { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import api from "../api/axios";

const VerifyPayment = () => {
  const { orderId } = useParams();
  const navigate = useNavigate();

  const [code, setCode] = useState("");
  const [status, setStatus] = useState("idle"); // idle | loading | success | error
  const [message, setMessage] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!code.trim()) {
      setMessage("Please enter the verification code.");
      setStatus("error");
      return;
    }

    try {
      setStatus("loading");
      setMessage("");

      const res = await api.post(`/orders/${orderId}/verify-code`, {
        code: code.trim(),
      });

      setStatus("success");
      setMessage(
        res.data?.message ||
          "Payment verified successfully. You’ll receive your QR ticket shortly."
      );

      setTimeout(() => {
        navigate(`/orders/my-orders`);
      }, 2500);
    } catch (err) {
      console.error(err);
      const errMsg =
        err.response?.data?.error ||
        err.response?.data?.message ||
        "We could not verify that code. Please check it and try again.";
      setStatus("error");
      setMessage(errMsg);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center px-4">
      <div className="w-full max-w-md bg-slate-900/70 border border-slate-800 rounded-2xl p-6 shadow-xl">
        <div className="mb-4 text-center">
          <h1 className="text-xl font-semibold text-amber-400">
            Verify your payment
          </h1>
          <p className="mt-1 text-sm text-slate-400">
            Enter the verification code that was sent to your email to confirm
            this order.
          </p>
        </div>

        <div className="mb-4 text-xs text-slate-500 text-center">
          Order ID: <span className="font-mono">{orderId}</span>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label
              htmlFor="code"
              className="block text-sm font-medium text-slate-200 mb-1"
            >
              Verification code
            </label>
            <input
              id="code"
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              placeholder="e.g. 483920"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              className="w-full rounded-lg border border-slate-700 bg-slate-950/70 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-amber-400"
            />
            <p className="mt-1 text-xs text-slate-500">
              Use the exact code you received in your email.
            </p>
          </div>

          {message && (
            <div
              className={`text-xs px-3 py-2 rounded-lg ${
                status === "error"
                  ? "bg-red-950/60 border border-red-700 text-red-200"
                  : status === "success"
                  ? "bg-emerald-950/60 border border-emerald-700 text-emerald-200"
                  : "bg-slate-900 border border-slate-700 text-slate-200"
              }`}
            >
              {message}
            </div>
          )}

          <button
            type="submit"
            disabled={status === "loading"}
            className="w-full inline-flex items-center justify-center rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 text-sm font-semibold py-2.5 transition disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {status === "loading" ? "Verifying..." : "Verify payment"}
          </button>
        </form>

        <p className="mt-4 text-[11px] text-center text-slate-500">
          If you didn’t receive any code, please check your spam folder or
          request support from your bank.
        </p>
      </div>
    </div>
  );
};

export default VerifyPayment;
