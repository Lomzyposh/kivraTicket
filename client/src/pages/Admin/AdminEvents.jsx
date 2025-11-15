import React, { useEffect, useState, useMemo } from "react";
import {
  ArrowLeft,
  Plus,
  Edit3,
  Trash2,
  Search,
  RefreshCw,
  CalendarDays,
  MapPin,
  Layers,
  Image as ImageIcon,
  AlertTriangle,
  Save,
  Globe2,
  Ticket,
  Download,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import api from "../../api/axios";
import { useAuth } from "../../context/AuthContext";

const CATEGORY_OPTIONS = [
  { value: "concert", label: "Concert" },
  { value: "sports", label: "Sports" },
  { value: "theater", label: "Theater" },
  { value: "comedy", label: "Comedy" },
  { value: "other", label: "Other" },
];

const CURRENCY_OPTIONS = ["USD", "NGN", "EUR", "GBP"];

const emptyForm = {
  title: "",
  description: "",
  category: "concert",
  venue: "",
  city: "",
  state: "",
  country: "",
  address: "",
  date: "",
  time: "",
  priceMin: "",
  priceMax: "",
  currency: "USD",
  hasSeats: false,
  rows: "",
  columns: "",
  totalTickets: "",
  availableTickets: "",
  images: "",
};

function toDateInputValue(value) {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  return d.toISOString().slice(0, 10);
}

function formatShortDate(value) {
  if (!value) return "Date TBA";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "Date TBA";
  return d.toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function formatLocation(event = {}) {
  const loc = event.location || {};
  const parts = [event.venue, loc.city, loc.state, loc.country].filter(Boolean);
  return parts.join(" • ") || "Location TBA";
}

export default function AdminEvents() {
  const navigate = useNavigate();
  const { user } = useAuth();

  // Guard
  useEffect(() => {
    if (!user) {
      navigate("/login", {
        state: {
          from: "/admin/events",
          message: "Sign in with an admin account to manage events.",
        },
      });
      return;
    }
    if (user.role !== "admin") {
      navigate("/");
    }
  }, [user, navigate]);

  const [events, setEvents] = useState([]);
  const [loadingEvents, setLoadingEvents] = useState(true);
  const [eventsError, setEventsError] = useState("");

  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [refreshing, setRefreshing] = useState(false);

  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");
  const [formSuccess, setFormSuccess] = useState("");

  const [deletingId, setDeletingId] = useState(null);

  const [fetchRealQuery, setFetchRealQuery] = useState("");
  const [fetchingReal, setFetchingReal] = useState(false);
  const [fetchRealMessage, setFetchRealMessage] = useState("");
  const [fetchRealError, setFetchRealError] = useState("");

  // Load events from public endpoint (matches what users see)
  const loadEvents = async ({ showLoader = true } = {}) => {
    try {
      if (showLoader) setLoadingEvents(true);
      setEventsError("");

      const params = {};
      if (search.trim()) params.search = search.trim();
      if (categoryFilter !== "all") params.category = categoryFilter;

      const res = await api.get("/events", { params });
      setEvents(res.data?.events || []);
    } catch (err) {
      const msg =
        err?.response?.data?.error ||
        err?.response?.data?.message ||
        "Unable to load events.";
      setEventsError(msg);
    } finally {
      if (showLoader) setLoadingEvents(false);
    }
  };

  useEffect(() => {
    if (!user || user.role !== "admin") return;
    loadEvents();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const handleRefresh = async () => {
    try {
      setRefreshing(true);
      await loadEvents({ showLoader: false });
    } finally {
      setRefreshing(false);
    }
  };

  const handleFormChange = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    setFormError("");
    setFormSuccess("");
  };

  const resetForm = () => {
    setForm(emptyForm);
    setEditingId(null);
    setFormError("");
    setFormSuccess("");
  };

  const startEdit = (event) => {
    setEditingId(event._id);
    setForm({
      title: event.title || "",
      description: event.description || "",
      category: event.category || "concert",
      venue: event.venue || "",
      city: event.location?.city || "",
      state: event.location?.state || "",
      country: event.location?.country || "",
      address: event.location?.address || "",
      date: toDateInputValue(event.date),
      time: event.time || "",
      priceMin:
        event.price?.min !== undefined && event.price?.min !== null
          ? String(event.price.min)
          : "",
      priceMax:
        event.price?.max !== undefined && event.price?.max !== null
          ? String(event.price.max)
          : "",
      currency: event.price?.currency || "USD",
      hasSeats: event.seatingLayout?.hasSeats || false,
      rows:
        event.seatingLayout?.rows !== undefined &&
        event.seatingLayout?.rows !== null
          ? String(event.seatingLayout.rows)
          : "",
      columns:
        event.seatingLayout?.columns !== undefined &&
        event.seatingLayout?.columns !== null
          ? String(event.seatingLayout.columns)
          : "",
      totalTickets:
        event.totalTickets !== undefined && event.totalTickets !== null
          ? String(event.totalTickets)
          : "",
      availableTickets:
        event.availableTickets !== undefined &&
        event.availableTickets !== null
          ? String(event.availableTickets)
          : "",
      images: (event.images || []).join(", "),
    });
    setFormError("");
    setFormSuccess("");
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError("");
    setFormSuccess("");

    if (!form.title || !form.venue || !form.date || !form.category) {
      setFormError("Title, category, venue and date are required.");
      return;
    }

    const payload = {
      title: form.title.trim(),
      description: form.description.trim() || undefined,
      category: form.category,
      venue: form.venue.trim(),
      location: {
        city: form.city.trim() || undefined,
        state: form.state.trim() || undefined,
        country: form.country.trim() || undefined,
        address: form.address.trim() || undefined,
      },
      date: form.date,
      time: form.time.trim() || undefined,
      price: {
        min: form.priceMin ? Number(form.priceMin) : undefined,
        max: form.priceMax ? Number(form.priceMax) : undefined,
        currency: form.currency || "USD",
      },
      seatingLayout: form.hasSeats
        ? {
            hasSeats: true,
            rows: form.rows ? Number(form.rows) : 0,
            columns: form.columns ? Number(form.columns) : 0,
          }
        : { hasSeats: false },
      totalTickets: form.totalTickets
        ? Number(form.totalTickets)
        : undefined,
      availableTickets: form.availableTickets
        ? Number(form.availableTickets)
        : undefined,
      images: form.images
        ? form.images
            .split(",")
            .map((i) => i.trim())
            .filter(Boolean)
        : [],
      apiSource: "manual",
    };

    try {
      setSaving(true);

      if (editingId) {
        const res = await api.put(`/admin/events/${editingId}`, payload);
        const updated = res.data?.event;
        setEvents((prev) =>
          prev.map((e) => (e._id === editingId ? updated : e))
        );
        setFormSuccess("Event updated successfully.");
      } else {
        const res = await api.post("/admin/events", payload);
        const created = res.data?.event;
        setEvents((prev) => [created, ...prev]);
        setFormSuccess("Event created successfully.");
        resetForm();
      }
    } catch (err) {
      const msg =
        err?.response?.data?.error ||
        err?.response?.data?.message ||
        "Unable to save event. Please check the data and try again.";
      setFormError(msg);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Delete this event permanently?")) return;

    try {
      setDeletingId(id);
      await api.delete(`/admin/events/${id}`);
      setEvents((prev) => prev.filter((e) => e._id !== id));
    } catch (err) {
      const msg =
        err?.response?.data?.error ||
        err?.response?.data?.message ||
        "Unable to delete event.";
      setEventsError(msg);
    } finally {
      setDeletingId(null);
    }
  };

  const handleFetchReal = async () => {
    if (!fetchRealQuery.trim()) {
      setFetchRealError("Enter a keyword (e.g. 'Lagos', 'London concerts').");
      return;
    }

    try {
      setFetchingReal(true);
      setFetchRealError("");
      setFetchRealMessage("");

      const res = await api.post("/admin/fetch-events", {
        query: fetchRealQuery.trim(),
        source: "seatgeek",
      });

      const msg =
        res.data?.message ||
        "Live events fetched and synced into your database.";
      setFetchRealMessage(msg);

      await loadEvents({ showLoader: false });
    } catch (err) {
      const msg =
        err?.response?.data?.error ||
        err?.response?.data?.message ||
        "Unable to fetch external events.";
      setFetchRealError(msg);
    } finally {
      setFetchingReal(false);
    }
  };

  const filteredEvents = useMemo(() => events, [events]);

 return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-slate-50">
      <div className="max-w-6xl mx-auto px-3 sm:px-6 lg:px-10 pt-20 pb-16 lg:pt-24">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
          <div>
            <button
              onClick={() => navigate(-1)}
              className="inline-flex items-center gap-1.5 text-xs text-slate-300 hover:text-amber-300 mb-2"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              Back
            </button>
            <h1 className="text-2xl md:text-3xl font-semibold flex items-center gap-2">
              <Layers className="w-5 h-5 text-amber-400" />
              Manage events
            </h1>
            <p className="mt-1 text-xs md:text-sm text-slate-400 max-w-xl">
              Create new shows, edit listings and keep your catalogue fresh.
            </p>
          </div>

          <button
            onClick={resetForm}
            className="inline-flex items-center gap-1.5 rounded-xl bg-slate-950 border border-slate-700 hover:border-amber-500/70 hover:bg-slate-900 text-[11px] px-3 py-2 transition-all"
          >
            <Plus className="w-3.5 h-3.5" />
            New manual event
          </button>
        </div>

        {/* Search & Import row */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
          {/* Search/filter */}
          <div className="rounded-3xl bg-slate-900/80 border border-slate-800 p-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-3">
              <div className="flex flex-col sm:flex-row items-stretch gap-2 w-full">
                <div className="relative flex-1">
                  <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-2.5" />
                  <input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search title, venue, location..."
                    className="w-full rounded-xl bg-slate-950/80 border border-slate-800 pl-8 pr-3 py-2 text-xs text-slate-50 placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-amber-500/70"
                  />
                </div>
                <button
                  onClick={() => loadEvents()}
                  className="sm:w-auto rounded-xl border border-slate-700 bg-slate-950/80 hover:border-amber-500/70 text-[11px] px-3 py-2"
                >
                  Apply
                </button>
              </div>
              <div className="flex items-center gap-2">
                <select
                  value={categoryFilter}
                  onChange={(e) => setCategoryFilter(e.target.value)}
                  className="rounded-xl bg-slate-950/80 border border-slate-800 px-3 py-2 text-[11px] focus:ring-1 focus:ring-amber-500/70"
                >
                  <option value="all">All</option>
                  {CATEGORY_OPTIONS.map((c) => (
                    <option key={c.value}>{c.label}</option>
                  ))}
                </select>
                <button
                  onClick={handleRefresh}
                  disabled={loadingEvents || refreshing}
                  className="rounded-xl border border-slate-700 bg-slate-950/80 hover:border-amber-500/70 text-[11px] px-3 py-2 flex items-center gap-1"
                >
                  <RefreshCw
                    className={`w-3.5 h-3.5 ${refreshing ? "animate-spin" : ""}`}
                  />
                  {refreshing ? "Refreshing" : "Refresh"}
                </button>
              </div>
            </div>
            <p className="text-[11px] text-slate-500">
              This pulls from the public events API.
            </p>
          </div>

          {/* Import live data */}
          <div className="rounded-3xl bg-slate-900/80 border border-slate-800 p-4">
            <div className="flex items-center gap-2 mb-3">
              <Download className="w-4 h-4 text-sky-400" />
              <div>
                <p className="text-[11px] text-slate-400 uppercase tracking-wider">
                  Import live data
                </p>
                <p className="text-xs text-slate-300">
                  Use SeatGeek / SerpAPI via backend.
                </p>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-2">
              <input
                value={fetchRealQuery}
                onChange={(e) => {
                  setFetchRealQuery(e.target.value);
                  setFetchRealError("");
                  setFetchRealMessage("");
                }}
                placeholder="e.g. Lagos concerts..."
                className="flex-1 rounded-xl bg-slate-950/80 border border-slate-800 px-3 py-2 text-xs placeholder:text-slate-500 focus:ring-1 focus:ring-sky-500/70"
              />
              <button
                onClick={handleFetchReal}
                disabled={fetchingReal}
                className="inline-flex items-center justify-center rounded-xl bg-sky-500 hover:bg-sky-400 disabled:bg-sky-500/60 text-slate-950 text-[11px] font-semibold px-3 py-2 transition-all"
              >
                {fetchingReal ? (
                  <>
                    <span className="h-3.5 w-3.5 border-2 border-slate-900/70 border-t-transparent rounded-full animate-spin" />
                    <span className="ml-1">Fetching</span>
                  </>
                ) : (
                  <>
                    <Globe2 className="w-3.5 h-3.5" />
                    <span className="ml-1">Fetch</span>
                  </>
                )}
              </button>
            </div>

            {fetchRealError && (
              <p className="text-[11px] text-red-200 mt-2 flex gap-1">
                <AlertTriangle className="w-3 h-3" /> {fetchRealError}
              </p>
            )}
            {fetchRealMessage && !fetchRealError && (
              <p className="text-[11px] text-emerald-200 mt-2">
                {fetchRealMessage}
              </p>
            )}
          </div>
        </div>

        {/* Error banner */}
        {eventsError && (
          <div className="mb-4 rounded-2xl bg-red-500/10 border border-red-500/40 px-4 py-3 text-xs text-red-100 flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 mt-0.5" />
            <span>{eventsError}</span>
          </div>
        )}

        {/* Main content: stack on mobile, side-by-side on md+ */}
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          {/* Events list */}
          <div className="rounded-3xl bg-slate-900/80 border border-slate-800 p-4 md:p-5">
            {/* same list logic */}
            {/* ... keep your list JSX unchanged ... */}
          </div>

          {/* Form */}
          <form
            onSubmit={handleSubmit}
            className="rounded-3xl bg-slate-900/80 border border-slate-800 p-4 md:p-5 flex flex-col gap-3"
          >
            {/* keep all existing form fields exactly; they already stack nicely on small screens */}
          </form>
        </div>
      </div>
    </div>
  );
}
