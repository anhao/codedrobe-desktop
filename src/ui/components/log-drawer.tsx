// SPDX-License-Identifier: MPL-2.0

import type { AppController } from '@/hooks/useAppController';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';

export function LogDrawer({ controller }: { controller: AppController }) {
  const { t, logs, logsOpen } = controller;
  return (
    <Sheet open={logsOpen} onOpenChange={controller.setLogsOpen}>
      <SheetContent side="right" className="w-full sm:max-w-lg">
        <SheetHeader>
          <SheetTitle>{t.runtimeLog}</SheetTitle>
          <SheetDescription>{logs.length === 0 ? t.noLogs : null}</SheetDescription>
        </SheetHeader>
        <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-4">
          <pre className="font-mono text-[11px] leading-5 break-words whitespace-pre-wrap text-muted-foreground">
            {logs.join('\n')}
          </pre>
        </div>
      </SheetContent>
    </Sheet>
  );
}
