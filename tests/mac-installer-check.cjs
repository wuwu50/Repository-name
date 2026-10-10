const assert = require("node:assert/strict"),
  fs = require("node:fs"),
  os = require("node:os"),
  path = require("node:path"),
  crypto = require("node:crypto");
const { createMacInstaller } = require("../mac-installer");
(async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "rabbit-pkg-test-"));
  let quit = 0,
    opened = 0,
    badHash = false,
    handoffError = "";
  const data = Buffer.from("xar!mock-native-package"),
    digest = crypto.createHash("sha512").update(data).digest("hex");
  const svc = createMacInstaller({
    app: { getPath: () => root, quit: () => quit++ },
    fetchRelease: async (url) => {
      assert(
        url.startsWith(
          "https://github.com/wuwu50/Repository-name/releases/download/v4.2.2/RabbitDesktop-4.2.2-mac-arm64.pkg",
        ),
      );
      return url.endsWith(".sha512")
        ? new Response(badHash ? "0".repeat(128) : digest)
        : new Response(data);
    },
    openPath: async () => {
      opened++;
      return handoffError;
    },
  });
  try {
    assert.equal(await svc.install(), false);
    await assert.rejects(svc.download("../bad", () => {}));
    badHash = true;
    await assert.rejects(
      svc.download("4.2.2", () => {}),
      /校驗失敗/,
    );
    assert.equal(opened, 0);
    assert.equal(quit, 0);
    badHash = false;
    let progress = 0;
    const file = await svc.download("4.2.2", (p) => (progress = p));
    assert.equal(progress, 100);
    handoffError = "blocked";
    await assert.rejects(svc.install(), /無法開啟/);
    assert.equal(quit, 0);
    handoffError = "";
    fs.appendFileSync(file, "tampered");
    await assert.rejects(svc.install(), /已變更/);
    assert.equal(quit, 0);
    await svc.download("4.2.2", () => {});
    assert.equal(await svc.install(), true);
    assert.equal(quit, 1);
    console.log(
      "PASS Mac package integrity, tamper rejection, safe handoff and quit",
    );
  } finally {
    assert(
      fs.realpathSync(root).startsWith(fs.realpathSync(os.tmpdir()) + path.sep),
    );
    fs.rmSync(root, { recursive: true, force: true });
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
