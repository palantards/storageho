import { redirect } from "next/navigation";
import { defaultLocale } from "@/i18n/config";
import { SpeedInsights } from "@vercel/speed-insights/next";

export default function RootPage() {
  redirect(`/${defaultLocale}`);
}
