import "server-only";
import Stripe from "stripe";

// Null until STRIPE_SECRET_KEY is set, so the store can show
// "checkout isn't available yet" instead of crashing.
let client: Stripe | null | undefined;
export function stripe(): Stripe | null {
  if (client === undefined) client = process.env.STRIPE_SECRET_KEY ? new Stripe(process.env.STRIPE_SECRET_KEY) : null;
  return client;
}

export const stripeReady = () => !!process.env.STRIPE_SECRET_KEY;
