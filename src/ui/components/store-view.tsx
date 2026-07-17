// SPDX-License-Identifier: MPL-2.0

import { FavouriteIcon, RefreshIcon, Search01Icon, Sorting01Icon, UserCircleIcon } from '@hugeicons/core-free-icons';
import type { AppController } from '@/hooks/useAppController';
import { APP_IDS, type MarketplaceSort } from '@shared/types';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { HugeIcon } from '@/components/ui/huge-icon';
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty';
import { InputGroup, InputGroupAddon, InputGroupInput } from '@/components/ui/input-group';
import { Spinner } from '@/components/ui/spinner';
import { AppMark } from '@/components/app-mark';
import { StoreThemeCard } from '@/components/theme-card';
import { cn } from '@/lib/utils';

const SORTS: MarketplaceSort[] = ['newest', 'name', 'downloads', 'likes'];

export function StoreView({ controller }: { controller: AppController }) {
  const { t, store, locale, storeAppFilter } = controller;
  const likesView = controller.view === 'likes';
  const sortLabel: Record<MarketplaceSort, string> = {
    newest: t.sortNewest,
    name: t.sortName,
    downloads: t.sortDownloads,
    likes: t.sortLikes,
  };
  const activeThemeIds = new Set(
    (controller.status?.apps ?? [])
      .map((app) => app.activeThemeId)
      .filter((id): id is string => Boolean(id)),
  );

  if (likesView && !controller.auth.loggedIn) {
    return (
      <div className="flex h-full min-h-0 items-center justify-center p-4">
        <Empty className="border">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <HugeIcon icon={FavouriteIcon} />
            </EmptyMedia>
            <EmptyTitle>{t.likesLoginTitle}</EmptyTitle>
            <EmptyDescription>{t.likesLoginHint}</EmptyDescription>
          </EmptyHeader>
          <Button
            disabled={controller.busy === 'login'}
            onClick={() => void controller.login()}
          >
            {controller.busy === 'login'
              ? <Spinner data-icon="inline-start" />
              : <HugeIcon icon={UserCircleIcon} data-icon="inline-start" />}
            {controller.busy === 'login' ? t.signingIn : t.signIn}
          </Button>
        </Empty>
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex flex-wrap items-center gap-2 border-b px-4 py-3">
        <InputGroup className="h-9 w-64">
          <InputGroupInput
            value={store.query}
            onChange={(event) => controller.changeQuery(event.target.value)}
            placeholder={t.searchThemes}
            aria-label={t.searchThemes}
          />
          <InputGroupAddon align="inline-start">
            <HugeIcon icon={Search01Icon} />
          </InputGroupAddon>
        </InputGroup>

        <DropdownMenu>
          <DropdownMenuTrigger
            render={<Button variant="outline" size="sm" />}
          >
            <HugeIcon icon={Sorting01Icon} data-icon="inline-start" />
            {sortLabel[store.sort]}
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="min-w-40">
            <DropdownMenuRadioGroup
              value={store.sort}
              onValueChange={(value) => controller.changeSort(value as MarketplaceSort)}
            >
              {SORTS.map((sort) => (
                <DropdownMenuRadioItem key={sort} value={sort}>
                  {sortLabel[sort]}
                </DropdownMenuRadioItem>
              ))}
            </DropdownMenuRadioGroup>
          </DropdownMenuContent>
        </DropdownMenu>

        <Button
          variant="ghost"
          size="icon-sm"
          aria-label={t.refresh}
          title={t.refresh}
          disabled={store.loading}
          onClick={controller.reloadStore}
        >
          {store.loading ? <Spinner /> : <HugeIcon icon={RefreshIcon} />}
        </Button>

        <span className="ml-auto text-xs text-muted-foreground">{t.themeCount(store.total)}</span>
      </div>

      <div className="flex flex-wrap items-center gap-1.5 border-b px-4 py-2.5">
        <button
          type="button"
          onClick={() => controller.changeStoreAppFilter(null)}
          className={cn(
            'rounded-full border px-3 py-1 text-xs font-medium transition-colors',
            storeAppFilter === null
              ? 'border-primary bg-accent text-foreground'
              : 'bg-background text-muted-foreground hover:text-foreground',
          )}
        >
          {t.appFilterAll}
        </button>
        {APP_IDS.map((appId) => (
          <button
            key={appId}
            type="button"
            onClick={() => controller.changeStoreAppFilter(storeAppFilter === appId ? null : appId)}
            className={cn(
              'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors',
              storeAppFilter === appId
                ? 'border-primary bg-accent text-foreground'
                : 'bg-background text-muted-foreground hover:text-foreground',
            )}
          >
            <AppMark appId={appId} size={14} />
            {appId === 'codex' ? 'Codex' : 'WorkBuddy'}
          </button>
        ))}
        <span className="mx-1 h-4 w-px bg-border" />
        <button
          type="button"
          onClick={() => controller.changeCategory(null)}
          className={cn(
            'rounded-full border px-3 py-1 text-xs font-medium transition-colors',
            store.category === null
              ? 'border-primary bg-accent text-foreground'
              : 'bg-background text-muted-foreground hover:text-foreground',
          )}
        >
          {t.allCategories}
        </button>
        {store.categories.map((category) => (
          <button
            key={category.slug}
            type="button"
            onClick={() => controller.changeCategory(category.slug)}
            className={cn(
              'rounded-full border px-3 py-1 text-xs font-medium transition-colors',
              store.category === category.slug
                ? 'border-primary bg-accent text-foreground'
                : 'bg-background text-muted-foreground hover:text-foreground',
            )}
          >
            {locale === 'zh-CN' ? category.name.zh || category.name.en : category.name.en}
          </button>
        ))}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-4">
        {store.error && (
          <Alert variant="destructive" className="mb-4">
            <AlertTitle>{t.storeUnavailable}</AlertTitle>
            <AlertDescription>
              {store.error}
              <Button variant="outline" size="sm" className="mt-2" onClick={controller.reloadStore}>
                {t.retry}
              </Button>
            </AlertDescription>
          </Alert>
        )}

        {store.loading && store.themes.length === 0 && !store.error && (
          <div className="flex min-h-40 items-center justify-center gap-2 text-sm text-muted-foreground">
            <Spinner />
            {t.loading}
          </div>
        )}

        {!store.loading && !store.error && store.themes.length === 0 && (
          <div className="flex min-h-40 flex-col items-center justify-center gap-1 text-center">
            <p className="text-sm font-medium">
              {store.query ? t.noSearchResults : likesView ? t.likesEmptyTitle : t.storeEmpty}
            </p>
            <p className="text-xs text-muted-foreground">
              {store.query ? t.noSearchResultsHint : likesView ? t.likesEmptyHint : ''}
            </p>
          </div>
        )}

        {store.themes.length > 0 && (
          <div className="grid grid-cols-3 gap-3">
            {store.themes.map((theme) => (
              <StoreThemeCard
                key={theme.slug}
                theme={theme}
                locale={locale}
                t={t}
                selected={controller.selection?.kind === 'store' && controller.selection.theme.slug === theme.slug}
                installed={controller.installedById.has(theme.slug)}
                active={activeThemeIds.has(theme.slug)}
                onSelect={() => controller.setSelection({ kind: 'store', theme })}
              />
            ))}
          </div>
        )}

        {store.cursor && !store.loading && (
          <div className="mt-4 flex justify-center">
            <Button variant="outline" onClick={controller.loadMoreStore}>{t.loadMore}</Button>
          </div>
        )}
        {store.loading && store.themes.length > 0 && (
          <div className="mt-4 flex justify-center"><Spinner /></div>
        )}
      </div>
    </div>
  );
}
