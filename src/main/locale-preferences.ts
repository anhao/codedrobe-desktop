// SPDX-License-Identifier: MPL-2.0

import fs from 'node:fs/promises';
import path from 'node:path';
import { isAppLocale, localeFromSystem, type AppLocale } from '../shared/i18n';

interface Preferences {
  locale?: unknown;
}

function preferencesPath(userDataRoot: string): string {
  return path.join(userDataRoot, 'preferences.json');
}

export async function saveLocalePreference(userDataRoot: string, locale: AppLocale): Promise<void> {
  await fs.mkdir(userDataRoot, { recursive: true });
  await fs.writeFile(preferencesPath(userDataRoot), `${JSON.stringify({ locale }, null, 2)}\n`, 'utf8');
}

export async function loadLocalePreference(userDataRoot: string, systemLocale: string): Promise<AppLocale> {
  try {
    const preferences = JSON.parse(await fs.readFile(preferencesPath(userDataRoot), 'utf8')) as Preferences;
    if (isAppLocale(preferences.locale)) return preferences.locale;
  } catch {
    // First launch or an unreadable preference file: initialize from the system locale.
  }

  const locale = localeFromSystem(systemLocale);
  await saveLocalePreference(userDataRoot, locale);
  return locale;
}
