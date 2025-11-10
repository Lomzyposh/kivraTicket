import React from "react";
import { Link } from "react-router-dom";
import {
  Facebook,
  Twitter,
  Instagram,
  Youtube,
  Mail,
  MapPin,
  Phone,
  Ticket,
} from "lucide-react";

export default function Footer() {
  const year = new Date().getFullYear();

  return (
    <footer className="bg-slate-950 border-t border-slate-800 text-slate-400">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-10 py-12">
        <div className="grid gap-10 md:grid-cols-3">
          {/* Brand column */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <div className="h-8 w-8 rounded-xl bg-amber-500 flex items-center justify-center text-slate-950 font-extrabold">
                <Ticket className="w-4 h-4" />
              </div>
              <h2 className="text-xl font-semibold text-slate-50">
                Go<span className="text-amber-400">Tickets</span>
              </h2>
            </div>
            <p className="text-sm leading-relaxed mb-3 text-slate-400 max-w-sm">
              Discover events, grab your seats, and experience unforgettable
              moments — all in one place.
            </p>
            <div className="flex items-center gap-3 mt-3">
              <a
                href="https://facebook.com"
                className="hover:text-amber-400 transition-colors"
              >
                <Facebook className="w-4 h-4" />
              </a>
              <a
                href="https://twitter.com"
                className="hover:text-amber-400 transition-colors"
              >
                <Twitter className="w-4 h-4" />
              </a>
              <a
                href="https://instagram.com"
                className="hover:text-amber-400 transition-colors"
              >
                <Instagram className="w-4 h-4" />
              </a>
              <a
                href="https://youtube.com"
                className="hover:text-amber-400 transition-colors"
              >
                <Youtube className="w-4 h-4" />
              </a>
            </div>
          </div>

          {/* Quick Links */}
          <div>
            <h3 className="text-slate-100 font-semibold text-sm uppercase tracking-wider mb-4">
              Quick Links
            </h3>
            <ul className="space-y-2 text-sm">
              <li>
                <Link to="/" className="hover:text-amber-400 transition-colors">
                  Home
                </Link>
              </li>
              <li>
                <Link
                  to="/events"
                  className="hover:text-amber-400 transition-colors"
                >
                  Events
                </Link>
              </li>
              <li>
                <Link
                  to="/wishlist"
                  className="hover:text-amber-400 transition-colors"
                >
                  Wishlist
                </Link>
              </li>
              <li>
                <Link
                  to="/my-orders"
                  className="hover:text-amber-400 transition-colors"
                >
                  My Tickets
                </Link>
              </li>
              <li>
                <Link
                  to="/profile"
                  className="hover:text-amber-400 transition-colors"
                >
                  Profile
                </Link>
              </li>
            </ul>
          </div>

          {/* Contact Info */}
          <div>
            <h3 className="text-slate-100 font-semibold text-sm uppercase tracking-wider mb-4">
              Get in Touch
            </h3>
            <ul className="space-y-2 text-sm">
              <li className="flex items-center gap-2">
                <Mail className="w-4 h-4 text-amber-400" />
                <span>support@gotickets.com</span>
              </li>
              <li className="flex items-center gap-2">
                <Phone className="w-4 h-4 text-amber-400" />
                <span>+(1) 3184947999</span>
              </li>
              <li className="flex items-center gap-2">
                <MapPin className="w-4 h-4 text-amber-400" />
                <span>Los Angeles, USA</span>
              </li>
            </ul>
            <p className="text-[11px] mt-4 text-slate-500">
              Open Monday – Sunday, 9am – 10pm
            </p>
          </div>
        </div>

        {/* Divider */}
        <div className="border-t border-slate-800 mt-10 pt-6 flex flex-col md:flex-row md:items-center md:justify-between gap-4 text-xs text-slate-500">
          <p>© {year} GoTickets. All rights reserved.</p>
          <p className="flex flex-wrap items-center gap-3">
            <Link
              to="/terms"
              className="hover:text-amber-400 transition-colors"
            >
              Terms of Service
            </Link>
            <span className="hidden sm:inline">•</span>
            <Link
              to="/privacy"
              className="hover:text-amber-400 transition-colors"
            >
              Privacy Policy
            </Link>
          </p>
        </div>
      </div>
    </footer>
  );
}