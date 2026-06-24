/**
 * Thin typed wrapper over the global `window.Telegram.WebApp` injected by
 * telegram-web-app.js (loaded in index.html). We use the global object directly
 * (rather than a heavier SDK) for the few features we need: initData (auth),
 * theme/appearance, the docked MainButton, haptics, and Stars invoices.
 */

interface MainButton {
  text: string;
  setText(text: string): void;
  show(): void;
  hide(): void;
  enable(): void;
  disable(): void;
  onClick(cb: () => void): void;
  offClick(cb: () => void): void;
  showProgress(leaveActive?: boolean): void;
  hideProgress(): void;
  setParams(p: { text?: string; is_active?: boolean; is_visible?: boolean }): void;
}

interface HapticFeedback {
  impactOccurred(style: "light" | "medium" | "heavy" | "rigid" | "soft"): void;
  notificationOccurred(type: "error" | "success" | "warning"): void;
  selectionChanged(): void;
}

export interface TelegramWebApp {
  initData: string;
  colorScheme: "light" | "dark";
  platform: string;
  version: string;
  ready(): void;
  expand(): void;
  setHeaderColor(color: string): void;
  MainButton: MainButton;
  HapticFeedback: HapticFeedback;
  openInvoice(url: string, callback: (status: "paid" | "cancelled" | "failed" | "pending") => void): void;
}

export const tg: TelegramWebApp | undefined =
  typeof window !== "undefined"
    ? ((window as unknown as { Telegram?: { WebApp?: TelegramWebApp } }).Telegram?.WebApp ?? undefined)
    : undefined;

/** Safe haptic helpers (no-op outside Telegram). */
export const haptic = {
  success: () => tg?.HapticFeedback.notificationOccurred("success"),
  error: () => tg?.HapticFeedback.notificationOccurred("error"),
  tap: () => tg?.HapticFeedback.selectionChanged(),
};

export const isDark = tg?.colorScheme === "dark";
export const tgPlatform: "ios" | "base" = /^(ios|macos)$/i.test(tg?.platform ?? "") ? "ios" : "base";
