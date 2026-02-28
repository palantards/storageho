// file: src/app/[locale]/(app)/admin/page.tsx
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import type { Locale } from "@/i18n/config";
import { t as tt } from "@/i18n/translate";
import { getMessages } from "@/i18n/getMessages";
import { getAdminStats, getUsers } from "@/lib/admin/users";
import { AdminDashboard } from "@/components/admin/AdminDashboard";
import { requireAdmin } from "@/lib/admin/requireAdmin";

export default async function AdminDashboardPage({
  params,
}: {
  params: { locale: Locale };
}) {
  const { locale } = params;
  const messages = await getMessages(locale);
  const t = (key: string) => tt(messages, key);
  const guard = await requireAdmin();
  if (!guard.ok) throw new Error("Forbidden");

  const adminStats = await getAdminStats();
  const users = await getUsers({ offset: 0, limit: 30 });
  return <AdminDashboard adminStats={adminStats} users={users} />;
}
