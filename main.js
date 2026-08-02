'use strict';

// ═══════════════════════════════════════════════════════════════
// brief-toolkit — Main Process Entry
// ═══════════════════════════════════════════════════════════════
// Handles IPC from the i18n panel and manages locale files on disk
// within the Cocos Creator editor main process.
// ═══════════════════════════════════════════════════════════════

const fs = require('fs');
const path = require('path');

const PACKAGE_NAME = 'brief-toolkit-i18n-2x';

// ── Helpers ────────────────────────────────────────────────────

/**
 * Read a JSON file, return parsed object or null.
 */
function readJSON(filePath) {
  try {
    if (!fs.existsSync(filePath)) return null;
    return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  } catch (_) {
    return null;
  }
}

/**
 * Write a JSON file, creating parent directories if needed.
 */
function writeJSON(filePath, data) {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
}

/**
 * Resolve resourceDir relative to project path.
 * If relative, resolve against Editor.Project.path.
 */
function resolveResourceDir(resourceDir) {
  if (!resourceDir) return '';
  if (path.isAbsolute(resourceDir)) return resourceDir;
  return path.join(Editor.Project.path, 'assets', 'resources', resourceDir);
}

/**
 * Scan a directory for locale JSON files and return locale info list.
 */
function scanLocales(dirPath) {
  if (!dirPath || !fs.existsSync(dirPath)) return [];

  const entries = fs.readdirSync(dirPath, { withFileTypes: true });
  const results = [];

  for (const entry of entries) {
    if (!entry.isFile() || !entry.name.endsWith('.json')) continue;
    if (entry.name === '.schema.json') continue;

    const code = entry.name.replace(/\.json$/, '');
    const jsonPath = path.join(dirPath, entry.name);
    const data = readJSON(jsonPath);
    const name = (data && data.meta && data.meta.name) ? data.meta.name : code;

    results.push({
      code: code,
      name: name,
      jsonPath: jsonPath,
    });
  }

  return results;
}

/**
 * Get the default template locale JSON from the resource directory.
 */
function getTemplateLocaleInfo(resourceDir, templateCode) {
  if (!templateCode) return null;
  var templatePath = path.join(resourceDir, templateCode + '.json');
  var json = readJSON(templatePath);
  if (!json) return null;
  return { code: templateCode, json: json };
}

// ═══════════════════════════════════════════════════════════════
// Panel State Persistence
// ═══════════════════════════════════════════════════════════════

var STATE_FILENAME = 'brief-toolkit-i18n.json';

function getStatePath() {
  return path.join(Editor.Project.path, 'settings', STATE_FILENAME);
}

function loadPanelState() {
  var p = getStatePath();
  var data = readJSON(p);
  return data || {};
}

function savePanelState(state) {
  var p = getStatePath();
  var dir = path.dirname(p);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  writeJSON(p, state);
}

// ═══════════════════════════════════════════════════════════════

