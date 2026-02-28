"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type ResetPasswordLabels = {
  title: string;
  subtitle: string;
  passwordLabel: string;
  confirmLabel: string;
  submit: string;
  successTitle: string;
  successDescription: string;
  errorTitle: string;
  errorDescription: string;
  tokenErrorTitle: string;
  tokenErrorDescription: string;
};

export function ResetPasswordForm({ labels }: { labels: ResetPasswordLabels }) {
  const searchParams = useSearchParams();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [status, setStatus] = useState<
    "idle" | "success" | "error" | "token-missing"
  >("idle");
  const [loading, setLoading] = useState(false);

  const tokens = useMemo(() => {
    if (typeof window === "undefined") return null;
    const hash = window.location.hash.startsWith("#")
      ? window.location.hash.slice(1)
      : window.location.hash;
    const params = new URLSearchParams(hash);
    const accessToken = params.get("access_token");
    const type = params.get("type");
    return { accessToken, type };
  }, [searchParams]);

  useEffect(() => {
    if (!tokens?.accessToken || tokens.type !== "recovery") {
      setStatus("token-missing");
    } else {
      setStatus("idle");
    }
  }, [tokens]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!tokens?.accessToken || tokens.type !== "recovery") {
      setStatus("token-missing");
      return;
    }
    if (!password || password !== confirm) {
      setStatus("error");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accessToken: tokens.accessToken, password }),
      });
      if (!res.ok) throw new Error("Reset failed");
      setStatus("success");
    } catch (err) {
      setStatus("error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="grid gap-4">
      <div>
        <h1 className="text-lg font-semibold leading-tight">{labels.title}</h1>
        <p className="text-sm text-muted-foreground">{labels.subtitle}</p>
      </div>

      {status === "success" && (
        <Alert>
          <AlertTitle>{labels.successTitle}</AlertTitle>
          <AlertDescription>{labels.successDescription}</AlertDescription>
        </Alert>
      )}

      {status === "error" && (
        <Alert variant="destructive">
          <AlertTitle>{labels.errorTitle}</AlertTitle>
          <AlertDescription>{labels.errorDescription}</AlertDescription>
        </Alert>
      )}

      {status === "token-missing" && (
        <Alert variant="destructive">
          <AlertTitle>{labels.tokenErrorTitle}</AlertTitle>
          <AlertDescription>{labels.tokenErrorDescription}</AlertDescription>
        </Alert>
      )}

      <form className="grid gap-3" onSubmit={onSubmit}>
        <div className="grid gap-2">
          <Label htmlFor="password">{labels.passwordLabel}</Label>
          <Input
            id="password"
            type="password"
            autoComplete="new-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="confirm">{labels.confirmLabel}</Label>
          <Input
            id="confirm"
            type="password"
            autoComplete="new-password"
            required
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
          />
        </div>
        <Button type="submit" disabled={loading} className="w-full">
          {loading ? `${labels.submit}…` : labels.submit}
        </Button>
      </form>
    </div>
  );
}
