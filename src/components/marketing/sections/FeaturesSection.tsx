"use client";

import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import type { Feature } from "../LandingContent";

export function FeaturesSection({
  features,
  t,
}: {
  features: Feature[];
  t: (key: string, vars?: Record<string, string | number>) => string;
}) {
  return (
    <section id="features" className="bg-muted">
      <div className="mx-auto max-w-6xl px-4 py-16">
        <div className="mb-8 text-center">
          <h2 className="text-2xl font-semibold tracking-tight">
            {t("features.title")}
          </h2>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {features.map((f, i) => (
            <Card
              key={i}
              className="bg-card/90 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
            >
              <CardHeader>
                <CardTitle className="text-base">{f.title}</CardTitle>
                <CardDescription>{f.desc}</CardDescription>
              </CardHeader>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
}

