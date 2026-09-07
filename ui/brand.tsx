import { AppLink } from './app-link';
export function Brand({ href = '/' }: { href?: string }) {
  return (
    <AppLink href={href} className="brand" aria-label="Cineradar">
      <svg
        width="32"
        height="32"
        viewBox="0 0 32 32"
        fill="none"
        aria-hidden="true"
      >
        <path
          d="M26 11A12 12 0 1 0 26 22"
          stroke="currentColor"
          strokeWidth="2.6"
          strokeLinecap="round"
        />
        <path
          d="M21 12a6.7 6.7 0 1 0 0 10"
          stroke="currentColor"
          strokeWidth="2.6"
          strokeLinecap="round"
        />
        <path d="m15 11 10 6-10 6z" fill="currentColor" />
      </svg>
      <span>
        cine<span className="gold">radar</span>
      </span>
    </AppLink>
  );
}
