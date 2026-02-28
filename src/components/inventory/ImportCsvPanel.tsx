"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import {
  parseInventoryCsv,
  type InventoryCsvRow,
} from "@/lib/inventory/csv-shared";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export function ImportCsvPanel({ householdId }: { householdId?: string }) {
  const router = useRouter();
  const [rows, setRows] = useState<InventoryCsvRow[]>([]);
  const [errors, setErrors] = useState<Array<{ row: number; message: string }>>([]);
  const [stats, setStats] = useState<{
    rows: number;
    uniqueLocations: number;
    uniqueRooms: number;
    uniqueContainers: number;
    uniqueItems: number;
  } | null>(null);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");

  const previewRows = useMemo(() => rows.slice(0, 10), [rows]);

  return (
    <div className="space-y-4">
      <Input
        type="file"
        accept=".csv,text/csv"
        onChange={async (event) => {
          const file = event.target.files?.[0];
          if (!file) return;
          const text = await file.text();
          const parsed = parseInventoryCsv(text);
          setRows(parsed.validRows);
          setErrors(parsed.errors);
          setStats(parsed.stats);
          setMessage("");
        }}
      />

      {stats ? (
        <div className="grid gap-2 rounded-md border p-3 text-sm sm:grid-cols-5">
          <div>Rows: {stats.rows}</div>
          <div>Locations: {stats.uniqueLocations}</div>
          <div>Rooms: {stats.uniqueRooms}</div>
          <div>Containers: {stats.uniqueContainers}</div>
          <div>Items: {stats.uniqueItems}</div>
        </div>
      ) : null}

      {errors.length ? (
        <div className="rounded-md border border-destructive/50 p-3 text-sm">
          <div className="font-medium text-destructive">Validation errors</div>
          <ul className="mt-2 list-disc pl-5">
            {errors.slice(0, 20).map((error, index) => (
              <li key={`${error.row}-${index}`}>
                Row {error.row}: {error.message}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {previewRows.length ? (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Location</TableHead>
                <TableHead>Room</TableHead>
                <TableHead>Container Path</TableHead>
                <TableHead>Item</TableHead>
                <TableHead>Qty</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {previewRows.map((row, index) => (
                <TableRow key={index}>
                  <TableCell>{row.location}</TableCell>
                  <TableCell>{row.room}</TableCell>
                  <TableCell>{row.containerPath}</TableCell>
                  <TableCell>{row.itemName}</TableCell>
                  <TableCell>{row.quantity}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      ) : null}

      <div className="flex items-center gap-2">
        <Button
          type="button"
          disabled={pending || rows.length === 0 || errors.length > 0}
          onClick={async () => {
            try {
              setPending(true);
              setMessage("");
              const response = await fetch("/api/import/commit", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ householdId, rows }),
              });

              const data = await response.json().catch(() => null);

              if (!response.ok) {
                throw new Error(data?.error || "Import failed");
              }

              setMessage(`Imported ${data?.result?.importedRows || rows.length} rows.`);
              router.refresh();
            } catch (error) {
              setMessage(error instanceof Error ? error.message : "Import failed");
            } finally {
              setPending(false);
            }
          }}
        >
          {pending ? "Importing..." : "Commit import"}
        </Button>
        {message ? <div className="text-sm text-muted-foreground">{message}</div> : null}
      </div>
    </div>
  );
}