import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  User,
  Mail,
  Phone,
  Globe2,
  ShieldCheck,
  KeyRound,
  Save,
  AlertTriangle,
  LogOut,
} from "lucide-react";
import api from "../api/axios";
import { useAuth } from "../context/AuthContext";

export default function Profile() {
  const navigate = useNavigate();
  const { user, logout, setUser } = useAuth?.() || {};

  const [profile, setProfile] = useState({
    name: user?.name || "",
    email: user?.email || "",
    phone: "",
    country: "",
  });

  const [profileLoading, setProfileLoading] = useState(true);
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileError, setProfileError] = useState("");
  const [profileSuccess, setProfileSuccess] = useState("");

  const [pwdForm, setPwdForm] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });
  const [pwdSaving, setPwdSaving] = useState(false);
  const [pwdError, setPwdError] = useState("");
  const [pwdSuccess, setPwdSuccess] = useState("");

  useEffect(() => {
    if (!user) {
      navigate("/login", {
        state: {
          from: "/profile",
          message: "Sign in to manage your KivraTickets profile.",
        },
      });
      return;
    }

    let active = true;

    const fetchProfile = async () => {
      try {
        setProfileLoading(true);
        setProfileError("");
        setProfileSuccess("");

        const res = await api.get("/auth/profile"); // adjust if needed
        if (!active) return;

        const data = res.data?.user || res.data?.profile || {};
        setProfile((prev) => ({
          ...prev,
          name: data.name || prev.name,
          email: data.email || prev.email,
          phone: data.phone || "",
          country: data.country || "",
        }));
      } catch (err) {
        if (!active) return;
        const msg =
          err?.response?.data?.error ||
          err?.response?.data?.message ||
          "We couldn’t load your profile details.";
        setProfileError(msg);
      } finally {
        if (active) setProfileLoading(false);
      }
    };

    fetchProfile();

    return () => {
      active = false;
    };
  }, [user, navigate]);

  const handleProfileChange = (field, value) => {
    setProfile((prev) => ({ ...prev, [field]: value }));
    setProfileError("");
    setProfileSuccess("");
  };

  const handleSaveProfile = async (e) => {
    e.preventDefault();
    if (!profile.name || !profile.email) {
      setProfileError("Name and email cannot be empty.");
      return;
    }

    try {
      setProfileSaving(true);
      setProfileError("");
      setProfileSuccess("");

      const res = await api.put("/auth/profile", {
        name: profile.name,
        email: profile.email,
        phone: profile.phone || undefined,
        country: profile.country || undefined,
      });

      const updatedUser = res.data?.user ||
        res.data?.profile || { ...user, ...profile };

      if (setUser) {
        setUser(updatedUser);
      }

      setProfileSuccess("Your profile has been updated.");
    } catch (err) {
      const msg =
        err?.response?.data?.error ||
        err?.response?.data?.message ||
        "We couldn’t save your profile changes.";
      setProfileError(msg);
    } finally {
      setProfileSaving(false);
    }
  };

  const handlePwdChange = (field, value) => {
    setPwdForm((prev) => ({ ...prev, [field]: value }));
    setPwdError("");
    setPwdSuccess("");
  };

  const handleChangePassword = async (e) => {
    e.preventDefault();

    if (
      !pwdForm.currentPassword ||
      !pwdForm.newPassword ||
      !pwdForm.confirmPassword
    ) {
      setPwdError("Please fill in all the password fields.");
      return;
    }

    if (pwdForm.newPassword.length < 6) {
      setPwdError("New password must be at least 6 characters.");
      return;
    }

    if (pwdForm.newPassword !== pwdForm.confirmPassword) {
      setPwdError("The new passwords do not match.");
      return;
    }

    try {
      setPwdSaving(true);
      setPwdError("");
      setPwdSuccess("");

      await api.post("/auth/change-password", {
        currentPassword: pwdForm.currentPassword,
        newPassword: pwdForm.newPassword,
      });

      setPwdSuccess("Your password has been updated successfully.");
      setPwdForm({
        currentPassword: "",
        newPassword: "",
        confirmPassword: "",
      });
    } catch (err) {
      const msg =
        err?.response?.data?.error ||
        err?.response?.data?.message ||
        "We couldn’t update your password. Please check your current password and try again.";
      setPwdError(msg);
    } finally {
      setPwdSaving(false);
    }
  };

  const handleLogout = async () => {
    try {
      await api.post("/auth/logout").catch(() => {});
    } catch (_) {
      // ignore
    } finally {
      if (logout) logout();
      navigate("/login");
    }
  };

  return (
    <div className="min-h-screen bg-linear-to-br from-slate-950 via-slate-900 to-slate-950 text-slate-50">
      <div className="max-w-4xl mx-auto px-4 pt-20 pb-16 md:px-8 lg:px-10 lg:pt-24">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
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
              <User className="w-5 h-5 text-amber-400" />
              Account settings
            </h1>
            <p className="mt-1 text-xs md:text-sm text-slate-400">
              Update your details and keep your KivraTickets account secure.
            </p>
          </div>
          <button
            type="button"
            onClick={handleLogout}
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-700 bg-slate-950/80 hover:border-red-500/70 hover:bg-slate-900/80 text-[11px] text-slate-200 px-3 py-1.5 transition-all"
          >
            <LogOut className="w-3.5 h-3.5" />
            Log out
          </button>
        </div>

        <div className="grid md:grid-cols-[minmax(0,1.2fr),minmax(0,1fr)] gap-6 md:gap-8">
          {/* Profile form */}
          <form
            onSubmit={handleSaveProfile}
            className="rounded-3xl bg-slate-900/80 border border-slate-800 p-5 md:p-6 flex flex-col gap-4"
          >
            <div className="flex items-center justify-between mb-1">
              <div>
                <p className="text-[11px] text-slate-400 uppercase tracking-[0.18em] mb-1">
                  Profile
                </p>
                <p className="text-sm font-semibold text-slate-50">
                  Basic account information
                </p>
              </div>
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
            </div>

            {profileError && (
              <div className="rounded-2xl bg-red-500/10 border border-red-500/40 px-3 py-3 text-xs text-red-100 flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 mt-0.5" />
                <span>{profileError}</span>
              </div>
            )}

            {profileSuccess && (
              <div className="rounded-2xl bg-emerald-500/10 border border-emerald-500/40 px-3 py-3 text-xs text-emerald-100">
                {profileSuccess}
              </div>
            )}

            {profileLoading ? (
              <div className="space-y-3 animate-pulse">
                <div className="h-9 rounded-xl bg-slate-800" />
                <div className="h-9 rounded-xl bg-slate-800" />
                <div className="h-9 rounded-xl bg-slate-800" />
                <div className="h-9 rounded-xl bg-slate-800" />
              </div>
            ) : (
              <>
                <div className="space-y-1">
                  <label className="text-[11px] text-slate-400 flex items-center gap-1">
                    <User className="w-3.5 h-3.5 text-amber-400" />
                    Full name
                  </label>
                  <input
                    type="text"
                    value={profile.name}
                    onChange={(e) =>
                      handleProfileChange("name", e.target.value)
                    }
                    placeholder="Your full name"
                    className="w-full rounded-xl bg-slate-950/80 border border-slate-800 px-3 py-2.5 text-sm text-slate-50 placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-amber-500/70 focus:border-amber-500/70"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] text-slate-400 flex items-center gap-1">
                    <Mail className="w-3.5 h-3.5 text-amber-400" />
                    Email
                  </label>
                  <input
                    type="email"
                    value={profile.email}
                    onChange={(e) =>
                      handleProfileChange("email", e.target.value)
                    }
                    placeholder="your@email.com"
                    className="w-full rounded-xl bg-slate-950/80 border border-slate-800 px-3 py-2.5 text-sm text-slate-50 placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-amber-500/70 focus:border-amber-500/70"
                  />
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    This is where we send your order confirmations and QR
                    tickets.
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-[11px] text-slate-400 flex items-center gap-1">
                      <Phone className="w-3.5 h-3.5 text-amber-400" />
                      Phone (optional)
                    </label>
                    <input
                      type="tel"
                      value={profile.phone}
                      onChange={(e) =>
                        handleProfileChange("phone", e.target.value)
                      }
                      placeholder="+234..."
                      className="w-full rounded-xl bg-slate-950/80 border border-slate-800 px-3 py-2.5 text-sm text-slate-50 placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-amber-500/70 focus:border-amber-500/70"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[11px] text-slate-400 flex items-center gap-1">
                      <Globe2 className="w-3.5 h-3.5 text-amber-400" />
                      Country (optional)
                    </label>
                    <input
                      type="text"
                      value={profile.country}
                      onChange={(e) =>
                        handleProfileChange("country", e.target.value)
                      }
                      placeholder="Nigeria, United Kingdom..."
                      className="w-full rounded-xl bg-slate-950/80 border border-slate-800 px-3 py-2.5 text-sm text-slate-50 placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-amber-500/70 focus:border-amber-500/70"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={profileSaving}
                  className="mt-2 inline-flex items-center justify-center gap-2 rounded-xl bg-amber-500 hover:bg-amber-400 disabled:bg-amber-500/60 text-slate-950 font-semibold text-sm px-4 py-2.5 transition-all shadow-lg shadow-amber-500/30"
                >
                  {profileSaving ? (
                    <>
                      <span className="h-4 w-4 border-2 border-slate-900/70 border-t-transparent rounded-full animate-spin" />
                      Saving changes...
                    </>
                  ) : (
                    <>
                      <Save className="w-4 h-4" />
                      Save profile
                    </>
                  )}
                </button>
              </>
            )}
          </form>

          {/* Password + security */}
          <form
            onSubmit={handleChangePassword}
            className="rounded-3xl bg-slate-900/80 border border-slate-800 p-5 md:p-6 flex flex-col gap-4"
          >
            <div className="flex items-center justify-between mb-1">
              <div>
                <p className="text-[11px] text-slate-400 uppercase tracking-[0.18em] mb-1">
                  Security
                </p>
                <p className="text-sm font-semibold text-slate-50">
                  Change password
                </p>
              </div>
              <KeyRound className="w-4 h-4 text-amber-400" />
            </div>

            {pwdError && (
              <div className="rounded-2xl bg-red-500/10 border border-red-500/40 px-3 py-3 text-xs text-red-100 flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 mt-0.5" />
                <span>{pwdError}</span>
              </div>
            )}

            {pwdSuccess && (
              <div className="rounded-2xl bg-emerald-500/10 border border-emerald-500/40 px-3 py-3 text-xs text-emerald-100">
                {pwdSuccess}
              </div>
            )}

            <div className="space-y-1">
              <label className="text-[11px] text-slate-400">
                Current password
              </label>
              <input
                type="password"
                value={pwdForm.currentPassword}
                onChange={(e) =>
                  handlePwdChange("currentPassword", e.target.value)
                }
                placeholder="Enter your current password"
                className="w-full rounded-xl bg-slate-950/80 border border-slate-800 px-3 py-2.5 text-sm text-slate-50 placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-amber-500/70 focus:border-amber-500/70"
              />
            </div>

            <div className="space-y-1">
              <label className="text-[11px] text-slate-400">New password</label>
              <input
                type="password"
                value={pwdForm.newPassword}
                onChange={(e) => handlePwdChange("newPassword", e.target.value)}
                placeholder="Choose a strong new password"
                className="w-full rounded-xl bg-slate-950/80 border border-slate-800 px-3 py-2.5 text-sm text-slate-50 placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-amber-500/70 focus:border-amber-500/70"
              />
            </div>

            <div className="space-y-1">
              <label className="text-[11px] text-slate-400">
                Confirm new password
              </label>
              <input
                type="password"
                value={pwdForm.confirmPassword}
                onChange={(e) =>
                  handlePwdChange("confirmPassword", e.target.value)
                }
                placeholder="Type the new password again"
                className="w-full rounded-xl bg-slate-950/80 border border-slate-800 px-3 py-2.5 text-sm text-slate-50 placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-amber-500/70 focus:border-amber-500/70"
              />
            </div>

            <p className="text-[11px] text-slate-500">
              Choose a password that you don&apos;t reuse on other sites. If you
              think your account has been compromised, update this immediately.
            </p>

            <button
              type="submit"
              disabled={pwdSaving}
              className="mt-1 inline-flex items-center justify-center gap-2 rounded-xl bg-slate-950 border border-slate-700 hover:border-amber-500/70 hover:bg-slate-900 text-slate-50 text-sm font-semibold px-4 py-2.5 transition-all"
            >
              {pwdSaving ? (
                <>
                  <span className="h-4 w-4 border-2 border-slate-300/70 border-t-transparent rounded-full animate-spin" />
                  Updating password...
                </>
              ) : (
                <>
                  <KeyRound className="w-4 h-4" />
                  Update password
                </>
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
