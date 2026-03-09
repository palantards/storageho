type TagChip = {
  id: string;
  name: string;
  color?: string | null;
};

export function TagChips({ tags }: { tags: TagChip[] }) {
  if (!tags.length) return null;
  return (
    <div className="flex flex-wrap gap-2">
      {tags.map((tag) => (
        <span
          key={tag.id}
          className={`rounded border px-2 py-1 text-xs ${!tag.color ? "bg-muted/60" : ""}`}
          style={{
            color: tag.color || undefined,
            backgroundColor: tag.color ? tag.color + "15" : undefined,
          }}
        >
          {tag.name}
        </span>
      ))}
    </div>
  );
}
