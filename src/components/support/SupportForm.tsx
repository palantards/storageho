"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useI18n } from "../i18n/I18nProvider";

export default function SupportForm() {
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { t } = useI18n();
  async function onSubmit(formData: FormData) {
    setLoading(true);
    setError(null);

    const payload = {
      email: String(formData.get("email") || ""),
      subject: String(formData.get("subject") || ""),
      message: String(formData.get("message") || ""),
    };

    try {
      const res = await fetch("/api/support", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        throw new Error((await res.json()).error || "Request failed");
      }

      setDone(true);
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : "Unknown error";
      setError(message);
    } finally {
      setLoading(false);
    }
  }

  if (done) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Thank you</CardTitle>
          <CardDescription>{t("support.sent")}</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("support.sendMessage")}</CardTitle>
        <CardDescription>{t("support.responseTime")}</CardDescription>
      </CardHeader>
      <CardContent>
        <form action={onSubmit} className="space-y-4">
          <div className="space-y-1">
            <label className="text-sm font-medium">Email</label>
            <Input
              name="email"
              type="email"
              required
              placeholder="you@example.com"
            />
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium">
              {t("support.subject")}
            </label>
            <Input
              name="subject"
              required
              placeholder={t("support.yourQuestion")}
            />
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium">
              {t("support.message")}
            </label>
            <Textarea
              name="message"
              rows={6}
              required
              placeholder={t("support.describeIssue")}
            />
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <Button type="submit" className="mt-4 w-full" disabled={loading}>
            {loading ? "Sending…" : "Send"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

