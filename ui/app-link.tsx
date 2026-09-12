'use client';

import Link from 'next/link';
import { useState, type ComponentProps } from 'react';

// Internal navigation keeps the current document alive so click events can
// finish sending. Only user intent enables prefetching, so large catalog grids
// do not fetch every title page as they enter the viewport.
export function AppLink({
  href,
  children,
  onMouseEnter,
  onFocus,
  ...props
}: ComponentProps<'a'>) {
  const [intent, setIntent] = useState<string>();
  const internal =
    href &&
    ((href.startsWith('/') && !href.startsWith('//')) ||
      href.startsWith('?')) &&
    !/^\/api(?:\/|$)/.test(href);
  if (internal && !props.download)
    return (
      <Link
        {...props}
        href={href}
        prefetch={intent === href}
        onMouseEnter={(event) => {
          onMouseEnter?.(event);
          if (!event.defaultPrevented) setIntent(href);
        }}
        onFocus={(event) => {
          onFocus?.(event);
          if (!event.defaultPrevented) setIntent(href);
        }}
      >
        {children}
      </Link>
    );
  return (
    <a {...props} href={href} onMouseEnter={onMouseEnter} onFocus={onFocus}>
      {children}
    </a>
  );
}
