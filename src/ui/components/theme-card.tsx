// SPDX-License-Identifier: MPL-2.0

import { FavouriteIcon, PaintBoardIcon } from '@hugeicons/core-free-icons';
import type { UiMessages } from '@shared/i18n';
import type { AppId, InstalledTheme, MarketplaceTheme } from '@shared/types';
import { AppMark } from '@/components/app-mark';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { HugeIcon } from '@/components/ui/huge-icon';
import { cn } from '@/lib/utils';

function AppDots({ apps }: { apps: AppId[] }) {
  if (apps.length === 0) return null;
  return (
    <span className="ml-auto flex items-center gap-1">
      {apps.map((app) => (
        <AppMark key={app} appId={app} size={16} />
      ))}
    </span>
  );
}

function CardShell({
  selected,
  onSelect,
  cover,
  children,
}: {
  selected: boolean;
  onSelect: () => void;
  cover: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        'group flex w-full flex-col overflow-hidden rounded-xl border bg-card text-left transition-colors outline-none',
        'hover:border-primary/40 focus-visible:ring-2 focus-visible:ring-ring',
        selected && 'border-primary ring-2 ring-primary/30',
      )}
    >
      <div className="relative aspect-[1.7/1] w-full overflow-hidden bg-muted">{cover}</div>
      <div className="flex flex-col gap-1.5 p-3">{children}</div>
    </button>
  );
}

function CoverImage({ src, alt }: { src: string | null; alt: string }) {
  if (!src) {
    return (
      <div className="flex size-full items-center justify-center bg-gradient-to-br from-primary/10 via-muted to-accent text-muted-foreground">
        <HugeIcon icon={PaintBoardIcon} className="size-7 opacity-50" />
      </div>
    );
  }
  return (
    <img
      src={src}
      alt={alt}
      loading="lazy"
      className="size-full object-cover transition-transform duration-200 group-hover:scale-[1.02]"
    />
  );
}

export function StoreThemeCard({
  theme,
  locale,
  selected,
  installed,
  active,
  t,
  onSelect,
}: {
  theme: MarketplaceTheme;
  locale: 'zh-CN' | 'en';
  selected: boolean;
  installed: boolean;
  active: boolean;
  t: UiMessages;
  onSelect: () => void;
}) {
  const name = locale === 'zh-CN' ? theme.name.zh || theme.name.en : theme.name.en || theme.name.zh;
  return (
    <CardShell selected={selected} onSelect={onSelect} cover={<CoverImage src={theme.coverUrl ?? theme.previewUrl} alt={name} />}>
      <div className="flex items-start justify-between gap-2">
        <h3 className="min-w-0 truncate text-sm font-semibold tracking-[-0.01em]">{name}</h3>
        {active ? (
          <Badge className="shrink-0">{t.activeBadge}</Badge>
        ) : installed ? (
          <Badge variant="secondary" className="shrink-0">{t.installedBadge}</Badge>
        ) : null}
      </div>
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        {theme.author && (
          <span className="flex min-w-0 items-center gap-1.5">
            <Avatar size="sm" className="size-4">
              {theme.author.avatarUrl ? <AvatarImage src={theme.author.avatarUrl} alt="" /> : null}
              <AvatarFallback className="text-[9px]">
                {theme.author.displayName.slice(0, 1).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <span className="truncate">{theme.author.displayName}</span>
          </span>
        )}
        <span className={cn('inline-flex shrink-0 items-center gap-0.5', theme.likedByMe && 'text-primary')}>
          <HugeIcon icon={FavouriteIcon} className="size-3.5" />
          {theme.likeCount}
        </span>
        <AppDots apps={theme.supportedApps} />
      </div>
    </CardShell>
  );
}

export function InstalledThemeCard({
  theme,
  selected,
  active,
  t,
  onSelect,
}: {
  theme: InstalledTheme;
  selected: boolean;
  active: boolean;
  t: UiMessages;
  onSelect: () => void;
}) {
  return (
    <CardShell selected={selected} onSelect={onSelect} cover={<CoverImage src={theme.coverDataUrl} alt={theme.displayName} />}>
      <div className="flex items-start justify-between gap-2">
        <h3 className="min-w-0 truncate text-sm font-semibold tracking-[-0.01em]">{theme.displayName}</h3>
        {active && <Badge className="shrink-0">{t.activeBadge}</Badge>}
      </div>
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <span>{t.versionLabel(theme.version)}</span>
        <AppDots apps={theme.supportedApps} />
      </div>
    </CardShell>
  );
}
