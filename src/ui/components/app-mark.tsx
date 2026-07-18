// SPDX-License-Identifier: MPL-2.0

import type { AppId } from '@shared/types';
import { cn } from '@/lib/utils';
import codexIcon from '../assets/apps/codex.png';
import workbuddyIcon from '../assets/apps/workbuddy.png';
import qoderworkIcon from '../assets/apps/qoderwork.png';
import traeworkIcon from '../assets/apps/traework.png';

export const APP_META: Record<AppId, { name: string; icon: string }> = {
  codex: { name: 'Codex', icon: codexIcon },
  workbuddy: { name: 'WorkBuddy', icon: workbuddyIcon },
  qoderwork: { name: 'QoderWork', icon: qoderworkIcon },
  traework: { name: 'TRAE SOLO', icon: traeworkIcon },
};

/** App icon mark (mirrors the website's AppMark; rounded-square app icon). */
export function AppMark({
  appId,
  size = 18,
  className,
}: {
  appId: AppId;
  size?: number;
  className?: string;
}) {
  const meta = APP_META[appId];
  return (
    <img
      src={meta.icon}
      width={size}
      height={size}
      alt={meta.name}
      title={meta.name}
      draggable={false}
      className={cn('shrink-0 rounded-[22%] object-cover', className)}
      style={{ width: size, height: size }}
    />
  );
}
