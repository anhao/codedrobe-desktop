// SPDX-License-Identifier: MPL-2.0

import type { AppController } from '@/hooks/useAppController';
import { APP_META } from '@/components/app-mark';
import { APP_IDS, type AppId } from '@shared/types';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Spinner } from '@/components/ui/spinner';

export function DialogsHost({ controller }: { controller: AppController }) {
  const { t, restartPrompt, deletePrompt, deepLinkPrompt, fileImportPrompt, locale } = controller;
  const appName = (appId: string) =>
    APP_IDS.includes(appId as AppId) ? APP_META[appId as AppId].name : appId;

  return (
    <>
      <Dialog
        open={restartPrompt !== null}
        onOpenChange={(open) => { if (!open) controller.setRestartPrompt(null); }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{t.restartTitle}</DialogTitle>
            <DialogDescription>
              {restartPrompt ? t.restartDescription(appName(restartPrompt.appId)) : null}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => controller.setRestartPrompt(null)}>
              {t.restartLater}
            </Button>
            <Button
              disabled={controller.busy !== null}
              onClick={() => {
                const prompt = restartPrompt;
                controller.setRestartPrompt(null);
                if (prompt) {
                  void controller.applyToApp(prompt.themeId, prompt.themeName, prompt.appId, {
                    restartExisting: true,
                  });
                }
              }}
            >
              {controller.busy?.startsWith('apply:') ? <Spinner data-icon="inline-start" /> : null}
              {t.restartAndApply}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={deletePrompt !== null}
        onOpenChange={(open) => { if (!open) controller.setDeletePrompt(null); }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{t.deleteTitle}</DialogTitle>
            <DialogDescription>
              {deletePrompt ? t.deleteDescription(deletePrompt.displayName) : null}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => controller.setDeletePrompt(null)}>
              {t.cancel}
            </Button>
            <Button
              variant="destructive"
              disabled={controller.busy !== null}
              onClick={() => void controller.confirmDelete()}
            >
              {controller.busy?.startsWith('delete:') ? <Spinner data-icon="inline-start" /> : null}
              {t.confirmDelete}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={deepLinkPrompt !== null}
        onOpenChange={(open) => { if (!open) controller.setDeepLinkPrompt(null); }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{t.deepLinkTitle}</DialogTitle>
            <DialogDescription>
              {deepLinkPrompt
                ? t.deepLinkDescription(
                    deepLinkPrompt.theme
                      ? (locale === 'zh-CN'
                          ? deepLinkPrompt.theme.name.zh || deepLinkPrompt.theme.name.en
                          : deepLinkPrompt.theme.name.en || deepLinkPrompt.theme.name.zh)
                      : deepLinkPrompt.request.slug,
                    appName(deepLinkPrompt.request.appId),
                  )
                : null}
            </DialogDescription>
          </DialogHeader>
          {deepLinkPrompt?.theme?.coverUrl && (
            <img
              src={deepLinkPrompt.theme.coverUrl}
              alt=""
              className="max-h-40 w-full rounded-lg border object-cover"
            />
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => controller.setDeepLinkPrompt(null)}>
              {t.deepLinkDeny}
            </Button>
            <Button
              disabled={controller.busy !== null}
              onClick={() => void controller.confirmDeepLink()}
            >
              {t.deepLinkAllow}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={fileImportPrompt !== null}
        onOpenChange={(open) => { if (!open) controller.setFileImportPrompt(null); }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{t.fileImportReplaceTitle}</DialogTitle>
            <DialogDescription>
              {fileImportPrompt
                ? t.fileImportReplaceDescription(
                    fileImportPrompt.existing.displayName,
                    fileImportPrompt.existing.version,
                    fileImportPrompt.incoming.version,
                  )
                : null}
            </DialogDescription>
          </DialogHeader>
          {fileImportPrompt?.incoming.coverDataUrl && (
            <img
              src={fileImportPrompt.incoming.coverDataUrl}
              alt=""
              className="max-h-40 w-full rounded-lg border object-cover"
            />
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => controller.setFileImportPrompt(null)}>
              {t.cancel}
            </Button>
            <Button
              disabled={controller.busy !== null}
              onClick={() => void controller.confirmFileImport()}
            >
              {controller.busy === 'import' ? <Spinner data-icon="inline-start" /> : null}
              {t.fileImportReplace}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
