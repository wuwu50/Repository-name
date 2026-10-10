const assert = require("node:assert/strict"),
  fs = require("node:fs"),
  path = require("node:path"),
  os = require("node:os"),
  crypto = require("node:crypto");
const { EventEmitter } = require("node:events");
const { PassThrough } = require("node:stream");
const { selectHardware } = require("../local-ai-hardware");
const { buildWorkflow } = require("../local-ai-workflow");
const { createLocalAI, download } = require("../local-ai");
const { createStudio } = require("../studio-service");
const manifest = require("../local-ai-manifest");
const png = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10, 0]);
(async () => {
  const folder = fs.mkdtempSync(path.join(os.tmpdir(), "rabbit-local-ai-"));
  try {
    const nvidia = selectHardware({
      platform: "win32",
      arch: "x64",
      memoryGB: 32,
      gpus: [{ name: "NVIDIA RTX 3060 Ti", memoryGB: 8 }],
    });
    assert.equal(nvidia.backend, "cuda");
    assert.equal(
      selectHardware({ platform: "darwin", arch: "arm64", memoryGB: 16 })
        .backend,
      "mps",
    );
    assert.equal(
      selectHardware({
        platform: "win32",
        arch: "x64",
        memoryGB: 16,
        gpus: [{ name: "AMD Radeon", memoryGB: 8 }],
      }).backend,
      "cpu",
    );
    assert(
      !selectHardware({ platform: "darwin", arch: "x64", memoryGB: 16 })
        .supported,
    );
    assert(
      !selectHardware({ platform: "win32", arch: "x64", memoryGB: 4 })
        .supported,
    );
    const graph = buildWorkflow(
      Array.from({ length: 10 }, (_, i) => `ref-${i}.png`),
      "forest watercolor",
      123,
    );
    assert.equal(
      Object.values(graph).filter((x) => x.class_type === "LoadImage").length,
      10,
    );
    assert.equal(
      Object.values(graph).filter((x) => x.class_type === "ImageBatch").length,
      9,
    );
    assert.equal(graph["8"].inputs.denoise, 1);
    assert.equal(graph["7"].inputs.combine_embeds, "average");
    assert(graph["2"].inputs.text.includes("forest watercolor"));
    const hash = crypto.createHash("sha256").update(png).digest("hex"),
      file = path.join(folder, "download.png");
    await download("https://example.test/model", file, {
      sha256: hash,
      fetchImpl: async () => new Response(png),
    });
    assert.deepEqual(fs.readFileSync(file), png);
    await assert.rejects(
      download("https://example.test/model", path.join(folder, "bad"), {
        sha256: "0".repeat(64),
        fetchImpl: async () => new Response(png),
      }),
      /校驗/,
    );
    assert(!fs.existsSync(path.join(folder, "bad.part")));
    let active = false,
      queuedGraph,
      hang = false,
      interrupted = false,
      spawns = [];
    function spawn(command, args, options) {
      spawns.push({ command, args, options });
      const child = new EventEmitter();
      child.stdout = new PassThrough();
      child.stderr = new PassThrough();
      child.killed = false;
      active = true;
      child.kill = () => {
        child.killed = true;
        active = false;
        child.emit("exit", 0);
      };
      return child;
    }
    const events = [];
    const ai = createLocalAI({
      root: path.join(__dirname, ".."),
      userData: folder,
      hardwareProbe: async () => nvidia,
      spawnImpl: spawn,
      notify: (s) => events.push(s),
      fetchImpl: async (url, options = {}) => {
        assert(
          url.startsWith("http://127.0.0.1:18888/"),
          "local requests must stay on loopback",
        );
        const route = new URL(url).pathname;
        if (route === "/system_stats")
          return new Response("{}", { status: active ? 200 : 503 });
        if (route === "/object_info/IPAdapterAdvanced")
          return Response.json({ IPAdapterAdvanced: {} });
        if (route === "/upload/image")
          return Response.json({
            name: "rabbit.png",
            subfolder: "",
            type: "input",
          });
        if (route === "/prompt") {
          queuedGraph = JSON.parse(options.body).prompt;
          return Response.json({ prompt_id: "job-1" });
        }
        if (route === "/history/job-1")
          return Response.json(
            hang
              ? {}
              : {
                  "job-1": {
                    outputs: { 10: { images: [{ filename: "rabbit.png" }] } },
                  },
                },
          );
        if (route === "/view") return new Response(png);
        if (route === "/interrupt") {
          interrupted = true;
          return new Response("{}");
        }
        throw Error("unexpected " + route);
      },
    });
    await assert.rejects(ai.start(), /安裝/);
    const home = path.join(folder, "rabbit-studio", "local-ai");
    const python = path.join(
      home,
      ".venv",
      process.platform === "win32" ? "Scripts/python.exe" : "bin/python",
    );
    fs.mkdirSync(path.dirname(python), { recursive: true });
    fs.writeFileSync(python, "test");
    for (const model of manifest.models) {
      const dest = path.join(home, "ComfyUI", model.file);
      fs.mkdirSync(path.dirname(dest), { recursive: true });
      fs.writeFileSync(dest, "test");
    }
    fs.writeFileSync(
      path.join(home, "installed.json"),
      JSON.stringify({
        comfy: manifest.COMFY,
        adapter: manifest.ADAPTER,
        backend: "cuda",
      }),
    );
    await ai.start();
    assert.equal(spawns[0].options.windowsHide, true);
    assert.equal(spawns[0].options.shell, false);
    assert(spawns[0].args.includes("127.0.0.1"));
    assert(spawns[0].args.includes("--offline"));
    const source = path.join(folder, "reference.png");
    fs.writeFileSync(source, png);
    const result = await ai.generate({
      files: Array(10).fill(source),
      text: "forest watercolor",
    });
    assert.deepEqual(result, png);
    assert.equal(
      Object.values(queuedGraph).filter((x) => x.class_type === "LoadImage")
        .length,
      10,
    );
    hang = true;
    const pending = ai.generate({ files: [source], text: "snow" });
    await new Promise(setImmediate);
    await assert.rejects(
      ai.generate({ files: [source], text: "again" }),
      /正在操作/,
    );
    ai.cancel();
    await assert.rejects(pending, /取消/);
    assert(interrupted);
    ai.stop();
    assert(!active);
    let cloudCalls = 0,
      localCalls = 0;
    const studio = createStudio({
      root: folder,
      userData: folder,
      fetchImpl: async () => {
        cloudCalls++;
        throw Error("must not call cloud");
      },
      localAI: {
        generate: async ({ files, text }) => {
          localCalls++;
          assert.equal(files.length, 10);
          assert(text.includes("花園"));
          return png;
        },
      },
    });
    await studio.importReferences(Array(10).fill(source), () => png);
    const generated = await studio.generate({ prompt: "花園" });
    assert(generated.image.startsWith("data:image/png"));
    assert.equal(localCalls, 1);
    assert.equal(cloudCalls, 0);
    console.log(
      "PASS local AI: hardware routes, checksums, 10-photo workflow, loopback-only requests, launch, PNG result, cancellation, no paid fallback",
    );
  } finally {
    fs.rmSync(folder, { recursive: true, force: true });
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
