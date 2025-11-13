// src/pages/AdminMerchAdd.jsx
import { useEffect, useMemo, useState } from "react";
import api from "../../api/axios";
import { Shirt, Plus, Trash2, CheckCircle2, AlertTriangle } from "lucide-react";

const THEME = {
  bg: "#020617",
  surface: "#0b1220",
  border: "#1f2937",
  accent: "#fbbf24",
  text: "#e5e7eb",
  muted: "#9ca3af",
};

const CATEGORIES = ["t-shirt", "hoodie", "cap", "pants", "accessory", "other"];
const SIZES = ["XS", "S", "M", "L", "XL", "XXL"];

export default function AdminMerch() {
  const [form, setForm] = useState({
    title: "",
    description: "",
    brand: "",
    category: "t-shirt",
    tags: [],
    images: [],
    currency: "USD",
    variants: [
      {
        size: "M",
        color: "Black",
        price: 35,
        stock: 10,
        image: "",
        isDefault: true,
      },
    ],
    isActive: true,
  });

  const [tagInput, setTagInput] = useState("");
  const [imageInput, setImageInput] = useState(""); // newline-separated urls
  const [loading, setLoading] = useState(false);
  const [ok, setOk] = useState(null); // null | {message} | {error}

  const variantHasDefault = useMemo(
    () => form.variants.some((v) => v.isDefault),
    [form.variants]
  );

  // Helpers
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  const setVariant = (i, kv) =>
    setForm((f) => {
      const variants = [...f.variants];
      variants[i] = { ...variants[i], ...kv };
      return { ...f, variants };
    });

  const addVariant = () =>
    setForm((f) => ({
      ...f,
      variants: [
        ...f.variants,
        {
          size: "M",
          color: "Black",
          price: 35,
          stock: 0,
          image: "",
          isDefault: f.variants.length === 0,
        },
      ],
    }));

  const removeVariant = (i) =>
    setForm((f) => {
      const variants = f.variants.filter((_, idx) => idx !== i);
      // Ensure at least one remains
      return {
        ...f,
        variants: variants.length
          ? variants
          : [
              {
                size: "M",
                color: "Black",
                price: 35,
                stock: 0,
                image: "",
                isDefault: true,
              },
            ],
      };
    });

  const makeDefault = (i) =>
    setForm((f) => {
      const variants = f.variants.map((v, idx) => ({
        ...v,
        isDefault: idx === i,
      }));
      return { ...f, variants };
    });

  const parseImages = () => {
    const urls = imageInput
      .split("\n")
      .map((s) => s.trim())
      .filter(Boolean);
    set("images", urls);
  };

  const addTag = () => {
    const t = tagInput.trim();
    if (!t) return;
    if (form.tags.includes(t)) return;
    set("tags", [...form.tags, t]);
    setTagInput("");
  };

  const removeTag = (t) =>
    set(
      "tags",
      form.tags.filter((x) => x !== t)
    );

  // Simple validation
  const errors = useMemo(() => {
    const e = {};
    if (!form.title.trim()) e.title = "Title is required.";
    if (!form.brand.trim()) e.brand = "Brand is required.";
    if (!variantHasDefault) e.variants = "Select a default variant.";
    if (!form.variants.length) e.variants = "At least one variant is required.";
    if (form.variants.some((v) => !v.size || !v.color || !v.price)) {
      e.variants = "Each variant needs size, color and price.";
    }
    return e;
  }, [form, variantHasDefault]);

  const onSubmit = async (e) => {
    e.preventDefault();
    setOk(null);

    // sync images from textarea
    parseImages();

    // re-validate after images parse (micro delay)
    setTimeout(async () => {
      const e2 = {};
      if (!form.title.trim()) e2.title = "Title is required.";
      if (!form.brand.trim()) e2.brand = "Brand is required.";
      if (!variantHasDefault) e2.variants = "Select a default variant.";
      if (!form.variants.length)
        e2.variants = "At least one variant is required.";
      if (
        form.variants.some(
          (v) => !v.size || !v.color || v.price === "" || v.price === null
        )
      ) {
        e2.variants = "Each variant needs size, color and price.";
      }
      if (Object.keys(e2).length) {
        window.scrollTo({ top: 0, behavior: "smooth" });
        return;
      }

      try {
        setLoading(true);
        const payload = {
          title: form.title.trim(),
          description: form.description.trim(),
          brand: form.brand.trim(),
          category: form.category,
          tags: form.tags,
          images: form.images,
          currency: form.currency,
          variants: form.variants.map((v) => ({
            size: v.size,
            color: v.color.trim(),
            price: Number(v.price),
            stock: Number(v.stock || 0),
            image: v.image?.trim() || undefined,
            isDefault: !!v.isDefault,
          })),
          isActive: !!form.isActive,
        };

        const { data } = await api.post("/admin/merch", payload);
        setOk({ message: `✅ ${data?.message || "Merch item created"}` });

        // Reset form but keep last brand/category for faster next entry
        setForm((f) => ({
          title: "",
          description: "",
          brand: f.brand,
          category: f.category,
          tags: [],
          images: [],
          currency: f.currency,
          variants: [
            {
              size: "M",
              color: "Black",
              price: 35,
              stock: 10,
              image: "",
              isDefault: true,
            },
          ],
          isActive: true,
        }));
        setImageInput("");
        setTagInput("");
        window.scrollTo({ top: 0, behavior: "smooth" });
      } catch (err) {
        const msg = err?.response?.data?.error || err.message;
        setOk({ error: `❌ ${msg}` });
        window.scrollTo({ top: 0, behavior: "smooth" });
      } finally {
        setLoading(false);
      }
    }, 0);
  };

  useEffect(() => {
    // keep textarea in sync when images changed elsewhere
    setImageInput((form.images || []).join("\n"));
  }, []); // run once

  return (
    <div
      style={{ background: THEME.bg, minHeight: "100dvh", color: THEME.text }}
    >
      <div className="mx-auto w-full max-w-5xl px-4 py-6 sm:py-10">
        {/* Header */}
        <div className="flex items-center gap-3">
          <div
            className="rounded-2xl p-2"
            style={{
              background: THEME.surface,
              border: `1px solid ${THEME.border}`,
            }}
          >
            <Shirt size={22} />
          </div>
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold">Add Merch Item</h1>
            <p className="text-sm" style={{ color: THEME.muted }}>
              Create apparel with size & color variants for the Merch &
              Lifestyle page.
            </p>
          </div>
        </div>

        {/* Alerts */}
        {ok?.message && (
          <div
            className="mt-5 flex items-start gap-3 rounded-xl p-3 text-sm"
            style={{
              background: "#0c1a18",
              border: `1px solid #134e4a`,
              color: "#A7F3D0",
            }}
          >
            <CheckCircle2 className="min-w-5" />
            <div>{ok.message}</div>
          </div>
        )}
        {ok?.error && (
          <div
            className="mt-5 flex items-start gap-3 rounded-xl p-3 text-sm"
            style={{
              background: "#1f0a0a",
              border: `1px solid #7f1d1d`,
              color: "#fecaca",
            }}
          >
            <AlertTriangle className="min-w-5" />
            <div>{ok.error}</div>
          </div>
        )}

        {/* Form card */}
        <form
          onSubmit={onSubmit}
          className="mt-6 rounded-2xl p-5 sm:p-6 space-y-6"
          style={{
            background: THEME.surface,
            border: `1px solid ${THEME.border}`,
          }}
        >
          {/* Basic info */}
          <section className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Field label="Title" error={errors.title}>
              <input
                value={form.title}
                onChange={(e) => set("title", e.target.value)}
                className="w-full rounded-xl px-3 py-2 text-sm outline-none"
                style={{
                  background: "#0a1220",
                  border: `1px solid ${THEME.border}`,
                  color: THEME.text,
                }}
                placeholder="Classic Logo Tee"
              />
            </Field>

            <Field label="Brand" error={errors.brand}>
              <input
                value={form.brand}
                onChange={(e) => set("brand", e.target.value)}
                className="w-full rounded-xl px-3 py-2 text-sm outline-none"
                style={{
                  background: "#0a1220",
                  border: `1px solid ${THEME.border}`,
                  color: THEME.text,
                }}
                placeholder="StreetLuxe"
              />
            </Field>

            <Field label="Category">
              <select
                value={form.category}
                onChange={(e) => set("category", e.target.value)}
                className="w-full rounded-xl px-3 py-2 text-sm bg-transparent outline-none"
                style={{
                  background: "#0a1220",
                  border: `1px solid ${THEME.border}`,
                  color: THEME.text,
                }}
              >
                {CATEGORIES.map((c) => (
                  <option key={c} value={c} className="bg-[#0a1220]">
                    {c}
                  </option>
                ))}
              </select>
            </Field>

            <Field label="Currency">
              <input
                value={form.currency}
                onChange={(e) => set("currency", e.target.value)}
                className="w-full rounded-xl px-3 py-2 text-sm outline-none uppercase"
                style={{
                  background: "#0a1220",
                  border: `1px solid ${THEME.border}`,
                  color: THEME.text,
                }}
                placeholder="USD"
                maxLength={3}
              />
            </Field>

            <Field className="md:col-span-2" label="Description">
              <textarea
                value={form.description}
                onChange={(e) => set("description", e.target.value)}
                rows={4}
                className="w-full rounded-xl px-3 py-2 text-sm outline-none resize-y"
                style={{
                  background: "#0a1220",
                  border: `1px solid ${THEME.border}`,
                  color: THEME.text,
                }}
                placeholder="Soft cotton tee with chest logo"
              />
            </Field>
          </section>

          {/* Tags */}
          <section>
            <label className="text-xs" style={{ color: THEME.muted }}>
              Tags
            </label>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              {form.tags.map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => removeTag(t)}
                  className="rounded-full px-3 py-1 text-xs"
                  style={{
                    background: "#0a1220",
                    border: `1px solid ${THEME.border}`,
                    color: THEME.text,
                  }}
                  title="Remove tag"
                >
                  {t} ×
                </button>
              ))}
              <div className="flex items-center gap-2">
                <input
                  value={tagInput}
                  onChange={(e) => setTagInput(e.target.value)}
                  onKeyDown={(e) =>
                    e.key === "Enter" ? (e.preventDefault(), addTag()) : null
                  }
                  placeholder="Add tag and press Enter"
                  className="rounded-xl px-3 py-2 text-sm outline-none"
                  style={{
                    background: "#0a1220",
                    border: `1px solid ${THEME.border}`,
                    color: THEME.text,
                  }}
                />
                <button
                  type="button"
                  onClick={addTag}
                  className="rounded-xl px-3 py-2 text-xs font-semibold"
                  style={{ background: THEME.accent, color: THEME.bg }}
                >
                  Add
                </button>
              </div>
            </div>
          </section>

          {/* Images */}
          <section>
            <label className="text-xs" style={{ color: THEME.muted }}>
              Images (one URL per line)
            </label>
            <textarea
              value={imageInput}
              onChange={(e) => setImageInput(e.target.value)}
              rows={4}
              className="mt-2 w-full rounded-xl px-3 py-2 text-sm outline-none resize-y"
              style={{
                background: "#0a1220",
                border: `1px solid ${THEME.border}`,
                color: THEME.text,
              }}
              placeholder="https://cdn.example.com/tee-front.jpg
