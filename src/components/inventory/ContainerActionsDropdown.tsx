"use client";

import Link from "next/link";
import { MoreHorizontal } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

type Props = {
  containerId: string;
  mapHref: string;
  isArchived: boolean;
  archiveAction: (formData: FormData) => Promise<void> | void;
  deleteAction: (formData: FormData) => Promise<void> | void;
};

export function ContainerActionsDropdown({
  containerId,
  mapHref,
  isArchived,
  archiveAction,
  deleteAction,
}: Props) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button type="button" variant="ghost" size="sm" className="h-8 w-8 p-0">
          <MoreHorizontal className="h-4 w-4" />
          <span className="sr-only">More actions</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem asChild>
          <Link href={mapHref}>Show on map</Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <form action={archiveAction}>
            <input type="hidden" name="containerId" value={containerId} />
            <input type="hidden" name="archived" value={isArchived ? "0" : "1"} />
            <button type="submit" className="w-full text-left">
              {isArchived ? "Restore" : "Archive"}
            </button>
          </form>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <form action={deleteAction}>
            <input type="hidden" name="containerId" value={containerId} />
            <button type="submit" className="w-full text-left text-destructive focus:text-destructive">
              Delete
            </button>
          </form>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
