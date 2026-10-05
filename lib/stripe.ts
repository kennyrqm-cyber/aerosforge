import Stripe from "stripe";

export const STRIPE_API_VERSION = "2026-07-29.dahlia" as const;

export type CheckrideCheckoutConfig = {
  apiKey: string;
  webhookSecret: string;
  priceId: string;
  baseUrl: string;
};

function exactHttpsOrigin(value: string) {
  const url = new URL(value);
  const local = url.hostname === "localhost" || url.hostname === "127.0.0.1";
  if (url.protocol !== "https:" && !(local && url.protocol === "http:")) {
    throw new Error("Checkride checkout requires an HTTPS application origin.");
  }
  if (url.pathname !== "/" || url.search || url.hash || url.username || url.password) {
    throw new Error("Checkride checkout origin must not contain a path, credentials, query, or fragment.");
  }
  return url.origin;
}

function stripeApiKey() {
  const value = process.env.STRIPE_RESTRICTED_KEY?.trim() ?? "";
  if (!/^rk_(test|live)_/.test(value)) {
    throw new Error("A restricted Stripe API key is required.");
  }
  return value;
}

export function getCheckrideCheckoutConfig(): CheckrideCheckoutConfig {
  if (process.env.CHECKRIDE_PAYMENTS_ENABLED !== "true") {
    throw new Error("Checkride payments are not open yet.");
  }
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET?.trim() ?? "";
  const priceId = process.env.CHECKRIDE_STRIPE_PRICE_ID?.trim() ?? "";
  const baseUrl = process.env.CHECKRIDE_CHECKOUT_BASE_URL?.trim() ?? "";
  if (!/^whsec_/.test(webhookSecret) || !/^price_/.test(priceId) || !baseUrl) {
    throw new Error("Checkride payment dependencies are incomplete.");
  }
  return { apiKey: stripeApiKey(), webhookSecret, priceId, baseUrl: exactHttpsOrigin(baseUrl) };
}

export function isCheckrideCheckoutConfigured() {
  try {
    getCheckrideCheckoutConfig();
    return true;
  } catch {
    return false;
  }
}

export function getStripeWebhookConfig() {
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET?.trim() ?? "";
  if (!/^whsec_/.test(webhookSecret)) throw new Error("Stripe webhook verification is not configured.");
  return { apiKey: stripeApiKey(), webhookSecret };
}

export function createStripeClient(apiKey: string) {
  return new Stripe(apiKey, {
    apiVersion: STRIPE_API_VERSION,
    typescript: true,
    maxNetworkRetries: 2,
    timeout: 20_000
  });
}
