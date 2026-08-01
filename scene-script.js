'use strict';

// ═══════════════════════════════════════════════════════════════
// brief-toolkit — Scene Script (Editor Bridge)
// ═══════════════════════════════════════════════════════════════
// Runs in the scene webview alongside game scripts (same JS context).
// Provides a minimal bridge: resolves db:// URLs to asset UUIDs via
// the main process (which has Editor.assetdb).
//
// Asset loading is handled by I18nManager on the game side.
//
// Flow:
//   I18nManager  → window.__btk_i18n_resolveUuid(dbUrl) → UUID
//     → Editor.Ipc.sendToMain('brief-toolkit-i18n-2x:resolve-sprite-uuid', dbUrl)
//       → main.js → Editor.assetdb → UUID
//     ← UUID string
//   I18nManager  → cc.assetManager.loadAny(uuid) → cc.SpriteFrame
//
// If Editor.Ipc is unavailable, returns null (graceful degradation).
// ═══════════════════════════════════════════════════════════════

var PACKAGE_NAME = 'brief-toolkit-i18n-2x';

// ── Bridge: resolve db:// URL → UUID via IPC ──────────────────
// Returns Promise<string | null>.

function resolveUuidViaIpc(dbUrl) {
  return new Promise(function (resolve) {
    if (typeof Editor === 'undefined' || !Editor.Ipc || !Editor.Ipc.sendToMain) {
      console.warn('[i18n-editor] Editor.Ipc unavailable — bundle sprite preview disabled');
      resolve(null);
      return;
    }

    Editor.Ipc.sendToMain(
      PACKAGE_NAME + ':resolve-sprite-uuid',
      dbUrl,
      function (err, uuid) {
        resolve(err || !uuid ? null : uuid);
      },
    );
  });
}

// ── Expose global bridge function ─────────────────────────────

Object.defineProperty(window, '__btk_i18n_resolveUuid', {
  value: resolveUuidViaIpc,
  writable: false,
  configurable: true,
  enumerable: false,
});

module.exports = {};
