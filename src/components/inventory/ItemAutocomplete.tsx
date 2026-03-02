"use client";

import * as React from "react";
import { Check, ChevronsUpDown } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

type ItemOption = { id: string; name: string };

type Props = {
  name?: string; // name for hidden input
  items: ItemOption[];
  placeholder?: string;
  label?: string;
};

export function ItemAutocomplete({
  name = "item",
  items,
  placeholder = "Search or type",
}: Props) {
  const [open, setOpen] = React.useState(false);
  const [value, setValue] = React.useState("");

  const display =
    items.find((item) => item.name.toLowerCase() === value.toLowerCase())?.name || value;

  return (
    <div className="grid gap-1.5">
      <input type="hidden" name={name} value={value} />
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className="w-full justify-between"
          >
            <span className={cn("truncate", !display && "text-muted-foreground")}>
              {display || placeholder}
            </span>
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[var(--trigger-width,260px)] p-0" align="start">
          <Command shouldFilter={false}>
            <CommandInput
              placeholder={placeholder}
              value={display}
              onValueChange={(val) => setValue(val)}
            />
            <CommandList>
              <CommandEmpty>No matches. Add as new item.</CommandEmpty>
              <CommandGroup heading="Existing items">
                {items.map((item) => {
                  const selected = value.toLowerCase() === item.name.toLowerCase();
                  return (
                    <CommandItem
                      key={item.id}
                      value={item.name}
                      onSelect={(val) => {
                        setValue(val);
                        setOpen(false);
                      }}
                    >
                      <Check
                        className={cn(
                          "mr-2 h-4 w-4",
                          selected ? "opacity-100" : "opacity-0",
                        )}
                      />
                      <span className="truncate">{item.name}</span>
                    </CommandItem>
                  );
                })}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </div>
  );
}
