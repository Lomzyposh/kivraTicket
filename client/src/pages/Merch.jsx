// src/pages/Merch.jsx
import { useEffect, useMemo, useState } from "react";
import api from "../api/axios";
import { useAuth } from "../context/AuthContext";
import { useNavigate } from "react-router-dom";

// --- helpers --------------------------------------------------
const SIZES = ["XS", "S", "M", "L", "XL", "XXL"];
const CATEGORIES = ["t-shirt", "hoodie", "cap", "pants", "accessory", "other"];

function classNames(...xs) {
  return xs.filter(Boolean).join(" ");
}

function useDebounced(value, delay = 500) {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return v;
}

function currencySymbol(code) {
  if (!code) return "";
  if (code === "USD") return "$";
  if (code === "NGN") return "₦";
  if (code === "GBP") return "£";
  if (code === "EUR") return "€";
  return "";
}

// --- card skeleton --------------------------------------------
function CardSkeleton() {
  return (
    <div
      className="rounded-2xl overflow-hidden border"
      style={{ borderColor: "#1f2937", background: "#0b1220" }}
    >
      <div
        className="w-full aspect-4/3 animate-pulse"
        style={{ background: "#111827" }}
      />
      <div className="p-4 space-y-3">
        <div
          className="h-4 w-2/3 animate-pulse rounded"
          style={{ background: "#111827" }}
        />
        <div
          className="h-3 w-1/3 animate-pulse rounded"
          style={{ background: "#111827" }}
        />
        <div
          className="h-8 w-full animate-pulse rounded"
          style={{ background: "#111827" }}
        />
      </div>
    </div>
  );
}

