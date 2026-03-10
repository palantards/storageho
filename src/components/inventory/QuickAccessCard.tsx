import Link from "next/link";

type QuickAccessCardProps = {
  href: string;
  icon: React.ReactNode;
  title: string;
  description: string;
};

export function QuickAccessCard({ href, icon, title, description }: QuickAccessCardProps) {
  return (
    <Link
      href={href}
      className="group flex flex-col gap-2 rounded-xl border bg-card p-4 transition hover:-translate-y-0.5 hover:shadow-sm hover:ring-1 hover:ring-primary/20"
    >
      <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-muted text-muted-foreground transition-colors group-hover:text-primary">
        {icon}
      </div>
      <div>
        <div className="text-sm font-semibold">{title}</div>
        <div className="text-xs text-muted-foreground">{description}</div>
      </div>
    </Link>
  );
}
