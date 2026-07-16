// SPDX-License-Identifier: MPL-2.0

import type { AppLocale } from '../shared/i18n';
import type { SystemStatus } from '../shared/types';
import type { UiCopy } from './ui-types';

export function cleanError(error: unknown): string {
  return (error instanceof Error ? error.message : String(error)).replace(/^Error invoking remote method '[^']+': Error: /, '');
}
export function localized(value: { en: string; zh: string }, locale: AppLocale): string {
  return locale === 'en' ? value.en : value.zh;
}

export function platformLabel(status: SystemStatus, copy: UiCopy): string {
  if (status.platform === 'darwin') return 'macOS';
  if (status.platform === 'win32') return 'Windows';
  return copy.unsupportedPlatform;
}
