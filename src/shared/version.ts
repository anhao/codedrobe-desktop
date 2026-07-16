// SPDX-License-Identifier: MPL-2.0

export function normalizeVersion(value: string): string {
  return value.trim().replace(/^v/i, '').split('+')[0];
}

function versionParts(value: string): Array<number | string> {
  const [core, pre = ''] = normalizeVersion(value).split('-', 2);
  const parts: Array<number | string> = core.split('.').map((part) => Number.parseInt(part, 10) || 0);
  if (pre) parts.push(-1, ...pre.split('.').map((part) => /^\d+$/.test(part) ? Number(part) : part));
  return parts;
}

export function compareVersions(left: string, right: string): number {
  const a = versionParts(left);
  const b = versionParts(right);
  const length = Math.max(a.length, b.length);
  for (let index = 0; index < length; index += 1) {
    const av = a[index] ?? (index < 3 ? 0 : Number.POSITIVE_INFINITY);
    const bv = b[index] ?? (index < 3 ? 0 : Number.POSITIVE_INFINITY);
    if (av === bv) continue;
    if (typeof av === 'number' && typeof bv === 'number') return av > bv ? 1 : -1;
    return String(av).localeCompare(String(bv));
  }
  return 0;
}
