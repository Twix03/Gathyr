/**
 * The server sends deadlines as remaining milliseconds ("deadline_ms") so clock
 * skew between devices never matters. On arrival we convert them to a local
 * performance.now() timestamp ("deadlineAt").
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function withDeadlines(value: any): any {
  if (Array.isArray(value)) return value.map(withDeadlines);
  if (value && typeof value === 'object') {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const out: any = {};
    for (const [k, v] of Object.entries(value)) {
      if (k === 'deadline_ms') {
        out.deadlineAt = typeof v === 'number' ? performance.now() + v : null;
      } else {
        out[k] = withDeadlines(v);
      }
    }
    return out;
  }
  return value;
}

export function msLeft(deadlineAt: number | null | undefined): number {
  return deadlineAt == null ? 0 : Math.max(0, deadlineAt - performance.now());
}
