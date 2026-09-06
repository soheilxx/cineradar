export function log(
  event: string,
  fields: Record<string, string | number | boolean> = {},
) {
  const allowed = [
    'kind',
    'id',
    'durationMs',
    'code',
    'count',
    'service',
    'units',
  ];
  console.log(
    JSON.stringify({
      event,
      at: new Date().toISOString(),
      ...Object.fromEntries(
        Object.entries(fields).filter(([key]) => allowed.includes(key)),
      ),
    }),
  );
}
