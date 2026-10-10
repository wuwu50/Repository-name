const assert = require("node:assert/strict"),
  fs = require("node:fs"),
  os = require("node:os"),
  path = require("node:path");
const { createUpdater } = require("../updater");
(async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "rabbit-mac-updates-"));
  let release,
    requests = 0,
    downloads = 0,
    installs = 0,
    fail = false;
  fs.writeFileSync(
    path.join(root, "app-update.yml"),
    "provider: github\nowner: wuwu50\nrepo: Repository-name\n",
  );
  const service = createUpdater({
    app: { isPackaged: true, getVersion: () => "4.2.1" },
    platform: "darwin",
    resourcesPath: root,
    notify: () => {},
    autoUpdater: new Proxy(
      {},
      {
        get() {
          throw Error("Mac must not invoke Squirrel");
        },
      },
    ),
    fetchRelease: async () => {
      requests++;
      return { ok: true, json: async () => release };
    },
    macInstaller: {
      download: async (version, notify) => {
        assert.equal(version, "4.2.2");
        downloads++;
        notify(50);
      },
      install: async () => {
        installs++;
        if (fail) throw Error("handoff failed");
        return true;
      },
    },
  });
  service.start();
  try {
    release = {
      tag_name: "v4.2.2",
      assets: [
        { name: "RabbitDesktop-4.2.2-mac-arm64.pkg" },
        { name: "RabbitDesktop-4.2.2-mac-arm64.pkg.sha512" },
      ],
    };
    await Promise.all([service.check(), service.check()]);
    assert.equal(requests, 1);
    assert.equal(service.status().phase, "available");
    assert.equal(service.status().installerMode, true);
    fail = true;
    await service.download();
    assert.equal(downloads, 1);
    assert.equal(installs, 1);
    assert.equal(service.status().phase, "downloaded");
    fail = false;
    assert.equal(await service.install(), true);
    assert.equal(service.status().phase, "installing");
    console.log(
      "PASS Mac update download, installer handoff, retry, concurrency",
    );
  } finally {
    service.stop();
    assert(
      fs.realpathSync(root).startsWith(fs.realpathSync(os.tmpdir()) + path.sep),
    );
    fs.rmSync(root, { recursive: true, force: true });
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
