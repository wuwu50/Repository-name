const { build, Platform } = require("electron-builder");
const target = process.argv[2];
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
    artifactName: "RabbitDesktop-${version}-${os}-${arch}.${ext}",
    npmRebuild: false,
    files: [
      "main.js",
      "preload.js",
      "updater.js",
      "pet.js",
      "calendar-ui.js",
      "dock.js",
      "studio.js",
      "studio-service.js",
      "studio-themes.js",
      "*.html",
      "*.css",
      "assets/**",
      "package.json",
    ],
    publish: [
      {
        provider: "github",
        owner: "wuwu50",
        repo: "Repository-name",
        releaseType: "release",
      },
    ],
    mac: {
      category: "public.app-category.entertainment",
      identity: "-",
      hardenedRuntime: false,
      notarize: false,
      minimumSystemVersion: "13.0",
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
