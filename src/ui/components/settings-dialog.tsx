// SPDX-License-Identifier: MPL-2.0

import { useEffect, useState, type ReactNode } from 'react';
import {
  ArrowDown01Icon,
  DashboardSquare01Icon,
  Download04Icon,
  Folder01Icon,
  RefreshIcon,
  Settings01Icon,
} from '@hugeicons/core-free-icons';
import type { AppController, SettingsSection } from '@/hooks/useAppController';
import { UpdateAction } from '@/components/update-action';
import { AppMark, APP_META } from '@/components/app-mark';
import { APP_IDS, type AppId } from '@shared/types';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { HugeIcon } from '@/components/ui/huge-icon';
import { Input } from '@/components/ui/input';
import { Spinner } from '@/components/ui/spinner';
import { cn } from '@/lib/utils';

const LOCALE_LABELS = [
  ['zh-CN', '中文（简体）'],
  ['en', 'English'],
] as const;

/** One settings entry: title + description on the left, its control on the right. */
function SettingRow({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children?: ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-xl border bg-background/60 px-4 py-3.5">
      <div className="min-w-0">
        <p className="text-sm font-medium">{title}</p>
        {description && <p className="mt-0.5 text-xs leading-5 text-muted-foreground">{description}</p>}
      </div>
      {children && <div className="flex shrink-0 items-center gap-2">{children}</div>}
    </div>
  );
}

