import { resolveApiUrl } from '../api/client';
import type { AppearanceSettings } from '../api/types';
import { darken, hexToRgba } from './colors';

export const DEFAULT_TITLE = 'TIBO';
const FAVICON_ID = 'appearance-favicon';

/** Overrides the button/link accent app-wide via the same CSS custom properties index.css already defines — reverting (null) just removes the inline override, falling back to the authored default. */
export function applyPrimaryColor(hex: string | null): void {
  const root = document.documentElement.style;
  if (!hex) {
    root.removeProperty('--accent');
    root.removeProperty('--accent-hover');
    root.removeProperty('--accent-bg');
    return;
  }
  root.setProperty('--accent', hex);
  root.setProperty('--accent-hover', darken(hex, 0.15));
  root.setProperty('--accent-bg', hexToRgba(hex, 0.1));
}

export function applyBackgroundColor(hex: string | null): void {
  const root = document.documentElement.style;
  if (!hex) root.removeProperty('--page');
  else root.setProperty('--page', hex);
}

export function applyTitle(title: string | null): void {
  document.title = title || DEFAULT_TITLE;
}

export function applyFavicon(url: string | null): void {
  let link = document.getElementById(FAVICON_ID) as HTMLLinkElement | null;
  if (!url) {
    link?.remove();
    return;
  }
  if (!link) {
    link = document.createElement('link');
    link.id = FAVICON_ID;
    link.rel = 'icon';
    document.head.appendChild(link);
  }
  link.href = resolveApiUrl(url);
}

export function applyAppearance(settings: AppearanceSettings): void {
  applyPrimaryColor(settings.primaryColor);
  applyBackgroundColor(settings.backgroundColor);
  applyTitle(settings.title);
  applyFavicon(settings.faviconUrl);
}
