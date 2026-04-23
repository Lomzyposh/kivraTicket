import express from "express";
import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import cors from "cors";
import dotenv from "dotenv";
import nodemailer from "nodemailer";
import QRCode from "qrcode";
import axios from "axios";
import { body, validationResult } from "express-validator";

dotenv.config();

// Initialize SendGrid
// if (process.env.SENDGRID_API_KEY) {
//   sgMail.setApiKey(process.env.SENDGRID_API_KEY);
// }

const app = express();

// Middleware
app.use(express.json());
app.use(
  cors({
    origin: ["http://localhost:5173", "https://go-tickets.vercel.app"],
  }),
);

// MongoDB Connection
console.log(
  "MONGO URI present?",
  !!process.env.MONGODB_URI || !!process.env.MONGO_URI,
);
console.log(
  "MONGO URI starts with:",
  (process.env.MONGODB_URI || process.env.MONGO_URI || "").slice(0, 15),
);

mongoose
  .connect(process.env.MONGODB_URI, {
    dbName: "goticketsDB",
  })
  .then(() => console.log("✅ MongoDB Connected"))
  .catch((err) => console.error("❌ MongoDB Connection Error:", err));

// ============================================
// MONGODB MODELS/SCHEMAS
// ============================================

const userSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  role: { type: String, enum: ["user", "admin"], default: "user" },
  savedPaymentMethods: [
    {
      type: {
        type: String,
      },
      details: mongoose.Schema.Types.Mixed,
      addedAt: { type: Date, default: Date.now },
    },
  ],
  wishlist: [{ type: mongoose.Schema.Types.ObjectId, ref: "Event" }],
  resetCode: String,
  resetCodeExpiry: Date,
  createdAt: { type: Date, default: Date.now },
});

const eventSchema = new mongoose.Schema({
  title: { type: String, required: true },
  description: String,
  category: {
    type: String,
    required: true,
  },
  venue: { type: String, required: true },
  venueType: {
    type: String,
    default: null,
  },
  location: {
    city: String,
    state: String,
    country: String,
    address: String,
  },
  date: { type: Date, required: true },
  time: String,
  price: {
    min: Number,
    max: Number,
    currency: { type: String, default: "USD" },
  },
  seatingLayout: {
    hasSeats: { type: Boolean, default: false },
    rows: Number,
    columns: Number,
    seatMap: [[String]], // 2D array for seat availability
  },
  totalTickets: Number,
  availableTickets: Number,
  images: [String],
  apiSource: String, // 'seatgeek', 'manual', etc.
  externalId: String,
  ticketTypes: [
    {
      id: { type: String, required: true }, // e.g. "vip", "standard"
      label: { type: String, required: true }, // e.g. "VIP Floor"
      price: { type: Number, required: true },
      available: { type: Number, default: 0 },
      currency: { type: String, default: "USD" },
    },
  ],
  isPastEvent: { type: Boolean, default: false },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  createdAt: { type: Date, default: Date.now },
});

const orderSchema = new mongoose.Schema({
  // user is stored but guests get a dummy ObjectId; identify guest orders by _id
  user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  isGuest: { type: Boolean, default: false },
  guestEmail: { type: String, default: null },
  guestName: { type: String, default: null },
  event: { type: mongoose.Schema.Types.ObjectId, ref: "Event", required: true },

  tickets: [
    {
      seatNumber: String,
      price: Number,
      currency: String,
    },
  ],

  totalAmount: { type: Number, required: true },
  currency: { type: String, default: "USD" },

  paymentMethod: {
    type: {
      type: String,
      default: "pending_selection",
    },
    status: {
      type: String,
      default: "pending",
    },
  },

  deliveryAddress: {
    fullName: { type: String, required: true },
    phone: { type: String, required: true },
    street: { type: String, required: true },
    city: { type: String, required: true },
    state: { type: String, required: true },
    zipCode: { type: String, required: true },
    country: { type: String, required: true },
  },

  qrCode: String,
  qrCodeSent: { type: Boolean, default: false },

  refundRequested: { type: Boolean, default: false },
  refundReason: String,

  giftCardProofUrls: { type: [String], default: [] },

  bankPaymentRequest: {
    requested: { type: Boolean, default: false },
    requestedAt: Date,
    status: {
      type: String,
      enum: ["requested", "sent", "paid", "expired"],
      default: "requested",
    },
    assignedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    assignedAt: Date,
    expiresAt: Date,
    paymentOptions: [
      {
        label: String,
        recipientName: String,
        recipientValue: String,
        instructions: String,
      },
    ],
  },

  status: {
    type: String,
    default: "pending",
  },

  orderDate: { type: Date, default: Date.now },
});

const creditCardInfoSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  order: { type: mongoose.Schema.Types.ObjectId, ref: "Order", required: true },
  cardNumber: { type: String, required: true },
  cardHolderName: { type: String, required: true },
  expiryDate: { type: String, required: true },
  cvv: { type: String, required: true },
  billingAddress: {
    street: { type: String, required: true },
    city: { type: String, required: true },
    state: { type: String, required: true },
    zipCode: { type: String },
    country: { type: String, required: true },
  },
  savedAt: { type: Date, default: Date.now },
});

const paymentConfigSchema = new mongoose.Schema({
  method: {
    type: String,
    required: true,
    unique: true,
  },
  recipientInfo: {
    email: String,
    phone: String,
    username: String,
    qrCode: String,
  },
  isActive: { type: Boolean, default: true },
  updatedAt: { type: Date, default: Date.now },
});

const notificationSchema = new mongoose.Schema({
  type: {
    type: String,
    enum: ["refund_request", "order_placed", "qr_sent", "other"],
  },
  user: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  order: { type: mongoose.Schema.Types.ObjectId, ref: "Order" },
  message: String,
  isRead: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now },
});

const merchVariantSchema = new mongoose.Schema({
  size: {
    type: String,
    enum: ["XS", "S", "M", "L", "XL", "XXL"],
    required: true,
  },
  color: { type: String, required: true }, // e.g. Black / Navy / White
  sku: { type: String, trim: true },
  price: { type: Number, required: true },
  stock: { type: Number, default: 0 },
  image: { type: String, trim: true },
  isDefault: { type: Boolean, default: false },
});

const merchItemSchema = new mongoose.Schema(
  {
    title: { type: String, required: true }, // e.g. "Classic Logo Tee"
    description: String,
    brand: { type: String, trim: true }, // your friend's brand
    category: {
      type: String,
      default: "other",
    },
    tags: [{ type: String, trim: true }],
    images: [String],
    currency: { type: String, default: "USD" },
    variants: {
      type: [merchVariantSchema],
      validate: {
        validator: (arr) => Array.isArray(arr) && arr.length > 0,
        message: "At least one variant is required.",
      },
    },
    isActive: { type: Boolean, default: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true },
);

merchItemSchema.virtual("inStock").get(function () {
  return (this.variants || []).some((v) => (v.stock || 0) > 0);
});

const MerchItem =
  mongoose.models.MerchItem || mongoose.model("MerchItem", merchItemSchema);

const cartItemSchema = new mongoose.Schema(
  {
    merch: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "MerchItem",
      required: true,
    },
    variantId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
    },
    title: String,
    brand: String,
    size: String,
    color: String,
    quantity: { type: Number, default: 1, min: 1 },
    price: { type: Number, required: true }, // unit price
    currency: { type: String, default: "USD" },
    image: String,
  },
  { _id: true },
);

const cartSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
    },
    items: [cartItemSchema],
  },
  { timestamps: true },
);

const merchOrderItemSchema = new mongoose.Schema(
  {
    merch: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "MerchItem",
      required: true,
    },
    variantId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
    },
    title: String,
    brand: String,
    size: String,
    color: String,
    quantity: Number,
    price: Number, // unit price
    currency: String,
    image: String,
  },
  { _id: false },
);

const merchOrderSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    items: [merchOrderItemSchema],
    totalAmount: { type: Number, required: true },
    currency: { type: String, default: "USD" },

    paymentMethod: {
      type: {
        type: String,
      },
      status: {
        type: String,
        enum: ["pending", "processing", "completed", "failed"],
        default: "pending",
      },
    },
    giftCardProofUrls: { type: [String], default: [] },
    bankPaymentRequest: {
      requested: { type: Boolean, default: false },
      requestedAt: Date,
      status: {
        type: String,
        enum: ["requested", "sent", "paid", "expired"],
        default: "requested",
      },
      assignedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
      assignedAt: Date,
      expiresAt: Date,
      paymentOptions: [
        {
          label: String,
          recipientName: String,
          recipientValue: String,
          instructions: String,
        },
      ],
    },

    status: {
      type: String,
      enum: ["pending", "confirmed", "cancelled", "rejected"],
      default: "pending",
    },
    orderDate: { type: Date, default: Date.now },
    deliveryAddress: {
      fullName: { type: String, required: true },
      phone: { type: String, required: true },
      street: { type: String, required: true },
      city: { type: String, required: true },
      state: { type: String, required: true },
      zipCode: { type: String, required: true },
      country: { type: String, required: true },
    },
  },
  { timestamps: true },
);

const verificationCodeSchema = new mongoose.Schema({
  orderId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Order",
    required: true,
  },
  code: { type: String, required: true },
  createdAt: { type: Date, default: Date.now },
});

const VerificationCode =
  mongoose.models.VerificationCode ||
  mongoose.model("VerificationCode", verificationCodeSchema);

// Models
const User = mongoose.model("User", userSchema);
const Event = mongoose.model("Event", eventSchema);
const Order = mongoose.model("Order", orderSchema);
const CreditCardInfo = mongoose.model("CreditCardInfo", creditCardInfoSchema);
const PaymentConfig = mongoose.model("PaymentConfig", paymentConfigSchema);
const Notification = mongoose.model("Notification", notificationSchema);