function AppOverrideCard({ controller, appId }: { controller: AppController; appId: AppId }) {
  const { t, settings } = controller;
  const override = settings?.apps[appId] ?? { appPath: null, port: null };
  const defaultPort = settings?.defaultPorts[appId] ?? controller.appStatusFor(appId)?.port ?? 0;
  const [portDraft, setPortDraft] = useState('');

  // Mirror the saved override whenever settings reload.
  useEffect(() => {
    setPortDraft(override.port === null ? '' : String(override.port));
  }, [override.port]);

  const commitPort = async () => {
    const trimmed = portDraft.trim();
    if (trimmed === (override.port === null ? '' : String(override.port))) return;
    const parsed = trimmed === '' ? null : Number(trimmed);
    const saved = await controller.saveAppPort(appId, parsed);
    if (!saved) setPortDraft(override.port === null ? '' : String(override.port));
  };

  return (
    <div className="rounded-xl border bg-background/60">
      <div className="flex items-center gap-2 border-b px-4 py-3">
        <AppMark appId={appId} size={22} />
        <span className="text-sm font-medium">{APP_META[appId].name}</span>
      </div>
      <div className="flex items-center justify-between gap-4 border-b px-4 py-3">
        <div className="min-w-0">
          <p className="text-sm">{t.settingsPathLabel}</p>
          <p className="mt-0.5 truncate text-xs text-muted-foreground" title={override.appPath ?? undefined}>
            {override.appPath ?? t.settingsPathAuto}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          {override.appPath && (
            <Button variant="ghost" size="xs" onClick={() => void controller.clearAppPath(appId)}>
              {t.settingsClearPath}
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={() => void controller.chooseAppPath(appId)}>
            <HugeIcon icon={Folder01Icon} data-icon="inline-start" />
            {t.settingsChoosePath}
          </Button>
        </div>
      </div>
      <div className="flex items-center justify-between gap-4 px-4 py-3">
        <div>
          <p className="text-sm">{t.settingsPortLabel}</p>
          <p className="mt-0.5 text-xs text-muted-foreground">{t.settingsPortHint(defaultPort)}</p>
        </div>
        <Input
          value={portDraft}
          inputMode="numeric"
          placeholder={String(defaultPort)}
          className="h-8 w-28 text-xs"
          onChange={(event) => setPortDraft(event.target.value)}
          onBlur={() => void commitPort()}
          onKeyDown={(event) => {
            if (event.key === 'Enter') void commitPort();
          }}
        />
      </div>
    </div>
  );
}

export function SettingsDialog({ controller }: { controller: AppController }) {
  const { t, update, updateChecking } = controller;
  const section = controller.settingsSection;
  const setSection = controller.setSettingsSection;

  const sections: Array<{ id: SettingsSection; label: string; icon: typeof Settings01Icon }> = [
    { id: 'general', label: t.settingsGeneralTitle, icon: Settings01Icon },
    { id: 'apps', label: t.settingsAppsTitle, icon: DashboardSquare01Icon },
    { id: 'updates', label: t.settingsUpdatesTitle, icon: Download04Icon },
  ];
  const activeSection = sections.find((item) => item.id === section) ?? sections[0];
  const localeLabel = LOCALE_LABELS.find(([value]) => value === controller.locale)?.[1] ?? controller.locale;

  return (
    <Dialog
      open={controller.settingsOpen}
      onOpenChange={(open) => controller.setSettingsOpen(open)}
    >
      <DialogContent className="grid h-[min(78svh,38rem)] w-[min(92vw,50rem)] max-w-none grid-cols-[190px_minmax(0,1fr)] gap-0 overflow-hidden p-0">
        {/* Category navigation — new settings land here as new sections. */}
        <aside className="flex min-h-0 flex-col gap-1 overflow-y-auto border-r bg-muted/40 p-3">
          <DialogTitle className="px-2 pt-1 pb-2 text-sm font-semibold">{t.settingsTitle}</DialogTitle>
          {sections.map((item) => (
            <Button
              key={item.id}
              variant={section === item.id ? 'secondary' : 'ghost'}
              size="sm"
              className={cn('justify-start', section !== item.id && 'text-muted-foreground')}
              onClick={() => setSection(item.id)}
            >
              <HugeIcon icon={item.icon} data-icon="inline-start" />
              {item.label}
            </Button>
          ))}
        </aside>

        <div className="flex min-h-0 flex-col">
          <div className="border-b px-6 py-4">
            <h2 className="text-base font-semibold tracking-[-0.01em]">{activeSection.label}</h2>
          </div>
          <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto px-6 py-4">
            {section === 'general' && (
              <SettingRow title={t.settingsLanguageTitle} description={t.settingsLanguageDesc}>
                <DropdownMenu>
                  <DropdownMenuTrigger render={<Button variant="outline" size="sm" />}>
                    {localeLabel}
                    <HugeIcon icon={ArrowDown01Icon} data-icon="inline-end" />
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="min-w-36">
                    <DropdownMenuRadioGroup
                      value={controller.locale}
                      onValueChange={(value) => void controller.setLocale(value as typeof controller.locale)}
                    >
                      {LOCALE_LABELS.map(([value, label]) => (
                        <DropdownMenuRadioItem key={value} value={value}>
                          {label}
                        </DropdownMenuRadioItem>
                      ))}
                    </DropdownMenuRadioGroup>
                  </DropdownMenuContent>
                </DropdownMenu>
              </SettingRow>
            )}
            {section === 'general' && (
              <>
                <p className="px-1 text-xs leading-5 text-muted-foreground">{t.privacyNote}</p>
                <div className="flex items-center gap-4 px-1 text-xs">
                  <button
                    type="button"
                    className="text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
                    onClick={() => void window.codeDrobe.openWebPage('privacy')}
                  >
                    {t.privacyPolicy}
                  </button>
                  <button
                    type="button"
                    className="text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
                    onClick={() => void window.codeDrobe.openWebPage('terms')}
                  >
                    {t.termsOfService}
                  </button>
                </div>
              </>
            )}

            {section === 'apps' && (
              <>
                <p className="text-xs leading-5 text-muted-foreground">{t.settingsAppsHint}</p>
                {APP_IDS.map((appId) => (
                  <AppOverrideCard key={appId} controller={controller} appId={appId} />
                ))}
              </>
            )}

            {section === 'updates' && (
              <>
                <SettingRow
                  title={t.settingsCurrentVersion}
                  description={update?.status === 'up-to-date'
                    ? t.latestVersion(update.currentVersion)
                    : update?.status === 'unavailable'
                      ? t.updateCheckFailed
                      : t.version(controller.appVersion)}
                >
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={updateChecking}
                    onClick={() => void controller.checkUpdates()}
                  >
                    {updateChecking
                      ? <Spinner data-icon="inline-start" />
                      : <HugeIcon icon={RefreshIcon} data-icon="inline-start" />}
                    {updateChecking ? t.checkingUpdates : t.checkForUpdates}
                  </Button>
                </SettingRow>
                {update?.status === 'available' && (
                  <div className="flex flex-col gap-3 rounded-xl border border-primary/30 bg-accent/30 px-4 py-3.5">
                    <div className="min-w-0">
                      <p className="text-sm font-medium">{t.updateAvailable(update.latestVersion ?? '')}</p>
                      {update.releaseUrl && (
                        <button
                          type="button"
                          className="mt-0.5 truncate text-xs text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
                          onClick={() => void window.codeDrobe.openUpdateRelease(update.releaseUrl!)}
                        >
                          {t.openReleasePage}
                        </button>
                      )}
                    </div>
                    <UpdateAction controller={controller} />
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
