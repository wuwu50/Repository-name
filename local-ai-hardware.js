const os = require("node:os");
const { execFile } = require("node:child_process");
function probe(command, args) {
  return new Promise((resolve) =>
    execFile(
      command,
      args,
      { windowsHide: true, timeout: 10000, maxBuffer: 1024 * 1024 },
      (error, stdout) => resolve(error ? "" : stdout.trim()),
    ),
  );
}
function selectHardware({ platform, arch, memoryGB, gpus = [] }) {
  const nvidia = gpus.find((g) => /NVIDIA/i.test(g.name));
  const supported =
    (platform === "win32" && arch === "x64") ||
    (platform === "darwin" && arch === "arm64");
  const backend =
    platform === "darwin" && arch === "arm64"
      ? "mps"
      : nvidia?.memoryGB >= 4 && /RTX|GTX\s*16|Tesla\s*T4/i.test(nvidia.name)
        ? "cuda"
        : "cpu";
  const minimum = backend === "cpu" ? 16 : 8;
  const usable = supported && memoryGB >= minimum;
  return {
    platform,
    arch,
    memoryGB,
    gpus,
    backend,
    supported: usable,
    label:
      backend === "mps"
        ? "Mac Apple Silicon · Metal"
        : backend === "cuda"
          ? `Windows · ${nvidia.name}`
          : "Windows · CPU 相容模式",
    message: !supported
      ? "目前自動安裝支援 Windows x64 與 Mac Apple Silicon。"
      : memoryGB < minimum
        ? `這個模式需要至少 ${minimum} GB 記憶體，暫不開放安裝。`
        : backend === "cpu"
          ? "未偵測到可用的 NVIDIA 加速，會使用 CPU，生成可能需要很久。"
          : memoryGB < 16
            ? "採用較省記憶體的 512×512 設定，建議關閉其他大型程式。"
            : "使用 512×512 兔兔照片參考模型，優先維持相容性。",
    requiredGB: 28,
    model: "Stable Diffusion 1.5 + IP-Adapter Plus",
    resolution: 512,
  };
}
async function detectHardware() {
  let gpus = [];
  if (process.platform === "win32") {
    let raw = await probe("nvidia-smi", [
      "--query-gpu=name,memory.total",
      "--format=csv,noheader,nounits",
    ]);
    if (!raw)
      raw = await probe("C:\\Windows\\System32\\nvidia-smi.exe", [
        "--query-gpu=name,memory.total",
        "--format=csv,noheader,nounits",
      ]);
    gpus = raw
      .split(/\r?\n/)
      .filter(Boolean)
      .map((line) => {
        const [name, memory] = line.split(",");
        return { name: name.trim(), memoryGB: Number(memory) / 1024 };
      });
    if (!gpus.length) {
      const registry = await probe("powershell.exe", [
        "-NoProfile",
        "-NonInteractive",
        "-Command",
        "Get-ItemProperty -Path 'HKLM:\\SYSTEM\\CurrentControlSet\\Control\\Video\\*\\0000' -ErrorAction SilentlyContinue | Select-Object -ExpandProperty DriverDesc",
      ]);
      gpus = registry
        .split(/\r?\n/)
        .filter(Boolean)
        .map((name) => ({ name, memoryGB: 0 }));
    }
  }
  return selectHardware({
    platform: process.platform,
    arch: process.arch,
    memoryGB: Math.round(os.totalmem() / 1024 ** 3),
    gpus,
  });
}
module.exports = { detectHardware, selectHardware };
