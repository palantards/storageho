"use client";

import Link from "next/link";

import {
  getPlanDescription,
  getPlanLabel,
  getPlanPrice,
  getPriceIdForPlan,
  planDefinitions,
} from "@/config/billing";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import { icons } from "@/lib/icons";
import { useI18n } from "@/components/i18n/I18nProvider";

export function PricingSection({ primaryHref }: { primaryHref: string }) {
  const { t, m } = useI18n();

  return (
    <section id="pricing" className="bg-gradient-to-b from-muted to-primary/10">
      <div className="mx-auto max-w-6xl px-4 py-16">
        <div className="mb-8 text-center">
          <h2 className="text-2xl font-semibold tracking-tight">
            {t("pricing.title")}
          </h2>
          <p className="mt-2 text-muted-foreground">{t("pricing.subtitle")}</p>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          {planDefinitions.map((plan) => {
            const label = getPlanLabel(plan, t);
            const price = getPlanPrice(plan, t);
            const desc = getPlanDescription(plan, t);
            const priceId = getPriceIdForPlan(plan.id);
            const missingPrice = !priceId;
            const isHighlight = Boolean(plan.highlight);

            const featureKey = plan.featuresKey; // <-- single key
            const featureKeys = featureKey
              ? (m<string[]>(featureKey) ?? [])
              : [];

            return (
              <Card key={plan.id} className="flex h-full flex-col">
                <CardHeader>
                  <CardTitle className="flex items-baseline justify-between">
                    <span>{label}</span>
                    <span className="text-2xl font-semibold">{price}</span>
                  </CardTitle>
                  <CardDescription>{desc}</CardDescription>
                </CardHeader>

                <CardContent className="flex flex-1 flex-col">
                  <ul className="space-y-2 text-sm text-muted-foreground">
                    {featureKeys.map((fk) => (
                      <li key={fk} className="flex gap-2">
                        <icons.CheckCircle2 className="mt-0.5 h-4 w-4 text-primary" />
                        <span>{t(fk)}</span>
                      </li>
                    ))}
                  </ul>

                  <div className="mt-auto pt-4">
                    <Button
                      asChild
                      className="w-full"
                      variant={isHighlight ? "default" : "secondary"}
                      disabled={missingPrice}
                      title={
                        missingPrice ? t("pricing.missingPrice") : undefined
                      }
                    >
                      <Link href={primaryHref}>{t("pricing.cta")}</Link>
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
    </section>
  );
}
