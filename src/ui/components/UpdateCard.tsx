// SPDX-License-Identifier: MPL-2.0

import type { UpdateInfo } from '../../shared/types';
import type { UiCopy } from '../ui-types';
import { Icon } from './Icon';

export function UpdateCard({ appVersion, update, checking, downloading, progress, copy, onAction }: {
  appVersion: string;
  update: UpdateInfo | null;
  checking: boolean;
  downloading: boolean;
  progress: number;
  copy: UiCopy;
  onAction: () => void;
}) {
  const available = update?.status === 'available';
  const unavailable = update?.status === 'unavailable';
  const title = checking
    ? copy.checkingUpdates
    : available
      ? copy.updateAvailable(update.latestVersion ?? '')
      : update?.status === 'up-to-date'
        ? copy.latestVersion(appVersion)
        : unavailable
          ? copy.updateCheckFailed
          : copy.version(appVersion);
  const detail = downloading
    ? copy.downloadingUpdate(progress)
    : checking
      ? copy.contactingGithub
      : available
        ? update.asset ? copy.downloadUpdate : copy.openReleasePage
        : unavailable
          ? copy.checkAgain
        : update?.checkedAt
          ? copy.checkedAt(update.checkedAt)
          : copy.checkForUpdates;

  return <button
    className={`update-card ${available ? 'has-update' : ''} ${unavailable ? 'has-error' : ''}`}
    type="button"
    onClick={onAction}
    disabled={checking || downloading}
    aria-busy={checking || downloading}
  >
    <span className={checking ? 'is-spinning' : ''}><Icon name={available ? 'download' : 'refresh'}/></span>
    <span><strong>{title}</strong><small>{detail}</small></span>
  </button>;
}
