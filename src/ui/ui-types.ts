// SPDX-License-Identifier: MPL-2.0

import { uiMessages, type AppLocale } from '../shared/i18n';

export type BusyAction = 'launch' | 'restore' | 'import' | 'export' | 'delete' | 'install' | 'update' | null;
export type View = 'store' | 'installed';
export type UiCopy = (typeof uiMessages)[AppLocale];
