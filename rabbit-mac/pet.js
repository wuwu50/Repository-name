const pet = document.querySelector("#pet"),
  cv = document.querySelector("#sprite"),
  ctx = cv.getContext("2d"),
  bubble = document.querySelector("#bubble"),
  status = document.querySelector("#status");
ctx.imageSmoothingEnabled = false;
const sheet = new Image(),
  held = new Image(),
  sleepSheet = new Image(),
  careSheet = new Image();
let ready = false,
  heldReady = false,
  sleepReady = false,
  careReady = false;
sheet.onload = () => (ready = true);
held.onload = () => (heldReady = true);
sleepSheet.onload = () => (sleepReady = true);
careSheet.onload = () => {
  careReady = true;
  drawCare(document.querySelector("#grassCanvas"), 0);
  for (const { element } of poops.values())
    drawCare(element.querySelector("canvas"), 1);
};
sheet.src = "assets/rabbit-sheet.png";
held.src = "assets/held-rabbit.png";
sleepSheet.src = "assets/rabbit-sleep-sheet.png";
careSheet.src = "assets/rabbit-care-sheet.png";
sheet.onerror = () => (status.textContent = "兔兔圖片載入失敗，請重新整理。");
let roaming = true;
try {
  roaming = localStorage.getItem("rabbit-roaming") !== "false";
} catch {}
let drawnKey = "",
  lastFrame = 0,
  petSize = pet.offsetWidth,
  hop = null,
  nextHop = performance.now() + 2000,
  facing = -1,
  x = 0,
  y = 0,
  mode = "idle",
  until = 0,
  drag = null,
  lastSniff = 0,
  nextIdle = performance.now() + 5000,
  raf;
let foodTarget = null,
  sleepPose = 0,
  previousSleep = -1,
  nextMeal = performance.now() + 18000 + Math.random() * 12000,
  nextSleep = performance.now() + 35000 + Math.random() * 20000,
  nextPoop = performance.now() + 45000 + Math.random() * 25000,
  poopId = 0;
const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches,
  poops = new Map();
