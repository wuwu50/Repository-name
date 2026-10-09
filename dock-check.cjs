const vm = require("vm"),
  fs = require("fs"),
  assert = require("assert");
const nodes = new Map(),
  calls = [];
let state;
function element() {
  return {
    hidden: true,
    textContent: "",
    handlers: {},
    dataset: {},
    classList: { add() {}, remove() {} },
    setAttribute() {},
    setPointerCapture() {},
    addEventListener(n, f) {
      this.handlers[n] = f;
    },
  };
}
for (const name of [
  "toggle",
  "panel",
  "notice",
  "closePanel",
  "quit",
  "shortcut",
  "roam",
  "calendar",
  "clean",
  "checkUpdate",
  "downloadUpdate",
  "installUpdate",
  "updateStatus",
])
  nodes.set(name, element());
const command = element();
command.dataset.command = "eat";
command.textContent = "去吃草";
const context = {
  document: {
    querySelector: (s) => nodes.get(s.slice(1)),
    querySelectorAll: () => [command],
  },
  desktopPet: {
    panel: async (v) => calls.push(["panel", v]),
    dockDrag: (p) => calls.push(["drag", p]),
    command: (n) => calls.push(["command", n]),
    quit: () => calls.push(["quit"]),
    shortcut: async () => "已建立捷徑",
    onState: (f) => (state = f),
    onUpdate() {},
    updateStatus: async () => ({
      phase: "disabled",
      currentVersion: "4.0.0",
      message: "未設定",
    }),
    checkUpdate: async () => ({}),
    downloadUpdate: async () => ({}),
    installUpdate: async () => false,
  },
  addEventListener() {},
  console,
};
vm.createContext(context);
vm.runInContext(
  fs.readFileSync(require("path").join(__dirname, "..", "dock.js"), "utf8"),
  context,
);
(async () => {
  const button = nodes.get("toggle");
  button.handlers.pointerdown({
    button: 0,
    pointerId: 1,
    screenX: 10,
    screenY: 10,
    preventDefault() {},
  });
  button.handlers.pointerup({ pointerId: 1, type: "pointerup" });
  await new Promise(setImmediate);
  assert(!nodes.get("panel").hidden, "click expands");
  nodes.get("closePanel").onclick();
  await new Promise(setImmediate);
  assert(nodes.get("panel").hidden, "x collapses");
  button.handlers.pointerdown({
    button: 0,
    pointerId: 1,
    screenX: 10,
    screenY: 10,
    preventDefault() {},
  });
  button.handlers.pointermove({ pointerId: 1, screenX: 30, screenY: 30 });
  button.handlers.pointerup({ pointerId: 1, type: "pointerup" });
  assert(nodes.get("panel").hidden, "drag does not toggle");
  assert(calls.some((c) => c[0] === "drag" && c[1] === "move"));
  command.onclick();
  assert(calls.some((c) => c[0] === "command" && c[1] === "eat"));
  state({ roaming: false, poops: 3, calendarOpen: true });
  assert(nodes.get("clean").textContent.includes("3"));
  nodes.get("quit").onclick();
  assert(calls.some((c) => c[0] === "quit"));
  console.log(
    "PASS dock renderer: circle click, close, drag without accidental toggle, action, state counts, exit",
  );
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
