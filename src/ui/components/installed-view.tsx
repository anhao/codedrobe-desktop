// SPDX-License-Identifier: MPL-2.0

import { FolderLibraryIcon, PackageIcon, Search01Icon } from '@hugeicons/core-free-icons';
import type { AppController } from '@/hooks/useAppController';
import { Button } from '@/components/ui/button';
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty';
import { HugeIcon } from '@/components/ui/huge-icon';
import { InputGroup, InputGroupAddon, InputGroupInput } from '@/components/ui/input-group';
import { Spinner } from '@/components/ui/spinner';
import { InstalledThemeCard } from '@/components/theme-card';

export function InstalledView({ controller }: { controller: AppController }) {
  const { t, installed, installedQuery } = controller;
  const keyword = installedQuery.trim().toLowerCase();
  const visible = keyword
    ? installed.filter((theme) =>
        theme.displayName.toLowerCase().includes(keyword)
        || (theme.tagline ?? '').toLowerCase().includes(keyword))
    : installed;
  const activeThemeIds = new Set(
    (controller.status?.apps ?? [])
      .map((app) => app.activeThemeId)
      .filter((id): id is string => Boolean(id)),
  );

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex flex-wrap items-center gap-2 border-b px-4 py-3">
        <h2 className="text-sm font-semibold">{t.installedTitle}</h2>
        <span className="text-xs text-muted-foreground">{t.themeCount(installed.length)}</span>
        <InputGroup className="h-8 w-56">
          <InputGroupInput
            value={installedQuery}
            onChange={(event) => controller.setInstalledQuery(event.target.value)}
            placeholder={t.searchInstalled}
            aria-label={t.searchInstalled}
          />
          <InputGroupAddon align="inline-start">
            <HugeIcon icon={Search01Icon} />
          </InputGroupAddon>
        </InputGroup>
        <div className="ml-auto flex items-center gap-2">
          <Button
            size="sm"
            disabled={controller.busy === 'import'}
            onClick={() => void controller.importTheme()}
          >
            {controller.busy === 'import'
              ? <Spinner data-icon="inline-start" />
              : <HugeIcon icon={PackageIcon} data-icon="inline-start" />}
            {controller.busy === 'import' ? t.importing : t.importTheme}
          </Button>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-4">
        {visible.length === 0 ? (
          keyword ? (
            <div className="flex min-h-40 flex-col items-center justify-center gap-1 text-center">
              <p className="text-sm font-medium">{t.noSearchResults}</p>
              <p className="text-xs text-muted-foreground">{t.noSearchResultsHint}</p>
            </div>
          ) : (
            <Empty className="border">
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <HugeIcon icon={FolderLibraryIcon} />
                </EmptyMedia>
                <EmptyTitle>{t.emptyInstalledTitle}</EmptyTitle>
                <EmptyDescription>{t.emptyInstalledHint}</EmptyDescription>
              </EmptyHeader>
              <Button variant="outline" onClick={() => controller.setView('store')}>
                {t.browseStore}
              </Button>
            </Empty>
          )
        ) : (
          <div className="grid grid-cols-3 gap-3">
            {visible.map((theme) => (
              <InstalledThemeCard
                key={theme.id}
                theme={theme}
                t={t}
                selected={controller.selection?.kind === 'installed' && controller.selection.theme.id === theme.id}
                active={activeThemeIds.has(theme.id)}
                onSelect={() => controller.setSelection({ kind: 'installed', theme })}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
