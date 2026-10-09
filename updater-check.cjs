const assert = require("node:assert/strict");
const { EventEmitter } = require("node:events");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { createUpdater } = require("../updater");
(async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "rabbit-update-test-"));
  const app = { isPackaged: true, getVersion: () => "4.0.0" };
  const engine = new EventEmitter();
  let checks = 0,
    downloads = 0,
    installs = 0;
  engine.checkForUpdates = async () => {
    checks++;
    engine.emit("update-available", { version: "4.1.0" });
  };
  engine.downloadUpdate = async () => {
    downloads++;
    engine.emit("download-progress", { percent: 42 });
    engine.emit("update-downloaded", { version: "4.1.0" });
  };
  engine.quitAndInstall = (silent, restart) => {
    assert.equal(silent, false);
    assert.equal(restart, true);
    installs++;
  };
  const states = [];
  const service = createUpdater({
    app,
    autoUpdater: engine,
    resourcesPath: root,
    notify: (s) => states.push(s),
  });
  service.start();
  await service.check();
  assert.equal(checks, 0);
  assert.equal(service.status().phase, "disabled");
  fs.writeFileSync(
    path.join(root, "app-update.yml"),
    "provider: generic\nurl: https://updates.example.test/rabbit/\n",
  );
  await service.check();
  assert.equal(service.status().phase, "available");
  assert.equal(service.install(), false);
  assert.equal(installs, 0);
  await service.download();
  assert.equal(downloads, 1);
  assert.equal(service.status().phase, "downloaded");
  assert(states.some((s) => s.percent === 42));
  await service.check();
  assert.equal(checks, 1); // Keep staged update instead of overwriting it.
  service.install();
  assert.equal(installs, 1);
  service.stop();
  const bad = new EventEmitter();
  bad.checkForUpdates = async () => {
    throw Error("offline");
  };
  const retry = createUpdater({
    app,
    autoUpdater: bad,
    resourcesPath: root,
    notify: () => {},
  });
  retry.start();
  await retry.check();
  assert.equal(retry.status().phase, "error");
  bad.checkForUpdates = async () => bad.emit("update-not-available");
  await retry.check();
  assert.equal(retry.status().phase, "current");
  retry.stop();
  fs.rmSync(root, { recursive: true, force: true });
  console.log(
    "PASS: unconfigured source, version detection, download progress, install guard, staged update, failure and retry",
  );
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