function size() {
  return petSize;
}
function clamp() {
  x = Math.max(0, Math.min(Math.max(0, innerWidth - size()), x));
  y = Math.max(54, Math.min(Math.max(54, innerHeight - size() - 14), y));
  pet.style.left = "0px";
  pet.style.top = "0px";
}
function home() {
  x = innerWidth * 0.68 - size() / 2;
  y = innerHeight * 0.72 - size() / 2;
  clamp();
}
home();
addEventListener("resize", () => {
  petSize = pet.offsetWidth;
  hop = null;
  clamp();
  if (mode === "goingToGrass") goEat();
  for (const { element } of poops.values()) {
    element.style.left =
      Math.max(8, Math.min(innerWidth - 52, parseFloat(element.style.left))) +
      "px";
    element.style.top =
      Math.max(60, Math.min(innerHeight - 48, parseFloat(element.style.top))) +
      "px";
  }
});
function say(text) {
  bubble.textContent = text;
  bubble.classList.add("show");
  status.textContent = text;
}
function settle(t = performance.now()) {
  if (
    (mode === "goingToGrass" || mode === "eating") &&
    !Number.isFinite(nextMeal)
  )
    nextMeal = t + 20000;
  mode = "idle";
  until = 0;
  hop = null;
  bubble.classList.remove("show");
  nextHop = t + 1000;
  nextIdle = t + 5000 + Math.random() * 4000;
}
function act(action) {
  if ((mode === "goingToGrass" || mode === "eating") && action !== "eating")
    nextMeal = performance.now() + 20000;
  if (action === "eat") {
    goEat();
    return;
  }
  if (action === "clean") {
    cleanAll();
    return;
  }
  hop = null;
  foodTarget = null;
  if (action === "home") {
    drag = null;
    pet.classList.remove("grabbed");
    home();
    action = "idle";
  }
  if (action === "sleep") {
    sleepPose =
      previousSleep < 0
        ? Math.floor(Math.random() * 4)
        : (previousSleep + 1 + Math.floor(Math.random() * 3)) % 4;
    previousSleep = sleepPose;
    nextSleep = performance.now() + 65000 + Math.random() * 65000;
  }
  if (action === "poop") {
    dropPoop();
    nextPoop = performance.now() + 55000 + Math.random() * 45000;
  }
  mode = action;
  const duration =
    action === "sleep"
      ? 14000 + Math.random() * 8000
      : action === "pat"
        ? 1700
        : action === "peek"
          ? 2400
          : action === "sniff"
            ? 2300
            : action === "eating"
              ? 5500
              : 1300;
  until = performance.now() + duration;
  nextIdle = until + 5000 + Math.random() * 5000;
  const words = {
    pat: "好舒服…",
    peek: "讓我看看！",
    sniff: "聞聞你的味道",
    idle: "我回來了",
    sleep: "呼…睡一下…",
    poop: "便便掉下來了",
    eating: "嚼嚼…草好香！",
  };
  say(words[action] || "兔兔陪你");
}
function goEat() {
  hop = null;
  const r = document.querySelector("#grass").getBoundingClientRect();
  foodTarget = {
    x: Math.max(0, Math.min(innerWidth - size(), r.left + r.width * 0.52)),
    y: Math.max(
      54,
      Math.min(
        innerHeight - size() - 14,
        r.top + r.height * 0.2 - size() * 0.8,
      ),
    ),
  };
  mode = "goingToGrass";
  until = Infinity;
  nextHop = performance.now();
  nextMeal = Infinity;
  say("去吃一口草！");
}
function drawCare(canvas, frame) {
  if (!careReady || !canvas) return;
  const c = canvas.getContext("2d");
  c.imageSmoothingEnabled = false;
  c.clearRect(0, 0, canvas.width, canvas.height);
  const w = careSheet.width / 2,
    h = careSheet.height / 2;
  c.drawImage(
    careSheet,
    (frame % 2) * w,
    Math.floor(frame / 2) * h,
    w,
    h,
    0,
    0,
    canvas.width,
    canvas.height,
  );
}
function updatePoopCount() {
  document.querySelector("#cleanAll").textContent =
    "一鍵清理" + (poops.size ? "（" + poops.size + "）" : "");
  document.querySelector("#cleanAll").disabled = poops.size === 0;
}
function dropPoop() {
  if (poops.size >= 24) return;
  const element = document.createElement("button"),
    canvas = document.createElement("canvas"),
    id = ++poopId;
  canvas.width = 64;
  canvas.height = 64;
  element.className = "poop";
  element.type = "button";
  element.setAttribute("aria-label", "清理這份兔兔便便");
  element.title = "點一下，用掃把掃走";
  element.style.left =
    Math.max(8, Math.min(innerWidth - 52, x + size() * 0.68)) + "px";
  element.style.top =
    Math.max(60, Math.min(innerHeight - 48, y + size() * 0.87)) + "px";
  element.append(canvas);
  document.querySelector("#room").append(element);
  drawCare(canvas, 1);
  poops.set(id, { element, cleaning: false });
  element.onclick = () => cleanPoop(id);
  updatePoopCount();
}
function cleanPoop(id) {
  const item = poops.get(id);
  if (!item || item.cleaning) return;
  item.cleaning = true;
  item.element.disabled = true;
  item.element.classList.add("cleaning");
  const tools = document.createElement("span"),
    broom = document.createElement("canvas"),
    pan = document.createElement("canvas");
  tools.className = "cleaningTools";
  broom.width = pan.width = 96;
  broom.height = pan.height = 96;
  broom.className = "broom";
  pan.className = "dustpan";
  drawCare(broom, 2);
  drawCare(pan, 3);
  tools.append(broom, pan);
  item.element.append(tools);
  status.textContent = "掃把與畚箕正在清理便便";
  setTimeout(
    () => {
      item.element.remove();
      poops.delete(id);
      updatePoopCount();
      if (!poops.size) status.textContent = "便便清理乾淨了！";
    },
    reduced ? 450 : 1100,
  );
}
function cleanAll() {
  if (!poops.size) {
    status.textContent = "桌面已經很乾淨了";
    return;
  }
  for (const id of poops.keys()) cleanPoop(id);
}
document
  .querySelectorAll("[data-action]")
  .forEach((b) => (b.onclick = () => act(b.dataset.action)));