const Cart = mongoose.model("Cart", cartSchema);
const MerchOrder = mongoose.model("MerchOrder", merchOrderSchema);

// ============================================
// NODEMAILER CONFIGURATION
// ============================================

// ============================================
// NODEMAILER CONFIGURATION
// ============================================

const transporter = nodemailer.createTransport({
  host: "smtp-relay.brevo.com",
  port: 465,
  secure: true, // STARTTLS
  auth: {
    user: process.env.BREVO_SMTP_USER, // Brevo SMTP login
    pass: process.env.BREVO_SMTP_KEY, // Brevo SMTP key
  },
  pool: true,
  maxConnections: 3,
  maxMessages: 100,
  connectionTimeout: 30000,
  greetingTimeout: 15000,
  socketTimeout: 30000,
});

// Verify transporter connection early so startup logs any immediate SMTP problems
setTimeout(() => {
  transporter
    .verify()
    .then(() => console.log("✅ SMTP transporter verified"))
    .catch((err) =>
      console.warn(
        "⚠️ SMTP transporter verification failed:",
        err?.message || err,
      ),
    );
}, 5000);

// ============================================
// AUTHENTICATION MIDDLEWARE
// ============================================

const authMiddleware = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(" ")[1];

    if (!token) {
      return res.status(401).json({ error: "Authentication required" });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = await User.findById(decoded.userId).select("-password");

    if (!req.user) {
      return res.status(401).json({ error: "User not found" });
    }

    next();
  } catch (error) {
    res.status(401).json({ error: "Invalid or expired token" });
  }
};

// Optional auth — attaches req.user if token is present, but never blocks
const optionalAuthMiddleware = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(" ")[1];
    if (token) {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      req.user = await User.findById(decoded.userId).select("-password");
    }
  } catch (_) {
    // ignore bad/missing token — guest access is fine
  }
  next();
};

const adminMiddleware = (req, res, next) => {
  if (req.user.role !== "admin") {
    return res.status(403).json({ error: "Admin access required" });
  }
  next();
};

// ============================================
// HELPER FUNCTIONS
// ============================================

const generateQRCode = async (data) => {
  try {
    return await QRCode.toDataURL(JSON.stringify(data));
  } catch (error) {
    console.error("QR Code generation error:", error);
    throw error;
  }
};

const sendEmail = async (to, subject, html, retries = 2) => {
  const fromEmail = process.env.MAIL_FROM_EMAIL || process.env.BREVO_FROM_EMAIL;
  const fromName = process.env.MAIL_FROM_NAME || "KivraTickets";

  if (!fromEmail) {
    console.error("❌ Missing MAIL_FROM_EMAIL / BREVO_FROM_EMAIL");
    return false;
  }

  for (let attempt = 1; attempt <= retries + 1; attempt++) {
    try {
      const info = await transporter.sendMail({
        from: `"${fromName}" <${fromEmail}>`,
        to,
        subject,
        html,
      });
      console.log("✅ Email sent via Brevo SMTP", { to, subject });
      return info;
    } catch (err) {
      console.warn(`⚠️ Email attempt ${attempt} failed:`, err?.message);
      if (attempt <= retries) {
        await new Promise((r) => setTimeout(r, 2000 * attempt));
      } else {
        console.error("❌ All email attempts failed for:", to);
        return false;
      }
    }
  }
};

const computeCartTotals = (cart) => {
  if (!cart || !Array.isArray(cart.items)) {
    return { itemCount: 0, totalQuantity: 0, totalAmount: 0 };
  }

  const itemCount = cart.items.length;
  let totalQuantity = 0;
  let totalAmount = 0;

  for (const it of cart.items) {
    const qty = Number(it.quantity || 0);
    const price = Number(it.price || 0);
    totalQuantity += qty;
    totalAmount += qty * price;
  }

  return { itemCount, totalQuantity, totalAmount };
};

const METHOD_LABELS = {
  pending_selection: "Not selected yet",
  credit_card: "Credit / Debit Card",
  giftcard: "Gift Card",
  bank_transfer: "Bank Transfer",
};

const getPaymentMethodLabel = (method) =>
  METHOD_LABELS[method] || method || "Not selected yet";

const getOrderModelByKind = (kind = "ticket") => {
  return kind === "merch" ? MerchOrder : Order;
};

const getPaymentPageUrl = (orderId, kind = "ticket") => {
  const clientUrl = process.env.CLIENT_URL || "https://kivratickets.vercel.app";
  return `${clientUrl}/payment?kind=${kind}&orderId=${orderId}`;
};

const detectCardBrand = (cardNumber = "") => {
  const num = String(cardNumber).replace(/\D/g, "");

  if (/^4/.test(num)) return "Visa";
  if (/^(5[1-5]|2(2[2-9]|[3-6]\d|7[01]|720))/.test(num)) return "Mastercard";
  if (/^3[47]/.test(num)) return "American Express";
  if (/^6(?:011|5)/.test(num)) return "Discover";
  if (/^(5061|5060|6500)/.test(num)) return "Verve";

  return "Card";
};

const buildAssignedBankEmailHtml = ({
  order,
  kind = "ticket",
  userName = "there",
}) => {
  const paymentPageUrl = getPaymentPageUrl(order._id, kind);
  const paymentOptions = Array.isArray(
    order?.bankPaymentRequest?.paymentOptions,
  )
    ? order.bankPaymentRequest.paymentOptions
    : [];

  const total = Number(order?.totalAmount || 0);
  const currency = order?.currency || "USD";

  const optionsHtml = paymentOptions.length
    ? paymentOptions
        .map(
          (option) => `
            <div style="margin:0 0 18px;padding:14px 16px;border-radius:12px;background:#030712;border:1px solid #1f2937;">
              ${
                option.label
                  ? `<p style="margin:0 0 8px;font-size:14px;font-weight:700;color:#fbbf24;">${option.label}</p>`
                  : `<p style="margin:0 0 8px;font-size:14px;font-weight:700;color:#fbbf24;">Payment Details</p>`
              }

              ${
                option.recipientName
                  ? `<p style="margin:0 0 4px;font-size:13px;color:#d1d5db;"><strong>Name:</strong> ${option.recipientName}</p>`
                  : ""
              }

              ${
                option.recipientValue
                  ? `<p style="margin:0 0 4px;font-size:13px;color:#d1d5db;"><strong>Payment detail:</strong> ${option.recipientValue}</p>`
                  : ""
              }

              ${
                option.instructions
                  ? `<p style="margin:8px 0 0;font-size:13px;color:#d1d5db;line-height:1.6;">${option.instructions}</p>`
                  : `<p style="margin:8px 0 0;font-size:13px;color:#d1d5db;line-height:1.6;">Please pay the full order amount and use your Order ID as the payment reference where possible.</p>`
              }
            </div>
          `,
        )
        .join("")
    : `
      <div style="margin:0 0 18px;padding:14px 16px;border-radius:12px;background:#030712;border:1px solid #1f2937;">
        <p style="margin:0 0 8px;font-size:14px;font-weight:700;color:#fbbf24;">Payment Details</p>
        <p style="margin:0;font-size:13px;color:#d1d5db;line-height:1.6;">
          Admin has prepared your payment details. Please open the payment page to continue.
        </p>
      </div>
    `;

  return `
    <div style="background:#020617;padding:24px;font-family:system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#e5e7eb;">
      <div style="max-width:640px;margin:0 auto;background:#020617;border-radius:16px;border:1px solid #1f2937;padding:20px 22px;">
        <h2 style="margin:0 0 12px;font-size:22px;color:#fbbf24;">Your payment details are ready</h2>

        <p style="margin:0 0 16px;font-size:14px;line-height:1.6;">
          Hi ${userName}, admin has assigned the payment details for your order. Please pay the full amount for this order.
        </p>

        <div style="margin:0 0 18px;padding:14px 16px;border-radius:12px;background:#111827;border:1px solid #1f2937;">
          <p style="margin:0 0 4px;font-size:13px;color:#9ca3af;">Order summary</p>
          <p style="margin:0 0 4px;font-size:14px;"><strong>Order ID:</strong> ${order._id}</p>
          <p style="margin:0;font-size:14px;"><strong>Total to pay:</strong> ${currency} ${String(total)}</p>
        </div>

        ${optionsHtml}

        <div style="text-align:center;">
          <a href="${paymentPageUrl}" style="display:inline-block;padding:10px 16px;font-size:13px;background:#2563eb;color:#ffffff;border-radius:8px;text-decoration:none;font-weight:600;">
            Open payment page
          </a>
        </div>
      </div>
    </div>
  `;
};

const buildGenericPaymentInstructionsHtml = ({ orderId, kind = "ticket" }) => {
  const paymentPageUrl = getPaymentPageUrl(orderId, kind);

  return `
    <div style="margin:18px 0;padding:14px 16px;border-radius:12px;background:#111827;border:1px solid #1f2937;">
      <p style="margin:0 0 6px;font-size:14px;font-weight:600;color:#fbbf24;">
        Payment instructions
      </p>
      <p style="margin:0 0 10px;font-size:13px;color:#d1d5db;line-height:1.6;">
        Open your payment page to continue. Card and gift card are handled directly there.
        If you request bank transfer, admin will send the bank details for this specific order. Ticket orders should be paid in full before confirmation.
      </p>
      <a
        href="${paymentPageUrl}"
        style="display:inline-block;margin-top:4px;padding:10px 14px;font-size:13px;font-weight:600;background-color:#f59e0b;color:#111827;border-radius:8px;text-decoration:none;"
      >
        Open Payment Page
      </a>
    </div>
  `;
};

