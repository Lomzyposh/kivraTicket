import React, { useState } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import {
  Heart,
  ShoppingCart,
  User,
  Menu,
  X,
  LogOut,
  Ticket,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { useCart } from "../context/CartContext";

const Navbar = () => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);

  const { user, logout } = useAuth();
  const { cartCount } = useCart();
  const navigate = useNavigate();
  const location = useLocation();

  const handleLogout = async () => {
    await logout();
    navigate("/");
    setMobileMenuOpen(false);
    setProfileOpen(false);
  };

  const isActive = (path) => {
    if (path === "/") return location.pathname === "/";
    return location.pathname.startsWith(path);
  };

  const userInitial =
    user?.name?.[0]?.toUpperCase() || user?.email?.[0]?.toUpperCase() || "U";

  return (
    <nav className="fixed inset-x-0 top-0 z-50 border-b border-slate-800 bg-slate-950/80 backdrop-blur-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="h-16 flex items-center justify-between gap-4">
          {/* Brand */}
          <Link
            to="/"
            className="flex items-center gap-3 shrink-0 group"
            onClick={() => {
              setMobileMenuOpen(false);
              setProfileOpen(false);
            }}
          >
            <div className="h-8 w-8 rounded-xl bg-amber-500 flex items-center justify-center text-slate-950 font-extrabold">
              <Ticket className="w-4 h-4" />
            </div>

            {/* Brand Text */}
            <div className="flex flex-col leading-tight">
              <span className="text-lg sm:text-xl font-semibold text-slate-50">
                Go
                <span className="text-amber-400 transition-colors duration-300 group-hover:text-amber-300">
                  Tickets
                </span>
              </span>
              <span className="hidden sm:inline text-[10px] uppercase tracking-[0.18em] text-slate-500 group-hover:text-slate-400 transition-colors">
                Secure • QR Events
              </span>
            </div>
          </Link>

          {/* Center nav (desktop) */}

          {/* Right side (desktop) */}
          <div className="hidden md:flex items-center gap-3">
            <div className="hidden md:flex items-center gap-6">
              {/* /merch */}
               <NavLink to="/merch" active={isActive("/merch")}>
                Merch
              </NavLink>
              <NavLink to="/events" active={isActive("/events")}>
                Events
              </NavLink>
              {user?.role === "admin" && (
                <NavLink to="/admin" active={isActive("/admin")}>
                  Admin
                </NavLink>
              )}
            </div>
            {user && (
              <>
                <IconButton to="/wishlist" label="Wishlist">
                  <Heart className="w-5 h-5" />
                </IconButton>

                <div className="relative">
                  <IconButton to="/cart" label="Cart">
                    <ShoppingCart className="w-5 h-5" />
                    {cartCount > 0 && (
                      <span className="absolute -top-1 -right-1 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-amber-500 px-1 text-[10px] font-semibold text-slate-950">
                        {cartCount}
                      </span>
                    )}
                  </IconButton>
                </div>

                <IconButton to="/my-orders" label="My tickets">
                  <Ticket className="w-5 h-5" />
                </IconButton>

                {/* Profile dropdown */}
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setProfileOpen((p) => !p)}
                    className="inline-flex items-center gap-2 rounded-full border border-slate-700 bg-slate-900/80 px-2.5 py-1.5 text-xs text-slate-100 hover:border-amber-500/70 hover:bg-slate-800 transition-all"
                  >
                    <div className="flex h-7 w-7 items-center justify-center rounded-full bg-amber-500 text-slate-950 text-xs font-semibold">
                      {userInitial}
                    </div>
                    <div className="hidden sm:flex flex-col items-start leading-tight">
                      <span className="max-w-[120px] truncate text-xs">
                        {user.name || user.email}
                      </span>
                      <span className="text-[10px] text-slate-500">
                        {user.role === "admin" ? "Admin" : "Member"}
                      </span>
                    </div>
                  </button>

                  {profileOpen && (
                    <div className="absolute right-0 mt-2 w-48 rounded-2xl border border-slate-800 bg-slate-950/95 shadow-lg shadow-slate-950/40 text-xs overflow-hidden">
                      <button
                        type="button"
                        onClick={() => {
                          navigate("/profile");
                          setProfileOpen(false);
                        }}
                        className="w-full px-3 py-2.5 text-left hover:bg-slate-900 flex items-center gap-2"
                      >
                        <User className="w-3.5 h-3.5 text-amber-400" />
                        <span>Profile & settings</span>
                      </button>
                      <button
                        type="button"
                        onClick={handleLogout}
                        className="w-full px-3 py-2.5 text-left hover:bg-red-500/10 flex items-center gap-2 text-red-200"
                      >
                        <LogOut className="w-3.5 h-3.5" />
                        <span>Sign out</span>
                      </button>
                    </div>
                  )}
                </div>
              </>
            )}

            {!user && (
              <Link
                to="/login"
                className="inline-flex items-center gap-2 rounded-xl bg-amber-500 px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-amber-400 transition-all shadow-md shadow-amber-500/30"
              >
                <User className="w-4 h-4" />
                <span>Sign in</span>
              </Link>
            )}
          </div>

          {/* Mobile right side */}
          <div className="flex md:hidden items-center gap-2">
            {user ? (
              <button
                type="button"
                onClick={() => setMobileMenuOpen((p) => !p)}
                className="inline-flex items-center justify-center rounded-full border border-slate-700 bg-slate-900/80 h-9 w-9 text-slate-100"
              >
                {mobileMenuOpen ? (
                  <X className="w-5 h-5" />
                ) : (
                  <Menu className="w-5 h-5" />
                )}
              </button>
            ) : (
              <>
                <Link
                  to="/login"
                  className="inline-flex items-center gap-1.5 rounded-xl bg-amber-500 px-3 py-1.5 text-xs font-semibold text-slate-950 hover:bg-amber-400 transition-all"
                >
                  <User className="w-4 h-4" />
                  <span>Sign in</span>
                </Link>
                <button
                  type="button"
                  onClick={() => setMobileMenuOpen((p) => !p)}
                  className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-slate-700 bg-slate-900/80 text-slate-100"
                >
                  {mobileMenuOpen ? (
                    <X className="w-5 h-5" />
                  ) : (
                    <Menu className="w-5 h-5" />
                  )}
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Mobile menu */}
      {mobileMenuOpen && (
        <div className="md:hidden border-t border-slate-800 bg-slate-950/95 backdrop-blur-md">
          <div className="max-w-7xl mx-auto px-4 py-4 flex flex-col gap-3 text-sm">
            <div className="flex items-center justify-between mb-1">
              {user && (
                <div className="flex items-center gap-2">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-amber-500 text-slate-950 text-xs font-semibold">
                    {userInitial}
                  </div>
                  <div className="flex flex-col leading-tight">
                    <span className="text-slate-100 text-sm">
                      {user.name || user.email}
                    </span>
                    <span className="text-[11px] text-slate-500">
                      {user.role === "admin" ? "Admin" : "Member"}
                    </span>
                  </div>
                </div>
              )}
            </div>

            <div className="flex flex-col gap-2 border-t border-slate-800 pt-3">
              <MobileLink
                to="/events"
                label="Events"
                active={isActive("/events")}
                onClick={() => setMobileMenuOpen(false)}
              />
               <MobileLink
                to="/merch"
                label="Merch ( Clothes & Accessories )"
                active={isActive("/merch")}
                onClick={() => setMobileMenuOpen(false)}
              />
              {user?.role === "admin" && (
                <MobileLink
                  to="/admin"
                  label="Admin dashboard"
                  active={isActive("/admin")}
                  onClick={() => setMobileMenuOpen(false)}
                />
              )}
              {user && (
                <>
                  <MobileLink
                    to="/wishlist"
                    label="Wishlist"
                    icon={<Heart className="w-4 h-4" />}
                    onClick={() => setMobileMenuOpen(false)}
                  />
                  <MobileLink
                    to="/cart"
                    label={`Cart${cartCount ? ` (${cartCount})` : ""}`}
                    icon={<ShoppingCart className="w-4 h-4" />}
                    onClick={() => setMobileMenuOpen(false)}
                  />
                  <MobileLink
                    to="/my-orders"
                    label="My Orders"
                    icon={<Ticket className="w-4 h-4" />}
                    onClick={() => setMobileMenuOpen(false)}
                  />
                  <MobileLink
                    to="/profile"
                    label="Profile & settings"
                    icon={<User className="w-4 h-4" />}
                    onClick={() => setMobileMenuOpen(false)}
                  />
                  <button
                    type="button"
                    onClick={handleLogout}
                    className="mt-1 inline-flex items-center gap-2 text-sm text-red-200 hover:text-red-100"
                  >
                    <LogOut className="w-4 h-4" />
                    <span>Sign out</span>
                  </button>
                </>
              )}
            </div>

            {!user && (
              <div className="pt-2">
                <Link
                  to="/login"
                  onClick={() => setMobileMenuOpen(false)}
                  className="block w-full text-center rounded-xl bg-amber-500 px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-amber-400 transition-all"
                >
                  Sign in
                </Link>
              </div>
            )}
          </div>
        </div>
      )}
    </nav>
  );
};

const NavLink = ({ to, active, children }) => (
  <Link
    to={to}
    className={`text-sm transition-all p-3 ${
      active
        ? "text-amber-300 font-medium border-b border-amber-400"
        : "text-slate-300 hover:text-amber-200"
    }`}
  >
    {children}
  </Link>
);

const IconButton = ({ to, label, children }) => (
  <Link
    to={to}
    className="relative inline-flex items-center justify-center rounded-xl border border-slate-700 bg-slate-900/80 px-2.5 py-1.5 text-slate-200 hover:border-amber-500/70 hover:bg-slate-800 transition-all"
    aria-label={label}
  >
    {children}
  </Link>
);

const MobileLink = ({ to, label, icon, active, onClick }) => (
  <Link
    to={to}
    onClick={onClick}
    className={`inline-flex items-center gap-2 rounded-lg px-2 py-1.5 ${
      active
        ? "text-amber-300 bg-slate-900"
        : "text-slate-200 hover:text-amber-200 hover:bg-slate-900/80"
    }`}
  >
    {icon}
    <span>{label}</span>
  </Link>
);

export default Navbar;
