const fs = require("node:fs"),
  path = require("node:path"),
  crypto = require("node:crypto");
const { Readable, Transform } = require("node:stream");
const { pipeline } = require("node:stream/promises");
function createMacInstaller({
  app,
  fetchRelease,
  openPath = (filename) => require("electron").shell.openPath(filename),
}) {
  let prepared;
  async function download(version, notify) {
    if (!/^\d+\.\d+\.\d+$/.test(version)) throw Error("更新版本不合法。");
    prepared = null;
    const name = `RabbitDesktop-${version}-mac-arm64.pkg`,
      base = `https://github.com/wuwu50/Repository-name/releases/download/v${version}/`;
    const checksumResponse = await fetchRelease(base + name + ".sha512", {
      signal: AbortSignal.timeout(15000),
    });
    if (!checksumResponse.ok) throw Error("更新校驗檔尚未就緒。");
    const expected = (await checksumResponse.text()).trim();
    if (!/^[a-f0-9]{128}$/.test(expected)) throw Error("更新校驗檔格式錯誤。");
    const folder = path.join(app.getPath("userData"), "mac-updates");
    fs.mkdirSync(folder, { recursive: true });
    const file = path.join(folder, name),
      partial = file + ".part";
    try {
      const response = await fetchRelease(base + name, {
        signal: AbortSignal.timeout(1800000),
      });
      if (!response.ok || !response.body) throw Error("新版下載失敗。");
      const total = Number(response.headers.get("content-length")) || 0;
      let received = 0,
        last = 0;
      const hash = crypto.createHash("sha512");
      const monitor = new Transform({
        transform(bytes, encoding, callback) {
          received += bytes.length;
          if (received > 2 * 1024 ** 3) return callback(Error("安裝檔過大。"));
          hash.update(bytes);
          if (Date.now() - last > 400) {
            last = Date.now();
            notify(total ? Math.min(99, (received / total) * 100) : 0);
          }
          callback(null, bytes);
        },
      });
      await pipeline(
        Readable.fromWeb(response.body),
        monitor,
        fs.createWriteStream(partial),
      );
      if (hash.digest("hex") !== expected) throw Error("更新完整性校驗失敗。");
      const fd = fs.openSync(partial, "r");
      const magic = Buffer.alloc(4);
      try {
        fs.readSync(fd, magic, 0, 4, 0);
      } finally {
        fs.closeSync(fd);
      }
      if (magic.toString() !== "xar!") throw Error("不是有效的 Mac 安裝包。");
      fs.copyFileSync(partial, file);
      fs.unlinkSync(partial);
      prepared = { file, expected };
      notify(100);
      return file;
    } catch (error) {
      try {
        fs.unlinkSync(partial);
      } catch {}
      throw error;
    }
  }
  async function install() {
    if (!prepared) return false;
    // Recheck the downloaded file before handing it to Apple's Installer.
    const hash = crypto.createHash("sha512");
    for await (const chunk of fs.createReadStream(prepared.file))
      hash.update(chunk);
    if (hash.digest("hex") !== prepared.expected)
      throw Error("安裝檔已變更，請重新下載。");
    const error = await openPath(prepared.file);
    if (error) throw Error("無法開啟 Mac 安裝程式：" + error);
    app.quit();
    return true;
  }
  return { download, install };
}
module.exports = { createMacInstaller };
