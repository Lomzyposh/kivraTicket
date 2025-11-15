import React, { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  Bell,
  AlertTriangle,
  Ticket,
  QrCode,
  CalendarDays,
  RefreshCw,
  CheckCircle2,
  Info,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import api from "../../api/axios";
import { useAuth } from "../../context/AuthContext";

const TYPE_OPTIONS = [
  { value: "all", label: "All types" },
  { value: "new_order", label: "New orders" },
  { value: "refund_request", label: "Refund requests" },
  { value: "qr_sent", label: "QR emails" },
  { value: "system", label: "System" },
];

const STATUS_OPTIONS = [
  { value: "all", label: "All statuses" },
  { value: "unread", label: "Unread only" },
  { value: "read", label: "Read only" },
];

function formatDateTime(dateString) {
  if (!dateString) return "";
  const d = new Date(dateString);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString(undefined, {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function typeIcon(type) {
  if (type === "refund_request") return <AlertTriangle className="w-4 h-4 text-amber-400" />;
  if (type === "qr_sent") return <QrCode className="w-4 h-4 text-emerald-400" />;
  if (type === "new_order") return <Ticket className="w-4 h-4 text-sky-400" />;
  return <Info className="w-4 h-4 text-slate-400" />;
}

export default function AdminNotifications() {
  const navigate = useNavigate();
  const { user } = useAuth();

  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [pageError, setPageError] = useState("");
  const [refreshing, setRefreshing] = useState(false);

  const [filterType, setFilterType] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");

  const [markingIds, setMarkingIds] = useState([]);
  const [markingAll, setMarkingAll] = useState(false);

  // Guard: only admins
  useEffect(() => {
    if (!user) {
      navigate("/login", {
        state: {
          from: "/admin/notifications",
          message: "Sign in with an admin account to view notifications.",
        },
      });
      return;
    }
    if (user.role !== "admin") {
      navigate("/");
    }
  }, [user, navigate]);

  const loadNotifications = async ({ showLoader = true } = {}) => {
    try {
      if (showLoader) setLoading(true);
      setPageError("");
      const res = await api.get("/admin/notifications");
      setNotifications(res.data?.notifications || []);
    } catch (err) {
      const msg =
        err?.response?.data?.error ||
        err?.response?.data?.message ||
        "Unable to load notifications.";
      setPageError(msg);
    } finally {
      if (showLoader) setLoading(false);
    }
  };

  useEffect(() => {
    if (!user || user.role !== "admin") return;
    loadNotifications();
  }, [user]);

  const handleRefresh = async () => {
    try {
      setRefreshing(true);
      await loadNotifications({ showLoader: false });
    } finally {
      setRefreshing(false);
    }
  };

  const handleMarkRead = async (id) => {
    if (markingIds.includes(id)) return;
    try {
      setMarkingIds((prev) => [...prev, id]);
      setPageError("");
      await api.patch(`/admin/notifications/${id}`);
      setNotifications((prev) =>
        prev.map((n) => (n._id === id ? { ...n, isRead: true } : n))
      );
    } catch (err) {
      const msg =
        err?.response?.data?.error ||
        err?.response?.data?.message ||
        "Unable to mark notification as read.";
      setPageError(msg);
    } finally {
      setMarkingIds((prev) => prev.filter((x) => x !== id));
    }
  };

  const handleMarkAllRead = async () => {
    try {
      setMarkingAll(true);
      setPageError("");
      // If you have a dedicated endpoint like /admin/notifications/mark-all-read,
      // call that instead. Here we just loop.
      const unread = notifications.filter((n) => !n.isRead);
      await Promise.all(
        unread.map((n) => api.patch(`/admin/notifications/${n._id}`))
      );
      setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
    } catch (err) {
      const msg =
        err?.response?.data?.error ||
        err?.response?.data?.message ||
        "Unable to mark all notifications as read.";
      setPageError(msg);
    } finally {
      setMarkingAll(false);
    }
  };

  const filteredNotifications = useMemo(() => {
    return notifications.filter((n) => {
      if (filterType !== "all" && n.type !== filterType) return false;
      if (filterStatus === "unread" && n.isRead) return false;
      if (filterStatus === "read" && !n.isRead) return false;
      return true;
    });
  }, [notifications, filterType, filterStatus]);

  const unreadCount = notifications.filter((n) => !n.isRead).length;

  return (
    <div className="min-h-screen bg-linear-to-br from-slate-950 via-slate-900 to-slate-950 text-slate-50">
      <div className="max-w-5xl mx-auto px-4 pt-20 pb-16 md:px-8 lg:px-10 lg:pt-24">
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
              <Bell className="w-5 h-5 text-amber-400" />
              Admin notifications
            </h1>
            <p className="mt-1 text-xs md:text-sm text-slate-400 max-w-xl">
              All sensitive activity in one feed: new orders, refund requests,
              QR sends and system messages.
            </p>
          </div>

          <div className="flex flex-col items-end gap-2">
            <div className="flex items-center gap-2">
              <select
                value={filterType}
                onChange={(e) => setFilterType(e.target.value)}
                className="rounded-xl bg-slate-950/80 border border-slate-800 px-3 py-2 text-[11px] text-slate-50 focus:outline-none focus:ring-1 focus:ring-amber-500/70 focus:border-amber-500/70"
              >
                {TYPE_OPTIONS.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="rounded-xl bg-slate-950/80 border border-slate-800 px-3 py-2 text-[11px] text-slate-50 focus:outline-none focus:ring-1 focus:ring-amber-500/70 focus:border-amber-500/70"
              >
                {STATUS_OPTIONS.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex items-center gap-2">
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
              <button
                type="button"
                onClick={handleMarkAllRead}
                disabled={unreadCount === 0 || markingAll}
                className="inline-flex items-center gap-1.5 rounded-xl border border-slate-700 bg-slate-950/80 hover:border-emerald-500/70 hover:bg-slate-900/80 disabled:opacity-60 text-[11px] text-slate-200 px-3 py-1.5 transition-all"
              >
                {markingAll ? (
                  <>
                    <span className="h-3.5 w-3.5 border-2 border-slate-300/70 border-t-transparent rounded-full animate-spin" />
                    Marking...
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                    Mark all read
                  </>
                )}
              </button>
            </div>
            <p className="text-[11px] text-slate-500">
              {unreadCount} unread notification{unreadCount === 1 ? "" : "s"}.
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
            {Array.from({ length: 5 }).map((_, idx) => (
              <div
                key={idx}
                className="rounded-2xl bg-slate-900/80 border border-slate-800 p-4 animate-pulse"
              >
                <div className="h-4 w-40 bg-slate-800 rounded-full mb-2" />
                <div className="h-3 w-32 bg-slate-800 rounded-full mb-1.5" />
                <div className="h-3 w-24 bg-slate-800 rounded-full" />
              </div>
            ))}
          </div>
        )}

        {!loading && filteredNotifications.length === 0 && !pageError && (
          <div className="rounded-3xl bg-slate-900/80 border border-slate-800 p-6 flex flex-col items-center justify-center text-center">
            <Bell className="w-6 h-6 text-amber-400 mb-2" />
            <p className="text-sm font-semibold text-slate-100">
              No notifications match your filters yet.
            </p>
            <p className="text-xs text-slate-400 mt-1 max-w-sm">
              Try switching to &quot;All types&quot; or &quot;All statuses&quot;
              to see the full activity log.
            </p>
          </div>
        )}

        {!loading && filteredNotifications.length > 0 && (
          <div className="space-y-3">
            {filteredNotifications.map((n) => (
              <div
                key={n._id}
                className={`rounded-2xl px-4 py-3 border flex gap-3 items-start text-xs transition-all ${
                  n.isRead
                    ? "bg-slate-900/80 border-slate-800"
                    : "bg-slate-950/90 border-amber-500/50 shadow-lg shadow-amber-500/10"
                }`}
              >
                <div className="mt-0.5">{typeIcon(n.type)}</div>
                <div className="flex-1 min-w-0">
                  <p className="text-slate-100">
                    {n.message || "Notification"}
                  </p>
                  <div className="mt-1 flex flex-wrap items-center gap-2 text-[10px] text-slate-500">
                    <span className="inline-flex items-center gap-1">
                      <CalendarDays className="w-3 h-3" />
                      {formatDateTime(n.createdAt)}
                    </span>
                    {n.type && (
                      <span className="uppercase tracking-[0.18em]">
                        {n.type.replace("_", " ")}
                      </span>
                    )}
                    {n.orderId && (
                      <span className="font-mono text-slate-400">
                        Order: {n.orderId}
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex flex-col items-end gap-1">
                  {!n.isRead ? (
                    <button
                      type="button"
                      onClick={() => handleMarkRead(n._id)}
                      disabled={markingIds.includes(n._id)}
                      className="inline-flex items-center gap-1.5 rounded-xl border border-slate-700 bg-slate-950/80 hover:border-emerald-500/70 hover:bg-slate-900/80 text-[10px] text-slate-200 px-3 py-1.5 transition-all"
                    >
                      {markingIds.includes(n._id) ? (
                        <>
                          <span className="h-3 w-3 border-2 border-slate-300/70 border-t-transparent rounded-full animate-spin" />
                          Marking...
                        </>
                      ) : (
                        <>
                          <CheckCircle2 className="w-3 h-3" />
                          Mark read
                        </>
                      )}
                    </button>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-[10px] text-emerald-300">
                      <CheckCircle2 className="w-3 h-3" />
                      Read
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
