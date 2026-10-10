const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const yaml = require("js-yaml");
const { readAsar } = require("app-builder-lib/out/asar/asar");
async function main() {
  const mac = process.argv[2] === "mac";
  const resources = mac
    ? "release-v4/mac-arm64/RabbitDesktop.app/Contents/Resources"
    : "release-v4/win-unpacked/resources";
  const archive = await readAsar(path.join(resources, "app.asar"));
  for (const file of [
    "main.js",
    "updater.js",
    "preload.js",
    "pet.js",
    "dock.js",
    "studio.js",
    "studio-service.js",
    "studio-themes.js",
    "studio.html",
    "studio.css",
    "calendar-ui.js",
    "index.html",
    "dock.html",
    "assets/rabbit-sheet.png",
    "assets/held-rabbit.png",
    "assets/rabbit-care-sheet.png",
    "assets/rabbit-sleep-sheet.png",
    "assets/rabbit-sleep-sheet-v4.0.1.png",
    "assets/background.png",
    "node_modules/electron-updater/package.json",
    "node_modules/semver/package.json",
  ]) {
    assert(
      archive.getFile(path.normalize(file)).size > 0,
      `missing runtime file: ${file}`,
    );
  }
  if (process.argv.includes("--runtime-only")) {
    console.log(
      "PASS packaged runtime and preserved assets (installer and feed not checked)",
    );
    return;
  }
  const config = yaml.load(
    fs.readFileSync(path.join(resources, "app-update.yml"), "utf8"),
  );
  assert.equal(config.provider, "github");
  assert.equal(config.owner, "wuwu50");
  assert.equal(config.repo, "Repository-name");
  const info = yaml.load(
    fs.readFileSync(
      mac ? "release-v4/latest-mac.yml" : "release-v4/latest.yml",
      "utf8",
    ),
  );
  assert.equal(info.version, require("../package.json").version);
  assert(info.files.length > 0);
  for (const file of info.files) {
    assert.equal(
      path.basename(file.url),
      file.url,
      "asset must be a local filename",
    );
    const bytes = fs.readFileSync(path.join("release-v4", file.url));
    assert.equal(
      crypto.createHash("sha512").update(bytes).digest("base64"),
      file.sha512,
      "update checksum must match installer",
    );
    assert.equal(bytes.length, file.size);
  }
  console.log(
    "PASS packaged runtime, preserved assets, GitHub feed, version and installer checksums",
  );
}
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