https://cdn.example.com/tee-back.jpg"
            />
            <div className="mt-2">
              <button
                type="button"
                onClick={parseImages}
                className="rounded-xl px-3 py-2 text-xs font-semibold"
                style={{ background: THEME.accent, color: THEME.bg }}
              >
                Apply Images
              </button>
            </div>
            {!!form.images.length && (
              <div className="mt-3 grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-2">
                {form.images.map((src, i) => (
                  <img
                    key={i}
                    src={src}
                    alt={`img-${i}`}
                    className="w-full aspect-square object-cover rounded-lg border"
                    style={{ borderColor: THEME.border }}
                  />
                ))}
              </div>
            )}
          </section>

          {/* Variants */}
          <section>
            <div className="flex items-center justify-between">
              <label className="text-xs" style={{ color: THEME.muted }}>
                Variants (size, color, price, stock, image)
              </label>
              {!variantHasDefault && (
                <span className="text-xs" style={{ color: "#fecaca" }}>
                  Please mark one variant as default
                </span>
              )}
            </div>

            <div className="mt-3 space-y-3">
              {form.variants.map((v, i) => (
                <div
                  key={i}
                  className="grid grid-cols-2 sm:grid-cols-6 gap-2 rounded-xl p-3"
                  style={{
                    background: "#0a1220",
                    border: `1px solid ${THEME.border}`,
                  }}
                >
                  {/* Size */}
                  <select
                    value={v.size}
                    onChange={(e) => setVariant(i, { size: e.target.value })}
                    className="rounded-lg px-2 py-2 text-sm bg-transparent outline-none"
                    style={{
                      border: `1px solid ${THEME.border}`,
                      color: THEME.text,
                    }}
                  >
                    {SIZES.map((s) => (
                      <option key={s} value={s} className="bg-[#0a1220]">
                        {s}
                      </option>
                    ))}
                  </select>

                  {/* Color */}
                  <input
                    value={v.color}
                    onChange={(e) => setVariant(i, { color: e.target.value })}
                    placeholder="Color"
                    className="rounded-lg px-2 py-2 text-sm outline-none"
                    style={{
                      background: "#0a1220",
                      border: `1px solid ${THEME.border}`,
                      color: THEME.text,
                    }}
                  />

                  {/* Price */}
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={v.price}
                    onChange={(e) => setVariant(i, { price: e.target.value })}
                    placeholder="Price"
                    className="rounded-lg px-2 py-2 text-sm outline-none"
                    style={{
                      background: "#0a1220",
                      border: `1px solid ${THEME.border}`,
                      color: THEME.text,
                    }}
                  />

                  {/* Stock */}
                  <input
                    type="number"
                    min="0"
                    value={v.stock}
                    onChange={(e) => setVariant(i, { stock: e.target.value })}
                    placeholder="Stock"
                    className="rounded-lg px-2 py-2 text-sm outline-none"
                    style={{
                      background: "#0a1220",
                      border: `1px solid ${THEME.border}`,
                      color: THEME.text,
                    }}
                  />

                  {/* Variant image */}
                  <input
                    value={v.image || ""}
                    onChange={(e) => setVariant(i, { image: e.target.value })}
                    placeholder="Image URL (optional)"
                    className="rounded-lg px-2 py-2 text-sm outline-none"
                    style={{
                      background: "#0a1220",
                      border: `1px solid ${THEME.border}`,
                      color: THEME.text,
                    }}
                  />

                  {/* Actions */}
                  <div className="flex items-center justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => makeDefault(i)}
                      className={`rounded-lg px-2 py-2 text-xs font-semibold border ${
                        v.isDefault
                          ? "opacity-100"
                          : "opacity-70 hover:opacity-100"
                      }`}
                      style={{
                        borderColor: THEME.border,
                        background: v.isDefault ? THEME.accent : "transparent",
                        color: v.isDefault ? THEME.bg : THEME.text,
                      }}
                      title="Mark as default"
                    >
                      Default
                    </button>
                    <button
                      type="button"
                      onClick={() => removeVariant(i)}
                      className="rounded-lg p-2 border hover:opacity-90"
                      style={{ borderColor: THEME.border }}
                      title="Remove variant"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-3">
              <button
                type="button"
                onClick={addVariant}
                className="flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold"
                style={{ background: THEME.accent, color: THEME.bg }}
              >
                <Plus size={16} /> Add Variant
              </button>
            </div>

            {errors.variants && (
              <p className="mt-2 text-xs" style={{ color: "#fecaca" }}>
                {errors.variants}
              </p>
            )}
          </section>

          {/* Active toggle */}
          <section className="flex items-center gap-2">
            <input
              id="isActive"
              type="checkbox"
              checked={form.isActive}
              onChange={(e) => set("isActive", e.target.checked)}
              className="h-4 w-4"
            />
            <label htmlFor="isActive" className="text-sm">
              Active (visible on site)
            </label>
          </section>

          {/* Submit */}
          <div className="pt-2 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={() => window.history.back()}
              className="rounded-xl px-4 py-2 text-sm border"
              style={{
                borderColor: THEME.border,
                background: THEME.surface,
                color: THEME.text,
              }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className={`rounded-xl px-5 py-2 text-sm font-semibold ${
                loading ? "opacity-70 cursor-not-allowed" : "hover:opacity-90"
              }`}
              style={{ background: THEME.accent, color: THEME.bg }}
            >
              {loading ? "Saving..." : "Save Merch"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function Field({ label, error, className = "", children }) {
  return (
    <div className={className}>
      <label className="text-xs" style={{ color: THEME.muted }}>
        {label}
      </label>
      <div className="mt-1">{children}</div>
      {error ? (
        <p className="mt-1 text-[11px]" style={{ color: "#fecaca" }}>
          {error}
        </p>
      ) : null}
    </div>
  );
}
