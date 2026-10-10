const fs = require("node:fs"),
  path = require("node:path"),
  vm = require("node:vm"),
  assert = require("node:assert/strict");
const html = fs.readFileSync(path.join(__dirname, "..", "studio.html"), "utf8"),
  nodes = new Map();
for (const match of html.matchAll(/id="([^"]+)"/g))
  nodes.set(match[1], {
    value: "",
    disabled: false,
    hidden: false,
    textContent: "",
    removeAttribute() {},
  });
nodes.get("mode").value = "local";
let phase = "idle",
  installed = false,
  onLocal,
  request,
  rejectGeneration;
const hardware = {
  label: "Windows · NVIDIA RTX 3060 Ti",
  memoryGB: 32,
  requiredGB: 28,
  supported: true,
  message: "test",
};
const status = () => ({ phase, installed, hardware, message: phase });
const api = {
  studioStatus: async () => ({ references: 10 }),
  studioTheme: async () => "秋日花園",
  studioPhotos: async () => ({ references: 10 }),
  studioKey: async () => ({ references: 10, configured: true }),
  localAIStatus: async () => status(),
  onLocalAI: (fn) => (onLocal = fn),
  localAIInstall: async () => {
    phase = "installing";
    onLocal(status());
    assert(!nodes.get("cancelLocal").hidden);
    installed = true;
    phase = "installed";
    return status();
  },
  localAIStart: async () => {
    phase = "ready";
    return status();
  },
  localAIStop: async () => {
    phase = "stopped";
    return status();
  },
  localAICancel: async () => {
    phase = "ready";
    onLocal(status());
    rejectGeneration(Error("已取消生成。"));
  },
  studioGenerate: async (input) => {
    request = input;
    phase = "generating";
    onLocal(status());
    return new Promise((resolve, reject) => (rejectGeneration = reject));
  },
  studioSave: async () => true,
};
vm.runInNewContext(
  fs.readFileSync(path.join(__dirname, "..", "studio.js"), "utf8"),
  {
    document: { getElementById: (id) => nodes.get(id) },
    desktopPet: api,
    console,
  },
);
(async () => {
  await new Promise(setImmediate);
  nodes.get("prompt").value = "兔兔到森林探險";
  await nodes.get("generate").onclick();
  assert(nodes.get("status").textContent.includes("先安裝"));
  await nodes.get("installLocal").onclick();
  assert(nodes.get("installLocal").hidden);
  assert(!nodes.get("startLocal").disabled);
  await nodes.get("startLocal").onclick();
  assert(!nodes.get("stopLocal").hidden);
  const pending = nodes.get("generate").onclick();
  await new Promise(setImmediate);
  assert.equal(request.mode, "local");
  assert.equal(request.prompt, "兔兔到森林探險");
  assert(nodes.get("generate").disabled);
  assert(!nodes.get("cancelLocal").hidden);
  await nodes.get("cancelLocal").onclick();
  await pending;
  assert(!nodes.get("generate").disabled);
  assert(!nodes.get("mode").disabled);
  assert(nodes.get("status").textContent.includes("取消"));
  api.studioGenerate = async () => ({ image: "data:image/png;base64,test" });
  await nodes.get("generate").onclick();
  assert(!nodes.get("image").hidden);
  assert(!nodes.get("download").disabled);
  await nodes.get("download").onclick();
  assert(nodes.get("status").textContent.includes("儲存"));
  nodes.get("mode").value = "cloud";
  nodes.get("mode").onchange();
  assert(!nodes.get("key").hidden);
  assert(nodes.get("status").textContent.includes("計費"));
  await nodes.get("stopLocal").onclick();
  assert(!nodes.get("startLocal").hidden);
  console.log(
    "PASS studio UI: setup, start, local default, cancellation recovery, preview, download, explicit paid-mode notice",
  );
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
