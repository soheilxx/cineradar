'use client';

import { lazy, Suspense, type ComponentProps } from 'react';
import { CatalogPending } from './loading-feedback';

const IdentifyExperience = lazy(() =>
  import('./identify-experience').then((module) => ({
    default: module.IdentifyExperience,
  })),
);

export function IdentifyLoader(
  props: ComponentProps<typeof IdentifyExperience>,
) {
  return (
    <Suspense
      fallback={<CatalogPending locale={props.locale} variant="identify" />}
    >
      <IdentifyExperience {...props} />
    </Suspense>
  );
}
