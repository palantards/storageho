"use client";

import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export function CtaSection({
  primaryHref,
  t,
}: {
  primaryHref: string;
  t: (key: string, vars?: Record<string, string | number>) => string;
}) {
  return (
    <section className="bg-gradient-to-b from-primary/10 to-background">
      <div className="mx-auto max-w-6xl px-4 py-16">
        <Card className="relative overflow-hidden border-border/50 shadow-sm">
          <div className="absolute inset-x-0 top-0 h-1 bg-primary" />

          <CardContent className="flex flex-col gap-6 p-6 md:flex-row md:items-center md:justify-between">
            <div>
              <h3 className="text-xl font-semibold tracking-tight">
                {t("landing.cta.title")}
              </h3>
              <p className="mt-2 text-muted-foreground">
                {t("landing.cta.subtitle")}
              </p>
            </div>

            <Button asChild>
              <Link href={primaryHref}>{t("landing.cta.button")}</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    </section>
  );
}
