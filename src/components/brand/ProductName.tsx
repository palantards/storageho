import { brand } from "@/config/brand";

export function ProductName() {
  return <span className="font-semibold tracking-tight">{brand.name}</span>;
}

