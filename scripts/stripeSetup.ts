import Stripe from "stripe";
import * as dotenv from "dotenv";
// Load environment (so STRIPE_SECRET_KEY and APP_URL are available)
dotenv.config({ path: ".env.local" });

// Import plan definitions from the config
import { planDefinitions } from "../src/config/billing";

// Make sure the Stripe secret key is provided
const stripeApiKey = process.env.STRIPE_SECRET_KEY;
if (!stripeApiKey) {
  console.error("ERROR: STRIPE_SECRET_KEY is not set in environment.");
  process.exit(1);
}

// Initialize Stripe SDK
const stripe = new Stripe(stripeApiKey, {
  apiVersion: Stripe.API_VERSION as Stripe.LatestApiVersion,
});

// Define the list of events our webhook should listen to
const WEBHOOK_EVENTS = [
  "checkout.session.completed",
  "customer.subscription.created",
  "customer.subscription.updated",
  "customer.subscription.deleted",
  "invoice.paid",
  "invoice.payment_failed",
] as Stripe.WebhookEndpointCreateParams.EnabledEvent[];

async function runSetup() {
  console.log("Running Stripe setup...");

  for (const plan of planDefinitions) {
    const {
      id,
      productName,
      defaultPriceCents,
      defaultPriceCurrency,
      defaultPriceInterval,
      stripePriceEnvVarName,
    } = plan;
    // Skip creation if an env var already exists for this price
    const existingPriceId = process.env[stripePriceEnvVarName];
    if (existingPriceId && existingPriceId.trim() !== "") {
      console.log(
        `Skipping ${id} plan - ${stripePriceEnvVarName} is already set (ID: ${existingPriceId}).`
      );
      continue;
    }

    // Ensure product exists (by name)
    let product;
    // Try to find an existing product with the same name
    const prodList = await stripe.products.list({ limit: 100, active: true });
    product = prodList.data.find((p) => p.name === productName);
    if (!product) {
      product = await stripe.products.create({ name: productName });
      console.log(`Created Stripe Product for plan "${id}": ${product.id}`);
    } else {
      console.log(
        `Found existing Stripe Product for plan "${id}": ${product.id}`
      );
    }

    // Ensure price exists (by currency & interval, matches config amount)
    const prices = await stripe.prices.list({
      product: product.id,
      active: true,
    });
    let price = prices.data.find(
      (pr) =>
        pr.currency === defaultPriceCurrency &&
        pr.recurring?.interval === defaultPriceInterval
    );
    if (price) {
      if (price.unit_amount === defaultPriceCents) {
        console.log(
          `Found existing Price for "${id}" matching config: ${price.id} ($${(
            price.unit_amount! / 100
          ).toFixed(2)} ${price.recurring?.interval})`
        );
      } else {
        // If a price exists for same interval but different amount, archive it and create a new one
        console.log(
          `Existing Price for "${id}" has amount ${(
            price.unit_amount! / 100
          ).toFixed(2)}, but config is ${(defaultPriceCents / 100).toFixed(
            2
          )}. Creating a new Price...`
        );
        await stripe.prices.update(price.id, { active: false });
        price = await stripe.prices.create({
          unit_amount: defaultPriceCents,
          currency: defaultPriceCurrency,
          recurring: { interval: defaultPriceInterval },
          product: product.id,
        });
        console.log(
          `Created new Price for "${id}": ${price.id} ($${(
            defaultPriceCents / 100
          ).toFixed(2)} per ${defaultPriceInterval})`
        );
      }
    } else {
      // No price for this plan yet – create it
      price = await stripe.prices.create({
        unit_amount: defaultPriceCents,
        currency: defaultPriceCurrency,
        recurring: { interval: defaultPriceInterval },
        product: product.id,
      });
      console.log(
        `Created Stripe Price for plan "${id}": ${price.id} ($${(
          defaultPriceCents / 100
        ).toFixed(2)} per ${defaultPriceInterval})`
      );
    }

    // Output the env var setting for this price
    console.log(
      `=> Set ${stripePriceEnvVarName}=${price.id} in your .env.local`
    );
  }

  // Optionally, set up a webhook endpoint for Stripe events
  const webhookSecretEnv = process.env.STRIPE_WEBHOOK_SECRET;
  const appUrl = process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL;
  if (!webhookSecretEnv) {
    if (!appUrl || appUrl.includes("localhost")) {
      console.log(
        "\nSTRIPE_WEBHOOK_SECRET is not set. Since the app URL is not public (likely development), please use the Stripe CLI to forward webhooks as described in the README."
      );
    } else {
      // If we have a public URL and no webhook secret, create a new webhook endpoint
      console.log("\nCreating a new Stripe webhook endpoint for " + appUrl);
      // Check if an endpoint with this URL already exists to avoid duplicates
      const existingHooks = await stripe.webhookEndpoints.list();
      const targetUrl = appUrl.replace(/\/$/, "") + "/api/stripe/webhook";
      const already = existingHooks.data.find((wh) => wh.url === targetUrl);
      if (already) {
        console.log(
          `Stripe webhook endpoint already exists for ${targetUrl}. Retrieve its signing secret from your Stripe dashboard or delete the old endpoint if you want to create a new one.`
        );
      } else {
        const webhookEndpoint = await stripe.webhookEndpoints.create({
          url: targetUrl,
          description: "Archangel SaaS Starter Webhook",
          enabled_events: WEBHOOK_EVENTS,
        });
        console.log(`Created Stripe Webhook endpoint: ${webhookEndpoint.id}`);
        if (webhookEndpoint.secret) {
          console.log(
            `=> Set STRIPE_WEBHOOK_SECRET=${webhookEndpoint.secret} in your .env.local`
          );
        } else {
          console.log(
            "Note: Copy the webhook signing secret from your Stripe dashboard and set STRIPE_WEBHOOK_SECRET in .env.local"
          );
        }
      }
    }
  } else {
    console.log(
      "\nStripe webhook secret is already configured, skipping webhook setup."
    );
  }

  console.log("\nStripe setup script completed.");
}

// Run the setup
runSetup().catch((error) => {
  console.error("Stripe setup failed:", error);
  process.exit(1);
});
