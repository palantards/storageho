"use client";

import * as React from "react";
import type { Locale } from "@/i18n/config";
import type { Messages } from "@/i18n/getMessages";
import { getByPath, interpolate } from "@/i18n/translate";

type Vars = Record<string, string | number>;

type I18nContextValue = {
  locale: Locale;
  messages: Messages;
  t: (key: string, vars?: Vars) => string;
  /** Returns the raw message value at a path (e.g. arrays/objects). */
  m: <T = unknown>(key: string) => T | undefined;
};

const I18nContext = React.createContext<I18nContextValue | null>(null);

export function I18nProvider({
  locale,
  messages,
  children,
}: {
  locale: Locale;
  messages: Messages;
  children: React.ReactNode;
}) {
  const m = React.useCallback(
    <T,>(key: string) => {
      const value = getByPath(messages, key);
      return value as T | undefined;
    },
    [messages],
  );

  const t = React.useCallback(
    (key: string, vars?: Vars) => {
      const value = getByPath(messages, key);
      if (typeof value === "string") return interpolate(value, vars);
      return key;
    },
    [messages],
  );

  const value = React.useMemo(
    () => ({ locale, messages, t, m }),
    [locale, messages, t, m],
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  const ctx = React.useContext(I18nContext);
  if (!ctx) throw new Error("useI18n must be used within I18nProvider");
  return ctx;
}
