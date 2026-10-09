const fs = require("fs");
const path = require("path");

// Runs in the main process only. No arbitrary feed URL is accepted from the UI.
function createUpdater({
  app,
  autoUpdater,
  notify,
  resourcesPath = process.resourcesPath,
}) {
  let state = {
    phase: "disabled",
    currentVersion: app.getVersion(),
    message: "此版本尚未設定更新來源",
  };
  let checking = false,
    downloading = false,
    started = false,
    timer,
    firstCheck;
  const send = (patch) => {
    state = { ...state, ...patch };
    notify({ ...state });
  };
  function configured() {
    if (!app.isPackaged) return false;
    try {
      const text = fs.readFileSync(
        path.join(resourcesPath, "app-update.yml"),
        "utf8",
      );
      return (
        /provider:\s*generic/.test(text) &&
        /url:\s*['"]?https:\/\//.test(text) &&
        !text.includes("example.invalid")
      );
    } catch {
      return false;
    }
  }
  async function check() {
    if (!started || !configured()) {
      send({
        phase: "disabled",
        message: "更新來源尚未設定，請使用正式安裝版",
      });
      return { ...state };
    }
    if (checking || downloading || state.phase === "downloaded")
      return { ...state };
    checking = true;
    send({ phase: "checking", message: "正在檢查更新…", percent: 0 });
    try {
      await autoUpdater.checkForUpdates();
    } catch {
      send({
        phase: "error",
        message: "更新檢查失敗，原版本仍可使用，稍後可重試",
      });
    } finally {
      checking = false;
    }
    return { ...state };
  }
  async function download() {
    if (!started || state.phase !== "available" || downloading)
      return { ...state };
    downloading = true;
    send({ phase: "downloading", message: "正在下載更新…", percent: 0 });
    try {
      await autoUpdater.downloadUpdate();
    } catch {
      send({
        phase: "error",
        message: "更新下載失敗，原版本仍可使用，請重新檢查更新",
      });
    } finally {
      downloading = false;
    }
    return { ...state };
  }
  function install() {
    if (state.phase !== "downloaded") return false;
    send({ phase: "installing", message: "正在重新啟動並套用更新…" });
    // The updater launches the installer then exits; no manual file deletion.
    autoUpdater.quitAndInstall(false, true);
    return true;
  }
  function start() {
    if (started) return;
    started = true;
    autoUpdater.autoDownload = false;
    autoUpdater.autoInstallOnAppQuit = false;
    autoUpdater.allowDowngrade = false;
    autoUpdater.allowPrerelease = false;
    autoUpdater.on("update-available", (info) =>
      send({
        phase: "available",
        version: info.version,
        message: `發現新版本 ${info.version}`,
      }),
    );
    autoUpdater.on("update-not-available", () =>
      send({ phase: "current", message: "目前已是最新版本" }),
    );
    autoUpdater.on("download-progress", (progress) =>
      send({
        phase: "downloading",
        percent: Math.max(0, Math.min(100, Number(progress.percent) || 0)),
        message: "正在下載更新…",
      }),
    );
    autoUpdater.on("update-downloaded", (info) =>
      send({
        phase: "downloaded",
        version: info.version,
        percent: 100,
        message: "更新已準備好，按「重新啟動更新」套用",
      }),
    );
    autoUpdater.on("error", () =>
      send({ phase: "error", message: "更新暫時失敗，原版本仍可使用" }),
    );
    if (configured()) {
      send({ phase: "idle", message: "會自動檢查更新" });
      firstCheck = setTimeout(() => {
        void check();
      }, 15000);
      timer = setInterval(
        () => {
          void check();
        },
        60 * 60 * 1000,
      );
      firstCheck.unref?.();
      timer.unref?.();
    } else
      send({
        phase: "disabled",
        message: "更新来源尚未設定，原有功能可正常使用",
      });
  }
  return {
    start,
    check,
    download,
    install,
    status: () => ({ ...state }),
    stop: () => {
      clearTimeout(firstCheck);
      clearInterval(timer);
    },
  };
}
module.exports = { createUpdater };
