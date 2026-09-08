'use client';
import { useState, useEffect, useRef } from 'react';
import { Film } from 'lucide-react';
import { imageVariant, imageSet } from '@/domain/artwork';
import type { StoredArtwork } from '@/domain/media';
export function Artwork({
  src,
  artwork,
  alt,
  width,
  height,
  className,
  loading,
  priority = false,
}: {
  src: string | null;
  artwork?: StoredArtwork;
  alt: string;
  width: number | string;
  height: number | string;
  className?: string;
  loading?: 'eager' | 'lazy';
  priority?: boolean;
  decoding?: 'async' | 'sync' | 'auto';
}) {
  const [failedSource, setFailedSource] = useState<string | null>(null);
  const element = useRef<HTMLImageElement>(null);
  useEffect(() => {
    // A cached/network error can fire before React attaches its event listener.
    const img = element.current;
    if (img?.complete && img.naturalWidth === 0) setFailedSource(src);
  }, [src]);
  if (!src || failedSource === src)
    return (
      <div
        className={'artwork-fallback ' + (className || '')}
        role={alt ? 'img' : undefined}
        aria-label={alt || undefined}
        style={{ aspectRatio: `${width}/${height}` }}
      >
        <Film size={32} />
        {alt && <span>{alt}</span>}
      </div>
    );
  return (
    <img
      key={src}
      ref={element}
      src={imageVariant(src, 342, artwork)}
      srcSet={imageSet(src, [185, 342, 500], artwork)}
      sizes="(max-width:700px) 44vw, (max-width:1200px) 22vw, 190px"
      alt={alt}
      width={width}
      height={height}
      className={className}
      loading={loading}
      fetchPriority={priority ? 'high' : undefined}
      decoding="async"
      onError={() => setFailedSource(src)}
    />
  );
}
