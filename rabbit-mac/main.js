const {
  app,
  BrowserWindow,
  screen,
  ipcMain,
  Tray,
  Menu,
  nativeImage,
  shell,
} = require("electron");
const path = require("path"),
  fs = require("fs");
const CALENDAR = "https://wuwu-rabbit-desk.wuwu5055.chatgpt.site/api/calendar";
const SOURCE = "https://uch-espacios.publish.ceu.es/VLC_G_MED/calendar";
let win,
  dock,
  tray,
  timer,
  regions = [],
  dragging = false,
  pendingCalendar,
  lastIgnore = null,
  dockGesture = null,
  expanded = false;
let settings = {};
const COMMANDS = new Set([
  "pat",
  "peek",
  "sniff",
  "home",
  "eat",
  "sleep",
  "poop",
  "clean",
  "roam",
  "calendar",
]);
const locked = app.requestSingleInstanceLock();
if (!locked) app.quit();
app.on("second-instance", () => {
  if (win) {
    win.showInactive();
    dock?.showInactive();
    dock?.moveTop();
  }
});
function action(name) {
  win?.webContents.send("pet-action", name);
}
function trusted(event) {
  return win && !win.isDestroyed() && event.sender === win.webContents;
}
function controlTrusted(event) {
  return dock && !dock.isDestroyed() && event.sender === dock.webContents;
}
function saveSettings() {
  try {
    fs.writeFileSync(
      path.join(app.getPath("userData"), "settings-v3.json"),
      JSON.stringify(settings, null, 2),
    );
  } catch {}
}
function applyIgnore(ignore) {
  if (lastIgnore !== ignore) {
    win.setIgnoreMouseEvents(ignore, { forward: true });
    lastIgnore = ignore;
  }
}
function refreshMouse() {
  if (!win || win.isDestroyed()) return;
  const p = screen.getCursorScreenPoint(),
    w = win.getBounds(),
    local = { x: p.x - w.x, y: p.y - w.y };
  const hit =
    dragging ||
    regions.some(
      (r) =>
        local.x >= r.x &&
        local.x <= r.x + r.width &&
        local.y >= r.y &&
        local.y <= r.y + r.height,
    );
  applyIgnore(!hit);
  win.webContents.send("pet-cursor", local);
}
function placeDock(anchor) {
  const area = screen.getDisplayNearestPoint(anchor).workArea;
  const width = expanded ? Math.min(300, area.width) : 68,
    height = expanded ? Math.min(590, area.height) : 68;
  const x = Math.round(
      Math.max(
        area.x,
        Math.min(area.x + area.width - width, anchor.x - width + 34),
      ),
    ),
    y = Math.round(
      Math.max(
        area.y,
        Math.min(area.y + area.height - height, anchor.y - height + 34),
      ),
    );
  dock.setBounds({ x, y, width, height });
  settings.anchor = { x: x + width - 34, y: y + height - 34 };
}
async function createDesktopShortcut() {
  const desktop = app.getPath("desktop");
  if (process.platform === "win32") {
    const target = process.execPath;
    const dest = path.join(desktop, "RabbitDesktop-v3.lnk");
    if (
      !shell.writeShortcutLink(dest, "create", {
        target,
        cwd: path.dirname(target),
        description: "啟動兔兔桌面寵物",
        icon: target,
        iconIndex: 0,
      })
    )
      throw Error("shortcut");
  } else if (process.platform === "darwin") {
    const target = path.resolve(app.getAppPath(), "../../..");
    if (!target.endsWith(".app")) throw Error("not packaged");
    const dest = path.join(desktop, "RabbitDesktop-v3.app");
    try {
      const info = fs.lstatSync(dest);
      if (!info.isSymbolicLink()) throw Error("桌面有同名檔案");
      fs.unlinkSync(dest);
    } catch (error) {
      if (error.code !== "ENOENT") throw error;
    }
    fs.symlinkSync(target, dest, "dir");
  } else throw Error("此平台不支援桌面捷徑");
  settings.shortcutCreated = true;
  saveSettings();
  return "已建立桌面啟動捷徑：RabbitDesktop-v3";
}
async function calendar() {
  if (pendingCalendar) return pendingCalendar;
  pendingCalendar = (async () => {
    const cache = path.join(app.getPath("userData"), "calendar-cache.json");
    let previous;
    try {
      previous = JSON.parse(fs.readFileSync(cache, "utf8"));
    } catch {}
    try {
      const response = await fetch(CALENDAR, {
        signal: AbortSignal.timeout(120000),
      });
      if (!response.ok) throw Error("HTTP " + response.status);
      const data = await response.json();
      if (!Array.isArray(data.events) || !data.updatedAt || !data.range)
        throw Error("課表格式錯誤");
      fs.writeFileSync(cache, JSON.stringify(data));
      return data;
    } catch (error) {
      if (previous)
        return { ...previous, stale: true, error: "連線失敗，顯示上次課表" };
      throw Error("目前無法連線讀取課表");
    }
  })();
  try {
    return await pendingCalendar;
  } finally {
    pendingCalendar = null;
  }
}
if (locked)
  app.whenReady().then(() => {
    try {
      settings = JSON.parse(
        fs.readFileSync(
          path.join(app.getPath("userData"), "settings-v3.json"),
          "utf8",
        ),
      );
    } catch {}
    const area = screen.getPrimaryDisplay().workArea;
    win = new BrowserWindow({
      ...area,
      transparent: true,
      frame: false,
      hasShadow: false,
      resizable: false,
      movable: false,
      fullscreenable: false,
      skipTaskbar: true,
      focusable: true,
      acceptFirstMouse: true,
      show: false,
      backgroundColor: "#00000000",
      webPreferences: {
        preload: path.join(__dirname, "preload.js"),
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: true,
        backgroundThrottling: false,
      },
    });
    win.setAlwaysOnTop(true, "floating");
    if (process.platform === "darwin")
      win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
    applyIgnore(true);
    win.loadFile(path.join(__dirname, "index.html"));
    win.once("ready-to-show", () => win.showInactive());
    function openSource(url) {
      if (url === SOURCE) shell.openExternal(SOURCE);
    }
    win.webContents.setWindowOpenHandler(({ url }) => {
      openSource(url);
      return { action: "deny" };
    });
    win.webContents.on("will-navigate", (event, url) => {
      event.preventDefault();
      openSource(url);
    });
    if (process.platform === "darwin") app.dock.hide();
    const icon = nativeImage
      .createFromPath(path.join(__dirname, "assets/rabbit-sheet.png"))
      .crop({ x: 0, y: 0, width: 627, height: 627 })
      .resize({ width: 24, height: 24 });
    tray = new Tray(icon);
    if (process.platform === "darwin") tray.setTitle("兔兔");
    tray.setToolTip("兔兔桌面寵物 v3");
    tray.setContextMenu(
      Menu.buildFromTemplate([
        { label: "拍拍", click: () => action("pat") },
        { label: "探頭", click: () => action("peek") },
        { label: "聞聞", click: () => action("sniff") },
        { label: "吃草", click: () => action("eat") },
        { label: "睡覺", click: () => action("sleep") },
        { label: "一鍵清理便便", click: () => action("clean") },
        { type: "separator" },
        { label: "切換自主跳動", click: () => action("roam") },
        { label: "展開／收起課表", click: () => action("calendar") },
        { label: "回到桌面中央", click: () => action("home") },
        { type: "separator" },
        {
          label: "顯示控制按鈕",
          click: () => {
            dock.showInactive();
            dock.moveTop();
          },
        },
        {
          label: "建立桌面啟動捷徑",
          click: () => createDesktopShortcut().catch(() => {}),
        },
        { label: "退出兔兔", click: () => app.quit() },
      ]),
    );
    ipcMain.on("pet-bounds", (event, value) => {
      if (trusted(event) && Array.isArray(value)) {
        regions = value
          .slice(0, 40)
          .filter(
            (r) =>
              r &&
              [r.x, r.y, r.width, r.height].every(Number.isFinite) &&
              r.width > 0 &&
              r.height > 0,
          );
        refreshMouse();
      }
    });
    ipcMain.on("pet-drag", (event, value) => {
      if (trusted(event)) {
        dragging = !!value;
        refreshMouse();
      }
    });
    ipcMain.handle("calendar-get", (event) => {
      if (!trusted(event)) throw Error("拒絕存取");
      return calendar();
    });
    timer = setInterval(refreshMouse, 20);
    dock = new BrowserWindow({
      width: 68,
      height: 68,
      parent: win,
      transparent: true,
      frame: false,
      hasShadow: false,
      resizable: false,
      skipTaskbar: true,
      acceptFirstMouse: true,
      focusable: true,
      show: false,
      backgroundColor: "#00000000",
      webPreferences: {
        preload: path.join(__dirname, "preload.js"),
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: true,
      },
    });
    dock.setAlwaysOnTop(true, "pop-up-menu");
    if (process.platform === "darwin")
      dock.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
    dock.setIgnoreMouseEvents(false);
    dock.loadFile(path.join(__dirname, "dock.html"));
    dock.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
    dock.webContents.on("will-navigate", (event) => event.preventDefault());
    const initial =
      settings.anchor &&
      Number.isFinite(settings.anchor.x) &&
      Number.isFinite(settings.anchor.y)
        ? settings.anchor
        : { x: area.x + area.width - 48, y: area.y + area.height - 48 };
    placeDock(initial);
    dock.once("ready-to-show", () => {
      dock.showInactive();
      dock.moveTop();
      if (!settings.shortcutCreated && app.isPackaged)
        createDesktopShortcut().catch(() => {});
    });
    ipcMain.on("dock-command", (event, name) => {
      if (controlTrusted(event) && COMMANDS.has(name)) action(name);
    });
    ipcMain.on("rabbit-quit", (event) => {
      if (controlTrusted(event)) app.quit();
    });
    ipcMain.handle("desktop-shortcut", (event) => {
      if (!controlTrusted(event)) throw Error("拒絕存取");
      return createDesktopShortcut();
    });
    ipcMain.handle("dock-panel", (event, value) => {
      if (!controlTrusted(event)) throw Error("拒絕存取");
      expanded = !!value;
      placeDock(settings.anchor);
      dock.moveTop();
      saveSettings();
      return true;
    });
    ipcMain.on("dock-drag", (event, phase) => {
      if (!controlTrusted(event)) return;
      if (phase === "start")
        dockGesture = {
          cursor: screen.getCursorScreenPoint(),
          anchor: { ...settings.anchor },
        };
      else if (phase === "move" && dockGesture) {
        const cursor = screen.getCursorScreenPoint();
        placeDock({
          x: dockGesture.anchor.x + cursor.x - dockGesture.cursor.x,
          y: dockGesture.anchor.y + cursor.y - dockGesture.cursor.y,
        });
      } else if (phase === "end") {
        dockGesture = null;
        saveSettings();
      }
    });
    ipcMain.on("pet-state", (event, value) => {
      if (
        trusted(event) &&
        value &&
        typeof value.roaming === "boolean" &&
        Number.isInteger(value.poops)
      )
        dock.webContents.send("pet-state", {
          roaming: value.roaming,
          poops: value.poops,
          calendarOpen: !!value.calendarOpen,
        });
    });
    function resetDisplay() {
      win.setBounds(screen.getPrimaryDisplay().workArea);
      action("home");
      placeDock(settings.anchor);
    }
    screen.on("display-metrics-changed", resetDisplay);
    screen.on("display-removed", resetDisplay);
    win.on("blur", () => {
      if (dragging) {
        dragging = false;
        action("home");
        refreshMouse();
      }
    });
  });
app.on("before-quit", () => {
  clearInterval(timer);
  tray?.destroy();
});
app.on("window-all-closed", () => app.quit());
