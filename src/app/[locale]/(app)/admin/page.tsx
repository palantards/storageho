// file: src/app/[locale]/(app)/admin/page.tsx
import type { Locale } from "@/i18n/config";
import { getAdminStats, getUsers } from "@/lib/admin/users";
import { AdminDashboard } from "@/components/admin/AdminDashboard";
import { requireAdmin } from "@/lib/admin/requireAdmin";

export default async function AdminDashboardPage({
  params,
}: {
  params: { locale: Locale };
}) {
  void params;
  const guard = await requireAdmin();
  if (!guard.ok) throw new Error("Forbidden");

  const adminStats = await getAdminStats();
  const users = await getUsers({ offset: 0, limit: 30 });
  return <AdminDashboard adminStats={adminStats} users={users} />;
}
