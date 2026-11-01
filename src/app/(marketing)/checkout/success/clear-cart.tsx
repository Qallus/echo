"use client";

import { useEffect } from "react";
import { clearCart } from "@/lib/billing/cart";

// Checkout finished: empty the cart.
export function ClearCart() {
  useEffect(() => { clearCart(); }, []);
  return null;
}
