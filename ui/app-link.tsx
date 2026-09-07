import Link from 'next/link';
import type { ComponentProps } from 'react';

// Internal navigation keeps the current document alive so click events can
// finish sending. Large catalog grids must not prefetch every title page.
export function AppLink({ href, children, ...props }: ComponentProps<'a'>) {
  const internal =
    href &&
    ((href.startsWith('/') && !href.startsWith('//')) ||
      href.startsWith('?')) &&
    !/^\/api(?:\/|$)/.test(href);
  if (internal && !props.download)
    return (
      <Link {...props} href={href} prefetch={false}>
        {children}
      </Link>
    );
  return (
    <a {...props} href={href}>
      {children}
    </a>
  );
}
