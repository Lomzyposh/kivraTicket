import React, { useEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import {
  BarChart3,
  Ticket,
  DollarSign,
  AlertTriangle,
  CalendarDays,
  Activity,
  Bell,
  ArrowRight,
  Banknote,
  Shirt,
} from "lucide-react";
import api from "../../api/axios";
import { useAuth } from "../../context/AuthContext";

function formatNumber(n = 0) {
  return Number(n || 0).toLocaleString();
}

function formatShortDate(dateString) {
  if (!dateString) return "";
  const d = new Date(dateString);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
  });
}

const adminLinks = [
  {
    label: "Overview",
    icon: BarChart3,
    path: "/admin",
  },
  {
    label: "Orders",
    icon: Ticket,
    path: "/admin/orders",
  },
  {
    label: "Events",
    icon: Activity,
    path: "/admin/events",
  },
  {
    label: "Add merch",
    icon: Shirt,
    path: "/admin/merch/new",
  },
  {
    label: "Merch orders",
    icon: Banknote,
    path: "/admin/merch-orders",
  },
  {
    label: "Fetch events",
    icon: CalendarDays,
    path: "/admin/fetch-events",
  },
  {
    label: "Notifications",
    icon: Bell,
    path: "/admin/notifications",
  },
  {
    label: "Bank requests",
    icon: Banknote,
    path: "/admin/payment-config",
  },
];

