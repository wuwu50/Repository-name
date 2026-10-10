const assert = require("node:assert/strict"),
  fs = require("node:fs"),
  os = require("node:os"),
  path = require("node:path");
const { createStudio } = require("../studio-service");
const { pickTheme, holiday } = require("../studio-themes");
(async () => {
  const folder = fs.mkdtempSync(path.join(os.tmpdir(), "rabbit-studio-test-"));
  const old = process.env.OPENAI_API_KEY;
  delete process.env.OPENAI_API_KEY;
  try {
    fs.writeFileSync(
      path.join(folder, ".env.local"),
      "OPENAI_API_KEY=sk-test-only\n",
    );
    let finish,
      calls = 0;
    const png = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10, 0]);
    const studio = createStudio({
      root: folder,
      userData: folder,
      fetchImpl: async (url, options) => {
        calls++;
        assert.equal(url, "https://api.openai.com/v1/images/edits");
        assert.equal(options.body.getAll("image[]").length, 10);
        assert(options.body.get("prompt").includes("恰好兩隻耳朵"));
        await new Promise((r) => (finish = r));
        return {
          ok: true,
          json: async () => ({ data: [{ b64_json: png.toString("base64") }] }),
        };
      },
    });
    await assert.rejects(studio.generate({ prompt: "test" }), /照片/);
    const source = path.join(folder, "source.png");
    fs.writeFileSync(source, png);
    await studio.importReferences(Array(10).fill(source), () => png);
    let h = [];
    for (let i = 0; i < 100; i++) {
      const s = pickTheme(new Date(2026, 9, 10), h);
      assert(!h.includes(s));
      h.push(s);
    }
    assert(holiday(new Date(2026, 9, 25)).includes("萬聖節"));
    const pending = studio.generate({ prompt: "花園" });
    await new Promise(setImmediate);
    await assert.rejects(studio.generate({ prompt: "other" }), /正在生成/);
    assert.equal(calls, 1);
    finish();
    const result = await pending;
    assert(result.image.startsWith("data:image/png;base64,"));
    assert(!studio.status().busy);
    const target = path.join(folder, "saved.png");
    studio.save(target);
    assert.deepEqual(fs.readFileSync(target), png);
    const last = studio.randomTheme();
    const restored = createStudio({ root: folder, userData: folder });
    assert.notEqual(restored.randomTheme(), last);
    const failing = createStudio({
      root: folder,
      userData: folder,
      fetchImpl: async () => ({ ok: false, status: 429 }),
    });
    await assert.rejects(failing.generate({ prompt: "test" }), /額度/);
    assert(!failing.status().busy);
    console.log(
      "PASS studio: 10 references, identity prompt, duplicate guard, history persistence, PNG save, API error recovery",
    );
  } finally {
    if (old === undefined) delete process.env.OPENAI_API_KEY;
    else process.env.OPENAI_API_KEY = old;
    fs.rmSync(folder, { recursive: true, force: true });
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
