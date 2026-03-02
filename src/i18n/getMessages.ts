import type { Locale } from "@/i18n/config";

export type Messages = Record<string, unknown>;

export async function getMessages(locale: Locale): Promise<Messages> {
  switch (locale) {
    case "sv":
      return (await import("@/i18n/messages/sv.json")).default as Messages;
    case "en":
    default:
      return (await import("@/i18n/messages/en.json")).default as Messages;
  }
}