document.querySelector("#grass").onclick = goEat;
updatePoopCount();
pet.addEventListener("pointerdown", (e) => {
  if (e.button !== 0) return;
  desktopPet.drag(true);
  pet.setPointerCapture(e.pointerId);
  drag = {
    id: e.pointerId,
    sx: e.clientX,
    sy: e.clientY,
    ox: x,
    oy: y,
    moved: false,
  };
  pet.classList.add("grabbed");
  if (mode === "goingToGrass" || mode === "eating")
    nextMeal = performance.now() + 15000;
  foodTarget = null;
  hop = null;
  mode = "grab";
  until = Infinity;
  bubble.classList.remove("show");
  e.preventDefault();
});
pet.addEventListener("pointermove", (e) => {
  if (!drag || e.pointerId !== drag.id) return;
  const dx = e.clientX - drag.sx,
    dy = e.clientY - drag.sy;
  if (Math.hypot(dx, dy) > 6) drag.moved = true;
  if (drag.moved) {
    x = drag.ox + dx;
    y = drag.oy + dy;
    clamp();
  }
});
function release(e) {
  if (!drag || e.pointerId !== drag.id) return;
  const moved = drag.moved;
  desktopPet.drag(false);
  drag = null;
  pet.classList.remove("grabbed");
  if (e.type === "pointercancel" || moved) settle();
  else act("pat");
  clamp();
}
pet.addEventListener("pointerup", release);
pet.addEventListener("pointercancel", release);
pet.addEventListener("lostpointercapture", () => {
  if (drag) {
    desktopPet.drag(false);
    drag = null;
    pet.classList.remove("grabbed");
    settle();
  }
});
addEventListener("pointermove", (e) => {
  if (
    !drag &&
    mode === "idle" &&
    performance.now() - lastSniff > 6500 &&
    Math.hypot(e.clientX - (x + size() / 2), e.clientY - (y + size() * 0.55)) <
      size() * 0.9
  ) {
    lastSniff = performance.now();
    act("sniff");
  }
});
pet.addEventListener("keydown", (e) => {
  if (["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(e.key)) {
    e.preventDefault();
    settle();
    x += e.key === "ArrowLeft" ? -20 : e.key === "ArrowRight" ? 20 : 0;
    y += e.key === "ArrowUp" ? -20 : e.key === "ArrowDown" ? 20 : 0;
    clamp();
  }
  if (e.key === "Escape") {
    desktopPet.drag(false);
    drag = null;
    pet.classList.remove("grabbed");
    settle();
  }
});
pet.addEventListener("click", (e) => {
  if (e.detail === 0) act("pat");
});
function beginHop(t, target = null) {
  const maxX = Math.max(0, innerWidth - size()),
    maxY = Math.max(54, innerHeight - size() - 14);
  let tx, ty;
  if (target) {
    const dx = target.x - x,
      dy = target.y - y,
      length = Math.hypot(dx, dy),
      fraction = Math.min(1, 170 / Math.max(1, length));
    tx = x + dx * fraction;
    ty = y + dy * fraction;
  } else {
    tx = Math.max(
      0,
      Math.min(
        maxX,
        x + (Math.random() < 0.5 ? -1 : 1) * (70 + Math.random() * 160),
      ),
    );
    ty = Math.max(54, Math.min(maxY, y + (Math.random() - 0.5) * 200));
    if (Math.abs(tx - x) < 25)
      tx = Math.max(0, Math.min(maxX, x < maxX / 2 ? x + 90 : x - 90));
  }
  facing = tx >= x ? 1 : -1;
  hop = { start: t, ox: x, oy: y, tx, ty, duration: 600 + Math.random() * 180 };
}
function loop(t) {
  if (t - lastFrame < 33) {
    raf = requestAnimationFrame(loop);
    return;
  }
  lastFrame = t;
  if (
    mode !== "idle" &&
    mode !== "grab" &&
    mode !== "goingToGrass" &&
    t > until
  ) {
    const finished = mode;
    if (finished === "eating") {
      nextMeal = t + 40000 + Math.random() * 35000;
      if (Math.random() < 0.65) dropPoop();
    }
    settle(t);
  }
  if (!drag && mode === "goingToGrass" && !hop && t >= nextHop) {
    if (!foodTarget) {
      settle(t);
      nextMeal = t + 15000;
    } else if (Math.hypot(x - foodTarget.x, y - foodTarget.y) < 8) {
      facing = -1;
      act("eating");
    } else beginHop(t, foodTarget);
  }
  if (!drag && mode === "idle" && !hop) {
    if (roaming && t >= nextMeal) goEat();
    else if (t >= nextSleep) act("sleep");
    else if (t >= nextPoop) act("poop");
    else if (t > nextIdle) act(Math.random() < 0.5 ? "peek" : "sniff");
    else if (t > nextHop && roaming) beginHop(t);
  }
  let hopLift = 0;
  if (hop) {
    const q = Math.min(1, (t - hop.start) / hop.duration),
      ease = q * q * (3 - 2 * q);
    x = hop.ox + (hop.tx - hop.ox) * ease;
    y = hop.oy + (hop.ty - hop.oy) * ease;
    clamp();
    hopLift =
      -Math.sin(q * Math.PI) * Math.min(reduced ? 12 : 62, Math.max(0, y - 54));
    if (q === 1) {
      hop = null;
      nextHop =
        t + (mode === "goingToGrass" ? 180 : 900 + Math.random() * 1900);
    }
  }
  const key = [
    ready,
    heldReady,
    sleepReady,
    mode,
    sleepPose,
    !!hop,
    hop ? facing : 0,
  ].join("|");
  if (key !== drawnKey) {
    drawnKey = key;
    ctx.clearRect(0, 0, 160, 160);
    if (mode === "grab" && heldReady) {
      const w = (160 * held.width) / held.height;
      ctx.drawImage(
        held,
        0,
        0,
        held.width,
        held.height,
        (160 - w) / 2,
        0,
        w,
        160,
      );
    } else if (mode === "sleep" && sleepReady) {
      const boxes = [
          [0, 140, 555, 465],
          [550, 250, 704, 350],
          [0, 800, 580, 390],
          [600, 790, 654, 390],
        ],
        b = boxes[sleepPose],
        scale = Math.min(152 / b[2], 136 / b[3]),
        dw = b[2] * scale,
        dh = b[3] * scale;
      ctx.drawImage(
        sleepSheet,
        b[0],
        b[1],
        b[2],
        b[3],
        (160 - dw) / 2,
        148 - dh,
        dw,
        dh,
      );
    } else if (ready) {
      const frame =
          mode === "sniff" || mode === "eating"
            ? 1
            : mode === "peek"
              ? 2
              : mode === "pat" || mode === "sleep"
                ? 3
                : hop
                  ? 1
                  : 0,
        w = sheet.width / 2,
        h = sheet.height / 2;
      ctx.save();
      if (hop && facing === 1) {
        ctx.translate(160, 0);
        ctx.scale(-1, 1);
      }
      ctx.drawImage(
        sheet,
        (frame % 2) * w,
        Math.floor(frame / 2) * h,
        w,
        h,
        0,
        0,
        160,
        160,
      );
      ctx.restore();
    }
  }
  let phase = t / 1000,
    dy = hopLift,
    rot = 0,
    sx = 1,
    sy = 1;
  if (!reduced) {
    if (mode === "idle" && !hop) sy = 1 + Math.sin(phase * 2) * 0.012;
    if (hop) {
      rot = facing * Math.sin(((t - hop.start) / hop.duration) * Math.PI) * -5;
      sy = 1.03;
    }
    if (mode === "sniff" || mode === "eating") {
      dy = Math.sin(phase * (mode === "eating" ? 10 : 15)) * 1.7;
      rot = Math.sin(phase * 6) * 2;
    }
    if (mode === "peek") {
      dy = -Math.abs(Math.sin(phase * 2)) * 10;
      rot = Math.sin(phase * 2) * 3;
    }
    if (mode === "pat") {
      sx = 1 + Math.sin(phase * 10) * 0.025;
      sy = 1 - Math.sin(phase * 10) * 0.025;
    }
    if (mode === "poop") {
      sy = 0.92;
      sx = 1.03;
    }
    if (mode === "sleep") sy = 1 + Math.sin(phase * 1.4) * 0.014;
    if (mode === "grab") {
      rot = Math.sin(phase * 5) * 4;
      dy = -7;
    }
  }
  pet.style.transform = `translate3d(${x}px,${y + dy}px,0) rotate(${rot}deg) scale(${sx},${sy})`;
  raf = requestAnimationFrame(loop);
}
requestAnimationFrame(loop);
const menuToggle = document.querySelector("#petMenuToggle"),
  menu = document.querySelector("#petMenu");
menuToggle.onclick = () => {
  menu.hidden = !menu.hidden;
  menuToggle.setAttribute("aria-expanded", String(!menu.hidden));
  menuToggle.textContent = menu.hidden ? "兔兔功能" : "收起功能";
};
const roamButton = document.querySelector("#roamToggle");
function showRoaming() {
  roamButton.textContent = "自主跳動：" + (roaming ? "開啟" : "暫停");
  roamButton.setAttribute("aria-pressed", String(roaming));
}
showRoaming();
roamButton.onclick = () => {
  roaming = !roaming;
  hop = null;
  if (mode === "goingToGrass") {
    nextMeal = performance.now() + 15000;
    settle();
  }
  nextHop = performance.now() + 200;
  try {
    localStorage.setItem("rabbit-roaming", String(roaming));
  } catch {}
  showRoaming();
};
const agendaToggle = document.querySelector("#agendaToggle"),
  agendaBody = document.querySelector("#agendaBody"),
  agenda = document.querySelector("#agenda");
function toggleCalendar() {
  agenda.hidden = !agenda.hidden;
  agendaBody.hidden = agenda.hidden;
  agenda.classList.remove("collapsed");
  agendaToggle.textContent = "關閉課表";
  sendHitRegions();
}
agendaToggle.onclick = toggleCalendar;
// Only the pet, grass, poop and visible calendar accept desktop clicks.
function sendHitRegions() {
  const selectors = [
    "#pet",
    "#grass",
    ".poop",
    ...(agenda.hidden ? [] : ["#agenda"]),
  ];
  desktopPet.bounds(
    selectors
      .flatMap((s) => [...document.querySelectorAll(s)])
      .filter((e) => !e.hidden)
      .map((e) => {
        const r = e.getBoundingClientRect();
        return { x: r.x, y: r.y, width: r.width, height: r.height };
      }),
  );
  desktopPet.state({
    roaming,
    poops: poops.size,
    calendarOpen: !agenda.hidden,
  });
}
setInterval(sendHitRegions, 40);
sendHitRegions();
desktopPet.onAction((action) => {
  if (action === "calendar") {
    toggleCalendar();
  } else if (action === "roam") {
    roamButton.click();
    sendHitRegions();
  } else {
    desktopPet.drag(false);
    drag = null;
    pet.classList.remove("grabbed");
    act(action);
    sendHitRegions();
  }
});
desktopPet.onCursor((p) => {
  if (
    !drag &&
    mode === "idle" &&
    performance.now() - lastSniff > 6500 &&
    Math.hypot(p.x - (x + size() / 2), p.y - (y + size() * 0.55)) < size() * 0.9
  ) {
    lastSniff = performance.now();
    act("sniff");
  }
});
