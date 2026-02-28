import Link from "next/link";
import { brand } from "@/config/brand";
import { CheckCircle2, DotIcon } from "lucide-react";

export default function PrivacyPage() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-4 md:py-16">
      <header className="text-center">
        <h1 className="text-balance text-4xl font-semibold leading-tight tracking-tight md:text-5xl">
          Privacy Policy
        </h1>
        <p className="mt-3 text-sm text-muted-foreground">
          Last updated: {new Date().toLocaleDateString()}
        </p>
      </header>

      <div className="mt-12 space-y-10">
        <section className="space-y-3">
          <h2 className="text-xl font-semibold">Overview</h2>
          <p className="text-muted-foreground">
            This Privacy Policy explains how {brand.name} collects, uses, and
            protects your personal data. By using our services, you agree to the
            practices described in this policy.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold">1. Data We Collect</h2>

          {/* green bullets */}
          <ul className="mt-3 space-y-2 ml-6">
            <GreenBullet>
              <span className="font-medium text-foreground">Account data</span>{" "}
              <span className="text-muted-foreground">
                – such as your email address and profile information.
              </span>
            </GreenBullet>

            <GreenBullet>
              <span className="font-medium text-foreground">Billing data</span>{" "}
              <span className="text-muted-foreground">
                – processed securely by Stripe for subscription payments.
              </span>
            </GreenBullet>

            <GreenBullet>
              <span className="font-medium text-foreground">Usage data</span>{" "}
              <span className="text-muted-foreground">
                – like your login activity and basic analytics logs.
              </span>
            </GreenBullet>
          </ul>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold">2. How We Use Data</h2>

          <ul className="mt-3 space-y-2 pl-6">
            <GreenBullet>
              <span className="text-muted-foreground">
                Provide, maintain, and improve our services.
              </span>
            </GreenBullet>
            <GreenBullet>
              <span className="text-muted-foreground">
                Authenticate users and manage accounts.
              </span>
            </GreenBullet>
            <GreenBullet>
              <span className="text-muted-foreground">
                Process payments and prevent fraud.
              </span>
            </GreenBullet>
            <GreenBullet>
              <span className="text-muted-foreground">
                Provide customer support and communicate about your account.
              </span>
            </GreenBullet>
            <GreenBullet>
              <span className="text-muted-foreground">
                Comply with legal obligations and enforce our Terms.
              </span>
            </GreenBullet>
          </ul>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold">3. Data Processors</h2>
          <p className="text-muted-foreground">
            We use trusted third parties to process data on our behalf—Stripe
            for payments, and Supabase for authentication and database services.
            Each provider maintains its own robust security standards.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold">4. Your Rights</h2>
          <p className="text-muted-foreground">
            You have the right to access, correct, or delete your personal data.
            To submit a request or exercise any rights under applicable law,
            please contact us via the{" "}
            <Link
              href="/support"
              className="text-primary underline-offset-4 hover:underline"
            >
              Support page
            </Link>
            .
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold">5. Contact</h2>
          <p className="text-muted-foreground">
            If you have any questions about this policy, please reach out to us
            through the{" "}
            <Link
              href="/support"
              className="text-primary underline-offset-4 hover:underline"
            >
              Support page
            </Link>
            .
          </p>
        </section>
      </div>
    </div>
  );
}

function GreenBullet({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex gap-3">
      {/* green bullet */}
      <DotIcon className="mt-1 h-5 w-5 shrink-0 text-primary" />
      <div className="leading-6">{children}</div>
    </li>
  );
}
