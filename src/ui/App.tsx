// SPDX-License-Identifier: MPL-2.0

import { useRef } from 'react';
import { useAppController, type Selection } from '@/hooks/useAppController';
import { DetailPanel } from '@/components/detail-panel';
import { DialogsHost } from '@/components/dialogs-host';
import { InstalledView } from '@/components/installed-view';
import { LogDrawer } from '@/components/log-drawer';
import { LoginOverlay } from '@/components/login-overlay';
import { SettingsDialog } from '@/components/settings-dialog';
import { Sidebar } from '@/components/sidebar';
import { StoreView } from '@/components/store-view';
import { Sheet, SheetContent } from '@/components/ui/sheet';
import { Spinner } from '@/components/ui/spinner';
import { cn } from '@/lib/utils';

export default function App() {
  const controller = useAppController();
  // Keep the last selection alive so the drawer's close animation doesn't flash empty.
  const lastSelection = useRef<Selection>(null);
  if (controller.selection) lastSelection.current = controller.selection;

  if (controller.booting) {
    return (
      <main className="flex h-svh items-center justify-center bg-background text-foreground">
        <Spinner className="size-6" />
      </main>
    );
  }

  return (
    <main
      className="grid h-svh grid-cols-[240px_minmax(0,1fr)] overflow-hidden bg-background font-sans text-foreground"
      lang={controller.locale === 'zh-CN' ? 'zh-CN' : 'en'}
      onDragOver={(event) => event.preventDefault()}
      onDrop={(event) => {
        event.preventDefault();
        controller.dropThemeFiles(Array.from(event.dataTransfer.files));
      }}
    >
      <Sidebar controller={controller} />

      <section className="min-h-0 min-w-0">
        {controller.view === 'installed'
          ? <InstalledView controller={controller} />
          : <StoreView controller={controller} />}
      </section>

      {/* Theme details open as a right-hand drawer (same interaction as the website). */}
      <Sheet
        open={controller.selection !== null}
        onOpenChange={(open) => {
          if (!open) controller.setSelection(null);
        }}
      >
        <SheetContent side="right" className="w-full gap-0 p-0 sm:max-w-md">
          <DetailPanel controller={controller} selection={controller.selection ?? lastSelection.current} />
        </SheetContent>
      </Sheet>

      <DialogsHost controller={controller} />
      <SettingsDialog controller={controller} />
      <LoginOverlay controller={controller} />
      <LogDrawer controller={controller} />

      {controller.toast && (
        <div
          key={controller.toast.id}
          className={cn(
            'fixed bottom-4 left-1/2 z-[100] -translate-x-1/2 rounded-full border px-4 py-2 text-sm shadow-lg',
            controller.toast.tone === 'destructive'
              ? 'border-destructive/30 bg-destructive/10 text-destructive'
              : 'border-border bg-popover text-popover-foreground',
          )}
        >
          {controller.toast.message}
        </div>
      )}
    </main>
  );
}
