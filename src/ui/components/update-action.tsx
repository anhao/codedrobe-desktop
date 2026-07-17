// SPDX-License-Identifier: MPL-2.0

import { Download04Icon, RefreshIcon } from '@hugeicons/core-free-icons';
import type { AppController } from '@/hooks/useAppController';
import { Button } from '@/components/ui/button';
import { HugeIcon } from '@/components/ui/huge-icon';
import { Spinner } from '@/components/ui/spinner';

/**
 * Update state machine shared by the sidebar banner and the settings dialog:
 * idle → downloading (Windows reports %, macOS in-place is indeterminate) →
 * staged, one click restarts into the new version.
 */
export function UpdateAction({ controller }: { controller: AppController }) {
  const { t, update, updateProgress, updateReady } = controller;
  const downloading = controller.busy === 'update';

  if (update?.status !== 'available') return null;

  if (updateReady) {
    return (
      <div className="flex flex-col gap-2">
        <p className="text-xs leading-5 text-muted-foreground">{t.updateReadyHint}</p>
        <Button size="sm" onClick={controller.installUpdate}>
          <HugeIcon icon={RefreshIcon} data-icon="inline-start" />
          {t.updateRestartInstall}
        </Button>
      </div>
    );
  }

  if (downloading) {
    return updateProgress !== null ? (
      <div className="flex flex-col gap-1.5">
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
          <div
            className="h-full rounded-full bg-primary transition-[width] duration-300"
            style={{ width: `${updateProgress}%` }}
          />
        </div>
        <p className="text-[11px] text-muted-foreground">{t.downloadingUpdate(updateProgress)}</p>
      </div>
    ) : (
      <p className="flex items-center gap-2 text-xs text-muted-foreground">
        <Spinner className="size-3.5" />
        {t.updateDownloading}
      </p>
    );
  }

  return (
    <Button size="sm" disabled={controller.busy !== null} onClick={() => void controller.downloadUpdate()}>
      <HugeIcon icon={Download04Icon} data-icon="inline-start" />
      {t.downloadUpdate}
    </Button>
  );
}