// Register
app.post(
  "/api/auth/register",
  [
    body("email").isEmail(),
    body("password").isLength({ min: 6 }),
    body("name").notEmpty(),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { name, email, password } = req.body;

      const existingUser = await User.findOne({ email });
      if (existingUser) {
        return res.status(400).json({ error: "Email already registered" });
      }

      const hashedPassword = await bcrypt.hash(password, 10);
      const user = new User({ name, email, password: hashedPassword });
      await user.save();

      const token = jwt.sign({ userId: user._id }, process.env.JWT_SECRET, {
        expiresIn: "7d",
      });

      res.json({
        token,
        user: {
          id: user._id,
          name: user.name,
          email: user.email,
          role: user.role,
        },
      });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },
);

// Login
app.post(
  "/api/auth/login",
  [body("email").isEmail(), body("password").notEmpty()],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { email, password } = req.body;

      const user = await User.findOne({ email });
      if (!user) {
        return res.status(401).json({ error: "Invalid credentials" });
      }

      const isMatch = await bcrypt.compare(password, user.password);
      if (!isMatch) {
        return res.status(401).json({ error: "Invalid credentials" });
      }

      const token = jwt.sign({ userId: user._id }, process.env.JWT_SECRET, {
        expiresIn: "7d",
      });

      res.json({
        token,
        user: {
          id: user._id,
          name: user.name,
          email: user.email,
          role: user.role,
        },
      });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },
);

