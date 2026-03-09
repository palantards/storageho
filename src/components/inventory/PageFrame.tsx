import { cn } from "@/lib/utils";

type PageFrameProps = {
  children: React.ReactNode;
  className?: string;
  padded?: boolean;
  header?: React.ReactNode;
};

/**
 * PageFrame is a single outer wrapper for logged-in views.
 * Use SectionDivider inside instead of nested cards.
 */
export function PageFrame({ children, className, padded = true, header }: PageFrameProps) {
  return (
    <div
      className={cn(
        "animate-in fade-in-0 rounded-2xl bg-background/90 duration-200",
        padded ? "px-4 py-4 md:px-6 md:py-5" : "",
        className,
      )}
    >
      {header}
      {children}
    </div>
  );
}
