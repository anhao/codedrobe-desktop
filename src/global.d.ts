// SPDX-License-Identifier: MPL-2.0

import type { CodeDrobeApi } from './shared/types';

declare global {
  interface Window {
    codeDrobe: CodeDrobeApi;
  }
}

export {};
