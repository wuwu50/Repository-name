const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { createUpdater } = require("../updater");
(async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "rabbit-mac-updates-"));
  let release,
    requests = 0,
    opened = [];
  fs.writeFileSync(
    path.join(root, "app-update.yml"),
    "provider: github\nowner: wuwu50\nrepo: Repository-name\n",
  );
  const service = createUpdater({
    app: { isPackaged: true, getVersion: () => "4.0.0" },
    platform: "darwin",
    resourcesPath: root,
    notify: () => {},
    autoUpdater: new Proxy(
      {},
      {
        get() {
          throw Error("Unsigned Mac must not use native installer");
        },
      },
    ),
    fetchRelease: async () => {
      requests++;
      return { ok: true, status: 200, json: async () => release };
    },
    openExternal: async (url) => opened.push(url),
  });
  service.start();
  try {
    release = {
      tag_name: "v4.1.0",
      assets: [{ name: "RabbitDesktop-4.1.0-mac-arm64.dmg" }],
    };
    await Promise.all([service.check(), service.check()]);
    assert.equal(requests, 1);
    assert.equal(service.status().phase, "available");
    assert.equal(service.status().manualDownload, true);
    assert.equal(service.install(), false);
    await service.download();
    assert.deepEqual(opened, [
      "https://github.com/wuwu50/Repository-name/releases/tag/v4.1.0",
    ]);
    for (const tag of ["v3.0.0", "v4.0.0", "bad", "v4.2.0-beta.1"]) {
      release.tag_name = tag;
      await service.check();
      assert.equal(service.status().phase, "current");
    }
    release = { tag_name: "v4.2.0", assets: [] };
    await service.check();
    assert.equal(service.status().phase, "current");
    assert.equal(service.install(), false);
    console.log(
      "PASS Mac updates: no native install, newer complete stable release only, download link, concurrency",
    );
  } finally {
    service.stop();
    const resolvedRoot = fs.realpathSync(root);
    assert(resolvedRoot.startsWith(fs.realpathSync(os.tmpdir()) + path.sep));
    fs.rmSync(resolvedRoot, { recursive: true, force: true });
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
