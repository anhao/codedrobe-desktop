// SPDX-License-Identifier: MPL-2.0

import type { UiCopy } from '../ui-types';
import { Icon } from './Icon';

export function ThemeSearch({ value, copy, onChange }: {
  value: string;
  copy: UiCopy;
  onChange: (value: string) => void;
}) {
  return <label className="theme-search">
    <Icon name="search"/>
    <input
      type="search"
      value={value}
      onChange={(event) => onChange(event.target.value)}
      placeholder={copy.searchThemes}
      aria-label={copy.searchThemes}
      autoComplete="off"
      spellCheck={false}
    />
    {value && <button type="button" onClick={() => onChange('')} aria-label={copy.clearSearch} title={copy.clearSearch}><Icon name="close"/></button>}
  </label>;
}
