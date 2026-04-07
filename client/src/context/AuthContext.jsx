import React, { createContext, useContext, useState, useEffect } from "react";
import api from "../api/axios"; // centralized axios instance
import Loader from "../components/Loader";

const AuthContext = createContext();

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [token, setToken] = useState(localStorage.getItem("token") || null);

  const checkAuth = async () => {
    try {
      setLoading(true);
      const response = await api.get("/auth/me");
      setUser(response.data.user);
      setError(null);
    } catch (err) {
      setUser(null);
      localStorage.removeItem("token");
      setToken(null);
      setError(err?.response?.data?.message || "Not authenticated");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (token) {
      checkAuth();
    } else {
      setLoading(false);
    }
  }, [token]);

  const login = async (email, password) => {
    try {
      const response = await api.post("/auth/login", { email, password });
      const newToken = response.data.token;

      localStorage.setItem("token", newToken);
      setToken(newToken);
      setUser(response.data.user);

      setError(null);
      return response.data;
    } catch (err) {
      setError(err?.response?.data?.message || "Login failed");
      throw err;
    }
  };

  const register = async (name, email, password) => {
    try {
      const response = await api.post("/auth/register", {
        name,
        email,
        password,
      });
      const newToken = response.data.token;

      localStorage.setItem("token", newToken);
      setToken(newToken);
      setUser(response.data.user);
      setError(null);
      return response.data;
    } catch (err) {
      setError(err?.response?.data?.message || "Registration failed");
      throw err;
    }
  };

  const logout = async () => {
    try {
      await api.post("/auth/logout");
      localStorage.removeItem("token");
      setToken(null);
      setUser(null);
      setError(null);
    } catch (err) {
      setError(err?.response?.data?.message || "Logout failed");
    }
  };

  const value = {
    user,
    loading,
    error,
    login,
    register,
    logout,
    checkAuth,
    isAuthenticated: !!user,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