module.exports = {

  load() {
    Editor.log('[' + PACKAGE_NAME + '] loaded');
  },

  unload() {
    Editor.log('[' + PACKAGE_NAME + '] unloaded');
  },

  messages: {

    // ── Panel Lifecycle ──────────────────────────────────

    'open-i18n-panel'() {
      Editor.Panel.open(PACKAGE_NAME);
    },

    // ── State Persistence ────────────────────────────────

    'load-state'(event) {
      var state = loadPanelState();
      event.reply(null, state);
    },

    'save-state'(event, state) {
      savePanelState(state || {});
      event.reply(null);
    },

    // ── Data Retrieval ───────────────────────────────────

    'get-locales'(event, resourceDir) {
      const absDir = resolveResourceDir(resourceDir);
      const locales = scanLocales(absDir);
      event.reply(null, { locales: locales });
    },

    // ── Add Locale ───────────────────────────────────────

    'add-locale'(event, data) {
      var resourceDir = data.resourceDir;
      var code = data.code;
      var name = data.name;
      var templateCode = data.templateCode;

      var absDir = resolveResourceDir(resourceDir);
      if (!absDir) {
        event.reply(new Error('Resource directory not configured.'));
        return;
      }

      var targetPath = path.join(absDir, code + '.json');
      if (fs.existsSync(targetPath)) {
        event.reply(new Error('Locale "' + code + '" already exists.'));
        return;
      }

      var template = templateCode ? getTemplateLocaleInfo(absDir, templateCode) : null;
      if (!template || !template.json) {
        // No template found — create a minimal locale file
        var newLocale = {
          "$schema": ".schema.json",
          "meta": {
            "code": code,
            "name": name || code,
            "version": "1.0.0"
          }
        };
        writeJSON(targetPath, newLocale);
        Editor.log('[' + PACKAGE_NAME + '] Created locale "' + code + '" (minimal).');
        event.reply(null, { code: code, name: name || code, jsonPath: targetPath });
        return;
      }

      var newLocaleData = deepCopy(template.json);
      newLocaleData.meta = newLocaleData.meta || {};
      newLocaleData.meta.code = code;
      newLocaleData.meta.name = name || code;
      writeJSON(targetPath, newLocaleData);
      Editor.log('[' + PACKAGE_NAME + '] Created locale "' + code + '" from template "' + template.code + '".');
      event.reply(null, { code: code, name: name || code, jsonPath: targetPath });
    },

    // ── Sync Locale ──────────────────────────────────────

    'sync-locale'(event, data) {
      var resourceDir = data.resourceDir;
      var code = data.code;
      var templateCode = data.templateCode;

      var absDir = resolveResourceDir(resourceDir);
      if (!absDir) {
        event.reply(new Error('Resource directory not configured.'));
        return;
      }

      var targetPath = path.join(absDir, code + '.json');
      var templatePath = path.join(absDir, templateCode + '.json');

      var target = readJSON(targetPath);
      var template = readJSON(templatePath);

      if (!target) {
        event.reply(new Error('Target locale "' + code + '" not found.'));
        return;
      }
      if (!template) {
        event.reply(new Error('Template locale "' + templateCode + '" not found.'));
        return;
      }

      mergeKeys(template, target);
      writeJSON(targetPath, target);

      Editor.log('[' + PACKAGE_NAME + '] Synced keys from "' + templateCode + '" → "' + code + '".');
      event.reply(null, { code: code });
    },

    // ── Delete Locale ────────────────────────────────────

    'delete-locale'(event, data) {
      var resourceDir = data.resourceDir;
      var code = data.code;

      var absDir = resolveResourceDir(resourceDir);
      if (!absDir) {
        event.reply(new Error('Resource directory not configured.'));
        return;
      }

      var targetPath = path.join(absDir, code + '.json');
      if (!fs.existsSync(targetPath)) {
        event.reply(new Error('Locale "' + code + '" does not exist.'));
        return;
      }

      fs.unlinkSync(targetPath);
      Editor.log('[' + PACKAGE_NAME + '] Deleted locale "' + code + '".');
      event.reply(null, { code: code });
    },

    // ── Open Directory ───────────────────────────────────

    // ── Open File ────────────────────────────────────────
    // Opens the locale JSON file with the system default editor (e.g. VSCode).

    'open-file'(event, filePath) {
      var absPath = resolveResourceDir(filePath);
      if (!absPath || !fs.existsSync(absPath)) {
        event.reply(new Error('File does not exist: ' + (absPath || filePath)));
        return;
      }

      require('electron').shell.openPath(absPath);
      event.reply(null);
    },

    // ── Get Project Info ─────────────────────────────────

    'get-project-path'(event) {
      event.reply(null, { projectPath: Editor.Project.path });
    },

    // ── Editor Sprite Preview (db:// → UUID) ─────────────

    /**
     * Resolve a db:// image URL to its SpriteFrame sub-asset UUID.
     * Called by scene-script.js via Editor.Ipc.sendToMain to bridge
     * bundle image paths from the scene webview into the main process,
     * where Editor.assetdb is available.
     *
     * In 2.x the SpriteFrame UUID is stored in the .meta file's
     * subMetas.spriteFrame.uuid field — not accessible via a URL suffix.
     *
     * Example: "db://bundle-i18n/zh/start"
     *   → finds "db://assets/bundle-i18n/zh/start.png"
     *   → reads "…/start.png.meta" → subMetas.spriteFrame.uuid
     */
    'resolve-sprite-uuid'(event, dbUrl) {
      var inner = (dbUrl || '').replace(/^db:\/\//, '');
      if (!inner) {
        event.reply(new Error('Invalid db:// URL: ' + dbUrl));
        return;
      }

      // Step 1: find the texture URL by trying common image extensions
      var extensions = ['.png', '.jpg', '.jpeg', '.webp', '.PNG', '.JPG'];
      var textureUrl = '';
      for (var i = 0; i < extensions.length; i++) {
        var candidate = 'db://assets/' + inner + extensions[i];
        if (Editor.assetdb.exists(candidate)) {
          textureUrl = candidate;
          break;
        }
      }
      if (!textureUrl) {
        var noExtUrl = 'db://assets/' + inner;
        if (Editor.assetdb.exists(noExtUrl)) {
          textureUrl = noExtUrl;
        }
      }
      if (!textureUrl) {
        event.reply(new Error('Asset not found for: ' + dbUrl));
        return;
      }

      // Step 2: read the .meta file to find the SpriteFrame sub-asset UUID.
      // In Cocos Creator 2.x, when type=image/sprite, each subMeta with
      // importer=texture is a SpriteFrame. Its UUID has the format
      // "{assetUuid}@{hash}" — that's the sub-asset UUID we need.
      var fspath = Editor.assetdb.urlToFspath(textureUrl);
      var metaPath = fspath + '.meta';
      var meta = readJSON(metaPath);
      if (meta && meta.subMetas) {
        // Iterate over subMetas to find the first SpriteFrame entry.
        // Typical keys: "spriteFrame", or named frames like "home", "start".
        var subKeys = Object.keys(meta.subMetas);
        for (var k = 0; k < subKeys.length; k++) {
          var sub = meta.subMetas[subKeys[k]];
          if (sub && sub.importer === 'texture' && sub.uuid) {
            // sub.uuid is the SpriteFrame UUID, e.g. "xxx@6c48a"
            event.reply(null, sub.uuid);
            return;
          }
        }
      }

      // Fallback: return the raw texture UUID (no crop, but shows the image)
      var texUuid = Editor.assetdb.urlToUuid(textureUrl);
      if (texUuid) {
        event.reply(null, texUuid);
        return;
      }

      event.reply(new Error('Failed to resolve UUID for: ' + textureUrl));
    }

  }
};

// ═══════════════════════════════════════════════════════════════
// Deep-merge helpers (module scope, not exported)
// ═══════════════════════════════════════════════════════════════

function mergeKeys(source, target) {
  // Remove keys that are no longer in the template
  var targetKeys = Object.keys(target);
  for (var t = 0; t < targetKeys.length; t++) {
    if (!(targetKeys[t] in source)) {
      delete target[targetKeys[t]];
    }
  }

  // Add new keys from template, recurse into nested objects
  var keys = Object.keys(source);
  for (var i = 0; i < keys.length; i++) {
    var key = keys[i];
    if (!(key in target)) {
      // New key: copy template value so translators can see the source text
      target[key] = deepCopy(source[key]);
    } else if (
      typeof source[key] === 'object' && source[key] !== null &&
      !Array.isArray(source[key]) &&
      typeof target[key] === 'object' && target[key] !== null
    ) {
      mergeKeys(source[key], target[key]);
    }
    // Existing key: preserve target's translated value
  }
}

function deepCopy(obj) {
  if (obj === null || obj === undefined) return obj;
  if (Array.isArray(obj)) return obj.map(deepCopy);
  if (typeof obj === 'object') {
    var result = {};
    var keys = Object.keys(obj);
    for (var i = 0; i < keys.length; i++) {
      result[keys[i]] = deepCopy(obj[keys[i]]);
    }
    return result;
  }
  return obj;
}
