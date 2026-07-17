// SPDX-License-Identifier: MPL-2.0

import { Download04Icon } from '@hugeicons/core-free-icons';
import type { AppController } from '@/hooks/useAppController';
import { Button } from '@/components/ui/button';
import { HugeIcon } from '@/components/ui/huge-icon';
import { Spinner } from '@/components/ui/spinner';

/**
 * Sidebar update banner. Renders only when an update is actually available —
 * failed or up-to-date checks stay invisible here (see the settings dialog).
 */
export function UpdateCard({ controller }: { controller: AppController }) {
  const { t, update, updateProgress } = controller;
  const downloading = controller.busy === 'update';

  if (update?.status !== 'available') return null;

  return (
    <div className="flex flex-col gap-2 rounded-lg border border-primary/30 bg-accent/40 px-3 py-2.5">
      <p className="text-xs font-medium">{t.updateAvailable(update.latestVersion ?? '')}</p>
      <Button
        size="sm"
        disabled={downloading}
        onClick={() => void controller.downloadUpdate()}
      >
        {downloading ? <Spinner data-icon="inline-start" /> : <HugeIcon icon={Download04Icon} data-icon="inline-start" />}
        {downloading && updateProgress !== null
          ? t.downloadingUpdate(updateProgress)
          : t.downloadUpdate}
      </Button>
      {update.releaseUrl && (
        <button
          type="button"
          className="text-left text-[11px] text-muted-foreground hover:text-foreground"
          onClick={() => void window.codeDrobe.openUpdateRelease(update.releaseUrl!)}
        >
          {t.openReleasePage}
        </button>
      )}
    </div>
  );
}
