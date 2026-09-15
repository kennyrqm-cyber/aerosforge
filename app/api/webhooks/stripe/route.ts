import { NextResponse } from "next/server";
import { processStripeWebhook } from "@/lib/checkride-payments";
import { createStripeClient, getStripeWebhookConfig } from "@/lib/stripe";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const signature = request.headers.get("stripe-signature");
  if (!signature) return NextResponse.json({ error: "Missing signature" }, { status: 400 });

  try {
    const { apiKey, webhookSecret } = getStripeWebhookConfig();
    const stripe = createStripeClient(apiKey);
    const event = stripe.webhooks.constructEvent(await request.text(), signature, webhookSecret);
    const result = await processStripeWebhook(event);
    return NextResponse.json({ received: true, processed: result.processed });
  } catch (error) {
    const invalidSignature = error instanceof Error && error.message.toLowerCase().includes("signature");
    return NextResponse.json(
      { error: invalidSignature ? "Invalid signature" : "Webhook unavailable" },
      { status: invalidSignature ? 400 : 503 }
    );
  }
}
