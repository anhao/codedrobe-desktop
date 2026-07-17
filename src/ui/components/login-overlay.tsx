// SPDX-License-Identifier: MPL-2.0

import { Copy01Icon, RefreshIcon } from '@hugeicons/core-free-icons';
import type { AppController } from '@/hooks/useAppController';
import { Button } from '@/components/ui/button';
import { HugeIcon } from '@/components/ui/huge-icon';
import { Spinner } from '@/components/ui/spinner';
import appIcon from '../../../assets/icon.png';

/**
 * Full-screen takeover while the PKCE login waits for the browser: status up
 * top, copy-link/restart fallbacks in view, cancel as the way out.
 */
export function LoginOverlay({ controller }: { controller: AppController }) {
  const { t } = controller;
  if (controller.loginUrl === null) return null;

  return (
    <div className="fixed inset-0 z-[90] flex flex-col items-center justify-center bg-background">
      {/* Keep the frameless window draggable while the overlay covers the title bar. */}
      <div className="absolute inset-x-0 top-0 h-9 [-webkit-app-region:drag]" />

      <div className="flex w-full max-w-sm flex-col items-center gap-10 px-6">
        <div className="flex flex-col items-center gap-5">
          <img src={appIcon} alt="" className="size-24 rounded-[24%]" draggable={false} />
          <h1 className="text-2xl font-semibold tracking-tight">{t.loginDialogTitle}</h1>
        </div>

        <Button size="lg" disabled variant="secondary" className="w-56 rounded-full">
          <Spinner data-icon="inline-start" />
          {t.loginInProgress}
        </Button>

        <div className="flex flex-col items-center gap-3 text-center">
          <div>
            <p className="text-sm font-semibold">{t.loginNoBrowserTitle}</p>
            <p className="mt-1 text-sm text-muted-foreground">{t.loginNoBrowserHint}</p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              size="sm"
              className="rounded-full"
              onClick={() => void controller.copyLoginUrl()}
            >
              <HugeIcon icon={Copy01Icon} data-icon="inline-start" />
              {t.loginCopyLink}
            </Button>
            <Button
              variant="secondary"
              size="sm"
              className="rounded-full"
              onClick={controller.restartLogin}
            >
              <HugeIcon icon={RefreshIcon} data-icon="inline-start" />
              {t.loginRestart}
            </Button>
          </div>
        </div>

        <Button
          variant="ghost"
          size="sm"
          className="text-muted-foreground"
          onClick={controller.cancelLogin}
        >
          {t.cancelLogin}
        </Button>
      </div>

      <div className="absolute inset-x-0 bottom-6 flex items-center justify-center gap-6 text-xs text-muted-foreground">
        <button
          type="button"
          className="hover:text-foreground"
          onClick={() => void window.codeDrobe.openWebPage('privacy')}
        >
          {t.privacyPolicy}
        </button>
        <button
          type="button"
          className="hover:text-foreground"
          onClick={() => void window.codeDrobe.openWebPage('terms')}
        >
          {t.termsOfService}
        </button>
      </div>
    </div>
  );
}
