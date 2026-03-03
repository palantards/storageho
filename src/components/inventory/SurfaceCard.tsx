import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

type SurfaceVariant = "hero" | "muted" | "neutral" | "danger";

type Props = React.ComponentProps<typeof Card> & {
  variant?: SurfaceVariant;
};

const base =
  "rounded-2xl border px-4 py-3 md:px-6 md:py-5 bg-background/90 shadow-[0_1px_0_rgba(0,0,0,0.04)]";

const variantClass: Record<SurfaceVariant, string> = {
  hero:
    "border-primary/25 bg-gradient-to-br from-primary/8 via-background to-background",
  muted: "border-muted/70 bg-background/80",
  neutral: "border-border/60 bg-background/90",
  danger: "border-destructive/30 bg-destructive/5",
};

export function SurfaceCard({ variant = "neutral", className, ...rest }: Props) {
  return <Card className={cn(base, variantClass[variant], className)} {...rest} />;
}
