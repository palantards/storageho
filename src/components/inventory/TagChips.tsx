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
          className="rounded border px-2 py-1 text-xs"
          style={{ color: tag.color || undefined }}
        >
          {tag.name}
        </span>
      ))}
    </div>
  );
}
