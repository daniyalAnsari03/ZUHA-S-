"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

import {
  addToCartAction,
  clearCartAction,
  getStorefrontInitialStateAction,
  getWishlistSummaryAction,
  removeCartItemAction,
  toggleWishlistAction,
  updateCartItemAction,
} from "@/app/storefront/actions";

type StorefrontState = {
  cartCount: number;
  wishlistCount: number;
  subtotal: number;
  ready: boolean;
  /** False while signed out. Resolved once the initial state has been read. */
  signedIn: boolean;
  addToCart: (productId: string, quantity?: number) => Promise<string | null>;
  updateCartItem: (itemId: string, quantity: number) => Promise<string | null>;
  removeCartItem: (itemId: string) => Promise<string | null>;
  clearCart: () => Promise<string | null>;
  toggleWishlist: (
    productId: string,
  ) => Promise<{ saved: boolean; error: string | null }>;
  refreshWishlist: () => Promise<void>;
};

export type { StorefrontState };

const StorefrontContext = createContext<StorefrontState | null>(null);

/**
 * Client-side storefront state for the authenticated customer: live cart and
 * wishlist counts that drive the navbar badges and mutate after every action.
 * Counts are hydrated from read-only server state on mount — the action forms
 * the source of truth, never stale client state.
 */
export function StorefrontProvider({ children }: { children: ReactNode }) {
  const [cartCount, setCartCount] = useState(0);
  const [wishlistCount, setWishlistCount] = useState(0);
  const [subtotal, setSubtotal] = useState(0);
  const [ready, setReady] = useState(false);
  const [signedIn, setSignedIn] = useState(false);

  const initialApplied = useRef(false);
  const cartActionApplied = useRef(false);

  useEffect(() => {
    let active = true;

    getStorefrontInitialStateAction().then((state) => {
      if (!active || initialApplied.current) return;
      setSignedIn(state.signedIn);
      if (!cartActionApplied.current) {
        setCartCount(state.cartCount);
        setWishlistCount(state.wishlistCount);
        setSubtotal(0);
      }
      setReady(true);
      initialApplied.current = true;
    });

    return () => {
      active = false;
    };
  }, []);

  const addToCart = useCallback(
    async (productId: string, quantity = 1): Promise<string | null> => {
      const result = await addToCartAction(productId, quantity);
      if (!result.ok) return result.error;
      cartActionApplied.current = true;
      setCartCount(result.itemCount);
      setSubtotal(result.subtotal);
      return null;
    },
    [],
  );

  const updateCartItem = useCallback(
    async (itemId: string, quantity: number): Promise<string | null> => {
      const result = await updateCartItemAction(itemId, quantity);
      if (!result.ok) return result.error;
      cartActionApplied.current = true;
      setCartCount(result.itemCount);
      setSubtotal(result.subtotal);
      return null;
    },
    [],
  );

  const removeCartItem = useCallback(
    async (itemId: string): Promise<string | null> => {
      const result = await removeCartItemAction(itemId);
      if (!result.ok) return result.error;
      cartActionApplied.current = true;
      setCartCount(result.itemCount);
      setSubtotal(result.subtotal);
      return null;
    },
    [],
  );

  const clearCart = useCallback(async (): Promise<string | null> => {
    const result = await clearCartAction();
    if (!result.ok) return result.error;
    cartActionApplied.current = true;
    setCartCount(result.itemCount);
    setSubtotal(result.subtotal);
    return null;
  }, []);

  const toggleWishlist = useCallback(
    async (
      productId: string,
    ): Promise<{ saved: boolean; error: string | null }> => {
      const result = await toggleWishlistAction(productId);
      if (!result.ok) return { saved: false, error: result.error };
      setWishlistCount(result.itemCount);
      return { saved: result.saved, error: null };
    },
    [],
  );

  const refreshWishlist = useCallback(async () => {
    const result = await getWishlistSummaryAction();
    if (result.ok) setWishlistCount(result.itemCount);
  }, []);

  const value = useMemo<StorefrontState>(
    () => ({
      cartCount,
      wishlistCount,
      subtotal,
      ready,
      signedIn,
      addToCart,
      updateCartItem,
      removeCartItem,
      clearCart,
      toggleWishlist,
      refreshWishlist,
    }),
    [
      cartCount,
      wishlistCount,
      subtotal,
      ready,
      signedIn,
      addToCart,
      updateCartItem,
      removeCartItem,
      clearCart,
      toggleWishlist,
      refreshWishlist,
    ],
  );

  return (
    <StorefrontContext.Provider value={value}>
      {children}
    </StorefrontContext.Provider>
  );
}

export function useStorefront(): StorefrontState {
  const context = useContext(StorefrontContext);
  if (!context) {
    throw new Error("useStorefront must be used within a StorefrontProvider.");
  }
  return context;
}
