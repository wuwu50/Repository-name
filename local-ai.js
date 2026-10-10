const fs = require("node:fs"),
  path = require("node:path"),
  crypto = require("node:crypto");
const { spawn } = require("node:child_process");
const { Readable } = require("node:stream");
const { pipeline } = require("node:stream/promises");
const { detectHardware } = require("./local-ai-hardware");
const { buildWorkflow } = require("./local-ai-workflow");
const manifest = require("./local-ai-manifest");
const BASE = "http://127.0.0.1:18888";
const pause = (ms, signal) =>
  new Promise((resolve, reject) => {
    if (signal?.aborted) return reject(Error("已取消操作。"));
    const done = () => {
      signal?.removeEventListener("abort", abort);
      resolve();
    };
    const timer = setTimeout(done, ms);
    function abort() {
      clearTimeout(timer);
      reject(Error("已取消操作。"));
    }
    signal?.addEventListener("abort", abort, { once: true });
  });
async function digest(file) {
  const hash = crypto.createHash("sha256");
  for await (const bytes of fs.createReadStream(file)) hash.update(bytes);
  return hash.digest("hex");
}
async function download(
  url,
  target,
  { sha256, signal, notify = () => {}, fetchImpl = fetch } = {},
) {
  if (sha256 && fs.existsSync(target) && (await digest(target)) === sha256)
    return;
  fs.mkdirSync(path.dirname(target), { recursive: true });
  const partial = target + ".part";
  try {
    const response = await fetchImpl(url, {
      signal: AbortSignal.any([
        signal || new AbortController().signal,
        AbortSignal.timeout(3600000),
      ]),
    });
    if (!response.ok || !response.body)
      throw Error(`下載失敗（${response.status}），請檢查網路後重試。`);
    const total = Number(response.headers.get("content-length")) || 0;
    let received = 0,
      last = 0;
    const stream = Readable.fromWeb(response.body);
    stream.on("data", (bytes) => {
      received += bytes.length;
      if (Date.now() - last > 500) {
        last = Date.now();
        notify({
          percent: total ? Math.round((received / total) * 100) : null,
        });
      }
    });
    await pipeline(stream, fs.createWriteStream(partial), { signal });
    if (sha256 && (await digest(partial)) !== sha256)
      throw Error("下載檔案校驗失敗，請重試。");
    try {
      fs.renameSync(partial, target);
    } catch (error) {
      if (!["EPERM", "EACCES"].includes(error.code)) throw error;
      fs.copyFileSync(partial, target);
      fs.unlinkSync(partial);
    }
  } catch (error) {
    try {
      fs.unlinkSync(partial);
    } catch {}
    throw error;
  }
}
function createLocalAI({
  root,
  userData,
  notify = () => {},
  fetchImpl = fetch,
  hardwareProbe = detectHardware,
  spawnImpl = spawn,
}) {
  const home = path.join(userData, "rabbit-studio", "local-ai"),
    comfy = path.join(home, "ComfyUI"),
    marker = path.join(home, "installed.json");
  let hardware,
    pendingHardware,
    server,
    operation,
    installing = false,
    starting = false,
    generating = false,
    lastState = { phase: "idle", message: "尚未安裝本機生圖工具。" },
    logTail = "";
  const python = () =>
    path.join(
      home,
      ".venv",
      process.platform === "win32" ? "Scripts/python.exe" : "bin/python",
    );
  const helper = path.join(home, "helper.py");
  fs.mkdirSync(home, { recursive: true });
  fs.writeFileSync(
    helper,
    fs.readFileSync(path.join(root, "local-ai-helper.py")),
  );
  function state(value) {
    lastState = { ...lastState, ...value };
    notify({ ...lastState });
  }
  function installed() {
    try {
      const m = JSON.parse(fs.readFileSync(marker, "utf8"));
      return (
        m.comfy === manifest.COMFY &&
        m.adapter === manifest.ADAPTER &&
        fs.existsSync(python()) &&
        manifest.models.every((x) => fs.existsSync(path.join(comfy, x.file)))
      );
    } catch {
      return false;
    }
  }
  async function hardwareInfo() {
    if (hardware) return hardware;
    if (!pendingHardware)
      pendingHardware = hardwareProbe()
        .then((v) => (hardware = v))
        .finally(() => (pendingHardware = null));
    return pendingHardware;
  }
  async function status() {
    const h = await hardwareInfo();
    let freeGB = null;
    try {
      fs.mkdirSync(home, { recursive: true });
      const s = fs.statfsSync(home);
      freeGB = Math.floor((s.bavail * s.bsize) / 1024 ** 3);
    } catch {}
    return {
      ...lastState,
      hardware: h,
      installed: installed(),
      running: !!server && !server.killed,
      installing,
      starting,
      generating,
      freeGB,
    };
  }
  function run(command, args, { cwd = home, signal, timeout = 3600000 } = {}) {
    return new Promise((resolve, reject) => {
      if (signal?.aborted) return reject(Error("已取消操作。"));
      const child = spawnImpl(command, args, {
        cwd,
        windowsHide: true,
        shell: false,
        env: {
          ...process.env,
          UV_PYTHON_PREFERENCE: "only-managed",
          PYTHONUTF8: "1",
          UV_PYTHON_INSTALL_DIR: path.join(home, "python"),
          UV_CACHE_DIR: path.join(home, "cache"),
          HF_HOME: path.join(home, "hf-cache"),
        },
      });
      let tail = "";
      const capture = (chunk) => {
        tail = (tail + chunk.toString()).slice(-5000);
      };
      child.stdout?.on("data", capture);
      child.stderr?.on("data", capture);
      const kill = () => {
        if (process.platform === "win32" && child.pid) {
          const killer = spawnImpl(
            "taskkill.exe",
            ["/PID", String(child.pid), "/T", "/F"],
            { windowsHide: true, shell: false },
          );
          killer.on("error", () => child.kill());
        } else child.kill();
      };
      const abort = kill;
      signal?.addEventListener("abort", abort, { once: true });
      const timer = setTimeout(kill, timeout);
      const clear = () => {
        clearTimeout(timer);
        signal?.removeEventListener("abort", abort);
      };
      child.once("error", (error) => {
        clear();
        reject(Error("無法啟動安裝工具：" + error.message));
      });
      child.once("close", (code) => {
        clear();
        if (signal?.aborted) reject(Error("已取消操作。"));
        else if (code !== 0)
          reject(Error(`安裝或啟動失敗（${code}）。${tail.slice(-900)}`));
        else resolve(tail);
      });
    });
  }
  async function install() {
    if (installing || starting || generating)
      throw Error("目前正在操作，請稍候。");
    if (server) throw Error("請先停止生圖引擎再重新安裝。");
    const h = await hardwareInfo();
    if (!h.supported) throw Error(h.message);
    const current = await status();
    if (installing || starting || generating)
      throw Error("目前正在操作，請稍候。");
    if (current.freeGB !== null && current.freeGB < h.requiredGB)
      throw Error(`可用空間不足，請保留至少 ${h.requiredGB} GB。`);
    try {
      fs.unlinkSync(marker);
    } catch (error) {
      if (error.code !== "ENOENT") throw error;
    }
    installing = true;
    operation = new AbortController();
    const signal = operation.signal;
    const stage = (message) =>
      state({ phase: "installing", message, percent: null });
    try {
      const uv = manifest.uv[h.platform],
        archive = path.join(home, uv.archive),
        tools = path.join(home, "tools");
      fs.mkdirSync(tools, { recursive: true });
      stage("下載環境管理工具…");
      await download(uv.url, archive, {
        sha256: uv.sha256,
        signal,
        notify: state,
        fetchImpl,
      });
      if (h.platform === "win32") {
        // Paths are arguments, never interpolated into shell source.
        const script = path.join(home, "extract-uv.ps1");
        fs.writeFileSync(
          script,
          "param([string]$Archive,[string]$Destination)\nExpand-Archive -LiteralPath $Archive -DestinationPath $Destination -Force\n",
        );
        await run(
          "powershell.exe",
          [
            "-NoProfile",
            "-NonInteractive",
            "-ExecutionPolicy",
            "Bypass",
            "-File",
            script,
            archive,
            tools,
          ],
          { signal },
        );
      } else
        await run("/usr/bin/tar", ["-xzf", archive, "-C", tools], { signal });
      const uvPath = path.join(tools, uv.binary);
      stage("安裝獨立 Python 環境…");
      await run(uvPath, ["python", "install", "3.12"], { signal });
      if (!fs.existsSync(python()))
        await run(
          uvPath,
          ["venv", "--python", "3.12", path.join(home, ".venv")],
          { signal },
        );
      stage("下載生圖引擎…");
      const source = path.join(home, "comfy.zip");
      await download(
        `https://github.com/Comfy-Org/ComfyUI/archive/${manifest.COMFY}.zip`,
        source,
        { signal, notify: state, fetchImpl },
      );
      await run(python(), [helper, "extract", source, comfy], { signal });
      const adapter = path.join(home, "adapter.zip");
      await download(
        `https://github.com/cubiq/ComfyUI_IPAdapter_plus/archive/${manifest.ADAPTER}.zip`,
        adapter,
        { signal, notify: state, fetchImpl },
      );
      await run(
        python(),
        [
          helper,
          "extract",
          adapter,
          path.join(comfy, "custom_nodes", "rabbit-ipadapter"),
        ],
        { signal },
      );
      stage("安裝適合這台電腦的運算套件…");
      const torchArgs = [
        "pip",
        "install",
        "--python",
        python(),
        "torch>=2.6",
        "torchvision",
        "torchaudio",
      ];
      if (h.platform === "win32")
        torchArgs.push(
          "--index-url",
          h.backend === "cuda"
            ? "https://download.pytorch.org/whl/cu128"
            : "https://download.pytorch.org/whl/cpu",
        );
      await run(uvPath, torchArgs, { signal });
      await run(
        uvPath,
        [
          "pip",
          "install",
          "--python",
          python(),
          "-r",
          path.join(comfy, "requirements.txt"),
          "transformers>=4.50.3,<5",
          "sentencepiece",
          "sacremoses",
        ],
        { signal },
      );
      // Reject a CUDA/Metal mismatch rather than marking an unusable install complete.
      await run(
        python(),
        [
          "-c",
          h.backend === "cuda"
            ? 'import torch; assert torch.cuda.is_available(), "NVIDIA driver unavailable: update the graphics driver"'
            : h.backend === "mps"
              ? 'import torch; assert torch.backends.mps.is_available(), "Metal unavailable"'
              : "import torch; print(torch.__version__)",
        ],
        { signal },
      );
      for (const model of manifest.models) {
        stage(`下載兔兔參考模型：${path.basename(model.file)}…`);
        await download(model.url, path.join(comfy, model.file), {
          sha256: model.sha256,
          signal,
          notify: state,
          fetchImpl,
        });
      }
      stage("安裝離線中文要求翻譯模型…");
      await run(
        python(),
        [helper, "translation-setup", path.join(home, "translator")],
        { signal },
      );
      if (
        (await digest(path.join(home, "translator", "pytorch_model.bin"))) !==
        "9d8ceb91d103ef89400c9d9d62328b4858743cf8924878aee3b8afc594242ce0"
      )
        throw Error("翻譯模型校驗失敗。");
      fs.writeFileSync(
        marker,
        JSON.stringify({
          comfy: manifest.COMFY,
          adapter: manifest.ADAPTER,
          backend: h.backend,
          createdAt: new Date().toISOString(),
        }),
      );
      state({
        phase: "installed",
        message: "安裝完成，按「啟動本機生圖」即可使用。",
        percent: null,
      });
    } catch (error) {
      state({
        phase: "error",
        message: signal.aborted ? "已取消安裝，可按安裝重試。" : error.message,
        percent: null,
      });
      throw error;
    } finally {
      installing = false;
      operation = null;
    }
    return status();
  }
  async function request(route, options = {}) {
    const signal = options.signal
      ? AbortSignal.any([options.signal, AbortSignal.timeout(15000)])
      : AbortSignal.timeout(15000);
    const r = await fetchImpl(BASE + route, { ...options, signal });
    if (!r.ok) throw Error(`本機引擎回應失敗（${r.status}）。`);
    return r;
  }
  async function start() {
    if (installing || starting || generating)
      throw Error("目前正在操作，請稍候。");
    if (server && !server.killed) {
      await request("/system_stats");
      return status();
    }
    if (!installed()) throw Error("請先安裝本機生圖工具。");
    const h = await hardwareInfo();
    if (installing || starting || generating)
      throw Error("目前正在操作，請稍候。");
    starting = true;
    operation = new AbortController();
    const signal = operation.signal;
    try {
      let occupied = false;
      try {
        await request("/system_stats");
        occupied = true;
      } catch {}
      if (occupied)
        throw Error("本機連接埠 18888 已被使用，請先關閉占用它的程式。");
      const args = [
        path.join(comfy, "main.py"),
        "--listen",
        "127.0.0.1",
        "--port",
        "18888",
        "--disable-auto-launch",
        "--offline",
      ];
      if (h.backend === "cpu") args.push("--cpu");
      if (h.backend === "cuda") args.push("--lowvram");
      logTail = "";
      server = spawnImpl(python(), args, {
        cwd: comfy,
        windowsHide: true,
        shell: false,
        env: {
          ...process.env,
          HF_HUB_OFFLINE: "1",
          PYTORCH_ENABLE_MPS_FALLBACK: "1",
        },
      });
      const child = server;
      child.stderr?.on("data", (bytes) => {
        logTail = (logTail + bytes.toString()).slice(-3000);
      });
      child.stdout?.on("data", () => {});
      child.once("error", (error) => {
        if (server === child) server = null;
        state({ phase: "error", message: "引擎啟動失敗：" + error.message });
      });
      child.once("exit", () => {
        if (server === child) {
          server = null;
          if (!installing)
            state({ phase: "stopped", message: "本機引擎已停止。" });
        }
      });
      state({ phase: "starting", message: "正在啟動本機生圖…" });
      const deadline = Date.now() + 180000;
      let ready = false;
      while (Date.now() < deadline) {
        if (!server || child.killed)
          throw Error("引擎啟動失敗：" + logTail.slice(-500));
        try {
          await request("/object_info/IPAdapterAdvanced", { signal });
          ready = true;
          break;
        } catch {}
        await pause(1000, signal);
      }
      if (!ready)
        throw Error("引擎啟動逾時，請停止引擎、關閉其他大型程式後再試。");
      const info = await (
        await request("/object_info/IPAdapterAdvanced", { signal })
      ).json();
      if (!info.IPAdapterAdvanced) throw Error("兔兔照片參考模組未載入。");
      state({ phase: "ready", message: "本機生圖已啟動，照片不會傳到雲端。" });
    } catch (error) {
      server?.kill();
      state({ phase: "error", message: error.message });
      throw error;
    } finally {
      starting = false;
      operation = null;
    }
    return status();
  }
  async function translate(text, signal) {
    if (!/[\u3400-\u9fff]/.test(text)) return text;
    const input = path.join(home, "translation-request.json"),
      output = path.join(home, "translation-response.json");
    fs.writeFileSync(input, JSON.stringify({ text }));
    await run(
      python(),
      [helper, "translate", path.join(home, "translator"), input, output],
      { signal, timeout: 180000 },
    );
    return JSON.parse(fs.readFileSync(output, "utf8")).text;
  }
  async function generate({ files, text }) {
    if (installing || starting || generating)
      throw Error("目前正在操作，請稍候。");
    if (!server || server.killed || lastState.phase !== "ready")
      throw Error("請先啟動本機生圖。");
    generating = true;
    operation = new AbortController();
    const signal = operation.signal;
    let promptId;
    try {
      state({ phase: "generating", message: "正在處理中文要求…" });
      const translated = await translate(text, signal);
      const images = [];
      for (const file of files) {
        const form = new FormData();
        form.append(
          "image",
          new Blob([fs.readFileSync(file)], { type: "image/png" }),
          "rabbit-" + crypto.randomUUID() + ".png",
        );
        form.append("overwrite", "false");
        const r = await (
          await request("/upload/image", { method: "POST", body: form, signal })
        ).json();
        if (typeof r.name !== "string") throw Error("無法載入兔兔參考照片。");
        images.push(r.subfolder ? `${r.subfolder}/${r.name}` : r.name);
      }
      const graph = buildWorkflow(
        images,
        translated,
        crypto.randomInt(0, 2 ** 32),
      );
      const queued = await (
        await request("/prompt", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            prompt: graph,
            client_id: crypto.randomUUID(),
          }),
          signal,
        })
      ).json();
      promptId = queued.prompt_id;
      if (!promptId) throw Error("生成工作未成功排入。");
      state({
        phase: "generating",
        message: "兔兔正在本機創作，首次生成可能較久…",
      });
      const deadline = Date.now() + 30 * 60 * 1000;
      while (Date.now() < deadline) {
        const history = await (
          await request("/history/" + encodeURIComponent(promptId), { signal })
        ).json();
        const result = history[promptId];
        if (result?.status?.status_str === "error")
          throw Error("本機生成失敗，可能記憶體不足；請關閉其他大型程式再試。");
        const image = result?.outputs?.["10"]?.images?.[0];
        if (image) {
          const query = new URLSearchParams({
            filename: image.filename,
            subfolder: image.subfolder || "",
            type: image.type || "output",
          });
          const response = await request("/view?" + query, { signal });
          const bytes = Buffer.from(await response.arrayBuffer());
          if (
            bytes.length > 60 * 1024 * 1024 ||
            !bytes
              .subarray(0, 8)
              .equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
          )
            throw Error("本機引擎回傳的圖片格式錯誤。");
          return bytes;
        }
        await pause(1200, signal);
      }
      throw Error("生成超過30分鐘，已停止；請降低負載再試。");
    } catch (error) {
      if (promptId)
        try {
          await request("/interrupt", { method: "POST" });
        } catch {}
      throw signal.aborted ? Error("已取消生成。") : error;
    } finally {
      generating = false;
      operation = null;
      if (server && !server.killed)
        state({ phase: "ready", message: "本機引擎已就緒。" });
    }
  }
  function cancel() {
    operation?.abort();
  }
  function stop() {
    cancel();
    server?.kill();
    server = null;
    state({ phase: "stopped", message: "本機引擎已停止，顯示卡資源已釋放。" });
  }
  return { status, install, start, generate, cancel, stop };
}
module.exports = { createLocalAI, download, digest };