// --- product card ---------------------------------------------
function MerchCard({ item }) {
  const navigate = useNavigate();
  const { user } = useAuth();

  const [size, setSize] = useState(() => {
    const def = item.variants.find((v) => v.isDefault) || item.variants[0];
    return def?.size || "";
  });

  const colorsForSize = useMemo(() => {
    const set = new Set(
      item.variants.filter((v) => v.size === size).map((v) => v.color)
    );
    return Array.from(set);
  }, [item.variants, size]);

  const [color, setColor] = useState(() => {
    const def = item.variants.find((v) => v.isDefault) || item.variants[0];
    return def?.color || "";
  });

  useEffect(() => {
    // when size changes, ensure color is valid
    if (!colorsForSize.includes(color)) {
      setColor(colorsForSize[0] || "");
    }
  }, [size, colorsForSize]); // eslint-disable-line

  const variant = useMemo(
    () => item.variants.find((v) => v.size === size && v.color === color),
    [item.variants, size, color]
  );

  const prices = useMemo(() => {
    const all = item.variants.map((v) => v.price);
    const min = Math.min(...all);
    const max = Math.max(...all);
    return { min, max };
  }, [item.variants]);

  const primaryImg =
    variant?.image ||
    item.images?.[0] ||
    "https://via.placeholder.com/800x600?text=Merch";

  const canBuy = (variant?.stock || 0) > 0;

  // quantity
  const [qty, setQty] = useState(1);
  const handleQtyChange = (e) => {
    const v = Number(e.target.value || 1);
    if (Number.isNaN(v) || v <= 0) setQty(1);
    else setQty(Math.min(v, 99)); // cap for sanity
  };

  const [adding, setAdding] = useState(false);
  const [feedback, setFeedback] = useState("");

  const onAdd = async () => {
    setFeedback("");

    if (!user) {
      setFeedback("Please log in to add items to your cart.");
      navigate("/login?next=/merch");
      return;
    }

    if (!size || !color) {
      setFeedback("Please choose a size and color.");
      return;
    }

    if (!qty || qty < 1) {
      setFeedback("Please choose a valid quantity.");
      return;
    }

    try {
      setAdding(true);

      const { data } = await api.post("/cart", {
        merchId: item._id,
        size,
        color,
        quantity: qty,
      });

      const totals = data?.totals;
      const symbol = currencySymbol(item.currency || "USD");

      if (totals) {
        setFeedback(
          `Added ${qty} to cart. Total: ${symbol}${totals.totalAmount.toLocaleString()} (${totals.totalQuantity} item${
            totals.totalQuantity === 1 ? "" : "s"
          })`
        );
      } else {
        setFeedback("Added to cart ✅");
      }
    } catch (e) {
      const msg =
        e?.response?.data?.error ||
        e?.response?.data?.message ||
        "Could not add to cart. Please try again.";
      setFeedback(msg);
      console.error("ADD_TO_CART error:", e?.response?.data || e.message);
    } finally {
      setAdding(false);
    }
  };

  return (
    <div
      className="rounded-2xl overflow-hidden border flex flex-col"
      style={{ borderColor: "#1f2937", background: "#0b1220", color: "#e5e7eb" }}
    >
      <div className="relative">
        <img
          src={primaryImg}
          alt={item.title}
          className="w-full aspect-4/3 object-cover"
          loading="lazy"
        />
        {!item.inStock && (
          <div className="absolute inset-0 bg-black/50 flex items-center justify-center text-sm">
            Out of stock
          </div>
        )}
      </div>

      <div className="p-4 flex-1 flex flex-col gap-3">
        <div>
          <h3 className="text-base font-semibold">{item.title}</h3>
          <p className="text-xs text-gray-400">{item.brand}</p>
        </div>

        <div className="text-sm">
          {prices.min === prices.max ? (
            <span>
              ${prices.min.toLocaleString()} {item.currency || "USD"}
            </span>
          ) : (
            <span>
              ${prices.min.toLocaleString()} – $
              {prices.max.toLocaleString()} {item.currency || "USD"}
            </span>
          )}
        </div>

        {/* selectors */}
        <div className="grid grid-cols-3 gap-2">
          <select
            value={size}
            onChange={(e) => setSize(e.target.value)}
            className="w-full rounded-lg border bg-transparent px-3 py-2 text-sm outline-none"
            style={{ borderColor: "#1f2937" }}
          >
            {Array.from(new Set(item.variants.map((v) => v.size))).map((s) => (
              <option key={s} value={s} className="bg-[#0b1220]">
                {s}
              </option>
            ))}
          </select>

          <select
            value={color}
            onChange={(e) => setColor(e.target.value)}
            className="w-full rounded-lg border bg-transparent px-3 py-2 text-sm outline-none"
            style={{ borderColor: "#1f2937" }}
          >
            {colorsForSize.map((c) => (
              <option key={c} value={c} className="bg-[#0b1220]">
                {c}
              </option>
            ))}
          </select>

          <input
            type="number"
            min={1}
            max={99}
            value={qty}
            onChange={handleQtyChange}
            className="w-full rounded-lg border bg-transparent px-3 py-2 text-sm outline-none"
            style={{ borderColor: "#1f2937" }}
          />
        </div>

        <button
          disabled={!canBuy || adding}
          onClick={onAdd}
          className={classNames(
            "mt-auto w-full rounded-xl px-4 py-2 text-sm font-semibold transition",
            canBuy && !adding
              ? "hover:opacity-90"
              : "opacity-50 cursor-not-allowed"
          )}
          style={{
            background: "#fbbf24",
            color: "#020617",
          }}
        >
          {!canBuy
            ? "Out of Stock"
            : adding
            ? "Adding..."
            : "Add to Cart"}
        </button>

        {feedback && (
          <p className="mt-1 text-[11px] text-gray-300">{feedback}</p>
        )}
      </div>
    </div>
  );
}

