"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AdminStats } from "@/lib/admin/users";

export function StatsSection({ adminStats }: { adminStats: AdminStats }) {
  const {
    totalUserCount,
    payingCount,
    freeCount,
    monthlyRevenue,
    newTickets7d,
    openTickets,
  } = adminStats;

  return (
    <div className="grid gap-6 md:grid-cols-3">
      <Card>
        <CardHeader>
          <CardTitle>Members</CardTitle>
        </CardHeader>
        <CardContent className="space-y-1 text-sm">
          <p>
            Total users: <b>{totalUserCount}</b>
          </p>
          <p>
            Subscribed (paid): <b>{payingCount}</b>
          </p>
          <p>
            Free (no subscription): <b>{freeCount}</b>
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Monthly Revenue</CardTitle>
        </CardHeader>
        <CardContent className="space-y-1 text-sm">
          <p>
            Current MRR: <b>${monthlyRevenue}</b> / month
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Tickets</CardTitle>
          {newTickets7d > 0 ? (
            <Badge variant="destructive">{newTickets7d} new</Badge>
          ) : (
            <Badge variant="secondary">No new</Badge>
          )}
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <div className="flex items-center justify-between">
            <span>New (last 7 days)</span>
            <b>{newTickets7d}</b>
          </div>
          <div className="flex items-center justify-between">
            <span>Open tickets</span>
            <b>{openTickets}</b>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
