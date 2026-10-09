const fs = require("fs");
const path = require("path");
const semver = require("semver");
const yaml = require("js-yaml");

// Runs in the main process only. No arbitrary feed URL is accepted from the UI.
function createUpdater({
  app,
  autoUpdater,
  notify,
  resourcesPath = process.resourcesPath,
  platform = process.platform,
  fetchRelease = (...args) => require("electron").net.fetch(...args),
  openExternal = (url) => require("electron").shell.openExternal(url),
}) {
  let state = {
    phase: "disabled",
    currentVersion: app.getVersion(),
    message: "此版本尚未設定更新來源",
    manualDownload: platform === "darwin",
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
      const config = yaml.load(text);
      return (
        config?.provider === "github" &&
        config.owner === "wuwu50" &&
        config.repo === "Repository-name"
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
      if (platform === "darwin") {
        const response = await fetchRelease(
          "https://api.github.com/repos/wuwu50/Repository-name/releases/latest",
          {
            headers: { Accept: "application/vnd.github+json" },
            signal: AbortSignal.timeout(15000),
          },
        );
        if (response.status === 404) {
          send({ phase: "current", message: "尚未發布正式版本" });
          return { ...state };
        }
        if (!response.ok) throw Error(`HTTP ${response.status}`);
        const release = await response.json();
        const version = semver.valid(release.tag_name);
        const available =
          !release.draft &&
          !release.prerelease &&
          version &&
          !semver.prerelease(version) &&
          release.tag_name === `v${version}` &&
          semver.gt(version, app.getVersion());
        const complete =
          Array.isArray(release.assets) &&
          release.assets.some(
            (a) => a.name === `RabbitDesktop-${version}-mac-arm64.dmg`,
          );
        send(
          available && complete
            ? {
                phase: "available",
                version,
                message: `新版 ${version} 可下載；Mac 需退出後手動替換`,
              }
            : {
                phase: "current",
                message: available
                  ? "新版 Mac 安裝包尚未就緒"
                  : "目前已是最新版本",
              },
        );
      } else {
        await autoUpdater.checkForUpdates();
      }
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
    if (platform === "darwin") {
      try {
        await openExternal(
          `https://github.com/wuwu50/Repository-name/releases/tag/v${state.version}`,
        );
        send({
          message:
            "已開啟下載頁；下載 DMG 後退出兔兔，再替換 Applications 中的程式",
        });
      } catch {
        send({ phase: "error", message: "無法開啟下載頁，請重新檢查更新" });
      }
      return { ...state };
    }
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
    if (platform === "darwin" || state.phase !== "downloaded") return false;
    send({ phase: "installing", message: "正在重新啟動並套用更新…" });
    // The updater launches the installer then exits; no manual file deletion.
    autoUpdater.quitAndInstall(false, true);
    return true;
  }
  function start() {
    if (started) return;
    started = true;
    if (platform !== "darwin") {
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
    }
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
