import { cn } from "@/lib/utils";

export type GalleryPhoto = { id: string; storageKey: string; label: string; meta?: string };

/** Evidence thumbnails served through the authorised storage route; each opens full size in a new tab. */
export function PhotoGallery({ photos, className }: { photos: GalleryPhoto[]; className?: string }) {
  if (!photos.length) return null;
  return (
    <ul className={cn("grid grid-cols-2 gap-3 sm:grid-cols-3", className)}>
      {photos.map((p) => (
        <li key={p.id}>
          <a
            href={`/api/storage/${p.storageKey}`}
            target="_blank"
            rel="noreferrer"
            className="group block overflow-hidden rounded-lg border border-line bg-surface-sunken focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
          >
            {/* eslint-disable-next-line @next/next/no-img-element -- private files behind the RBAC route, not optimisable by next/image */}
            <img src={`/api/storage/${p.storageKey}`} alt={p.label} loading="lazy" className="aspect-[4/3] w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]" />
          </a>
          <p className="mt-1 truncate text-caption text-fg">{p.label}</p>
          {p.meta ? <p className="truncate text-caption text-fg-subtle">{p.meta}</p> : null}
        </li>
      ))}
    </ul>
  );
}
