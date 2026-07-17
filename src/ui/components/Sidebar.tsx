// SPDX-License-Identifier: MPL-2.0

import {
  FavouriteIcon,
  FolderLibraryIcon,
  GlobalIcon,
  Logout01Icon,
  RefreshIcon,
  Settings01Icon,
  StoreVerified01Icon,
  TerminalIcon,
  Undo02Icon,
  UserCircleIcon,
} from '@hugeicons/core-free-icons';
import type { AppController } from '@/hooks/useAppController';
import { AppMark, APP_META } from '@/components/app-mark';
import { APP_IDS } from '@shared/types';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { HugeIcon } from '@/components/ui/huge-icon';
import { Spinner } from '@/components/ui/spinner';
import { UpdateCard } from '@/components/update-card';
import { cn } from '@/lib/utils';
import appIcon from '../../../assets/icon.png';

export function Sidebar({ controller }: { controller: AppController }) {
  const { t, auth, status, view } = controller;
  const isMac = status?.platform === 'darwin';

  return (
    <aside className="flex h-full min-h-0 flex-col gap-4 overflow-y-auto border-r bg-sidebar p-4 pt-0">
      {/* hiddenInset traffic lights float over the top-left corner on macOS:
          reserve a draggable strip so the brand block never sits under them. */}
      <div className={cn('shrink-0 [-webkit-app-region:drag]', isMac ? 'h-9' : 'h-2')} />
      <div className="flex items-center gap-2.5 px-1 [-webkit-app-region:drag]">
        <img src={appIcon} alt="" className="size-9 rounded-xl" draggable={false} />
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold tracking-tight">CodeDrobe</p>
          <p className="truncate text-[11px] text-muted-foreground">{t.version(controller.appVersion)}</p>
        </div>
      </div>

      <nav className="flex flex-col gap-1">
        <Button
          variant={view === 'store' ? 'secondary' : 'ghost'}
          className="justify-start"
          onClick={() => controller.setView('store')}
        >
          <HugeIcon icon={StoreVerified01Icon} data-icon="inline-start" />
          {t.storeNav}
        </Button>
        <Button
          variant={view === 'likes' ? 'secondary' : 'ghost'}
          className="justify-start"
          onClick={() => controller.setView('likes')}
        >
          <HugeIcon icon={FavouriteIcon} data-icon="inline-start" />
          {t.likesNav}
        </Button>
        <Button
          variant={view === 'installed' ? 'secondary' : 'ghost'}
          className="justify-start"
          onClick={() => controller.setView('installed')}
        >
          <HugeIcon icon={FolderLibraryIcon} data-icon="inline-start" />
          {t.installedNav}
          <Badge variant="secondary" className="ml-auto">{controller.installed.length}</Badge>
        </Button>
      </nav>

      {/* Passive per-app status (detection only); apply targets are chosen in the
          theme drawer, and store filtering lives in the store toolbar. */}
      <div className="flex flex-col gap-2">
        <p className="px-1 text-xs font-medium tracking-[0.12em] text-muted-foreground uppercase">
          {t.appsStatusLabel}
        </p>
        <div className="flex flex-col gap-1.5">
          {APP_IDS.map((appId) => {
            const appStatus = controller.appStatusFor(appId);
            const activeTheme = appStatus?.activeThemeId
              ? controller.installedById.get(appStatus.activeThemeId) ?? null
              : null;
            const stateText = !appStatus
              ? t.loading
              : !appStatus.installed
                ? t.statusNotInstalled
                : activeTheme
                  ? t.statusActiveTheme(activeTheme.displayName)
                  : appStatus.debugReady
                    ? t.statusDebugReady
                    : appStatus.running
                      ? t.statusRunning
                      : t.statusInstalled;
            return (
              <div key={appId} className="flex items-center gap-2 rounded-lg border bg-background/60 px-2.5 py-2">
                <AppMark appId={appId} size={20} />
                <div className="min-w-0 flex-1">
                  <p className="flex items-center gap-1.5 text-xs font-medium">
                    {APP_META[appId].name}
                    <span className={cn(
                      'size-1.5 shrink-0 rounded-full',
                      appStatus?.debugReady ? 'bg-emerald-500' : appStatus?.running ? 'bg-amber-500' : appStatus?.installed ? 'bg-muted-foreground/40' : 'bg-destructive/50',
                    )} />
                  </p>
                  <p className="truncate text-[11px] text-muted-foreground">{stateText}</p>
                </div>
                {appStatus?.activeThemeId && (
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label={t.restoreNative(APP_META[appId].name)}
                    title={t.restoreNative(APP_META[appId].name)}
                    disabled={controller.busy !== null}
                    onClick={() => void controller.restoreApp(appId)}
                  >
                    {controller.busy === `restore:${appId}` ? <Spinner /> : <HugeIcon icon={Undo02Icon} />}
                  </Button>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <div className="mt-auto flex flex-col gap-2">
        <UpdateCard controller={controller} />
        {/* WorkBuddy-style account entry: avatar row at the very bottom, the
            profile/settings menu pops up from it. */}
        <DropdownMenu>
          <DropdownMenuTrigger
            render={(
              <button
                type="button"
                className="flex w-full items-center gap-2.5 rounded-xl border bg-background/60 px-2.5 py-2 text-left transition-colors hover:bg-accent"
              />
            )}
          >
            <Avatar size="sm">
              {auth.loggedIn && auth.user.avatarUrl ? <AvatarImage src={auth.user.avatarUrl} alt="" /> : null}
              <AvatarFallback>
                {auth.loggedIn
                  ? (auth.user.name || auth.user.email || '?').slice(0, 1).toUpperCase()
                  : <HugeIcon icon={UserCircleIcon} className="size-4" />}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-medium">
                {auth.loggedIn ? auth.user.name ?? auth.user.email ?? '—' : t.notSignedIn}
              </p>
              <p className="truncate text-[11px] text-muted-foreground">
                {auth.loggedIn
                  ? (auth.user.handle ? `@${auth.user.handle}` : auth.user.email ?? '')
                  : t.signIn}
              </p>
            </div>
          </DropdownMenuTrigger>
          <DropdownMenuContent side="top" align="start" className="w-60">
            {auth.loggedIn ? (
              <>
                <div className="flex items-center gap-2.5 px-2 py-2">
                  <Avatar>
                    {auth.user.avatarUrl ? <AvatarImage src={auth.user.avatarUrl} alt="" /> : null}
                    <AvatarFallback>
                      {(auth.user.name || auth.user.email || '?').slice(0, 1).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{auth.user.name ?? auth.user.email ?? '—'}</p>
                    {auth.user.handle && (
                      <p className="truncate text-xs text-muted-foreground">@{auth.user.handle}</p>
                    )}
                  </div>
                </div>
                <DropdownMenuSeparator />
                {/* Publishing and profile editing live on the website. */}
                <DropdownMenuItem onClick={() => void window.codeDrobe.openWebPage('account')}>
                  <HugeIcon icon={GlobalIcon} data-icon="inline-start" />
                  {t.webProfile}
                </DropdownMenuItem>
              </>
            ) : (
              <>
                <DropdownMenuItem
                  disabled={controller.busy === 'login'}
                  onClick={() => void controller.login()}
                >
                  {controller.busy === 'login'
                    ? <Spinner data-icon="inline-start" />
                    : <HugeIcon icon={UserCircleIcon} data-icon="inline-start" />}
                  {controller.busy === 'login' ? t.signingIn : t.signIn}
                </DropdownMenuItem>
                <DropdownMenuSeparator />
              </>
            )}
            <DropdownMenuItem onClick={() => controller.openSettings()}>
              <HugeIcon icon={Settings01Icon} data-icon="inline-start" />
              {t.settingsTitle}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => controller.openSettings('updates')}>
              <HugeIcon icon={RefreshIcon} data-icon="inline-start" />
              {t.checkForUpdates}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => controller.setLogsOpen(true)}>
              <HugeIcon icon={TerminalIcon} data-icon="inline-start" />
              {t.showLogs}
            </DropdownMenuItem>
            {auth.loggedIn && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  variant="destructive"
                  disabled={controller.busy === 'logout'}
                  onClick={() => void controller.logout()}
                >
                  {controller.busy === 'logout'
                    ? <Spinner data-icon="inline-start" />
                    : <HugeIcon icon={Logout01Icon} data-icon="inline-start" />}
                  {t.signOut}
                </DropdownMenuItem>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </aside>
  );
}
