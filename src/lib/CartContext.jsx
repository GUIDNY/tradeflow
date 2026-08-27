import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { getProduct, FREE_SHIPPING_THRESHOLD, SHIPPING_COST } from "@/lib/products";

const STORAGE_KEY = "tapit.cart.v1";
const CartContext = createContext(null);

const readStorage = () => {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    // Drop anything that no longer exists in the catalog.
    return parsed
      .filter((line) => line && getProduct(line.id))
      .map((line) => ({ id: line.id, quantity: Math.max(1, Math.min(99, Number(line.quantity) || 1)) }));
  } catch {
    return [];
  }
};

export const CartProvider = ({ children }) => {
  const [lines, setLines] = useState(readStorage);
  const [isOpen, setIsOpen] = useState(false);
  const [lastAdded, setLastAdded] = useState(null);

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(lines));
    } catch {
      // Storage can be unavailable (private mode) — the cart just won't persist.
    }
  }, [lines]);

  const addItem = useCallback((productId, quantity = 1) => {
    if (!getProduct(productId)) return;
    setLines((current) => {
      const existing = current.find((line) => line.id === productId);
      if (existing) {
        return current.map((line) =>
          line.id === productId
            ? { ...line, quantity: Math.min(99, line.quantity + quantity) }
            : line
        );
      }
      return [...current, { id: productId, quantity: Math.min(99, quantity) }];
    });
    setLastAdded({ id: productId, at: Date.now() });
    setIsOpen(true);
  }, []);

  const updateQuantity = useCallback((productId, quantity) => {
    setLines((current) =>
      quantity <= 0
        ? current.filter((line) => line.id !== productId)
        : current.map((line) =>
            line.id === productId ? { ...line, quantity: Math.min(99, quantity) } : line
          )
    );
  }, []);

  const removeItem = useCallback((productId) => {
    setLines((current) => current.filter((line) => line.id !== productId));
  }, []);

  const clearCart = useCallback(() => setLines([]), []);

  const value = useMemo(() => {
    const items = lines
      .map((line) => {
        const product = getProduct(line.id);
        return product ? { ...line, product, lineTotal: product.price * line.quantity } : null;
      })
      .filter(Boolean);

    const subtotal = items.reduce((sum, item) => sum + item.lineTotal, 0);
    const count = items.reduce((sum, item) => sum + item.quantity, 0);
    const shipping = subtotal === 0 || subtotal >= FREE_SHIPPING_THRESHOLD ? 0 : SHIPPING_COST;

    return {
      items,
      count,
      subtotal,
      shipping,
      total: subtotal + shipping,
      missingForFreeShipping: Math.max(0, FREE_SHIPPING_THRESHOLD - subtotal),
      isOpen,
      openCart: () => setIsOpen(true),
      closeCart: () => setIsOpen(false),
      setIsOpen,
      lastAdded,
      addItem,
      updateQuantity,
      removeItem,
      clearCart,
    };
  }, [lines, isOpen, lastAdded, addItem, updateQuantity, removeItem, clearCart]);

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
};

export const useCart = () => {
  const context = useContext(CartContext);
  if (!context) throw new Error("useCart must be used within a CartProvider");
  return context;
};
