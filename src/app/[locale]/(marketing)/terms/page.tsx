import { brand } from "@/config/brand";

export default function TermsPage() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-4 md:py-16">
      <h1 className="text-balance text-4xl font-semibold leading-tight tracking-tight md:text-5xl text-center">
        Terms of Service
      </h1>
      <p className="mt-2 text-muted-foreground text-sm">
        Last updated: {new Date().toLocaleDateString()}
      </p>

      {/* Sections */}
      <div className="mt-10 space-y-8">
        <section>
          <h2 className="text-xl font-semibold">Overview</h2>
          <p className="mt-2 text-muted-foreground">
            These Terms of Service (“Terms”) govern your use of the {brand.name}{" "}
            platform. By accessing or using our services, you agree to these
            Terms.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold">1. Accounts</h2>
          <p className="mt-2 text-muted-foreground">
            You must provide a valid email address and accurate information when
            creating an account. You are responsible for all activities that
            occur under your account.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold">2. Subscription & Billing</h2>
          <p className="mt-2 text-muted-foreground">
            Our paid plans are billed in advance on a recurring basis. Billing
            is handled securely through Stripe. By subscribing to a paid plan,
            you authorize us to charge your payment method until you cancel.
          </p>
          <p className="mt-2 text-muted-foreground">
            You can cancel your subscription at any time through your account
            settings. We do not refund or credit partial months of service,
            except where required by law.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold">3. Acceptable Use</h2>
          <p className="mt-2 text-muted-foreground">
            You agree not to misuse the service. Prohibited activities include,
            but are not limited to, attempting unauthorized access, interfering
            with the service’s operations, or infringing upon the rights of
            others.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold">4. Termination</h2>
          <p className="mt-2 text-muted-foreground">
            We reserve the right to suspend or terminate your access if you
            violate these Terms. Upon termination, your right to use the service
            will immediately cease. We may retain any data collected as required
            by law.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold">5. Liability & Warranty</h2>
          <p className="mt-2 text-muted-foreground">
            {brand.name} is provided “as is” and without warranties of any kind.
            We make no guarantees regarding uptime, reliability, or
            availability. Our liability is limited to the maximum extent
            permitted by law.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold">6. Changes to These Terms</h2>
          <p className="mt-2 text-muted-foreground">
            We may modify these Terms at any time. We will provide notice
            through the service when material changes occur. Continued use after
            the changes become effective constitutes acceptance of the revised
            Terms.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold">7. Contact</h2>
          <p className="mt-2 text-muted-foreground">
            Questions about these Terms? Please contact us via the Support page.
          </p>
        </section>
      </div>
    </div>
  );
}
