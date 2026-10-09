const vm = require("vm"),
  fs = require("fs"),
  assert = require("assert");
const nodes = new Map();
let tick = 0,
  frame,
  action,
  regions,
  grab = false;
const timers = [];
function element(id = "") {
  const n = {
    id,
    style: {},
    dataset: {},
    hidden: false,
    disabled: false,
    offsetWidth: 160,
    width: 160,
    height: 160,
    children: [],
    handlers: {},
    classList: { add() {}, remove() {}, toggle() {} },
    getContext() {
      return {
        imageSmoothingEnabled: false,
        clearRect() {},
        drawImage() {},
        save() {},
        restore() {},
        translate() {},
        scale() {},
      };
    },
    getBoundingClientRect() {
      if (id === "grass")
        return { x: 20, y: 650, left: 20, top: 650, width: 120, height: 134 };
      return { x: 20, y: 20, left: 20, top: 20, width: 160, height: 160 };
    },
    setAttribute() {},
    setPointerCapture() {},
    append(...items) {
      this.children.push(...items);
    },
    addEventListener(type, fn) {
      this.handlers[type] = fn;
    },
    querySelector(s) {
      return this.children.find((c) => s === "canvas" && c.getContext);
    },
    remove() {
      this.removed = true;
    },
    click() {
      this.onclick?.({});
    },
  };
  return n;
}
for (const id of [
  "pet",
  "sprite",
  "bubble",
  "status",
  "grass",
  "grassCanvas",
  "cleanAll",
  "room",
  "petMenuToggle",
  "petMenu",
  "roamToggle",
  "agendaToggle",
  "agendaBody",
  "agenda",
])
  nodes.set(id, element(id));
nodes.get("petMenu").hidden = true;
nodes.get("agendaBody").hidden = true;
nodes.get("agenda").hidden = true;
const context = {
  console,
  Image: class {
    constructor() {
      this.width = 1254;
      this.height = 1254;
    }
    set src(v) {
      this.onload?.();
    }
  },
  performance: { now: () => tick },
  matchMedia: () => ({ matches: false }),
  localStorage: { getItem: () => null, setItem() {} },
  innerWidth: 1200,
  innerHeight: 800,
  requestAnimationFrame: (fn) => {
    frame = fn;
    return 1;
  },
  setInterval: (fn) => {
    timers.push(fn);
  },
  setTimeout: (fn) => {
    timers.push(fn);
  },
  addEventListener() {},
  desktopPet: {
    bounds: (r) => (regions = r),
    drag: (v) => (grab = v),
    focusable() {},
    state() {},
    onAction: (fn) => (action = fn),
    onCursor() {},
  },
  document: {
    querySelector: (s) => nodes.get(s.slice(1)),
    querySelectorAll: (s) =>
      s === "[data-action]"
        ? []
        : s === ".poop"
          ? []
          : s.includes(":not")
            ? nodes.get("petMenu").hidden
              ? []
              : [nodes.get("petMenu")]
            : [nodes.get(s.slice(1))].filter(Boolean),
    createElement: (tag) => element(tag),
  },
};
// Image loading is asynchronous in browsers.
context.Image = class {
  constructor() {
    this.width = 1254;
    this.height = 1254;
  }
  set src(v) {
    timers.push(() => this.onload?.());
  }
};
vm.createContext(context);
vm.runInContext(
  fs.readFileSync(require("path").join(__dirname, "..", "pet.js"), "utf8"),
  context,
);
function evals(s) {
  return vm.runInContext(s, context);
}
function advance(ms) {
  tick += ms;
  frame(tick);
}
for (const fn of [...timers]) fn();
assert(regions.length >= 2, "native hit regions");
assert(evals("ready&&heldReady&&sleepReady&&careReady"), "assets load");
advance(2500);
assert(evals("!!hop"), "rabbit starts hopping");
advance(1000);
assert(!evals("hop"), "hop completes");
const poses = new Set();
for (let i = 0; i < 30; i++) {
  action("sleep");
  poses.add(evals("sleepPose"));
  assert.strictEqual(evals("mode"), "sleep");
}
assert.strictEqual(poses.size, 4, "four sleeping poses");
action("eat");
assert.strictEqual(evals("mode"), "goingToGrass");
for (let i = 0; i < 25; i++) advance(1000);
assert(
  evals("mode") === "eating" ||
    evals("mode") === "idle" ||
    evals("mode") === "sniff" ||
    evals("mode") === "peek",
  "walks to grass and eats",
);
action("poop");
assert(evals("poops.size") >= 1);
action("clean");
for (const fn of [...timers]) fn();
assert.strictEqual(evals("poops.size"), 0, "cleanup removes poop");
const p = nodes.get("pet");
p.handlers.pointerdown({
  button: 0,
  pointerId: 1,
  clientX: 100,
  clientY: 100,
  preventDefault() {},
});
assert(grab);
assert.strictEqual(evals("mode"), "grab");
p.handlers.pointermove({ pointerId: 1, clientX: 200, clientY: 200 });
p.handlers.pointerup({ type: "pointerup", pointerId: 1 });
assert(!grab);
assert.strictEqual(evals("mode"), "idle");
action("calendar");
assert(!nodes.get("agendaBody").hidden);
action("calendar");
assert(nodes.get("agendaBody").hidden);
console.log(
  "PASS: assets, native hit regions, autonomous hop, four sleeping poses, eating, poop cleanup, drag lifecycle, collapsible calendar",
);