export default function AdminDashboard() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();

  const [stats, setStats] = useState(null);
  const [statsLoading, setStatsLoading] = useState(true);
  const [statsError, setStatsError] = useState("");

  const [pendingOrders, setPendingOrders] = useState([]);
  const [pendingLoading, setPendingLoading] = useState(true);

  const [notifications, setNotifications] = useState([]);
  const [notifLoading, setNotifLoading] = useState(true);
  const [notifError, setNotifError] = useState("");

  const [paymentRequestsSummary, setPaymentRequestsSummary] = useState({
    all: 0,
    requested: 0,
    sent: 0,
  });
  const [paymentLoading, setPaymentLoading] = useState(true);

  const [pageError, setPageError] = useState("");

  useEffect(() => {
    if (!user) {
      navigate("/login", {
        state: {
          from: "/admin",
          message: "Sign in with an admin account to access the dashboard.",
        },
      });
      return;
    }
    if (user.role !== "admin") {
      navigate("/");
    }
  }, [user, navigate]);

  useEffect(() => {
    if (!user || user.role !== "admin") return;

    let active = true;

    const fetchStats = async () => {
      try {
        setStatsLoading(true);
        setStatsError("");
        const res = await api.get("/admin/stats");
        if (!active) return;
        setStats(res.data?.stats || null);
      } catch (err) {
        if (!active) return;
        const msg =
          err?.response?.data?.error ||
          err?.response?.data?.message ||
          "Unable to load dashboard statistics.";
        setStatsError(msg);
      } finally {
        if (active) setStatsLoading(false);
      }
    };

    fetchStats();

    return () => {
      active = false;
    };
  }, [user]);

  useEffect(() => {
    if (!user || user.role !== "admin") return;
    let active = true;

    const fetchPending = async () => {
      try {
        setPendingLoading(true);
        const res = await api.get("/admin/orders", {
          params: { status: "pending" },
        });
        if (!active) return;
        const orders = res.data?.orders || [];
        setPendingOrders(orders.slice(0, 5));
      } catch {
        if (!active) return;
      } finally {
        if (active) setPendingLoading(false);
      }
    };

    fetchPending();

    return () => {
      active = false;
    };
  }, [user]);

  useEffect(() => {
    if (!user || user.role !== "admin") return;
    let active = true;

    const fetchNotifications = async () => {
      try {
        setNotifLoading(true);
        setNotifError("");
        const res = await api.get("/admin/notifications");
        if (!active) return;
        setNotifications(res.data?.notifications || []);
      } catch (err) {
        if (!active) return;
        const msg =
          err?.response?.data?.error ||
          err?.response?.data?.message ||
          "Unable to load admin notifications.";
        setNotifError(msg);
      } finally {
        if (active) setNotifLoading(false);
      }
    };

    fetchNotifications();

    return () => {
      active = false;
    };
  }, [user]);

  useEffect(() => {
    if (!user || user.role !== "admin") return;
    let active = true;

    const fetchPaymentRequests = async () => {
      try {
        setPaymentLoading(true);
        const res = await api.get("/admin/payment-requests");
        if (!active) return;
        const ticketOrders = res.data?.ticketOrders || [];
        const merchOrders = res.data?.merchOrders || [];
        const allOrders = [...ticketOrders, ...merchOrders];
        setPaymentRequestsSummary({
          all: allOrders.length,
          requested: allOrders.filter(
            (item) => (item.bankPaymentRequest?.status || "requested") === "requested",
          ).length,
          sent: allOrders.filter(
            (item) => item.bankPaymentRequest?.status === "sent",
          ).length,
        });
      } catch {
        if (!active) return;
      } finally {
        if (active) setPaymentLoading(false);
      }
    };

    fetchPaymentRequests();

    return () => {
      active = false;
    };
  }, [user]);

  const unreadCount = notifications.filter((n) => !n.isRead).length;

  const handleMarkNotificationRead = async (id) => {
    try {
      await api.patch(`/admin/notifications/${id}`);
      setNotifications((prev) =>
        prev.map((n) => (n._id === id ? { ...n, isRead: true } : n)),
      );
    } catch {
      setPageError("Failed to update notification. Try again.");
    }
  };

  const isActiveLink = (path) => {
    if (path === "/admin") {
      return location.pathname === "/admin";
    }
    return location.pathname.startsWith(path);
  };

  return (
    <div className="min-h-screen bg-linear-to-br from-slate-950 via-slate-900 to-slate-950 text-slate-50">
      <div className="max-w-6xl mx-auto px-3 xs:px-4 pt-20 pb-16 md:px-8 lg:px-10 lg:pt-24">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-4">
          <div className="space-y-1">
            <div className="inline-flex items-center gap-2 rounded-full bg-slate-950/80 border border-amber-500/40 px-3 xs:px-4 py-1 text-[10px] xs:text-[11px] uppercase tracking-[0.18em] text-amber-300 shadow-sm backdrop-blur-sm">
              <BarChart3 className="w-3.5 h-3.5" />
              <span>Admin dashboard</span>
            </div>
            <h1 className="text-xl xs:text-2xl md:text-3xl font-semibold text-slate-50">
              Oversee tickets, orders and revenue.
            </h1>
            <p className="text-xs md:text-sm text-slate-400 max-w-xl">
              A quick snapshot of how KivraTickets is performing: orders, users,
              events and refund activity in one place.
            </p>
          </div>

          <div className="flex flex-col items-start md:items-end gap-2">
            <div className="inline-flex items-center gap-2 rounded-full bg-slate-900/80 border border-slate-800 px-3 py-1 text-[10px] xs:text-[11px] text-slate-300 shadow-sm backdrop-blur-sm">
              <Bell className="w-3.5 h-3.5 text-amber-400" />
              <span className="whitespace-nowrap">
                {unreadCount > 0
                  ? `${unreadCount} unread notification${
                      unreadCount === 1 ? "" : "s"
                    }`
                  : "No unread notifications"}
              </span>
            </div>
          </div>
        </div>

        <div className="mb-6 -mx-3 xs:-mx-4 md:mx-0">
          <div className="overflow-x-auto px-3 xs:px-4 md:px-0">
            <div className="inline-flex min-w-max items-center gap-2 rounded-2xl bg-slate-950/80 border border-slate-800 px-2 py-2 shadow-sm backdrop-blur-sm">
              {adminLinks.map((link) => {
                const Icon = link.icon;
                const active = isActiveLink(link.path);
                return (
                  <button
                    key={link.path}
                    type="button"
                    onClick={() => navigate(link.path)}
                    className={`group inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-[10px] xs:text-[11px] transition-all whitespace-nowrap ${
                      active
                        ? "bg-amber-500 text-slate-950 font-semibold shadow shadow-amber-500/30"
                        : "bg-slate-900/80 text-slate-200 hover:bg-slate-800 hover:text-amber-200 hover:shadow-md hover:shadow-slate-950/40"
                    }`}
                  >
                    <Icon
                      className={`w-3.5 h-3.5 transition-colors ${
                        active
                          ? "text-slate-950"
                          : "text-amber-300 group-hover:text-amber-200"
                      }`}
                    />
                    <span>{link.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {pageError && (
          <div className="mb-4 rounded-2xl bg-red-500/10 border border-red-500/40 px-4 py-3 text-xs text-red-100 flex items-start gap-2 backdrop-blur-sm">
            <AlertTriangle className="w-4 h-4 mt-0.5" />
            <span>{pageError}</span>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
          <div className="rounded-2xl bg-slate-900/80 border border-slate-800 p-4 flex flex-col gap-2 shadow-sm backdrop-blur">
            <div className="flex items-center justify-between gap-2">
              <p className="text-[10px] xs:text-[11px] text-slate-400 uppercase tracking-[0.18em]">
                Total revenue
              </p>
              <DollarSign className="w-4 h-4 text-emerald-400" />
            </div>
            {statsLoading ? (
              <div className="h-6 w-24 bg-slate-800 rounded-full animate-pulse" />
            ) : statsError ? (
              <p className="text-xs text-red-200">{statsError}</p>
            ) : (
              <p className="text-lg xs:text-xl font-semibold text-emerald-300">
                {formatNumber(stats?.totalRevenue)}{" "}
                <span className="text-[10px] xs:text-xs text-slate-400">
                  (sum of order totals)
                </span>
              </p>
            )}
          </div>

          <div className="rounded-2xl bg-slate-900/80 border border-slate-800 p-4 flex flex-col gap-2 shadow-sm backdrop-blur">
            <div className="flex items-center justify-between gap-2">
              <p className="text-[10px] xs:text-[11px] text-slate-400 uppercase tracking-[0.18em]">
                Orders
              </p>
              <Ticket className="w-4 h-4 text-amber-400" />
            </div>
            {statsLoading ? (
              <div className="h-6 w-16 bg-slate-800 rounded-full animate-pulse" />
            ) : (
              <>
                <p className="text-lg xs:text-xl font-semibold text-slate-100">
                  {formatNumber(stats?.totalOrders || 0)}
                </p>
                <p className="text-[10px] xs:text-[11px] text-slate-500">
                  {formatNumber(stats?.pendingOrders || 0)} pending,{" "}
                  {formatNumber(
                    (stats?.totalOrders || 0) - (stats?.pendingOrders || 0),
                  )}{" "}
                  processed.
                </p>
              </>
            )}
          </div>

          <div className="rounded-2xl bg-slate-900/80 border border-slate-800 p-4 flex flex-col gap-2 shadow-sm backdrop-blur">
            <div className="flex items-center justify-between gap-2">
              <p className="text-[10px] xs:text-[11px] text-slate-400 uppercase tracking-[0.18em]">
                Users & events
              </p>
              <Activity className="w-4 h-4 text-sky-400" />
            </div>
            {statsLoading ? (
              <div className="space-y-2">
                <div className="h-4 w-20 bg-slate-800 rounded-full animate-pulse" />
                <div className="h-3 w-24 bg-slate-800 rounded-full animate-pulse" />
              </div>
            ) : (
              <>
                <p className="text-sm text-slate-100">
                  <span className="font-semibold">
                    {formatNumber(stats?.totalUsers || 0)}
                  </span>{" "}
                  registered users
                </p>
                <p className="text-sm text-slate-100">
                  <span className="font-semibold">
                    {formatNumber(stats?.totalEvents || 0)}
                  </span>{" "}
                  events in catalogue
                </p>
                <p className="text-[10px] xs:text-[11px] text-slate-500">
                  {formatNumber(stats?.refundRequests || 0)} refund request
                  {Number(stats?.refundRequests || 0) === 1 ? "" : "s"}{" "}
                  currently flagged.
                </p>
              </>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1.3fr),minmax(0,1fr)] gap-6">
          <div className="rounded-3xl bg-slate-900/80 border border-slate-800 p-4 xs:p-5 shadow-md backdrop-blur">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-3">
              <div>
                <p className="text-[10px] xs:text-[11px] text-slate-400 uppercase tracking-[0.18em] mb-1">
                  Pending orders
                </p>
                <p className="text-xs xs:text-sm font-semibold text-slate-50">
                  Quick view of orders awaiting action.
                </p>
              </div>
              <button
                type="button"
                onClick={() => navigate("/admin/orders")}
                className="inline-flex items-center gap-1.5 text-[10px] xs:text-[11px] text-amber-300 hover:text-amber-200 whitespace-nowrap"
              >
                Manage all
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>

            {pendingLoading ? (
              <div className="space-y-2">
                {Array.from({ length: 3 }).map((_, idx) => (
                  <div
                    key={idx}
                    className="h-14 rounded-2xl bg-slate-950/80 border border-slate-800 animate-pulse"
                  />
                ))}
              </div>
            ) : pendingOrders.length === 0 ? (
              <p className="text-xs text-slate-400">
                No pending orders at the moment. New orders will appear here in
                real time.
              </p>
            ) : (
              <div className="space-y-2">
                {pendingOrders.map((order) => (
                  <button
                    key={order._id}
                    type="button"
                    onClick={() =>
                      navigate("/admin/orders", {
                        state: { highlight: order._id },
                      })
                    }
                    className="group w-full text-left rounded-2xl bg-slate-950/80 border border-slate-800 hover:border-amber-500/70 hover:bg-slate-900/80 px-3 py-2.5 flex items-center gap-3 transition-all hover:-translate-y-px hover:shadow-md hover:shadow-slate-950/50"
                  >
                    <div className="rounded-xl bg-slate-900 p-2 shrink-0">
                      <Ticket className="w-4 h-4 text-amber-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-slate-100 truncate">
                        {order.event?.title || "Event removed"}
                      </p>
                      <p className="text-[10px] xs:text-[11px] text-slate-400 truncate">
                        {order.user?.name} • {order.user?.email}
                      </p>
                    </div>
                    <div className="text-right text-[10px] xs:text-[11px] text-slate-300 whitespace-nowrap">
                      <p>
                        {formatNumber(order.tickets?.length || 0)} ticket
                        {order.tickets?.length === 1 ? "" : "s"}
                      </p>
                      <p className="text-amber-300">
                        {order.currency || "USD"} {formatNumber(order.totalAmount)}
                      </p>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="space-y-4">
            <div className="rounded-3xl bg-slate-900/80 border border-slate-800 p-4 xs:p-5 shadow-md backdrop-blur">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-3">
                <div className="flex items-center gap-2">
                  <Bell className="w-4 h-4 text-amber-400" />
                  <div>
                    <p className="text-[10px] xs:text-[11px] text-slate-400 uppercase tracking-[0.18em]">
                      Notifications
                    </p>
                    <p className="text-[11px] xs:text-xs text-slate-300">
                      Refunds, QR sends, new orders.
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => navigate("/admin/notifications")}
                  className="text-[10px] xs:text-[11px] text-amber-300 hover:text-amber-200 flex items-center gap-1 whitespace-nowrap"
                >
                  View all
                  <ArrowRight className="w-3 h-3" />
                </button>
              </div>

              {notifLoading ? (
                <div className="space-y-2">
                  {Array.from({ length: 3 }).map((_, idx) => (
                    <div
                      key={idx}
                      className="h-10 rounded-2xl bg-slate-950/80 border border-slate-800 animate-pulse"
                    />
                  ))}
                </div>
              ) : notifError ? (
                <p className="text-xs text-red-200">{notifError}</p>
              ) : notifications.length === 0 ? (
                <p className="text-xs text-slate-400">
                  No notifications yet. New orders and refund requests will
                  appear here.
                </p>
              ) : (
                <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                  {notifications.map((n) => (
                    <div
                      key={n._id}
                      className={`rounded-2xl px-3 py-2 border text-xs flex items-start gap-2 transition-all ${
                        n.isRead
                          ? "bg-slate-950/70 border-slate-800"
                          : "bg-slate-950/90 border-amber-500/40 shadow-sm shadow-amber-500/20"
                      }`}
                    >
                      <div className="mt-0.5 shrink-0">
                        {n.type === "refund_request" ? (
                          <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
                        ) : n.type === "qr_sent" ? (
                          <Ticket className="w-3.5 h-3.5 text-emerald-400" />
                        ) : (
                          <CalendarDays className="w-3.5 h-3.5 text-slate-400" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-slate-100 truncate">
                          {n.message || "Notification"}
                        </p>
                        <p className="text-[9px] xs:text-[10px] text-slate-500 mt-0.5">
                          {formatShortDate(n.createdAt)} • {n.type?.replace("_", " ")}
                        </p>
                      </div>
                      {!n.isRead && (
                        <button
                          type="button"
                          onClick={() => handleMarkNotificationRead(n._id)}
                          className="text-[9px] xs:text-[10px] text-amber-300 hover:text-amber-100 shrink-0"
                        >
                          Mark
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="rounded-3xl bg-slate-900/80 border border-slate-800 p-4 xs:p-5 shadow-md backdrop-blur">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-3">
                <div className="flex items-center gap-2">
                  <Banknote className="w-4 h-4 text-sky-400" />
                  <div>
                    <p className="text-[10px] xs:text-[11px] text-slate-400 uppercase tracking-[0.18em]">
                      Bank transfer requests
                    </p>
                    <p className="text-[11px] xs:text-xs text-slate-300">
                      Per-order bank assignment only.
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => navigate("/admin/payment-config")}
                  className="text-[10px] xs:text-[11px] text-amber-300 hover:text-amber-200 flex items-center gap-1 whitespace-nowrap"
                >
                  Open
                  <ArrowRight className="w-3 h-3" />
                </button>
              </div>

              {paymentLoading ? (
                <div className="space-y-2">
                  {Array.from({ length: 3 }).map((_, idx) => (
                    <div
                      key={idx}
                      className="h-10 rounded-2xl bg-slate-950/80 border border-slate-800 animate-pulse"
                    />
                  ))}
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="rounded-2xl bg-slate-950/80 border border-slate-800 px-3 py-2 text-xs flex items-center justify-between gap-2">
                    <span className="text-slate-400">All requests</span>
                    <span className="text-slate-100 font-medium">{paymentRequestsSummary.all}</span>
                  </div>
                  <div className="rounded-2xl bg-slate-950/80 border border-slate-800 px-3 py-2 text-xs flex items-center justify-between gap-2">
                    <span className="text-slate-400">Awaiting admin</span>
                    <span className="text-amber-300 font-medium">{paymentRequestsSummary.requested}</span>
                  </div>
                  <div className="rounded-2xl bg-slate-950/80 border border-slate-800 px-3 py-2 text-xs flex items-center justify-between gap-2">
                    <span className="text-slate-400">Assigned / emailed</span>
                    <span className="text-emerald-300 font-medium">{paymentRequestsSummary.sent}</span>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
