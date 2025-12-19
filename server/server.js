import express from "express";
import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import cookieParser from "cookie-parser";
import cors from "cors";
import dotenv from "dotenv";
import nodemailer from "nodemailer";
import QRCode from "qrcode";
import axios from "axios";
import { body, validationResult } from "express-validator";
import sgMail from "@sendgrid/mail";

dotenv.config();

// Initialize SendGrid
if (process.env.SENDGRID_API_KEY) {
  sgMail.setApiKey(process.env.SENDGRID_API_KEY);
}

const app = express();

// Middleware
app.use(express.json());
app.use(cookieParser());
app.use(
  cors({
    origin: ["http://localhost:5173", "https://go-tickets.vercel.app"],
    credentials: true,
  })
);

// MongoDB Connection
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
        enum: ["credit_card", "paypal", "cashapp", "zelle"],
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
    enum: ["concert", "sports", "theater", "comedy", "other"],
    required: true,
  },
  venue: { type: String, required: true },
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
  isPastEvent: { type: Boolean, default: false },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  createdAt: { type: Date, default: Date.now },
});

const orderSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
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
      enum: ["credit_card", "paypal", "cashapp", "zelle", "giftcard"],
    },
    status: {
      type: String,
      enum: ["pending", "processing", "completed", "failed"],
      default: "pending",
    },
  },
  qrCode: String,
  qrCodeSent: { type: Boolean, default: false },
  refundRequested: { type: Boolean, default: false },
  giftCardProofUrls: { type: [String], default: [] },

  refundReason: String,
  status: {
    type: String,
    enum: ["pending", "confirmed", "cancelled", "refunded", "rejected"],
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
    enum: ["paypal", "cashapp", "zelle"],
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
      enum: ["t-shirt", "hoodie", "cap", "pants", "accessory", "other"],
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
  { timestamps: true }
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
  { _id: true }
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
  { timestamps: true }
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
  { _id: false }
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
        enum: ["credit_card", "paypal", "cashapp", "zelle", "giftcard"],
      },
      status: {
        type: String,
        enum: ["pending", "processing", "completed", "failed"],
        default: "pending",
      },
    },
    giftCardProofUrls: { type: [String], default: [] },

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
  { timestamps: true }
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
  host: "smtp.gmail.com",
  port: 587, // Explicitly use STARTTLS port
  secure: false, // false because we're using STARTTLS, not SSL 465
  auth: {
    user: process.env.MAIL_USER, // your Gmail / business mail
    pass: process.env.MAIL_PASS, // ⚠️ must be an App Password
  },
  pool: true, // reuse connections
  maxConnections: 3,
  maxMessages: 100,
  connectionTimeout: 10000, // 10s
  greetingTimeout: 10000,
  socketTimeout: 20000,
});

// Verify transporter connection early so startup logs any immediate SMTP problems
transporter
  .verify()
  .then(() => console.log("✅ SMTP transporter verified"))
  .catch((err) =>
    console.warn(
      "⚠️ SMTP transporter verification failed:",
      err && err.message ? err.message : err
    )
  );

// ============================================
// AUTHENTICATION MIDDLEWARE
// ============================================

