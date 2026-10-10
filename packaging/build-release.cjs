if (process.platform === "darwin")
  require("fs").chmodSync(
    require("path").join(__dirname, "pkg-scripts/postinstall"),
    0o755,
  );
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
          ["dmg", "zip", "pkg"],
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
      "mac-installer.js",
      "pet.js",
      "calendar-ui.js",
      "dock.js",
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
    pkg: {
      identity: null,
      installLocation: "/Applications",
      allowAnywhere: false,
      allowCurrentUserHome: false,
      isRelocatable: false,
      overwriteAction: "upgrade",
      mustClose: ["com.wuwu.rabbitdesktop"],
      scripts: require("path").join(__dirname, "pkg-scripts"),
    },
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
})
  .then(() => {
    if (target === "mac") {
      const fs = require("fs"),
        path = require("path"),
        crypto = require("crypto");
      for (const name of fs
        .readdirSync("release-v4")
        .filter((x) => x.endsWith(".pkg"))) {
        const file = path.join("release-v4", name);
        fs.writeFileSync(
          file + ".sha512",
          crypto
            .createHash("sha512")
            .update(fs.readFileSync(file))
            .digest("hex") + "\n",
        );
      }
    }
  })
  .catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
