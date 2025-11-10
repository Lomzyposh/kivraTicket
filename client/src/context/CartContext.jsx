import React, { createContext, useContext, useState, useEffect } from "react";

const CartContext = createContext();

export const useCart = () => {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error("useCart must be used within CartProvider");
  }
  return context;
};

export const CartProvider = ({ children }) => {
  const [cartItems, setCartItems] = useState([]);

  // Load cart from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem("gotickets_cart");
    if (saved) {
      try {
        setCartItems(JSON.parse(saved));
      } catch {
        setCartItems([]);
      }
    }
  }, []);

  // Save cart to localStorage whenever it changes
  useEffect(() => {
    localStorage.setItem("gotickets_cart", JSON.stringify(cartItems));
  }, [cartItems]);

  // Add tickets for an event
  const addToCart = (event, tickets) => {
    const newItem = {
      event,
      tickets,
      addedAt: new Date().toISOString(),
    };

    setCartItems((prev) => {
      const existing = prev.find((item) => item.event._id === event._id);
      if (existing) {
        // merge tickets if same event
        const updated = prev.map((item) =>
          item.event._id === event._id
            ? { ...item, tickets: [...item.tickets, ...tickets] }
            : item
        );
        return updated;
      }
      return [...prev, newItem];
    });
  };

  // Remove a single event's tickets from the cart
  const removeFromCart = (eventId) => {
    setCartItems((prev) => prev.filter((item) => item.event._id !== eventId));
  };

  // Clear the entire cart
  const clearCart = () => {
    setCartItems([]);
  };

  // Calculate total price of all tickets
  const getTotalAmount = () => {
    return cartItems.reduce((total, item) => {
      const subtotal = item.tickets.reduce((sum, t) => sum + (t.price || 0), 0);
      return total + subtotal;
    }, 0);
  };

  const getTotalCount = () => {
    return cartItems.reduce((count, item) => count + item.tickets.length, 0);
  };

  const value = {
    cartItems,
    addToCart,
    removeFromCart,
    clearCart,
    getTotalAmount,
    getTotalCount,
  };

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
};
