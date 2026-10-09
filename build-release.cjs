const { build, Platform } = require("electron-builder");
const target = process.argv[2];
const url = process.env.RABBIT_UPDATE_URL;
if (
  !url ||
  new URL(url).protocol !== "https:" ||
  url.includes("example.invalid")
) {
  console.error("請先設定 RABBIT_UPDATE_URL 為正式 HTTPS 更新目錄網址");
  process.exit(1);
}
if (!["mac", "windows"].includes(target)) {
  console.error("使用：node packaging/build-release.cjs mac|windows");
  process.exit(1);
}
build({
  targets:
    target === "mac"
      ? Platform.MAC.createTarget(
          ["dmg", "zip"],
          require("electron-builder").Arch.arm64,
        )
      : Platform.WINDOWS.createTarget(
          ["nsis"],
          require("electron-builder").Arch.x64,
        ),
  publish: "never",
  config: {
    appId: "com.wuwu.rabbitdesktop",
    productName: "RabbitDesktop",
    directories: { output: "release-v4" },
    files: [
      "main.js",
      "preload.js",
      "updater.js",
      "pet.js",
      "calendar-ui.js",
      "dock.js",
      "*.html",
      "*.css",
      "assets/**",
      "package.json",
    ],
    publish: [{ provider: "generic", url: url.replace(/\/?$/, "/") }],
    mac: {
      category: "public.app-category.entertainment",
      hardenedRuntime: true,
      entitlements: "packaging/Entitlements.plist",
      entitlementsInherit: "packaging/Entitlements.plist",
    },
    nsis: {
      oneClick: false,
      perMachine: false,
      allowToChangeInstallationDirectory: true,
      createDesktopShortcut: true,
      shortcutName: "RabbitDesktop-v3",
      deleteAppDataOnUninstall: false,
    },
  },
}).catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
