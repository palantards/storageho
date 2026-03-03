"use client";

import { StatsSection } from "./sections/StatsSection";
import { UserList } from "./sections/UserList";
import { AdminSupportAndTickets } from "./sections/AdminSupportSection";
import { AdminStats, UserWithProfileAndSubscription } from "@/lib/admin/users";

export type Feature = { title: string; desc: string };

export function AdminDashboard({
  adminStats,
  users,
}: {
  adminStats: AdminStats;
  users: UserWithProfileAndSubscription[];
}) {
  return (
    <div className="mx-auto w-full max-w-6xl space-y-12 px-4 py-8">
      <div>
        <h2 className="mb-4 text-2xl font-semibold">Stats Overview</h2>
        <StatsSection adminStats={adminStats} />
      </div>

      <div>
        <h2 className="mb-4 text-2xl font-semibold">User Management</h2>
        <UserList initialUsers={users} />
      </div>

      <div>
        <h2 className="mb-4 text-2xl font-semibold">Tickets</h2>
        <AdminSupportAndTickets />
      </div>
    </div>
  );
}
