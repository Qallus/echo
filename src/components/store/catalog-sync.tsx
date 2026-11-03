"use client";

import { setCatalog, type Product } from "@/lib/billing/catalog";

// Hands the server-loaded catalog to the browser's store code (cart, pricing
// cards). Render it before anything that reads the catalog.
export function CatalogSync({ products }: { products: Product[] }) {
  setCatalog(products);
  return null;
}
