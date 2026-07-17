// SPDX-License-Identifier: MPL-2.0

import { useState } from 'react';
import {
  CopyLinkIcon,
  Delete02Icon,
  Download04Icon,
  FavouriteIcon,
  NewTwitterIcon,
  PaintBoardIcon,
  Share05Icon,
} from '@hugeicons/core-free-icons';
import type { AppController, Selection } from '@/hooks/useAppController';
import { AppMark, APP_META } from '@/components/app-mark';
import { APP_IDS, type AppId } from '@shared/types';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { HugeIcon } from '@/components/ui/huge-icon';
import { Separator } from '@/components/ui/separator';
import { Spinner } from '@/components/ui/spinner';
import { cn } from '@/lib/utils';

/** Per-app apply rows: the drawer chooses the target app, not a global picker. */
function AppActionList({
  controller,
  supportedApps,
  installedThemeId,
  onApply,
}: {
  controller: AppController;
  supportedApps: AppId[];
  /** Installed library id of this theme, when it exists; used for the active badge. */
  installedThemeId: string | null;
  onApply: (appId: AppId) => Promise<unknown>;
}) {
  const { t } = controller;
  const [pendingApp, setPendingApp] = useState<AppId | null>(null);

  const run = async (appId: AppId) => {
    setPendingApp(appId);
    try {
      await onApply(appId);
    } finally {
      setPendingApp(null);
    }
  };

  return (
    <div className="flex flex-col gap-2">
      <div>
        <p className="text-sm font-medium">{t.appPickerTitle}</p>
        <p className="mt-0.5 text-xs text-muted-foreground">{t.appPickerHint}</p>
      </div>
      <div className="flex flex-col gap-1.5">
        {APP_IDS.map((appId) => {
          const supported = supportedApps.includes(appId);
          const appStatus = controller.appStatusFor(appId);
          const detected = Boolean(appStatus?.installed);
          const live = Boolean(appStatus?.running || appStatus?.debugReady);
          const isActive = installedThemeId !== null
            && appStatus?.activeThemeId === installedThemeId;
          const stateText = !supported
            ? t.notSupported
            : !detected
              ? t.statusNotInstalled
              : appStatus?.debugReady
                ? t.statusDebugReady
                : appStatus?.running
                  ? t.statusRunning
                  : t.statusInstalled;
          const busyHere = pendingApp === appId && controller.busy !== null;
          return (
            <div
              key={appId}
              className={cn(
                'flex items-center gap-2.5 rounded-lg border bg-background/60 px-3 py-2.5',
                !supported && 'opacity-55',
              )}
            >
              <AppMark appId={appId} size={26} />
              <div className="min-w-0 flex-1">
                <p className="flex items-center gap-1.5 text-sm font-medium">
                  {APP_META[appId].name}
                  {isActive && <Badge className="px-1.5 py-0 text-[10px]">{t.activeBadge}</Badge>}
                </p>
                <p className="truncate text-xs text-muted-foreground">{stateText}</p>
              </div>
              <Button
                size="sm"
                variant={live ? 'default' : 'outline'}
                disabled={!supported || !detected || controller.busy !== null}
                onClick={() => void run(appId)}
              >
                {busyHere && <Spinner data-icon="inline-start" />}
                {live ? t.applyAction : t.applyAndLaunch}
              </Button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function DetailPanel({
  controller,
  selection: selectionOverride,
}: {
  controller: AppController;
  /** Lets the drawer keep rendering the last selection during its close animation. */
  selection?: Selection;
}) {
  const { t, locale } = controller;
  const selection = selectionOverride !== undefined ? selectionOverride : controller.selection;
  const [shareOpen, setShareOpen] = useState(false);

  if (!selection) {
    return (
      <div className="flex h-full items-center justify-center p-6 text-center">
        <div className="flex flex-col items-center gap-2 text-muted-foreground">
          <HugeIcon icon={PaintBoardIcon} className="size-8 opacity-40" />
          <p className="text-sm">{t.selectThemeHint}</p>
        </div>
      </div>
    );
  }

  if (selection.kind === 'store') {
    const theme = selection.theme;
    const name = locale === 'zh-CN' ? theme.name.zh || theme.name.en : theme.name.en || theme.name.zh;
    const description = locale === 'zh-CN'
      ? theme.description.zh || theme.description.en
      : theme.description.en || theme.description.zh;
    const installedTheme = controller.installedById.get(theme.slug) ?? null;
    const updateAvailable = installedTheme && installedTheme.version !== theme.version;

    return (
      <div className="flex h-full min-h-0 flex-col overflow-y-auto">
        <div className="relative aspect-[1.6/1] w-full shrink-0 overflow-hidden bg-muted">
          {(theme.coverUrl ?? theme.previewUrl) ? (
            <img src={theme.coverUrl ?? theme.previewUrl} alt={name} className="size-full object-cover" />
          ) : null}
        </div>
        <div className="flex flex-col gap-3 p-4">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <h2 className="text-base font-semibold tracking-[-0.01em]">{name}</h2>
              <div className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
                <span>{t.versionLabel(theme.version)}</span>
                {theme.author && (
                  <>
                    <span>·</span>
                    <Avatar size="sm" className="size-4">
                      {theme.author.avatarUrl ? <AvatarImage src={theme.author.avatarUrl} alt="" /> : null}
                      <AvatarFallback className="text-[9px]">
                        {theme.author.displayName.slice(0, 1).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <span className="truncate">{theme.author.displayName}</span>
                  </>
                )}
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-0.5">
              {/* Share slides its actions out to the left of the trigger. */}
              {shareOpen && (
                <span className="flex items-center gap-0.5 animate-in fade-in slide-in-from-right-2 duration-200">
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label={t.shareCopyAction}
                    title={t.shareCopyAction}
                    onClick={() => void controller.copyShareText(theme)}
                  >
                    <HugeIcon icon={CopyLinkIcon} />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label={t.shareXAction}
                    title={t.shareXAction}
                    onClick={() => controller.shareToX(theme)}
                  >
                    <HugeIcon icon={NewTwitterIcon} />
                  </Button>
                </span>
              )}
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label={t.share}
                title={t.share}
                className={cn(shareOpen && 'text-primary')}
                onClick={() => setShareOpen((open) => !open)}
              >
                <HugeIcon icon={Share05Icon} />
              </Button>
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label={t.likesLabel}
                className={cn(theme.likedByMe && 'text-primary')}
                onClick={() => void controller.toggleLike(theme)}
              >
                <HugeIcon icon={FavouriteIcon} />
              </Button>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            <Badge variant="secondary">{t.freeTheme}</Badge>
            {updateAvailable && <Badge>{t.updateAvailableBadge}</Badge>}
            {theme.categories.map((category) => (
              <Badge key={category.slug} variant="outline" className="text-[11px]">
                {locale === 'zh-CN' ? category.name.zh || category.name.en : category.name.en}
              </Badge>
            ))}
          </div>

          {description && <p className="text-sm leading-6 text-muted-foreground">{description}</p>}

          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1">
              <HugeIcon icon={FavouriteIcon} className="size-3.5" />
              {theme.likeCount} {t.likesLabel}
            </span>
            <span className="inline-flex items-center gap-1">
              <HugeIcon icon={Download04Icon} className="size-3.5" />
              {theme.downloadCount} {t.downloadsLabel}
            </span>
          </div>

          <Separator />

          <AppActionList
            controller={controller}
            supportedApps={theme.supportedApps}
            installedThemeId={installedTheme?.id ?? null}
            onApply={(appId) =>
              installedTheme && !updateAvailable
                ? controller.applyToApp(installedTheme.id, installedTheme.displayName, appId)
                : controller.installFromStore(theme, appId)}
          />
          <p className="text-center text-[11px] text-muted-foreground">{t.integrityVerified}</p>
        </div>
      </div>
    );
  }

  const theme = selection.theme;

  return (
    <div className="flex h-full min-h-0 flex-col overflow-y-auto">
      <div className="relative aspect-[1.6/1] w-full shrink-0 overflow-hidden bg-muted">
        {theme.coverDataUrl ? (
          <img src={theme.coverDataUrl} alt={theme.displayName} className="size-full object-cover" />
        ) : (
          <div className="flex size-full items-center justify-center bg-gradient-to-br from-primary/10 via-muted to-accent text-muted-foreground">
            <HugeIcon icon={PaintBoardIcon} className="size-8 opacity-50" />
          </div>
        )}
      </div>
      <div className="flex flex-col gap-3 p-4">
        <div>
          <h2 className="text-base font-semibold tracking-[-0.01em]">{theme.displayName}</h2>
          <p className="mt-0.5 text-xs text-muted-foreground">{t.versionLabel(theme.version)}</p>
        </div>
        {theme.tagline && <p className="text-sm leading-6 text-muted-foreground">{theme.tagline}</p>}

        <Separator />

        <AppActionList
          controller={controller}
          supportedApps={theme.supportedApps}
          installedThemeId={theme.id}
          onApply={(appId) => controller.applyToApp(theme.id, theme.displayName, appId)}
        />

        <div className="flex gap-2">
          <Button
            variant="outline"
            className="flex-1"
            onClick={() => void controller.exportTheme(theme.id)}
          >
            <HugeIcon icon={Share05Icon} data-icon="inline-start" />
            {t.exportTheme}
          </Button>
          <Button
            variant="destructive"
            className="flex-1"
            disabled={controller.busy !== null}
            onClick={() => controller.setDeletePrompt(theme)}
          >
            <HugeIcon icon={Delete02Icon} data-icon="inline-start" />
            {t.deleteTheme}
          </Button>
        </div>
      </div>
    </div>
  );
}
