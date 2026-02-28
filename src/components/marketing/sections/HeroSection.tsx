"use client";

import Image from "next/image";
import Link from "next/link";
import type { Locale } from "@/i18n/config";
import { localizedHref } from "@/i18n/routing";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { icons } from "@/lib/icons";

export function HeroSection({
  locale,
  primaryHref,
  t,
}: {
  locale: Locale;
  primaryHref: string;
  t: (key: string, vars?: Record<string, string | number>) => string;
}) {
  return (
    <section className="relative bg-gradient-to-b from-background via-background to-muted">
      <div className="mx-auto max-w-6xl px-4 py-16 md:py-24">
        <div className="grid gap-10 md:grid-cols-2 md:items-center">
          <div className="space-y-6">
            <Badge variant="outline" className="w-fit">
              {t("landing.trust.c")}
            </Badge>

            <h1 className="text-balance text-4xl font-semibold leading-tight tracking-tight md:text-5xl">
              {t("landing.hero.title")}
            </h1>
            <p className="text-pretty text-base text-muted-foreground md:text-lg">
              {t("landing.hero.subtitle")}
            </p>

            <div className="flex flex-col gap-2 sm:flex-row">
              <Button asChild>
                <Link href={primaryHref}>
                  {t("landing.hero.primary")}{" "}
                  <icons.ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
              <Button asChild variant="secondary">
                <Link href={localizedHref(locale, "#features")}>
                  {t("landing.hero.secondary")}
                </Link>
              </Button>
            </div>

            <div className="grid gap-3 pt-4 sm:grid-cols-3">
              <TrustItem
                icon={icons.ShieldCheck}
                label={t("landing.trust.a")}
              />
              <TrustItem icon={icons.Sparkles} label={t("landing.trust.b")} />
              <TrustItem
                icon={icons.CheckCircle2}
                label={t("landing.trust.c")}
              />
            </div>
          </div>

          <div className="relative">
            <div className="pointer-events-none absolute -left-8 -top-8 h-48 w-48 rounded-full bg-primary/15 blur-2xl" />
            <div className="pointer-events-none absolute -bottom-8 -right-8 h-44 w-44 rounded-full bg-accent/35 blur-2xl" />
            <div className="relative overflow-hidden rounded-[var(--radius-lg)] border border-border/70 bg-card shadow-md ring-1 ring-foreground/5">
              <Image
                src="/illustrations/storageho-workflow.svg"
                alt={t("landing.preview.imageAlt")}
                width={1360}
                height={900}
                priority
                className="h-auto w-full"
              />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function TrustItem({
  icon: Icon,
  label,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
}) {
  return (
    <div className="flex items-center gap-2 text-sm text-muted-foreground">
      <Icon className="h-4 w-4" />
      {label}
    </div>
  );
}