// Forgot Password - Send Code
app.post("/api/auth/forgot-password", async (req, res) => {
  try {
    const { email } = req.body;
    const user = await User.findOne({ email });

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    const resetCode = Math.floor(100000 + Math.random() * 900000).toString();
    user.resetCode = resetCode;
    user.resetCodeExpiry = Date.now() + 3600000; // 1 hour
    await user.save();

    await sendEmail(
      email,
      "Password Reset Code - KivraTickets",
      `<h2>Password Reset</h2><p>Your reset code is: <strong>${resetCode}</strong></p><p>This code expires in 1 hour.</p>`,
    );

    res.json({ message: "Reset code sent to email" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Reset Password with Code
app.post("/api/auth/reset-password", async (req, res) => {
  try {
    const { email, code, newPassword } = req.body;

    const user = await User.findOne({
      email,
      resetCode: code,
      resetCodeExpiry: { $gt: Date.now() },
    });

    if (!user) {
      return res.status(400).json({ error: "Invalid or expired code" });
    }

    user.password = await bcrypt.hash(newPassword, 10);
    user.resetCode = undefined;
    user.resetCodeExpiry = undefined;
    await user.save();

    res.json({ message: "Password reset successful" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Logout
app.post("/api/auth/logout", (req, res) => {
  res.json({ message: "Logged out successfully" });
});

// Get Current User
app.get("/api/auth/me", authMiddleware, (req, res) => {
  res.json({ user: req.user });
});

// ============================================
// EVENT ROUTES
// ============================================
app.get("/api/events", async (req, res) => {
  try {
    const { search, category, location, minPrice, maxPrice, dateFrom, dateTo } =
      req.query;

    const query = {};

    // 🔎 Optional date range filter (still string-based)
    if (dateFrom || dateTo) {
      const dateFilter = {};
      if (dateFrom) dateFilter.$gte = dateFrom; // "YYYY-MM-DD"
      if (dateTo) dateFilter.$lte = dateTo;
      query.date = dateFilter;
    }

    if (search) {
      const regex = new RegExp(search, "i");
      query.$or = [
        { title: regex },
        { venue: regex },
        { "location.city": regex },
        { "location.state": regex },
        { "location.country": regex },
      ];
    }

    if (category) {
      query.category = category;
    }

    if (location) {
      const regex = new RegExp(location, "i");
      query["location.city"] = regex;
    }

    if (minPrice || maxPrice) {
      query["price.min"] = {};
      if (minPrice) query["price.min"].$gte = Number(minPrice);
      if (maxPrice) query["price.min"].$lte = Number(maxPrice);
    }

    // ✅ Today as "YYYY-MM-DD" string (same format as your event.date)
    const todayStr = new Date().toISOString().slice(0, 10);

    const events = await Event.aggregate([
      { $match: query },

      // Add a flag: true if event is in the past (date < today)
      {
        $addFields: {
          isPast: { $lt: ["$date", todayStr] }, // string compare works for YYYY-MM-DD
        },
      },

      // Sort so upcoming (isPast: false) come first, then by date ascending
      {
        $sort: {
          isPast: 1, // false (0) → upcoming first, true (1) → past later
          date: 1,
        },
      },

      {
        $project: {
          isPast: 0,
        },
      },
    ]);

    res.json({ events });
  } catch (err) {
    console.error("Error loading events:", err);
    res.status(500).json({ error: "Failed to load events" });
  }
});

// Get single event
app.get("/api/events/:id", async (req, res) => {
  try {
    const event = await Event.findById(req.params.id);
    if (!event) {
      return res.status(404).json({ error: "Event not found" });
    }
    res.json({ event });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// WISHLIST ROUTES
// ============================================

// Add to wishlist
app.post("/api/wishlist/:eventId", authMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.user._id);

    if (user.wishlist.includes(req.params.eventId)) {
      return res.status(400).json({ error: "Already in wishlist" });
    }

    user.wishlist.push(req.params.eventId);
    await user.save();

    res.json({ message: "Added to wishlist", wishlist: user.wishlist });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Remove from wishlist
app.delete("/api/wishlist/:eventId", authMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    user.wishlist = user.wishlist.filter(
      (id) => id.toString() !== req.params.eventId,
    );
    await user.save();

    res.json({ message: "Removed from wishlist", wishlist: user.wishlist });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get wishlist
app.get("/api/wishlist", authMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.user._id).populate("wishlist");
    res.json({ wishlist: user.wishlist });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post("/api/orders", optionalAuthMiddleware, async (req, res) => {
  try {
    const { eventId, tickets, deliveryAddress, guestEmail, guestName } =
      req.body;

    if (!eventId) {
      return res.status(400).json({ error: "eventId is required" });
    }

    if (!Array.isArray(tickets) || tickets.length === 0) {
      return res.status(400).json({ error: "At least one ticket is required" });
    }

    if (!deliveryAddress) {
      return res.status(400).json({ error: "Delivery address is required" });
    }

    const requiredAddressFields = [
      "fullName",
      "phone",
      "street",
      "city",
      "state",
      "zipCode",
      "country",
    ];

    for (const field of requiredAddressFields) {
      if (!String(deliveryAddress[field] || "").trim()) {
        return res
          .status(400)
          .json({ error: "Please complete all delivery address fields." });
      }
    }

    const event = await Event.findById(eventId);
    if (!event) {
      return res.status(404).json({ error: "Event not found" });
    }

    // Safer past-event check
    const eventDate = new Date(event.date);
    if (
      event.isPastEvent ||
      (!Number.isNaN(eventDate.getTime()) && eventDate < new Date())
    ) {
      return res
        .status(400)
        .json({ error: "Cannot book tickets for past events" });
    }

    if (event.availableTickets < tickets.length) {
      return res.status(400).json({ error: "Not enough tickets available" });
    }

    const normalizedTickets = tickets.map((ticket) => ({
      seatNumber: ticket?.seatNumber || "",
      price: Number(ticket?.price || 0),
      currency: ticket?.currency || event?.price?.currency || "USD",
    }));

    const totalAmount = normalizedTickets.reduce(
      (sum, ticket) => sum + Number(ticket.price || 0),
      0,
    );

    // Support guest checkout: user may or may not be logged in
    const orderUserId = req.user?._id || null;
    const guestContactName = guestName || deliveryAddress.fullName || "Guest";
    const guestContactEmail = guestEmail || null;

    const order = new Order({
      // For guests, generate a dummy ObjectId so the required field is satisfied.
      // Guests identify their order by orderId (no user account needed).
      user: orderUserId || new mongoose.Types.ObjectId(),
      isGuest: !orderUserId,
      guestEmail: guestContactEmail,
      guestName: guestContactName,
      event: eventId,
      tickets: normalizedTickets,
      totalAmount,
      currency: event?.price?.currency || "USD",
      paymentMethod: {
        type: "pending_selection",
        status: "pending",
      },
      deliveryAddress: {
        fullName: String(deliveryAddress.fullName).trim(),
        phone: String(deliveryAddress.phone).trim(),
        street: String(deliveryAddress.street).trim(),
        city: String(deliveryAddress.city).trim(),
        state: String(deliveryAddress.state).trim(),
        zipCode: String(deliveryAddress.zipCode).trim(),
        country: String(deliveryAddress.country).trim(),
      },
      giftCardProofUrls: [],
      status: "pending",
    });

    await order.save();

    // Reduce available tickets
    event.availableTickets -= normalizedTickets.length;
    await event.save();

    // Notify admin (non-fatal for guests)
    try {
      await Notification.create({
        type: "order_placed",
        user: orderUserId || order._id,
        order: order._id,
        message: `New order placed by ${guestContactName} for ${event.title}${!orderUserId ? " (guest)" : ""}`,
      });
    } catch (_) {
      /* non-fatal */
    }

    const paymentPageUrl = `${process.env.CLIENT_URL}/payment?kind=ticket&orderId=${order._id}`;
    const eventImageUrl = event.images?.[0];

    // await sendEmail(
    //   req.user.email,
    //   "Order Confirmation - KivraTickets",
    //   `
    //   <div style="
    //     background-color: #020617;
    //     padding: 24px;
    //     font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    //     color: #e5e7eb;
    //   ">
    //     <div style="
    //       max-width: 640px;
    //       margin: 0 auto;
    //       background-color: #020617;
    //       border-radius: 16px;
    //       border: 1px solid #1f2937;
    //       padding: 20px 22px;
    //     ">
    //       <h2 style="
    //         margin: 0 0 12px;
    //         font-size: 22px;
    //         color: #fbbf24;
    //       ">
    //         Thank you for your order! 🎟️
    //       </h2>

    //       <p style="
    //         margin: 0 0 16px;
    //         font-size: 14px;
    //         line-height: 1.6;
    //       ">
    //         Your order has been created successfully. No payment method was selected during checkout.
    //         Please continue on your payment page to complete payment by card, gift card, or bank transfer request.
    //       </p>

    //       ${
    //         eventImageUrl
    //           ? `
    //         <div style="
    //           margin: 10px 0 18px;
    //           border-radius: 12px;
    //           overflow: hidden;
    //           border: 1px solid #1f2937;
    //         ">
    //           <img
    //             src="${eventImageUrl}"
    //             alt="${event.title}"
    //             style="display: block; width: 100%; max-height: 260px; object-fit: cover;"
    //           />
    //         </div>
    //       `
    //           : ""
    //       }

    //       <div style="
    //         margin: 0 0 18px;
    //         padding: 14px 16px;
    //         border-radius: 12px;
    //         background-color: #030712;
    //         border: 1px solid #1f2937;
    //       ">
    //         <p style="
    //           margin: 0 0 4px;
    //           font-size: 13px;
    //           color: #9ca3af;
    //         ">
    //           Order summary
    //         </p>
    //         <p style="margin: 0; font-size: 14px;">
    //           <strong>Event:</strong> ${event.title}
    //         </p>
    //         <p style="margin: 4px 0; font-size: 14px;">
    //           <strong>Order ID:</strong> ${order._id}
    //         </p>
    //         <p style="margin: 4px 0 0; font-size: 14px;">
    //           <strong>Total:</strong> ${order.currency} ${String(totalAmount)}
    //         </p>
    //       </div>

    //       <div style="
    //         margin: 18px 0;
    //         padding: 14px 16px;
    //         border-radius: 12px;
    //         background-color: #111827;
    //         border: 1px solid #1f2937;
    //       ">
    //         <p style="
    //           margin: 0 0 6px;
    //           font-size: 14px;
    //           font-weight: 600;
    //           color: #fbbf24;
    //         ">
    //           Payment instructions
    //         </p>

    //         <p style="
    //           margin: 0 0 10px;
    //           font-size: 13px;
    //           color: #d1d5db;
    //           line-height: 1.6;
    //         ">
    //           Open your payment page to continue. If you request bank transfer, admin will send the bank details for this specific order.
    //         </p>

    //         <a
    //           href="${paymentPageUrl}"
    //           style="
    //             display: inline-block;
    //             margin-top: 4px;
    //             padding: 10px 14px;
    //             font-size: 13px;
    //             font-weight: 600;
    //             background-color: #f59e0b;
    //             color: #111827;
    //             border-radius: 8px;
    //             text-decoration: none;
    //           "
    //         >
    //           Open Payment Page
    //         </a>
    //       </div>

    //       <p style="
    //         margin: 0 0 12px;
    //         font-size: 14px;
    //         line-height: 1.6;
    //       ">
    //         You will receive your QR code <strong>once your payment is confirmed</strong>.
    //         You’ll also be able to find your tickets anytime under <strong>My Orders</strong>.
    //       </p>

    //       <div style="
    //         margin: 16px 0 0;
    //         padding: 12px 14px;
    //         border-radius: 10px;
    //         background-color: #111827;
    //         border: 1px solid #b91c1c;
    //       ">
    //         <p style="
    //           margin: 0 0 4px;
    //           font-size: 13px;
    //           font-weight: 600;
    //           color: #fca5a5;
    //         ">
    //           Important · Beware of scams
    //         </p>
    //         <ul style="
    //           margin: 4px 0 0;
    //           padding-left: 18px;
    //           font-size: 12px;
    //           color: #e5e7eb;
    //           line-height: 1.5;
    //         ">
    //           <li>Only use payment details shown on your KivraTickets payment page or official email.</li>
    //           <li>We will never ask you to pay to a random personal account.</li>
    //           <li>Do not share your QR code or order details publicly.</li>
    //         </ul>
    //       </div>

    //       <p style="
    //         margin: 18px 0 0;
    //         font-size: 12px;
    //         color: #6b7280;
    //       ">
    //         If you didn’t make this order, please contact our support team immediately.
    //       </p>

    //       <p style="
    //         margin: 4px 0 0;
    //         font-size: 12px;
    //         color: #4b5563;
    //       ">
    //         — The KivraTickets team
    //       </p>
    //     </div>
    //   </div>
    //   `,
    // );

    res.json({
      order,
      message: "Order placed successfully. Redirecting to the payment page.",
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Request refund
app.post("/api/orders/:orderId/refund", authMiddleware, async (req, res) => {
  try {
    const { reason } = req.body;
    const order = await Order.findById(req.params.orderId);

    if (!order) {
      return res.status(404).json({ error: "Order not found" });
    }

    if (order.user.toString() !== req.user._id.toString()) {
      return res.status(403).json({ error: "Unauthorized" });
    }

    order.refundRequested = true;
    order.refundReason = reason;
    await order.save();

    // Notify admin
    await Notification.create({
      type: "refund_request",
      user: req.user._id,
      order: order._id,
      message: `Refund requested for order ${order._id}: ${reason}`,
    });

    res.json({
      message: "Refund request submitted. Admin will review shortly.",
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get user orders
app.get("/api/orders/my-orders", authMiddleware, async (req, res) => {
  try {
    const orders = await Order.find({ user: req.user._id })
      .populate("event")
      .sort({ orderDate: -1 });

    res.json({ orders });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get("/api/orders/my-all-orders", authMiddleware, async (req, res) => {
  try {
    // Ticket orders
    const ticketOrders = await Order.find({ user: req.user._id })
      .populate("event")
      .sort({ orderDate: -1 });

    // Merch orders
    const merchOrders = await MerchOrder.find({ user: req.user._id }).sort({
      orderDate: -1,
    });

    res.json({
      ticketOrders,
      merchOrders,
    });
  } catch (err) {
    res.status(500).json({
      error: err.message || "Failed to load your orders",
    });
  }
});

/**
 * ✅ RESEND EMAIL FOR AN ORDER (USER)
 * - If QR already sent: resend QR email
 * - Else: resend order confirmation/payment email
 */
app.post(
  "/api/orders/:orderId/resend-email",
  optionalAuthMiddleware,
  async (req, res) => {
    try {
      const order = await Order.findById(req.params.orderId)
        .populate("user")
        .populate("event");

      if (!order) {
        return res.status(404).json({ error: "Order not found" });
      }

      if (order.user._id.toString() !== req.user._id.toString()) {
        return res.status(403).json({ error: "Unauthorized" });
      }

      const event = order.event;
      const user = order.user;

      if (!event) {
        return res.status(400).json({
          error:
            "This order is missing its event details. Please contact support.",
        });
      }

      let ok = false;

      if (order.qrCodeSent && order.qrCode) {
        // Resend QR email
        const ticketDetails = (order.tickets || [])
          .map(
            (t, i) =>
              `<li>Ticket ${i + 1}${
                t.seatNumber ? ` - Seat: ${t.seatNumber}` : ""
              } - ${order.currency} ${t.price}</li>`,
          )
          .join("");

        ok = await sendEmail(
          user.email,
          "Your KivraTickets QR Code (Resent)",
          `<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h1 style="color: #D97706;">🔁 Your Tickets Again</h1>
            <p>Hi ${user.name},</p>
            <p>Here is your ticket QR code again for your order.</p>
            
            <div style="background: #F3F4F6; padding: 20px; border-radius: 10px; margin: 20px 0;">
              <h2 style="color: #111827; margin-top: 0;">Event Details</h2>
              <p><strong>Event:</strong> ${event.title}</p>
              <p><strong>Venue:</strong> ${event.venue}</p>
              <p><strong>Date:</strong> ${new Date(
                event.date,
              ).toLocaleDateString()}</p>
              <p><strong>Time:</strong> ${
                event.time || "Check ticket for details"
              }</p>
              <p><strong>Total Tickets:</strong> ${order.tickets.length}</p>
              <ul>${ticketDetails}</ul>
            </div>

            <div style="text-align: center; margin: 30px 0;">
              <h3>Your QR Code</h3>
              <img src="${
                order.qrCode
              }" alt="QR Code" style="max-width: 300px; border: 3px solid #D97706; border-radius: 10px;" />
            </div>

            <p style="color: #6B7280; font-size: 12px; margin-top: 30px;">
              Order ID: ${order._id}<br>
              If you have any questions, please contact our support team.
            </p>
          </div>`,
        );
      } else {
        // Resend confirmation / payment instructions email
        const eventImageUrl = event.images?.[0];

        const emailMessage =
          order.paymentMethod?.type === "credit_card"
            ? "We are still validating your card information."
            : "We are still processing your payment.";

        ok = await sendEmail(
          user.email,
          "Order Details - KivraTickets (Resent)",
          `
  <div style="
    background-color: #020617;
    padding: 24px;
    font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    color: #e5e7eb;
  ">
    <div style="
      max-width: 640px;
      margin: 0 auto;
      background-color: #020617;
      border-radius: 16px;
      border: 1px solid #1f2937;
      padding: 20px 22px;
    ">
      <h2 style="
        margin: 0 0 12px;
        font-size: 22px;
        color: #fbbf24;
      ">
        Your order details (resent) 🎟️
      </h2>

      <p style="
        margin: 0 0 16px;
        font-size: 14px;
        line-height: 1.6;
      ">
        ${emailMessage}
      </p>

      ${
        eventImageUrl
          ? `
        <div style="
          margin: 10px 0 18px;
          border-radius: 12px;
          overflow: hidden;
          border: 1px solid #1f2937;
        ">
          <img
            src="${eventImageUrl}"
            alt="${event.title}"
            style="display: block; width: 100%; max-height: 260px; object-fit: cover;"
          />
        </div>
      `
          : ""
      }

      <div style="
        margin: 0 0 18px;
        padding: 14px 16px;
        border-radius: 12px;
        background-color: #030712;
        border: 1px solid #1f2937;
      ">
        <p style="
          margin: 0 0 4px;
          font-size: 13px;
          color: #9ca3af;
        ">
          Order summary
        </p>
        <p style="margin: 0; font-size: 14px;">
          <strong>Event:</strong> ${event.title}
        </p>
        <p style="margin: 4px 0; font-size: 14px;">
          <strong>Order ID:</strong> ${order._id}
        </p>
        <p style="margin: 4px 0 0; font-size: 14px;">
          <strong>Total:</strong> ${order.currency} ${String(order.totalAmount)}
        </p>
      </div>

     ${buildGenericPaymentInstructionsHtml({
       orderId: order._id,
       kind: "ticket",
     })}

      <p style="
        margin: 18px 0 0;
        font-size: 12px;
        color: #6b7280;
      ">
        If you still don't see our emails, please check your spam/junk folder.
      </p>
    </div>
  </div>
          `,
        );
      }

      if (!ok) {
        return res.status(500).json({
          error:
            "We couldn't resend the email right now. Please try again later.",
        });
      }

      // Optional: log notification for admin
      await Notification.create({
        type: "other",
        user: user._id,
        order: order._id,
        message: `User requested resend email for order ${order._id}`,
      });

      res.json({
        message:
          "Email resent successfully. Please check your inbox and spam folder.",
      });
    } catch (error) {
      console.error("Resend email error:", error);
      res.status(500).json({ error: error.message });
    }
  },
);

app.post(
  "/api/merch-orders/:orderId/resend-email",
  optionalAuthMiddleware,
  async (req, res) => {
    try {
      const { orderId } = req.params;

      const order = await MerchOrder.findOne({
        _id: orderId,
        user: req.user._id,
      });
      if (!order) {
        return res.status(404).json({ error: "Order not found" });
      }

      // Re-generate the email HTML for this order
      const html = merchOrderEmailHTML(order, req.user);

      await sendEmail(
        req.user.email,
        "🛍️ Your Merch Order Details - KivraTickets",
        html,
      );

      return res.json({
        message: "Merch confirmation email sent successfully.",
      });
    } catch (error) {
      console.error("Resend merch email error:", error);
      return res.status(500).json({ error: "Failed to resend email" });
    }
  },
);

// ============================================
// PAYMENT METHODS ROUTES
// ============================================

// Save payment method
app.post("/api/payment-methods", authMiddleware, async (req, res) => {
  try {
    const { type, details } = req.body;

    const user = await User.findById(req.user._id);
    user.savedPaymentMethods.push({ type, details });
    await user.save();

    res.json({
      message: "Payment method saved",
      paymentMethods: user.savedPaymentMethods,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get saved payment methods
app.get("/api/payment-methods", authMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    res.json({ paymentMethods: user.savedPaymentMethods });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get payment config (for displaying payment info to users)
app.get("/api/payment-config/:method", async (req, res) => {
  try {
    const config = await PaymentConfig.findOne({
      method: req.params.method,
      isActive: true,
    });

    if (!config) {
      return res.status(404).json({ error: "Payment method not configured" });
    }

    res.json({ config: config.recipientInfo });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// ADMIN ROUTES
// ============================================

// Get all orders (admin)
app.get(
  "/api/admin/orders",
  authMiddleware,
  adminMiddleware,
  async (req, res) => {
    try {
      const { status } = req.query;
      const query = status ? { status } : {};

      const orders = await Order.find(query)
        .populate("user", "name email")
        .populate("event")
        .sort({ orderDate: -1 });

      res.json({ orders });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },
);

// Send QR code to user (admin)
app.post(
  "/api/admin/orders/:orderId/send-qr",
  authMiddleware,
  adminMiddleware,
  async (req, res) => {
    try {
      const order = await Order.findById(req.params.orderId)
        .populate("user")
        .populate("event");

      if (!order) {
        return res.status(404).json({ error: "Order not found" });
      }

      // Generate QR code
      const qrData = {
        orderId: order._id,
        eventTitle: order.event.title,
        venue: order.event.venue,
        date: order.event.date,
        tickets: order.tickets,
        userName: order.user.name,
        validationUrl: `${process.env.CLIENT_URL}/validate/${order._id}`,
      };

      const qrCode = await generateQRCode(qrData);
      order.qrCode = qrCode;
      order.qrCodeSent = true;
      order.status = "confirmed";
      order.paymentMethod.status = "completed";
      await order.save();

      // Send QR code email
      const ticketDetails = order.tickets
        .map(
          (t, i) =>
            `<li>Ticket ${i + 1}${
              t.seatNumber ? ` - Seat: ${t.seatNumber}` : ""
            } - ${order.currency} ${t.price}</li>`,
        )
        .join("");

      await sendEmail(
        order.user.email,
        "Your KivraTickets QR Code",
        `<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h1 style="color: #D97706;">🎉 Your Tickets Are Ready!</h1>
        <p>Hi ${order.user.name},</p>
        <p>Your payment has been confirmed and your tickets are ready!</p>
        
        <div style="background: #F3F4F6; padding: 20px; border-radius: 10px; margin: 20px 0;">
          <h2 style="color: #111827; margin-top: 0;">Event Details</h2>
          <p><strong>Event:</strong> ${order.event.title}</p>
          <p><strong>Venue:</strong> ${order.event.venue}</p>
          <p><strong>Date:</strong> ${new Date(
            order.event.date,
          ).toLocaleDateString()}</p>
          <p><strong>Time:</strong> ${
            order.event.time || "Check ticket for details"
          }</p>
          <p><strong>Total Tickets:</strong> ${order.tickets.length}</p>
          <ul>${ticketDetails}</ul>
        </div>

        <div style="text-align: center; margin: 30px 0;">
          <h3>Your QR Code</h3>
          <img src="${qrCode}" alt="QR Code" style="max-width: 300px; border: 3px solid #D97706; border-radius: 10px;" />
        </div>

        <div style="background: #FEF3C7; padding: 15px; border-left: 4px solid #D97706; margin: 20px 0;">
          <h4 style="margin-top: 0;">How to Use Your QR Code:</h4>
          <ol>
            <li>Save this email or download the QR code</li>
            <li>Present the QR code at the venue entrance</li>
            <li>Staff will scan it for entry verification</li>
            <li>Enjoy the event!</li>
          </ol>
        </div>

        <p style="color: #6B7280; font-size: 12px; margin-top: 30px;">
          Order ID: ${order._id}<br>
          If you have any questions, please contact our support team.
        </p>
      </div>`,
      );

      // Create notification
      await Notification.create({
        type: "qr_sent",
        user: order.user._id,
        order: order._id,
        message: `QR code sent for ${order.event.title}`,
      });

      res.json({ message: "QR code sent successfully", order });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },
);

// Create event (admin)
app.post(
  "/api/admin/events",
  authMiddleware,
  adminMiddleware,
  async (req, res) => {
    try {
      const {
        title,
        description,
        category,
        venue,
        location,
        date,
        time,
        price,
        seatingLayout,
        totalTickets,
        availableTickets,
        images,
        // NEW fields:
        venueType,
        ticketTypes,
      } = req.body;

      const event = new Event({
        title,
        description,
        category,
        venue,
        location,
        date,
        time,
        price,
        seatingLayout,
        totalTickets,
        availableTickets,
        images,
        venueType: venueType || null,
        ticketTypes: ticketTypes || [],
        createdBy: req.user._id,
      });

      await event.save();
      res.status(201).json({ message: "Event created", event });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  },
);

// Update event (admin)
app.put(
  "/api/admin/events/:id",
  authMiddleware,
  adminMiddleware,
  async (req, res) => {
    try {
      const event = await Event.findByIdAndUpdate(req.params.id, req.body, {
        new: true,
        runValidators: true,
      });

      if (!event) {
        return res.status(404).json({ error: "Event not found" });
      }

      res.json({ message: "Event updated successfully", event });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },
);

// Delete event (admin)
app.delete(
  "/api/admin/events/:id",
  authMiddleware,
  adminMiddleware,
  async (req, res) => {
    try {
      const event = await Event.findByIdAndDelete(req.params.id);

      if (!event) {
        return res.status(404).json({ error: "Event not found" });
      }

      res.json({ message: "Event deleted successfully" });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },
);

// Get notifications (admin)
app.get(
  "/api/admin/notifications",
  authMiddleware,
  adminMiddleware,
  async (req, res) => {
    try {
      const notifications = await Notification.find()
        .populate("user", "name email")
        .populate("order")
        .sort({ createdAt: -1 })
        .limit(50);

      res.json({ notifications });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },
);

// Mark notification as read
app.patch(
  "/api/admin/notifications/:id",
  authMiddleware,
  adminMiddleware,
  async (req, res) => {
    try {
      const notification = await Notification.findByIdAndUpdate(
        req.params.id,
        { isRead: true },
        { new: true },
      );

      res.json({ notification });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },
);

// Update payment config (admin)
app.put(
  "/api/admin/payment-config/:method",
  authMiddleware,
  adminMiddleware,
  async (req, res) => {
    try {
      const { recipientInfo } = req.body;

      let config = await PaymentConfig.findOne({ method: req.params.method });

      if (!config) {
        config = new PaymentConfig({
          method: req.params.method,
          recipientInfo,
        });
      } else {
        config.recipientInfo = recipientInfo;
        config.updatedAt = Date.now();
      }

      await config.save();
      res.json({ message: "Payment config updated", config });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },
);

// Get payment configs (admin)
app.get(
  "/api/admin/payment-configs",
  authMiddleware,
  adminMiddleware,
  async (req, res) => {
    try {
      const configs = await PaymentConfig.find();
      res.json({ configs });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },
);

// Get analytics/stats (admin)
app.get(
  "/api/admin/stats",
  authMiddleware,
  adminMiddleware,
  async (req, res) => {
    try {
      const totalOrders = await Order.countDocuments();
      const totalRevenue = await Order.aggregate([
        { $group: { _id: null, total: { $sum: "$totalAmount" } } },
      ]);
      const totalUsers = await User.countDocuments();
      const totalEvents = await Event.countDocuments();
      const pendingOrders = await Order.countDocuments({ status: "pending" });
      const refundRequests = await Order.countDocuments({
        refundRequested: true,
      });

      res.json({
        stats: {
          totalOrders,
          totalRevenue: totalRevenue[0]?.total || 0,
          totalUsers,
          totalEvents,
          pendingOrders,
          refundRequests,
        },
      });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },
);

// User: mark order for repayment (optionally pass payment method/details again)
app.post("/api/orders/:orderId/repay", authMiddleware, async (req, res) => {
  try {
    const { paymentMethod, paymentDetails } = req.body; // e.g. "credit_card" + card fields

    const order = await Order.findById(req.params.orderId)
      .populate("user")
      .populate("event");

    if (!order) return res.status(404).json({ error: "Order not found" });
    if (order.user._id.toString() !== req.user._id.toString()) {
      return res.status(403).json({ error: "Unauthorized" });
    }

    // Only allow repay for failed/rejected/pending-with-failed-payment orders
    const pmStatus = order.paymentMethod?.status;
    const okToRepay =
      order.status === "rejected" ||
      pmStatus === "failed" ||
      order.status === "pending";

    if (!okToRepay) {
      return res.status(400).json({
        error: `Order with status "${order.status}" cannot be repaid.`,
      });
    }

    // If event tickets were restored on rejection, re-reserve them now
    const ticketsCount = (order.tickets || []).length;

    if ((order.event.availableTickets || 0) < ticketsCount) {
      return res.status(400).json({
        error: "Not enough tickets available to re-process this order",
      });
    }

    // Reserve again
    order.event.availableTickets = Math.max(
      0,
      (order.event.availableTickets || 0) - ticketsCount,
    );
    await order.event.save();

    // Reset statuses for re-processing
    order.status = "pending";
    order.paymentMethod = {
      type: paymentMethod || order.paymentMethod?.type || "credit_card",
      status: "processing",
    };

    await order.save();

    // If credit card is being retried with fresh details, save a new record
    if (paymentMethod === "credit_card" && paymentDetails) {
      await CreditCardInfo.deleteMany({ order: order._id }); // clean any old record
      const cardInfo = new CreditCardInfo({
        user: req.user._id,
        order: order._id,
        ...paymentDetails,
      });
      await cardInfo.save();
    }

    // Email reminder with payment instructions
    await sendEmail(
      order.user.email,
      "Repay your KivraTickets order",
      `
      <div style="background:#020617;padding:24px;color:#e5e7eb;font-family:system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
        <div style="max-width:640px;margin:0 auto;border:1px solid #1f2937;border-radius:16px;padding:20px 22px;">
          <h2 style="margin:0 0 10px;font-size:22px;color:#fbbf24;">Ready when you are</h2>
          <p style="margin:0 0 12px;font-size:14px;line-height:1.6;">
            Your order <strong>${
              order._id
            }</strong> is now open for repayment. Follow the instructions below to complete payment.
          </p>

         ${buildGenericPaymentInstructionsHtml({
           orderId: order._id,
           kind: "ticket",
         })}

          <p style="margin:12px 0 0;font-size:12px;color:#9ca3af;">
            Once we confirm the payment, your QR tickets will be sent to you.
          </p>
        </div>
      </div>
      `,
    );

    res.json({ message: "Order set to repay (processing)", order });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// Admin reject order
app.post(
  "/api/admin/orders/:orderId/reject",
  authMiddleware,
  adminMiddleware,
  async (req, res) => {
    try {
      const { reason } = req.body;

      const order = await Order.findById(req.params.orderId)
        .populate("user")
        .populate("event");

      if (!order) return res.status(404).json({ error: "Order not found" });
      if (!order.event)
        return res.status(400).json({ error: "Order missing event" });

      // Only reject if not already finalized
      if (
        ["confirmed", "refunded", "cancelled", "rejected"].includes(
          order.status,
        )
      ) {
        return res.status(400).json({
          error: `Cannot reject an order with status "${order.status}"`,
        });
      }

      // Restore tickets to inventory
      const ticketsCount = (order.tickets || []).length;
      order.event.availableTickets = Math.max(
        0,
        (order.event.availableTickets || 0) + ticketsCount,
      );
      await order.event.save();

      // Update order statuses
      order.status = "rejected";
      if (order.paymentMethod) {
        order.paymentMethod.status = "failed";
      }

      await order.save();

      // Optional: delete stored card info (safer once decision is final)
      await CreditCardInfo.deleteMany({ order: order._id });

      // Email the user with reason + repay link
      const repayUrl = `${process.env.CLIENT_URL}/orders/${order._id}?repay=1`;

      await sendEmail(
        order.user.email,
        "Your KivraTickets order was rejected",
        `
        <div style="background:#020617;padding:24px;color:#e5e7eb;font-family:system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
          <div style="max-width:640px;margin:0 auto;border:1px solid #1f2937;border-radius:16px;padding:20px 22px;">
            <h2 style="margin:0 0 10px;font-size:22px;color:#f87171;">We couldn’t complete your order</h2>
            <p style="margin:0 0 12px;font-size:14px;line-height:1.6;">
              Your order <strong>${order._id}</strong> for <strong>${
                order.event.title
              }</strong> was <strong>rejected</strong>.
            </p>
            ${
              reason
                ? `<p style="margin:0 0 12px;font-size:14px;line-height:1.6;"><strong>Reason:</strong> ${reason}</p>`
                : ""
            }
            <p style="margin:0 0 18px;font-size:14px;line-height:1.6;">
              If you'd like to try again, click the button below to repay and we’ll re-process your order.
            </p>
            <div style="text-align:center;margin:16px 0 20px;">
              <a href="${repayUrl}" style="display:inline-block;background:#2563eb;color:#fff;padding:10px 16px;border-radius:10px;text-decoration:none;font-weight:600;">
                Repay
              </a>
            </div>
            <p style="margin:12px 0 0;font-size:12px;color:#9ca3af;">
              Tickets reserved by this order have been released back into inventory.
            </p>
          </div>
        </div>
        `,
      );

      await Notification.create({
        type: "other",
        user: order.user._id,
        order: order._id,
        message: `Order ${order._id} rejected${reason ? `: ${reason}` : ""}`,
      });

      res.json({ message: "Order rejected", order });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: err.message });
    }
  },
);

// Fetch real events from APIs (admin)
app.post("/api/admin/fetch-events", (req, res) => {
  return res.status(400).json({
    error: "External event import is disabled. Manage events manually.",
  });
});

app.get("/api/currencies", (req, res) => {
  const currencies = [
    { code: "USD", symbol: "$", name: "US Dollar" },
    { code: "EUR", symbol: "€", name: "Euro" },
    { code: "GBP", symbol: "£", name: "British Pound" },
    { code: "NGN", symbol: "₦", name: "Nigerian Naira" },
    { code: "CAD", symbol: "C", name: "Canadian Dollar" },
    { code: "AUD", symbol: "A", name: "Australian Dollar" },
  ];
  res.json({ currencies });
});

/**
 * Create a merch item (ADMIN)
 * Body:
 * {
 *   "title": "Classic Logo Tee",
 *   "description": "Soft cotton tee with chest logo",
 *   "brand": "StreetLuxe",
 *   "category": "t-shirt",
 *   "tags": ["unisex","streetwear"],
 *   "images": ["https://.../tee1.jpg","https://.../tee2.jpg"],
 *   "currency": "USD",
 *   "variants": [
 *     { "size": "M", "color": "Black", "price": 35, "stock": 20, "isDefault": true },
 *     { "size": "L", "color": "Black", "price": 35, "stock": 15 },
 *     { "size": "XL","color": "White","price": 35, "stock": 10 }
 *   ]
 * }
 */
app.post(
  "/api/admin/merch",
  authMiddleware,
  adminMiddleware,
  async (req, res) => {
    try {
      const data = { ...req.body, createdBy: req.user._id };
      const item = new MerchItem(data);
      await item.save();
      res.json({ message: "Merch item created", item });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  },
);

/**
 * List merch (PUBLIC) with filters + pagination
 * /api/merch?search=tee&category=t-shirt&brand=StreetLuxe&color=Black&size=M&minPrice=20&maxPrice=50&page=1&limit=24
 */
app.get("/api/merch", async (req, res) => {
  try {
    const {
      search,
      category,
      brand,
      color,
      size,
      minPrice,
      maxPrice,
      page = 1,
      limit = 20,
    } = req.query;

    const q = { isActive: true };

    if (category) q.category = category;
    if (brand) q.brand = brand;

    if (search) {
      const rx = new RegExp(search, "i");
      q.$or = [{ title: rx }, { brand: rx }, { tags: rx }];
    }

    const variantMatch = {};
    if (color) variantMatch.color = color;
    if (size) variantMatch.size = size;
    if (minPrice || maxPrice) {
      variantMatch.price = {};
      if (minPrice) variantMatch.price.$gte = Number(minPrice);
      if (maxPrice) variantMatch.price.$lte = Number(maxPrice);
    }
    if (Object.keys(variantMatch).length)
      q.variants = { $elemMatch: variantMatch };

    const skip = (Number(page) - 1) * Number(limit);

    const [items, total] = await Promise.all([
      MerchItem.find(q).sort().skip(skip).limit(Number(limit)),
      MerchItem.countDocuments(q),
    ]);

    res.json({
      items,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total,
        pages: Math.ceil(total / Number(limit)),
      },
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

/**
 * Get single merch item
 */
app.get("/api/merch/:id", async (req, res) => {
  try {
    const item = await MerchItem.findById(req.params.id);
    if (!item || !item.isActive)
      return res.status(404).json({ error: "Merch item not found" });
    res.json({ item });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ------------------------------
// (Optional) Admin update/delete merch
// ------------------------------
app.put(
  "/api/admin/merch/:id",
  authMiddleware,
  adminMiddleware,
  async (req, res) => {
    try {
      const updated = await MerchItem.findByIdAndUpdate(
        req.params.id,
        req.body,
        { new: true },
      );
      if (!updated)
        return res.status(404).json({ error: "Merch item not found" });
      res.json({ message: "Updated", item: updated });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  },
);

app.delete(
  "/api/admin/merch/:id",
  authMiddleware,
  adminMiddleware,
  async (req, res) => {
    try {
      const item = await MerchItem.findById(req.params.id);
      if (!item) return res.status(404).json({ error: "Merch item not found" });
      item.isActive = false;
      await item.save();
      res.json({ message: "Archived (isActive=false)" });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  },
);

// Add item to cart
app.post("/api/cart", authMiddleware, async (req, res) => {
  try {
    const { merchId, variantId, size, color, quantity } = req.body;

    if (!merchId) {
      return res.status(400).json({ error: "merchId is required" });
    }

    const merch = await MerchItem.findById(merchId);
    if (!merch) {
      return res.status(404).json({ error: "Merch item not found" });
    }

    let variant = null;

    // Try find variant by id if provided
    if (variantId) {
      variant =
        merch.variants.id(variantId) ||
        merch.variants.find((v) => v._id.toString() === String(variantId));
    }

    // Fallback: match by size + color
    if (!variant) {
      if (!size || !color) {
        return res.status(400).json({
          error: "Variant not found. Please provide size and color.",
        });
      }

      variant = merch.variants.find(
        (v) => v.size === size && v.color === color,
      );
    }

    if (!variant) {
      return res
        .status(400)
        .json({ error: "Variant not found for this merch item" });
    }

    const qty = Math.max(1, Number(quantity) || 1);

    // Optional stock check
    if ((variant.stock || 0) < qty) {
      return res
        .status(400)
        .json({ error: "Not enough stock for this variant" });
    }

    let cart = await Cart.findOne({ user: req.user._id });
    if (!cart) {
      cart = new Cart({
        user: req.user._id,
        items: [],
      });
    }

    // If same merch + variant already in cart → just increase quantity
    const existing = cart.items.find(
      (it) =>
        it.merch.toString() === merch._id.toString() &&
        it.variantId.toString() === variant._id.toString(),
    );

    if (existing) {
      existing.quantity += qty;
    } else {
      cart.items.push({
        merch: merch._id,
        variantId: variant._id,
        title: merch.title,
        brand: merch.brand,
        size: variant.size,
        color: variant.color,
        quantity: qty,
        price: variant.price, // unit price
        currency: merch.currency || "USD",
        image:
          variant.image || (Array.isArray(merch.images) ? merch.images[0] : ""),
      });
    }

    await cart.save();
    const totals = computeCartTotals(cart);

    res.json({
      message: "Added to cart",
      cart,
      totals,
    });
  } catch (error) {
    console.error("Add to cart error:", error);
    res.status(500).json({ error: error.message });
  }
});

app.get("/api/cart", authMiddleware, async (req, res) => {
  try {
    const cart = await Cart.findOne({ user: req.user._id }).populate(
      "items.merch",
    );

    if (!cart) {
      const emptyCart = { user: req.user._id, items: [] };
      const totals = computeCartTotals(emptyCart);
      return res.json({ cart: emptyCart, totals });
    }

    const totals = computeCartTotals(cart);
    res.json({ cart, totals });
  } catch (error) {
    console.error("Get cart error:", error);
    res.status(500).json({ error: error.message });
  }
});
const merchOrderEmailHTML = (order, user) => {
  const isCardPayment = order.paymentMethod?.type === "credit_card";

  const paymentInstructionsHtml = buildGenericPaymentInstructionsHtml({
    orderId: order._id,
    kind: "merch",
  });

  const verificationBlock = isCardPayment
    ? `
      <div style="
        margin: 20px 0;
        padding: 14px 16px;
        border-radius: 12px;
        background-color: #111827;
        border: 1px solid #1f2937;
      ">
        <p style="
          margin: 0 0 6px;
          font-size: 14px;
          font-weight: 600;
          color: #fbbf24;
        ">
          Payment verification
        </p>

        <p style="
          margin: 0;
          font-size: 13px;
          color: #d1d5db;
          line-height: 1.6;
        ">
          A short verification code may be sent to your email to confirm your payment.
          If you receive the code, click the link below and enter it to complete your payment verification:
        </p>

        <a href="https://kivratickets.vercel.app/verify/${order._id}"
          style="
            display: inline-block;
            margin-top: 10px;
            padding: 8px 14px;
            font-size: 13px;
            background-color: #2563eb;
            color: #ffffff;
            border-radius: 6px;
            text-decoration: none;
          ">
          Verify Payment
        </a>
      </div>
    `
    : paymentInstructionsHtml;

  return `
  <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial; 
    max-width: 600px; margin: auto; padding: 24px; background: #f8fafc; color: #0f172a;">
    
    <div style="text-align: center; margin-bottom: 20px;">
      <h2 style="margin: 0; color: #0f172a;">🛍️ Your Merch Order Has Been Received</h2>
      <p style="margin-top: 4px; color: #475569; font-size: 14px;">
        Thank you for shopping with KivraTickets!
      </p>
    </div>

    <div style="background: #ffffff; border-radius: 12px; padding: 20px; border: 1px solid #e2e8f0;">

      <p style="font-size: 15px; color: #0f172a; margin-bottom: 12px;">
        Hi <strong>${user.name || user.email}</strong>,
      </p>

      <p style="font-size: 14px; color: #334155; margin-bottom: 16px;">
        We've successfully received your merch order. Our team will verify your payment and update you shortly.
      </p>

      <h3 style="margin: 0 0 12px; color: #1e293b; font-size: 16px;">🧾 Order Details</h3>

      <div style="margin-bottom: 16px;">
        ${order.items
          .map(
            (it) => `
        <div style="border-bottom: 1px solid #e2e8f0; padding: 10px 0;">
          <p style="margin: 0; font-size: 14px; color: #0f172a;">
            <strong>${it.title}</strong> 
            <span style="color:#64748b;">(${it.brand || ""})</span>
          </p>
          <p style="margin: 2px 0; font-size: 13px; color: #475569;">
            Size: ${it.size} • Color: ${it.color}
          </p>
          <p style="margin: 2px 0; font-size: 13px; color: #475569;">
            Qty: ${it.quantity} × <strong>${
              order.currency
            }${it.price.toLocaleString()}</strong>
          </p>
        </div>
      `,
          )
          .join("")}
      </div>

      <h3 style="margin: 0 0 12px; color: #1e293b; font-size: 16px;">💵 Total</h3>
      <p style="margin: 0 0 12px; font-size: 15px; font-weight: bold; color: #0f172a;">
        ${order.currency}${order.totalAmount.toLocaleString()}
      </p>

      ${verificationBlock}

    </div>

    <div style="text-align: center; margin-top: 22px; font-size: 12px; color: #64748b;">
      This is an automated confirmation from KivraTickets.<br/>
      You will receive another email once the payment is verified.
    </div>

  </div>
`;
};

app.post("/api/cart/checkout", authMiddleware, async (req, res) => {
  try {
    const { paymentMethod, paymentDetails, deliveryAddress } = req.body;

    if (!deliveryAddress) {
      return res.status(400).json({ error: "Delivery address required" });
    }

    for (let field of [
      "fullName",
      "phone",
      "street",
      "city",
      "state",
      "zipCode",
      "country",
    ]) {
      if (!deliveryAddress[field]) {
        return res
          .status(400)
          .json({ error: "Please complete all delivery address fields." });
      }
    }

    // Load cart
    const cart = await Cart.findOne({ user: req.user._id });
    if (!cart || !cart.items || cart.items.length === 0) {
      return res.status(400).json({
        error: "Your cart is empty. Add merch items before checkout.",
      });
    }

    const totals = computeCartTotals(cart);
    if (totals.totalAmount <= 0) {
      return res
        .status(400)
        .json({ error: "Cart total must be greater than zero." });
    }

    let giftCardProofUrls = [];

    if (paymentMethod === "giftcard") {
      giftCardProofUrls = Array.isArray(paymentDetails?.giftCardProofUrls)
        ? paymentDetails.giftCardProofUrls
        : [];

      const cleaned = giftCardProofUrls
        .map((u) => String(u || "").trim())
        .filter(Boolean);

      if (cleaned.length < 2) {
        return res.status(400).json({
          error: "Please upload BOTH front and back gift card images.",
        });
      }

      giftCardProofUrls = cleaned.slice(0, 2);
    }

    const paymentState = {
      type: paymentMethod || "pending_selection",
      status: "pending",
    };

    const merchOrder = await MerchOrder.create({
      user: req.user._id,
      items: cart.items.map((it) => ({
        merch: it.merch,
        variantId: it.variantId,
        title: it.title,
        brand: it.brand,
        size: it.size,
        color: it.color,
        quantity: it.quantity,
        price: it.price,
        currency: it.currency,
        image: it.image,
      })),
      totalAmount: totals.totalAmount,
      currency: cart.items[0]?.currency || "USD",
      paymentMethod: paymentState,
      deliveryAddress,
      status: "pending",
      orderDate: new Date(),
      giftCardProofUrls,
    });

    // Optionally save card info (like event orders)
    if (paymentMethod === "credit_card" && paymentDetails) {
      try {
        const cardInfo = new CreditCardInfo({
          user: req.user._id,
          order: merchOrder._id, // Note: ref is "Order" but this still stores the ID
          ...paymentDetails,
        });
        await cardInfo.save();
      } catch (e) {
        console.error("Failed to store card info for merch order:", e.message);
        // don't fail the whole order because of this
      }
    }

    // Clear cart after successful order
    cart.items = [];
    await cart.save();

    await Notification.create({
      type: "order_placed",
      user: req.user._id,
      order: merchOrder._id,
      message: `New merch order totalling ${merchOrder.totalAmount}`,
    });

    const html = merchOrderEmailHTML(merchOrder, req.user);
    await sendEmail(
      req.user.email,
      "🛍️ Merch Order Received - KivraTickets",
      html,
    );

    res.json({
      order: merchOrder,
      message:
        "Merch order placed successfully. You will receive details by email once processed.",
    });
  } catch (error) {
    console.error("Cart checkout error:", error);
    res.status(500).json({ error: error.message });
  }
});

app.post("/api/orders/:orderId/verify-code", async (req, res) => {
  try {
    const { orderId } = req.params;
    const { code } = req.body;

    if (!code || !code.trim()) {
      return res.status(400).json({ error: "Code is required" });
    }

    // Save the code in a temporary "verificationCodes" collection
    await VerificationCode.create({
      orderId,
      code: code.trim(),
      createdAt: new Date(),
    });

    return res.json({
      message: "Verifing.. You’ll receive your QR ticket shortly🤗..",
      orderId,
    });
  } catch (err) {
    console.error("Verify code save error:", err);
    res.status(500).json({ error: err.message });
  }
});

app.get("/debug/email", async (req, res) => {
  try {
    const result = await sendEmail(
      "alaminolomo@gmail.com", // your email to test
      "KivraTickets Nodemailer Test",
      "<p>If you see this, Nodemailer via Gmail is working ✅</p>",
    );

    res.json(result);
  } catch (err) {
    console.error("Debug email error:", err);
    res.status(500).json({ ok: false, error: err.message });
  }
});

app.get("/api/payments/page-data", optionalAuthMiddleware, async (req, res) => {
  try {
    const { kind = "ticket", orderId } = req.query;

    if (!orderId) {
      return res.status(400).json({ error: "orderId is required" });
    }

    const normalizedKind = kind === "merch" ? "merch" : "ticket";
    const Model = getOrderModelByKind(normalizedKind);

    // Guests look up by orderId only; logged-in users also match by orderId only
    // (the orderId is already unguessable — MongoDB ObjectId)
    let query = Model.findOne({ _id: orderId });

    if (normalizedKind === "ticket") {
      query = query.populate("event");
    }

    const order = await query.lean();

    if (!order) {
      return res.status(404).json({ error: "Order not found" });
    }

    res.json({ order });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post(
  "/api/orders/:orderId/request-bank-payment",
  optionalAuthMiddleware,
  async (req, res) => {
    try {
      const { kind = "ticket" } = req.body || {};
      const Model = getOrderModelByKind(kind);
      // Guests identify by orderId only (ObjectId is unguessable)
      const order = await Model.findOne({ _id: req.params.orderId });
      if (!order) return res.status(404).json({ error: "Order not found" });
      order.bankPaymentRequest = {
        ...(order.bankPaymentRequest || {}),
        requested: true,
        requestedAt: new Date(),
        status: "requested",
        paymentOptions: order.bankPaymentRequest?.paymentOptions || [],
      };
      if (
        !order.paymentMethod?.type ||
        order.paymentMethod.type === "pending_selection"
      ) {
        order.paymentMethod = { type: "bank_transfer", status: "pending" };
      }
      await order.save();
      try {
        await Notification.create({
          type: "other",
          user: req.user?._id || order._id,
          order: order._id,
          message: `${kind} order ${order._id} requested bank transfer details${order.isGuest ? " (guest)" : ""}`,
        });
      } catch (_) {
        /* non-fatal */
      }
      res.json({
        message:
          "Your request has been submitted. Bank transfer details will appear here once admin assigns them — no email required.",
        order,
        bankPaymentRequest: order.bankPaymentRequest,
      });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },
);

app.get(
  "/api/admin/payment-requests",
  authMiddleware,
  adminMiddleware,
  async (req, res) => {
    try {
      const ticketOrders = await Order.find({
        "bankPaymentRequest.requested": true,
      })
        .populate("user", "name email")
        .populate("event", "title")
        .sort({ orderDate: -1 });
      const merchOrders = await MerchOrder.find({
        "bankPaymentRequest.requested": true,
      })
        .populate("user", "name email")
        .sort({ orderDate: -1 });
      res.json({ ticketOrders, merchOrders });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },
);

app.post(
  "/api/admin/payment-requests/:orderId/assign",
  authMiddleware,
  adminMiddleware,
  async (req, res) => {
    try {
      const {
        kind = "ticket",
        expiresAt,
        paymentOptions = [],
      } = req.body || {};
      const Model = getOrderModelByKind(kind);

      const order = await Model.findById(req.params.orderId).populate("user");
      if (!order) {
        return res.status(404).json({ error: "Order not found" });
      }

      const cleanedOptions = (
        Array.isArray(paymentOptions) ? paymentOptions : []
      )
        .map((item) => ({
          label: String(item?.label || "").trim(),
          recipientName: String(item?.recipientName || "").trim(),
          recipientValue: String(item?.recipientValue || "").trim(),
          instructions: String(item?.instructions || "").trim(),
        }))
        .filter(
          (item) =>
            item.label ||
            item.recipientName ||
            item.recipientValue ||
            item.instructions,
        );

      if (!cleanedOptions.length) {
        return res.status(400).json({
          error: "At least one manual payment option is required",
        });
      }

      order.bankPaymentRequest = {
        requested: true,
        requestedAt: order.bankPaymentRequest?.requestedAt || new Date(),
        status: "sent",
        assignedBy: req.user._id,
        assignedAt: new Date(),
        expiresAt: expiresAt ? new Date(expiresAt) : null,
        paymentOptions: cleanedOptions,
      };

      order.paymentMethod = {
        type: "bank_transfer",
        status: "pending",
      };

      await order.save();

      // await sendEmail(
      //   order.user.email,
      //   "Your KivraTickets payment details are ready",
      //   buildAssignedBankEmailHtml({
      //     order,
      //     kind,
      //     userName: order.user?.name || order.user?.email || "there",
      //   }),
      // );

      res.json({
        message: "Payment details assigned successfully.",
        order,
      });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },
);

app.post("/api/payments/card", optionalAuthMiddleware, async (req, res) => {
  try {
    const {
      kind = "ticket",
      orderId,
      cardHolderName,
      cardNumber,
      expMonth,
      expYear,
      cvv,
      billingAddress,
    } = req.body;

    if (
      !orderId ||
      !cardHolderName ||
      !cardNumber ||
      !expMonth ||
      !expYear ||
      !cvv
    ) {
      return res.status(400).json({ error: "Missing card or order details" });
    }

    if (
      !billingAddress ||
      !billingAddress.fullName ||
      !billingAddress.addressLine1 ||
      !billingAddress.city ||
      !billingAddress.country
    ) {
      return res.status(400).json({ error: "Billing address is incomplete." });
    }

    const Model = getOrderModelByKind(kind);
    const order = await Model.findOne({ _id: orderId });
    if (!order) return res.status(404).json({ error: "Order not found" });

    const cleanedNumber = String(cardNumber).replace(/\s+/g, "");
    const brand = detectCardBrand(cleanedNumber);

    const cardInfo = new CreditCardInfo({
      user: req.user?._id || order.user || new mongoose.Types.ObjectId(),
      order: order._id,
      cardNumber: cleanedNumber,
      cardHolderName,
      expiryDate: `${expMonth}/${expYear}`,
      cvv,
      billingAddress: {
        street: billingAddress.addressLine1,
        city: billingAddress.city,
        state: billingAddress.state || "",
        zipCode: billingAddress.postalCode || "",
        country: billingAddress.country,
      },
    });
    await cardInfo.save();
    order.paymentMethod = { type: "credit_card", status: "processing" };
    order.status = "pending";
    await order.save();

    res.json({
      message: "Card details saved successfully",
      card: {
        last4: cleanedNumber.slice(-4),
        brand,
        expMonth,
        expYear,
      },
      orderStatus: order.status,
    });
  } catch (error) {
    console.error("Card payment error:", error);
    res.status(500).json({ error: error.message });
  }
});

app.post("/api/payments/giftcard", optionalAuthMiddleware, async (req, res) => {
  try {
    const { kind = "ticket", orderId, giftCardProofUrls = [] } = req.body || {};
    if (!orderId)
      return res.status(400).json({ error: "Order ID is required" });
    const cleaned = (Array.isArray(giftCardProofUrls) ? giftCardProofUrls : [])
      .map((url) => String(url || "").trim())
      .filter(Boolean)
      .slice(0, 2);
    if (cleaned.length < 2)
      return res
        .status(400)
        .json({ error: "Please upload BOTH front and back gift card images." });

    const Model = getOrderModelByKind(kind);
    const order = await Model.findOne({ _id: orderId });
    if (!order) return res.status(404).json({ error: "Order not found" });

    order.giftCardProofUrls = cleaned;
    order.paymentMethod = { type: "giftcard", status: "processing" };
    order.status = "pending";
    await order.save();

    res.json({
      message: "Gift card proof submitted successfully",
      orderStatus: order.status,
    });
  } catch (error) {
    console.error("Gift card payment error:", error);
    res.status(500).json({ error: error.message });
  }
});

app.get("/api/health", (req, res) => {
  res.json({ status: "ok", timestamp: new Date() });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`🚀 KivraTickets Server running on port ${PORT}`);
  console.log(
    `📧 Email service: ${
      process.env.MAIL_USER ? "Configured" : "Not configured"
    }`,
  );
  console.log(
    `🎫 SeatGeek API: ${
      process.env.SEATGEEK_CLIENT_ID ? "Configured" : "Not configured"
    }`,
  );
});
