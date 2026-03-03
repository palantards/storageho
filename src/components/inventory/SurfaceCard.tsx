import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

type SurfaceVariant = "hero" | "muted" | "neutral" | "danger";

type Props = React.ComponentProps<typeof Card> & {
  variant?: SurfaceVariant;
};

const base =
  "transition hover:shadow-md hover:-translate-y-[1px] border";

const variantClass: Record<SurfaceVariant, string> = {
  hero: "border-primary/15 bg-gradient-to-br from-primary/10 via-background to-background hover:shadow-lg",
  muted: "border-muted bg-muted/40",
  neutral: "border-border/70 bg-background",
  danger: "border-destructive/30",
};

export function SurfaceCard({ variant = "neutral", className, ...rest }: Props) {
  return <Card className={cn(base, variantClass[variant], className)} {...rest} />;
}