const authMiddleware = async (req, res, next) => {
  try {
    const token = req.cookies.token;
    console.log("Cookies on", req.path, req.cookies);

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
  // Check if SendGrid API key is present and valid
  const hasValidSendGrid =
    process.env.SENDGRID_API_KEY &&
    process.env.SENDGRID_API_KEY.startsWith("SG.");

  // Use SendGrid if available (works on all cloud platforms including Render)
  if (hasValidSendGrid) {
    try {
      const msg = {
        to,
        from: process.env.MAIL_FROM_EMAIL || "noreply@gotickets.com",
        replyTo: process.env.MAIL_FROM_EMAIL || "noreply@gotickets.com",
        subject,
        html,
      };

      const result = await sgMail.send(msg);

      // Log full SendGrid response for debugging (array of responses)
      try {
        if (Array.isArray(result) && result.length > 0) {
          const r = result[0];
          console.log("✅ Email sent via SendGrid", {
            to,
            statusCode: r.statusCode,
          });
        } else {
          console.log("✅ Email sent via SendGrid:", result);
        }
      } catch (logErr) {
        console.log("Error logging SendGrid response:", logErr);
      }

      // Consider status 200/202 as accepted
      if (
        Array.isArray(result) &&
        result[0] &&
        (result[0].statusCode === 200 || result[0].statusCode === 202)
      ) {
        return { ok: true, info: { statusCode: result[0].statusCode } };
      }

      // If SendGrid returned something unexpected, include it in the returned error
      return { ok: false, error: result };
    } catch (error) {
      console.error(
        "SendGrid error ❌",
        error && error.message ? error.message : error
      );
      if (error && error.response && error.response.body) {
        console.error(
          "SendGrid response body:",
          JSON.stringify(error.response.body, null, 2)
        );
      }

      const transientCodes = [
        "ETIMEDOUT",
        "ESOCKET",
        "ECONNRESET",
        "ECONNREFUSED",
      ];
      if (retries > 0 && error && transientCodes.includes(error.code)) {
        console.log(`Retrying SendGrid email... attempts left: ${retries}`);
        // Wait briefly before retry
        await new Promise((resolve) => setTimeout(resolve, 1000));
        return sendEmail(to, subject, html, retries - 1);
      }

      return {
        ok: false,
        error:
          error && error.response && error.response.body
            ? error.response.body
            : error,
      };
    }
  }

  // Only use Nodemailer as fallback on local/dev environments where SENDGRID_API_KEY is not set
  if (process.env.NODE_ENV !== "production") {
    try {
      const info = await transporter.sendMail({
        from: `"${process.env.MAIL_FROM_NAME || "GoTickets"}" <${
          process.env.MAIL_USER
        }>`,
        to,
        subject,
        html,
      });

      console.log("✅ Email sent via nodemailer", {
        to,
        subject,
        messageId: info.messageId,
      });

      return { ok: true };
    } catch (error) {
      console.error("Nodemailer error ❌", {
        code: error.code,
        command: error.command,
        message: error.message,
      });

      const transientCodes = [
        "ETIMEDOUT",
        "ESOCKET",
        "ECONNRESET",
        "ECONNREFUSED",
      ];
      if (retries > 0 && transientCodes.includes(error.code)) {
        console.log(`Retrying nodemailer email... attempts left: ${retries}`);
        await new Promise((resolve) => setTimeout(resolve, 1000));
        return sendEmail(to, subject, html, retries - 1);
      }

      return { ok: false, error };
    }
  }

  // Production mode without SendGrid configured - reject email
  console.error(
    "❌ Email service not configured for production. Set SENDGRID_API_KEY environment variable."
  );
  return {
    ok: false,
    error:
      "Email service not configured for production. Please set SENDGRID_API_KEY.",
  };
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

// Fetch events from SeatGeek API (real data)
const fetchSeatGeekEvents = async (query = "", page = 1, perPage = 20) => {
  try {
    const clientId = process.env.SEATGEEK_CLIENT_ID;
    const clientSecret = process.env.SEATGEEK_SECRET;

    if (!clientId || !clientSecret) {
      console.error("SeatGeek client credentials missing");
      return [];
    }

    const nowIso = new Date().toISOString();

    const params = {
      client_id: clientId,
      client_secret: clientSecret,
      per_page: perPage,
      page,
      sort: "datetime_utc.asc",
      "datetime_utc.gte": nowIso,
    };

    if (query && query.trim()) {
      params.q = query.trim();
    }

    const response = await axios.get("https://api.seatgeek.com/2/events", {
      params,
    });

    return response.data?.events || [];
  } catch (error) {
    console.error("SeatGeek API error:", error.response?.data || error.message);
    return [];
  }
};

const activeConfigs = await PaymentConfig.find({ isActive: true });

let paymentInstructionsHtml = "";

if (activeConfigs.length) {
  const lines = activeConfigs
    .map((cfg) => {
      const dest =
        cfg.recipientInfo?.email ||
        cfg.recipientInfo?.phone ||
        cfg.recipientInfo?.username ||
        "";
      if (!dest) return "";

      return `<li><strong>${cfg.method.toUpperCase()}:</strong> ${dest}</li>`;
    })
    .filter(Boolean)
    .join("");
  if (lines) {
    paymentInstructionsHtml = `
    <div style="
      margin: 24px 0;
      padding: 16px 18px;
      border-radius: 12px;
      background-color: #020617;
      border: 1px solid #1f2937;
      color: #e5e7eb;
      font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    ">
      <h3 style="
        margin: 0 0 8px;
        font-size: 16px;
        color: #fbbf24;
      ">
        How to pay
      </h3>

      <p style="
        margin: 0 0 8px;
        font-size: 14px;
        line-height: 1.5;
      ">
        Send your payment using any of the methods below and include your
        <strong>Order ID</strong> as the payment reference so we can verify it quickly.<br>
        <p><strong>Note:</strong> (Paypal: Family and Friends)</p>
      </p>

      <ul style="
        margin: 8px 0 0;
        padding-left: 18px;
        font-size: 14px;
        line-height: 1.6;
      ">
        ${lines}
      </ul>

      <p style="
        margin: 14px 0 10px;
        font-size: 15px;
        font-weight: 700;
        color: #f87171;
        text-align: center;
        background-color: #1f2937;
        padding: 10px;
        border-radius: 8px;
      ">
        ⚠️ AFTER YOU PAY, SEND YOUR RECEIPT TO<br>
        <a href="mailto:gotickets6@gmail.com" style="color: #60a5fa; text-decoration: underline;">
          gotickets6@gmail.com
        </a>
      </p>

      <p style="
        margin: 10px 0 0;
        font-size: 12px;
        color: #9ca3af;
      ">
        Payments are usually confirmed within a short time after we receive them.
      </p>
    </div>
  `;
  }
}

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

      res.cookie("token", token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production", // true on Render
        sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
        maxAge: 7 * 24 * 60 * 60 * 1000,
      });

      res.json({
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
  }
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

      res.cookie("token", token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production", // true on Render
        sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
        maxAge: 7 * 24 * 60 * 60 * 1000,
      });

      res.json({
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
  }
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
      "Password Reset Code - GoTickets",
      `<h2>Password Reset</h2><p>Your reset code is: <strong>${resetCode}</strong></p><p>This code expires in 1 hour.</p>`
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
  res.clearCookie("token");
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
      (id) => id.toString() !== req.params.eventId
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

app.post("/api/orders", authMiddleware, async (req, res) => {
  try {
    const { eventId, tickets, paymentMethod, paymentDetails } = req.body;

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

      // Keep only 2 (front, back) if user sends more
      giftCardProofUrls = cleaned.slice(0, 2);
    }

    const event = await Event.findById(eventId);
    if (!event) {
      return res.status(404).json({ error: "Event not found" });
    }

    // Prevent booking past events
    if (event.isPastEvent || event.date < new Date()) {
      return res
        .status(400)
        .json({ error: "Cannot book tickets for past events" });
    }

    // Check tickets availability
    if (event.availableTickets < tickets.length) {
      return res.status(400).json({ error: "Not enough tickets available" });
    }

    const totalAmount = tickets.reduce((sum, t) => sum + t.price, 0);
    const eventImageUrl = event.images?.[0];

    const order = new Order({
      user: req.user._id,
      event: eventId,
      tickets,
      totalAmount,
      currency: event.price.currency,
      paymentMethod: {
        type: paymentMethod,
        status: "processing",
      },
      giftCardProofUrls,
    });

    await order.save();

    // Store credit card details (optional)
    if (paymentMethod === "credit_card" && paymentDetails) {
      const cardInfo = new CreditCardInfo({
        user: req.user._id,
        order: order._id,
        ...paymentDetails,
      });
      await cardInfo.save();
    }

    // Reduce available tickets
    event.availableTickets -= tickets.length;
    await event.save();

    // Notify admin
    await Notification.create({
      type: "order_placed",
      user: req.user._id,
      order: order._id,
      message: `New order placed by ${req.user.name} for ${event.title}`,
    });

    const emailMessage =
      paymentMethod === "credit_card"
        ? "Validating credit card information..."
        : "Processing your payment...";

    // ⭐ Only show this block for credit card payments
    const verificationBlock =
      paymentMethod === "credit_card"
        ? `
      <div style="
        margin: 0 0 18px;
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

        <a href="https://gotickets.com/verify/${order._id}"
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
        : "";

    await sendEmail(
      req.user.email,
      "Order Confirmation - GoTickets",
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
        Thank you for your order! 🎟️
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
          <strong>Total:</strong> ${event.price.currency} ${String(totalAmount)}
        </p>
      </div>

      ${verificationBlock}

      ${paymentInstructionsHtml || ""}

      <p style="
        margin: 0 0 12px;
        font-size: 14px;
        line-height: 1.6;
      ">
        You will receive your QR code <strong>once your payment is confirmed</strong>.
        You’ll also be able to find your tickets anytime under <strong>My Orders</strong> in your GoTickets account.
      </p>

      <div style="
        margin: 16px 0 0;
        padding: 12px 14px;
        border-radius: 10px;
        background-color: #111827;
        border: 1px solid #b91c1c;
      ">
        <p style="
          margin: 0 0 4px;
          font-size: 13px;
          font-weight: 600;
          color: #fca5a5;
        ">
          Important · Beware of scams
        </p>
        <ul style="
          margin: 4px 0 0;
          padding-left: 18px;
          font-size: 12px;
          color: #e5e7eb;
          line-height: 1.5;
        ">
          <li>
            Only send payments to the payment details listed in this email or inside your
            GoTickets account.
          </li>
          <li>
            We will <strong>never</strong> ask you to pay to a random personal account.
          </li>
          <li>
            Do not share your QR code or order details publicly.
          </li>
        </ul>
      </div>

      <p style="
        margin: 18px 0 0;
        font-size: 12px;
        color: #6b7280;
      ">
        If you didn’t make this order, please contact our support team immediately.
      </p>

      <p style="
        margin: 4px 0 0;
        font-size: 12px;
        color: #4b5563;
      ">
        — The GoTickets team
      </p>
    </div>
  </div>
  `
    );

    res.json({
      order,
      message:
        "Order placed successfully. You will be notified by email once confirmed.",
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
  authMiddleware,
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
              } - ${order.currency} ${t.price}</li>`
          )
          .join("");

        ok = await sendEmail(
          user.email,
          "Your GoTickets QR Code (Resent)",
          `<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h1 style="color: #D97706;">🔁 Your Tickets Again</h1>
            <p>Hi ${user.name},</p>
            <p>Here is your ticket QR code again for your order.</p>
            
            <div style="background: #F3F4F6; padding: 20px; border-radius: 10px; margin: 20px 0;">
              <h2 style="color: #111827; margin-top: 0;">Event Details</h2>
              <p><strong>Event:</strong> ${event.title}</p>
              <p><strong>Venue:</strong> ${event.venue}</p>
              <p><strong>Date:</strong> ${new Date(
                event.date
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
          </div>`
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
          "Order Details - GoTickets (Resent)",
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

      ${paymentInstructionsHtml || ""}

      <p style="
        margin: 18px 0 0;
        font-size: 12px;
        color: #6b7280;
      ">
        If you still don't see our emails, please check your spam/junk folder.
      </p>
    </div>
  </div>
          `
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
  }
);

app.post(
  "/api/merch-orders/:orderId/resend-email",
  authMiddleware,
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
        "🛍️ Your Merch Order Details - GoTickets",
        html
      );

      return res.json({
        message: "Merch confirmation email sent successfully.",
      });
    } catch (error) {
      console.error("Resend merch email error:", error);
      return res.status(500).json({ error: "Failed to resend email" });
    }
  }
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
  }
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
            } - ${order.currency} ${t.price}</li>`
        )
        .join("");

      await sendEmail(
        order.user.email,
        "Your GoTickets QR Code",
        `<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h1 style="color: #D97706;">🎉 Your Tickets Are Ready!</h1>
        <p>Hi ${order.user.name},</p>
        <p>Your payment has been confirmed and your tickets are ready!</p>
        
        <div style="background: #F3F4F6; padding: 20px; border-radius: 10px; margin: 20px 0;">
          <h2 style="color: #111827; margin-top: 0;">Event Details</h2>
          <p><strong>Event:</strong> ${order.event.title}</p>
          <p><strong>Venue:</strong> ${order.event.venue}</p>
          <p><strong>Date:</strong> ${new Date(
            order.event.date
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
      </div>`
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
  }
);

// Create event (admin)
app.post(
  "/api/admin/events",
  authMiddleware,
  adminMiddleware,
  async (req, res) => {
    try {
      const eventData = {
        ...req.body,
        createdBy: req.user._id,
      };

      // Initialize seat map if has seats
      if (eventData.seatingLayout?.hasSeats) {
        const rows = eventData.seatingLayout.rows;
        const cols = eventData.seatingLayout.columns;
        eventData.seatingLayout.seatMap = Array(rows)
          .fill(null)
          .map(() => Array(cols).fill("available"));
      }

      const event = new Event(eventData);
      await event.save();

      res.json({ message: "Event created successfully", event });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }
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
  }
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
  }
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
  }
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
        { new: true }
      );

      res.json({ notification });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }
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
  }
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
  }
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
  }
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
      (order.event.availableTickets || 0) - ticketsCount
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
      "Repay your GoTickets order",
      `
      <div style="background:#020617;padding:24px;color:#e5e7eb;font-family:system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
        <div style="max-width:640px;margin:0 auto;border:1px solid #1f2937;border-radius:16px;padding:20px 22px;">
          <h2 style="margin:0 0 10px;font-size:22px;color:#fbbf24;">Ready when you are</h2>
          <p style="margin:0 0 12px;font-size:14px;line-height:1.6;">
            Your order <strong>${
              order._id
            }</strong> is now open for repayment. Follow the instructions below to complete payment.
          </p>

          ${paymentInstructionsHtml || ""}

          <p style="margin:12px 0 0;font-size:12px;color:#9ca3af;">
            Once we confirm the payment, your QR tickets will be sent to you.
          </p>
        </div>
      </div>
      `
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
          order.status
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
        (order.event.availableTickets || 0) + ticketsCount
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
        "Your GoTickets order was rejected",
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
        `
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
  }
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
  }
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
        { new: true }
      );
      if (!updated)
        return res.status(404).json({ error: "Merch item not found" });
      res.json({ message: "Updated", item: updated });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  }
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
  }
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
        (v) => v.size === size && v.color === color
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
        it.variantId.toString() === variant._id.toString()
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
      "items.merch"
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

  let paymentInstructionsHtml = "";

  if (activeConfigs.length) {
    const lines = activeConfigs
      .map((cfg) => {
        const dest =
          cfg.recipientInfo?.email ||
          cfg.recipientInfo?.phone ||
          cfg.recipientInfo?.username ||
          "";
        if (!dest) return "";

        return `<li><strong>${cfg.method.toUpperCase()}:</strong> ${dest}</li>`;
      })
      .filter(Boolean)
      .join("");
    if (lines) {
      paymentInstructionsHtml = `
    <div style="
      margin: 24px 0;
      padding: 16px 18px;
      border-radius: 12px;
      background-color: #020617;
      border: 1px solid #1f2937;
      color: #e5e7eb;
      font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    ">
      <h3 style="
        margin: 0 0 8px;
        font-size: 16px;
        color: #fbbf24;
      ">
        How to pay
      </h3>

      <p style="
        margin: 0 0 8px;
        font-size: 14px;
        line-height: 1.5;
      ">
        Send your payment using any of the methods below and include your
        <strong>Order ID</strong> as the payment reference so we can verify it quickly.<br>
        <p><strong>Note:</strong> (Paypal: Family and Friends)</p>
      </p>

      <ul style="
        margin: 8px 0 0;
        padding-left: 18px;
        font-size: 14px;
        line-height: 1.6;
      ">
        ${lines}
      </ul>

      <p style="
        margin: 14px 0 10px;
        font-size: 15px;
        font-weight: 700;
        color: #f87171;
        text-align: center;
        background-color: #1f2937;
        padding: 10px;
        border-radius: 8px;
      ">
        ⚠️ AFTER YOU PAY, SEND YOUR RECEIPT TO<br>
        <a href="mailto:gotickets6@gmail.com" style="color: #60a5fa; text-decoration: underline;">
          gotickets6@gmail.com
        </a>
      </p>

      <p style="
        margin: 10px 0 0;
        font-size: 12px;
        color: #9ca3af;
      ">
        Payments are usually confirmed within a short time after we receive them.
      </p>
    </div>
  `;
    }
  }

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

        <a href="https://go-tickets.vercel.app/verify/${order._id}"
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
    : `${paymentInstructionsHtml}`;

  return `
  <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial; 
    max-width: 600px; margin: auto; padding: 24px; background: #f8fafc; color: #0f172a;">
    
    <div style="text-align: center; margin-bottom: 20px;">
      <h2 style="margin: 0; color: #0f172a;">🛍️ Your Merch Order Has Been Received</h2>
      <p style="margin-top: 4px; color: #475569; font-size: 14px;">
        Thank you for shopping with GoTickets!
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
      `
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
      This is an automated confirmation from GoTickets.<br/>
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
      type: paymentMethod || "credit_card",
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
      "🛍️ Merch Order Received - GoTickets",
      html
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
      "GoTickets Nodemailer Test",
      "<p>If you see this, Nodemailer via Gmail is working ✅</p>"
    );

    res.json(result);
  } catch (err) {
    console.error("Debug email error:", err);
    res.status(500).json({ ok: false, error: err.message });
  }
});

app.get("/api/health", (req, res) => {
  res.json({ status: "ok", timestamp: new Date() });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`🚀 GoTickets Server running on port ${PORT}`);
  console.log(
    `📧 Email service: ${
      process.env.MAIL_USER ? "Configured" : "Not configured"
    }`
  );
  console.log(
    `🎫 SeatGeek API: ${
      process.env.SEATGEEK_CLIENT_ID ? "Configured" : "Not configured"
    }`
  );
});
