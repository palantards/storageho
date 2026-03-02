"use client";

import { useI18n } from "@/components/i18n/I18nProvider";

import { StatsSection } from "./sections/StatsSection";
import { UserList } from "./sections/UserList";
import { AdminStats, UserWithProfileAndSubscription } from "@/lib/admin/users";

import { AdminSupportAndTickets } from "./sections/AdminSupportSection";

export type Feature = { title: string; desc: string };

export function AdminDashboard({
  adminStats,
  users,
}: {
  adminStats: AdminStats;
  users: UserWithProfileAndSubscription[];
}) {
  const { t, m } = useI18n();

  return (
    <div className="w-full max-w-6xl mx-auto px-4 py-8 space-y-12">
      <div>
        <h2 className="text-2xl font-semibold mb-4">📊 Stats Overview</h2>
        <StatsSection adminStats={adminStats} />
      </div>

      <div>
        <h2 className="text-2xl font-semibold mb-4">👥 User Management</h2>
        <UserList initialUsers={users} />
      </div>
      <div>
        <h2 className="text-2xl font-semibold mb-4">🎫 Tickets</h2>
        <AdminSupportAndTickets />
      </div>
    </div>
  );
}