// --- main page ------------------------------------------------
export default function Merch() {
  // theme base
  const bg = "#020617";
  const surface = "#0b1220";
  const border = "#1f2937";
  const accent = "#fbbf24";
  const text = "#e5e7eb";
  const muted = "#9ca3af";

  // filters & state
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounced(search, 500);
  const [category, setCategory] = useState("");
  const [brand, setBrand] = useState("");
  const [size, setSize] = useState("");
  const [color, setColor] = useState("");
  const [minPrice, setMinPrice] = useState("");
  const [maxPrice, setMaxPrice] = useState("");

  const [page, setPage] = useState(1);
  const [limit] = useState(12);

  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState([]);
  const [pagination, setPagination] = useState({
    page: 1,
    pages: 1,
    total: 0,
  });

  // fetch merch
  useEffect(() => {
    const fetchMerch = async () => {
      setLoading(true);
      try {
        const params = {
          page,
          limit,
        };

        if (debouncedSearch) params.search = debouncedSearch;
        if (category) params.category = category;
        if (brand) params.brand = brand;
        if (size) params.size = size;
        if (color) params.color = color;
        if (minPrice) params.minPrice = minPrice;
        if (maxPrice) params.maxPrice = maxPrice;

        const { data } = await api.get("/merch", { params });
        setItems(data.items || []);
        setPagination(data.pagination || { page: 1, pages: 1, total: 0 });
      } catch (e) {
        console.error("Fetch merch failed:", e?.response?.data || e.message);
      } finally {
        setLoading(false);
      }
    };
    fetchMerch();
  }, [
    debouncedSearch,
    category,
    brand,
    size,
    color,
    minPrice,
    maxPrice,
    page,
    limit,
  ]);

  const resetFilters = () => {
    setSearch("");
    setCategory("");
    setBrand("");
    setSize("");
    setColor("");
    setMinPrice("");
    setMaxPrice("");
    setPage(1);
  };

  return (
    <div style={{ background: bg, color: text, minHeight: "100dvh" }}>
      <div className="mx-auto w-full max-w-7xl px-4 py-6 sm:py-8 lg:py-10">
        {/* header */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold">
              Merch & Lifestyle
            </h1>
            <p className="text-sm" style={{ color: muted }}>
              Event-ready fits and accessories — curated for your vibe.
            </p>
          </div>

          <button
            onClick={resetFilters}
            className="self-start rounded-xl px-4 py-2 text-sm font-semibold transition"
            style={{
              background: surface,
              color: text,
              border: `1px solid ${border}`,
            }}
          >
            Reset Filters
          </button>
        </div>

        {/* filters */}
        <div
          className="mt-6 rounded-2xl p-4 sm:p-5"
          style={{ background: surface, border: `1px solid ${border}` }}
        >
          <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
            {/* search */}
            <div className="md:col-span-4">
              <label className="text-xs" style={{ color: muted }}>
                Search
              </label>
              <input
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
                placeholder="Search by name, tag, or brand..."
                className="mt-1 w-full rounded-xl px-3 py-2 text-sm outline-none"
                style={{
                  background: "#0a1220",
                  border: `1px solid ${border}`,
                  color: text,
                }}
              />
            </div>

            {/* category */}
            <div className="md:col-span-2">
              <label className="text-xs" style={{ color: muted }}>
                Category
              </label>
              <select
                value={category}
                onChange={(e) => {
                  setCategory(e.target.value);
                  setPage(1);
                }}
                className="mt-1 w-full rounded-xl px-3 py-2 text-sm bg-transparent outline-none"
                style={{
                  border: `1px solid ${border}`,
                  background: "#0a1220",
                  color: text,
                }}
              >
                <option value="" className="bg-[#0a1220]">
                  All
                </option>
                {CATEGORIES.map((c) => (
                  <option key={c} value={c} className="bg-[#0a1220]">
                    {c}
                  </option>
                ))}
              </select>
            </div>

            {/* brand */}
            <div className="md:col-span-2">
              <label className="text-xs" style={{ color: muted }}>
                Brand
              </label>
              <input
                value={brand}
                onChange={(e) => {
                  setBrand(e.target.value);
                  setPage(1);
                }}
                placeholder="e.g. StreetLuxe"
                className="mt-1 w-full rounded-xl px-3 py-2 text-sm outline-none"
                style={{
                  background: "#0a1220",
                  border: `1px solid ${border}`,
                  color: text,
                }}
              />
            </div>

            {/* size */}
            <div className="md:col-span-2">
              <label className="text-xs" style={{ color: muted }}>
                Size
              </label>
              <select
                value={size}
                onChange={(e) => {
                  setSize(e.target.value);
                  setPage(1);
                }}
                className="mt-1 w-full rounded-xl px-3 py-2 text-sm bg-transparent outline-none"
                style={{
                  border: `1px solid ${border}`,
                  background: "#0a1220",
                  color: text,
                }}
              >
                <option value="" className="bg-[#0a1220]">
                  Any
                </option>
                {SIZES.map((s) => (
                  <option key={s} value={s} className="bg-[#0a1220]">
                    {s}
                  </option>
                ))}
              </select>
            </div>

            {/* color */}
            <div className="md:col-span-2">
              <label className="text-xs" style={{ color: muted }}>
                Color
              </label>
              <input
                value={color}
                onChange={(e) => {
                  setColor(e.target.value);
                  setPage(1);
                }}
                placeholder="e.g. Black"
                className="mt-1 w-full rounded-xl px-3 py-2 text-sm outline-none"
                style={{
                  background: "#0a1220",
                  border: `1px solid ${border}`,
                  color: text,
                }}
              />
            </div>

            {/* price */}
            <div className="md:col-span-12 grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div>
                <label className="text-xs" style={{ color: muted }}>
                  Min Price
                </label>
                <input
                  type="number"
                  min={0}
                  value={minPrice}
                  onChange={(e) => {
                    setMinPrice(e.target.value);
                    setPage(1);
                  }}
                  className="mt-1 w-full rounded-xl px-3 py-2 text-sm outline-none"
                  style={{
                    background: "#0a1220",
                    border: `1px solid ${border}`,
                    color: text,
                  }}
                />
              </div>
              <div>
                <label className="text-xs" style={{ color: muted }}>
                  Max Price
                </label>
                <input
                  type="number"
                  min={0}
                  value={maxPrice}
                  onChange={(e) => {
                    setMaxPrice(e.target.value);
                    setPage(1);
                  }}
                  className="mt-1 w-full rounded-xl px-3 py-2 text-sm outline-none"
                  style={{
                    background: "#0a1220",
                    border: `1px solid ${border}`,
                    color: text,
                  }}
                />
              </div>

              {/* callout */}
              <div className="col-span-2 hidden sm:flex items-end justify-end">
                <div
                  className="rounded-xl px-3 py-2 text-sm"
                  style={{
                    border: `1px solid ${border}`,
                    background: "#0a1220",
                    color: text,
                  }}
                >
                  Tip: combine <span style={{ color: accent }}>size</span> +{" "}
                  <span style={{ color: accent }}>color</span> to find exact
                  variants.
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* results */}
        <div className="mt-6">
          {loading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {Array.from({ length: 8 }).map((_, i) => (
                <CardSkeleton key={i} />
              ))}
            </div>
          ) : items.length === 0 ? (
            <div
              className="rounded-2xl p-10 text-center"
              style={{
                background: surface,
                border: `1px solid ${border}`,
                color: muted,
              }}
            >
              No merch found. Try adjusting filters.
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {items.map((it) => (
                  <MerchCard key={it._id} item={it} />
                ))}
              </div>

              {/* pagination */}
              <div className="mt-8 flex flex-col sm:flex-row items-center justify-between gap-3">
                <p className="text-xs" style={{ color: muted }}>
                  Page {pagination.page} of {pagination.pages} —{" "}
                  {pagination.total} items
                </p>
                <div className="flex gap-2">
                  <button
                    disabled={pagination.page <= 1}
                    onClick={() =>
                      setPage((p) => Math.max(1, p - 1))
                    }
                    className={classNames(
                      "rounded-xl px-4 py-2 text-sm border",
                      pagination.page <= 1
                        ? "opacity-50 cursor-not-allowed"
                        : "hover:opacity-90"
                    )}
                    style={{
                      borderColor: border,
                      background: surface,
                      color: text,
                    }}
                  >
                    Previous
                  </button>
                  <button
                    disabled={pagination.page >= pagination.pages}
                    onClick={() =>
                      setPage((p) =>
                        Math.min(pagination.pages, p + 1)
                      )
                    }
                    className={classNames(
                      "rounded-xl px-4 py-2 text-sm border",
                      pagination.page >= pagination.pages
                        ? "opacity-50 cursor-not-allowed"
                        : "hover:opacity-90"
                    )}
                    style={{
                      borderColor: border,
                      background: surface,
                      color: text,
                    }}
                  >
                    Next
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}