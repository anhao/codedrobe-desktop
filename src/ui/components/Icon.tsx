// SPDX-License-Identifier: MPL-2.0

import type { ReactNode } from 'react';

export type IconName = 'store' | 'wardrobe' | 'import' | 'restore' | 'play' | 'export' | 'delete' | 'spark' | 'monitor' | 'download' | 'refresh' | 'search' | 'close';

export function Icon({ name }: { name: IconName }) {
  const paths: Record<IconName, ReactNode> = {
    store: <><path d="M4 10h16l-1-5H5Z"/><path d="M5 10v10h14V10M9 20v-6h6v6"/><path d="M4 10c0 2 3 2 4 0 1 2 3 2 4 0 1 2 3 2 4 0 1 2 4 2 4 0"/></>,
    wardrobe: <><path d="M4 5.5A2.5 2.5 0 0 1 6.5 3h11A2.5 2.5 0 0 1 20 5.5V21H4Z"/><path d="M12 3v18M8.5 11.5h.01M15.5 11.5h.01"/></>,
    import: <><path d="M12 3v12m0 0 4-4m-4 4-4-4"/><path d="M5 18v3h14v-3"/></>,
    restore: <><path d="M4 8v5h5"/><path d="M5.6 16a8 8 0 1 0 .4-8L4 10"/></>,
    play: <><path d="m9 7 8 5-8 5Z"/><circle cx="12" cy="12" r="10"/></>,
    export: <><path d="M12 15V3m0 0 4 4m-4-4L8 7"/><path d="M5 14v7h14v-7"/></>,
    delete: <><path d="M4 7h16M9 7V4h6v3m3 0-1 14H7L6 7m4 4v6m4-6v6"/></>,
    spark: <><path d="m12 2 1.4 5.1L18 9l-4.6 1.9L12 16l-1.4-5.1L6 9l4.6-1.9Z"/><path d="m19 15 .7 2.3L22 18l-2.3.7L19 21l-.7-2.3L16 18l2.3-.7Z"/></>,
    monitor: <><rect x="3" y="4" width="18" height="13" rx="2"/><path d="M8 21h8m-4-4v4"/></>,
    download: <><path d="M12 3v12m0 0 4-4m-4 4-4-4"/><path d="M4 20h16"/></>,
    refresh: <><path d="M20 7v5h-5"/><path d="M18.4 16a8 8 0 1 1-.4-8l2 2"/></>,
    search: <><circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/></>,
    close: <><path d="m7 7 10 10M17 7 7 17"/></>,
  };
  return <svg viewBox="0 0 24 24" aria-hidden="true">{paths[name]}</svg>;
}
