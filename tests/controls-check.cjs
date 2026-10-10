const vm = require("vm"),
  fs = require("fs"),
  path = require("path"),
  assert = require("assert");
const code = fs.readFileSync(path.join(__dirname, "..", "main.js"), "utf8");
async function main() {
  const windows = [],
    listeners = {},
    handlers = {},
    writes = [],
    links = [];
  let cursor = { x: 500, y: 500 },
    quit = false;
  class Window {
    constructor(options) {
      this.options = options;
      this.bounds = {
        x: 0,
        y: 0,
        width: options.width,
        height: options.height,
      };
      this.events = {};
      this.ignored = [];
      this.sent = [];
      this.webContents = {
        send: (...args) => this.sent.push(args),
        on() {},
        setWindowOpenHandler() {},
      };
      windows.push(this);
    }
    setBounds(b) {
      this.bounds = { ...b };
    }
    getBounds() {
      return this.bounds;
    }
    setAlwaysOnTop() {}
    setVisibleOnAllWorkspaces() {}
    setIgnoreMouseEvents(v) {
      this.ignored.push(v);
    }
    loadFile() {}
    once(n, f) {
      this.events[n] = f;
    }
    on(n, f) {
      this.events[n] = f;
    }
    showInactive() {}
    moveTop() {}
    isDestroyed() {
      return false;
    }
  }
  const area = { x: 0, y: 0, width: 1600, height: 1000 };
  const electron = {
    app: {
      requestSingleInstanceLock: () => true,
      quit: () => (quit = true),
      on() {},
      whenReady: () => Promise.resolve(),
      isPackaged: true,
      getPath: (k) => (k === "desktop" ? "/fake/desktop" : "/fake/user"),
      getAppPath: () => "/fake/RabbitDesktop.app/Contents/Resources/app.asar",
      dock: { hide() {} },
    },
    BrowserWindow: Window,
    screen: {
      getPrimaryDisplay: () => ({ workArea: area }),
      getDisplayNearestPoint: () => ({ workArea: area }),
      getCursorScreenPoint: () => cursor,
      on() {},
    },
    ipcMain: {
      on: (n, f) => (listeners[n] = f),
      handle: (n, f) => (handlers[n] = f),
    },
    Tray: class {
      setTitle() {}
      setToolTip() {}
      setContextMenu() {}
    },
    Menu: { buildFromTemplate: (v) => v },
    nativeImage: {
      createFromPath: () => ({
        crop() {
          return this;
        },
        resize() {
          return this;
        },
      }),
    },
    shell: {
      writeShortcutLink: (...args) => {
        links.push(args);
        return true;
      },
      openExternal() {},
    },
  };
  const fakefs = {
    readFileSync() {
      throw Error("no settings");
    },
    writeFileSync: (...args) => writes.push(args),
  };
  const context = {
    require: (n) =>
      n === "electron"
        ? electron
        : n === "fs"
          ? fakefs
          : n === "electron-updater"
            ? { autoUpdater: {} }
            : n === "./updater"
              ? {
                  createUpdater: () => ({
                    start() {},
                    stop() {},
                    status: () => ({ phase: "disabled" }),
                  }),
                }
              : require(n),
    process: {
      platform: "win32",
      execPath: "C:/RabbitDesktop/RabbitDesktop.exe",
    },
    __dirname: "/fake/source",
    setInterval: () => 1,
    clearInterval() {},
    console,
  };
  vm.createContext(context);
  vm.runInContext(code, context);
  await Promise.resolve();
  assert.equal(windows.length, 2);
  const [pet, dock] = windows;
  assert.equal(dock.options.focusable, true);
  assert.equal(dock.ignored.at(-1), false);
  const event = { sender: dock.webContents };
  listeners["dock-command"](event, "eat");
  assert.deepEqual(pet.sent.at(-1), ["pet-action", "eat"]);
  const before = pet.sent.length;
  listeners["dock-command"]({ sender: {} }, "sleep");
  listeners["dock-command"](event, "bad");
  assert.equal(pet.sent.length, before);
  const initial = { ...dock.bounds };
  await handlers["dock-panel"](event, true);
  assert(dock.bounds.width > 68);
  assert.equal(dock.bounds.x + dock.bounds.width, initial.x + 68);
  await handlers["dock-panel"](event, false);
  assert.equal(dock.bounds.width, 68);
  listeners["dock-drag"](event, "start");
  cursor = { x: 400, y: 350 };
  listeners["dock-drag"](event, "move");
  listeners["dock-drag"](event, "end");
  assert.equal(dock.bounds.x, initial.x - 100);
  assert.equal(dock.bounds.y, initial.y - 150);
  assert(writes.length);
  cursor = { x: 100, y: 100 };
  listeners["pet-bounds"]({ sender: pet.webContents }, [
    { x: 90, y: 90, width: 50, height: 50 },
  ]);
  assert.equal(pet.ignored.at(-1), false);
  cursor = { x: 700, y: 700 };
  listeners["pet-drag"]({ sender: pet.webContents }, true);
  assert.equal(pet.ignored.at(-1), false);
  listeners["pet-drag"]({ sender: pet.webContents }, false);
  assert.equal(
    pet.ignored.at(-1),
    true,
    "blank desktop click-through restored",
  );
  await handlers["desktop-shortcut"](event);
  assert.equal(links.length, 1);
  assert.equal(links[0][2].target, context.process.execPath);
  listeners["rabbit-quit"](event);
  assert(quit);
  console.log(
    "PASS: independent clickable dock, action allowlist, expand/collapse, screen drag/persist, mouse hit/drag/pass-through, desktop shortcut, exit",
  );
}
main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
