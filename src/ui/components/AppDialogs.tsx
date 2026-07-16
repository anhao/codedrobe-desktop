// SPDX-License-Identifier: MPL-2.0

import type { ThemeSummary } from '../../shared/types';
import type { UiCopy } from '../ui-types';
import { Icon } from './Icon';

export function AppDialogs({ restartThemeId, deleteThemeId, themes, copy, onCancelRestart, onRestart, onCancelDelete, onDelete }: {
  restartThemeId: string | null; deleteThemeId: string | null; themes: ThemeSummary[]; copy: UiCopy;
  onCancelRestart: () => void; onRestart: (id: string) => void; onCancelDelete: () => void; onDelete: () => void;
}) {
  return <>
    {restartThemeId && <div className="modal-backdrop"><div className="confirm-modal"><span className="modal-icon"><Icon name="restore"/></span><p className="eyebrow">{copy.restartEyebrow}</p><h2>{copy.restartTitle}</h2><p>{copy.restartDescription}</p><div><button onClick={onCancelRestart}>{copy.restartLater}</button><button className="confirm" onClick={() => onRestart(restartThemeId)}>{copy.restartAndApply}</button></div></div></div>}
    {deleteThemeId && <div className="modal-backdrop"><div className="confirm-modal delete-modal"><span className="modal-icon"><Icon name="delete"/></span><p className="eyebrow">{copy.deleteEyebrow}</p><h2>{copy.deleteTitle}</h2><p>{copy.deleteDescription(themes.find((theme) => theme.id === deleteThemeId)?.displayName ?? deleteThemeId)}</p><div><button onClick={onCancelDelete}>{copy.cancel}</button><button className="confirm danger" onClick={onDelete}>{copy.confirmDelete}</button></div></div></div>}
  </>;
}
