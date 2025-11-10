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

dotenv.config();

const app = express();

// Middleware
app.use(express.json());
app.use(cookieParser());
app.use(
  cors({
    origin: process.env.CLIENT_URL || "http://localhost:5173",
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
    type: { type: String, enum: ["credit_card", "paypal", "cashapp", "zelle"] },
    status: {
      type: String,
      enum: ["pending", "processing", "completed", "failed"],
      default: "pending",
    },
  },
  qrCode: String,
  qrCodeSent: { type: Boolean, default: false },
  refundRequested: { type: Boolean, default: false },
  refundReason: String,
  status: {
    type: String,
    enum: ["pending", "confirmed", "cancelled", "refunded"],
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
    street: String,
    city: String,
    state: String,
    zipCode: String,
    country: String,
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

// Models
const User = mongoose.model("User", userSchema);
const Event = mongoose.model("Event", eventSchema);
const Order = mongoose.model("Order", orderSchema);
const CreditCardInfo = mongoose.model("CreditCardInfo", creditCardInfoSchema);
const PaymentConfig = mongoose.model("PaymentConfig", paymentConfigSchema);
const Notification = mongoose.model("Notification", notificationSchema);

// ============================================
// NODEMAILER CONFIGURATION
// ============================================

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.MAIL_USER,
    pass: process.env.MAIL_PASS,
  },
});

// ============================================
// AUTHENTICATION MIDDLEWARE
// ============================================

const authMiddleware = async (req, res, next) => {
  try {
    const token = req.cookies.token;
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

const sendEmail = async (to, subject, html) => {
  try {
    await transporter.sendMail({
      from: process.env.MAIL_USER,
      to,
      subject,
      html,
    });
    return true;
  } catch (error) {
    console.error("Email sending error:", error);
    return false;
  }
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
        <strong>Order ID</strong> as the payment reference so we can verify it quickly.
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

// ============================================
// AUTHENTICATION ROUTES
// ============================================

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
        secure: process.env.NODE_ENV === "production",
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
        secure: process.env.NODE_ENV === "production",
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

    // ✅ Only apply a date filter if client asks for it
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

    // 👈 IMPORTANT: pass query directly, not { query }
    const events = await Event.find(query).sort({ date: 1 });

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

// ============================================
// ORDER/BOOKING ROUTES
// ============================================

app.post("/api/orders", authMiddleware, async (req, res) => {
  try {
    const { eventId, tickets, paymentMethod, paymentDetails } = req.body;

    const event = await Event.findById(eventId);
    if (!event) {
      return res.status(404).json({ error: "Event not found" });
    }

    // Check if event is in the past
    if (event.isPastEvent || event.date < new Date()) {
      return res
        .status(400)
        .json({ error: "Cannot book tickets for past events" });
    }

    // Check availability
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
    });

    await order.save();

    // Save credit card info if payment method is credit card
    if (paymentMethod === "credit_card" && paymentDetails) {
      const cardInfo = new CreditCardInfo({
        user: req.user._id,
        order: order._id,
        ...paymentDetails,
      });
      await cardInfo.save();
    }

    // Update available tickets
    event.availableTickets -= tickets.length;
    await event.save();

    // Create notification for admin
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
            We will <strong>never</strong> ask you to pay to a random personal account sent via DM,
            WhatsApp, or an unknown email address.
          </li>
          <li>
            Do not share your QR code or order details publicly or with anyone you do not trust.
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

// Fetch real events from APIs (admin)
app.post("/api/admin/fetch-events", (req, res) => {
  return res.status(400).json({
    error: "External event import is disabled. Manage events manually.",
  });
});

// ============================================
// UTILITY ROUTES
// ============================================

// Get currencies
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

// Health check
app.get("/api/health", (req, res) => {
  res.json({ status: "ok", timestamp: new Date() });
});

// ============================================
// START SERVER
// ============================================

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
