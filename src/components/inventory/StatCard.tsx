import Link from "next/link";

type Props = {
  label: string;
  value: number | string;
  href?: string;
};

export function StatCard({ label, value, href }: Props) {
  const inner = (
    <>
      <div className="text-xs uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="text-2xl font-semibold">{value}</div>
    </>
  );

  if (href) {
    return (
      <Link
        href={href}
        prefetch={false}
        className="block rounded-xl border bg-gradient-to-br from-muted/40 to-muted p-4 transition hover:-translate-y-0.5 hover:shadow-sm hover:ring-1 hover:ring-primary/20"
      >
        {inner}
      </Link>
    );
  }

  return (
    <div className="rounded-xl border bg-gradient-to-br from-muted/40 to-muted p-4">
      {inner}
    </div>
  );
}
