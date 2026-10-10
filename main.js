const {
  app,
  BrowserWindow,
  screen,
  ipcMain,
  Tray,
  Menu,
  nativeImage,
  shell,
  dialog,
} = require("electron");
const path = require("path"),
  fs = require("fs");
const { autoUpdater } = require("electron-updater");
const { createUpdater } = require("./updater");
let updater;
let studioWindow, studio, localAI;
const { createLocalAI } = require("./local-ai");
const { createStudio } = require("./studio-service");
function openStudio() {
  if (studioWindow && !studioWindow.isDestroyed()) {
    studioWindow.show();
    studioWindow.focus();
    return;
  }
  studioWindow = new BrowserWindow({
    width: 1000,
    height: 800,
    minWidth: 600,
    minHeight: 500,
    title: "兔兔圖片工作室",
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });
  studioWindow.loadFile(path.join(__dirname, "studio.html"));
  studioWindow.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
  studioWindow.webContents.on("will-navigate", (e) => e.preventDefault());
  studioWindow.on("closed", () => {
    studioWindow = null;
  });
}
function studioTrusted(e) {
  return (
    studioWindow &&
    !studioWindow.isDestroyed() &&
    e.sender === studioWindow.webContents
  );
}
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
    updater = createUpdater({
      app,
      autoUpdater,
      notify: (value) => {
        if (dock && !dock.isDestroyed())
          dock.webContents.send("update-state", value);
      },
    });
    ipcMain.handle("update-status", (event) => {
      if (!controlTrusted(event)) throw Error("拒絕存取");
      return updater.status();
    });
    ipcMain.handle("update-check", (event) => {
      if (!controlTrusted(event)) throw Error("拒絕存取");
      return updater.check();
    });
    ipcMain.handle("update-download", (event) => {
      if (!controlTrusted(event)) throw Error("拒絕存取");
      return updater.download();
    });
    ipcMain.handle("update-install", (event) => {
      if (!controlTrusted(event)) throw Error("拒絕存取");
      return updater.install();
    });
    localAI = createLocalAI({
      root: __dirname,
      userData: app.getPath("userData"),
      notify: (value) => {
        if (studioWindow && !studioWindow.isDestroyed())
          studioWindow.webContents.send("local-ai-state", value);
      },
    });
    studio = createStudio({
      localAI,
      root: __dirname,
      userData: app.getPath("userData"),
    });
    if (
      !app.isPackaged &&
      !studio.status().references &&
      fs.existsSync(path.join(__dirname, ".studio-references"))
    ) {
      const folder = path.join(__dirname, ".studio-references");
      studio
        .importReferences(
          fs.readdirSync(folder).map((f) => path.join(folder, f)),
          (file) =>
            nativeImage.createFromPath(file).resize({ width: 1024 }).toPNG(),
        )
        .catch(() => {});
    }
    ipcMain.handle("studio-open", (e) => {
      if (!controlTrusted(e)) throw Error("拒絕存取");
      openStudio();
      return true;
    });
    const studioHandler = (name, fn) =>
      ipcMain.handle(name, (e, ...args) => {
        if (!studioTrusted(e)) throw Error("拒絕存取");
        return fn(...args);
      });
    studioHandler("studio-status", () => studio.status());
    studioHandler("local-ai-status", () => localAI.status());
    studioHandler("local-ai-install", async () => {
      const status = await localAI.status();
      if (!status.hardware.supported) throw Error(status.hardware.message);
      const answer = await dialog.showMessageBox(studioWindow, {
        type: "question",
        title: "安裝免費本機生圖",
        message: "為這台電腦安裝生圖工具與模型？",
        detail:
          status.hardware.label +
          "\n" +
          status.hardware.model +
          "\n需預留約28 GB；首次下載約8～15 GB，依運算套件而異。安裝後生成不收 API 費用。\n" +
          status.hardware.message,
        buttons: ["取消", "確認下載並安裝"],
        defaultId: 0,
        cancelId: 0,
      });
      if (answer.response !== 1) return localAI.status();
      return localAI.install();
    });
    studioHandler("local-ai-start", () => localAI.start());
    studioHandler("local-ai-stop", () => {
      localAI.stop();
      return localAI.status();
    });
    studioHandler("local-ai-cancel", () => {
      localAI.cancel();
      return true;
    });
    studioHandler("studio-theme", () => studio.randomTheme());
    studioHandler("studio-generate", (input) => studio.generate(input));
    studioHandler("studio-photos", async () => {
      const r = await dialog.showOpenDialog(studioWindow, {
        title: "選擇同一隻兔子的照片",
        properties: ["openFile", "multiSelections"],
        filters: [{ name: "照片", extensions: ["png", "jpg", "jpeg", "webp"] }],
      });
      if (r.canceled) return studio.status();
      return studio.importReferences(r.filePaths, (file) => {
        const image = nativeImage.createFromPath(file);
        if (image.isEmpty()) throw Error("無法讀取照片");
        return image.resize({ width: 1024 }).toPNG();
      });
    });
    studioHandler("studio-key", async () => {
      const r = await dialog.showOpenDialog(studioWindow, {
        title: "選擇包含 OPENAI_API_KEY 的設定檔",
        properties: ["openFile", "showHiddenFiles"],
      });
      return r.canceled ? studio.status() : studio.importKey(r.filePaths[0]);
    });
    studioHandler("studio-save", async () => {
      const r = await dialog.showSaveDialog(studioWindow, {
        defaultPath: path.join(
          app.getPath("downloads"),
          "兔兔-" + Date.now() + ".png",
        ),
        filters: [{ name: "PNG 圖片", extensions: ["png"] }],
      });
      return r.canceled ? false : studio.save(r.filePath);
    });
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
    tray.setToolTip("兔兔桌面寵物 v4");
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
      updater.start();
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
  updater?.stop();
  localAI?.stop();
  clearInterval(timer);
  tray?.destroy();
});
app.on("window-all-closed", () => app.quit());
