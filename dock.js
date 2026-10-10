const toggle = document.querySelector("#toggle"),
  panel = document.querySelector("#panel"),
  notice = document.querySelector("#notice");
let expanded = false,
  gesture = null,
  busy = false;
async function setExpanded(next) {
  if (busy) return;
  busy = true;
  try {
    await desktopPet.panel(next);
    expanded = next;
    panel.hidden = !expanded;
    toggle.setAttribute("aria-expanded", String(expanded));
    toggle.setAttribute(
      "aria-label",
      expanded ? "收起兔兔功能；按住拖曳移動" : "展開兔兔功能；按住拖曳移動",
    );
  } catch {
    notice.textContent = "無法調整功能視窗，請重啟兔兔。";
  } finally {
    busy = false;
  }
}
toggle.addEventListener("pointerdown", (e) => {
  if (e.button !== 0) return;
  toggle.setPointerCapture(e.pointerId);
  gesture = { id: e.pointerId, x: e.screenX, y: e.screenY, moved: false };
  desktopPet.dockDrag("start");
  e.preventDefault();
});
toggle.addEventListener("pointermove", (e) => {
  if (!gesture || gesture.id !== e.pointerId) return;
  if (Math.hypot(e.screenX - gesture.x, e.screenY - gesture.y) > 5)
    gesture.moved = true;
  if (gesture.moved) {
    toggle.classList.add("dragging");
    desktopPet.dockDrag("move");
  }
});
function release(e) {
  if (!gesture || gesture.id !== e.pointerId) return;
  const click = !gesture.moved && e.type === "pointerup";
  gesture = null;
  desktopPet.dockDrag("end");
  toggle.classList.remove("dragging");
  if (click) setExpanded(!expanded);
}
toggle.addEventListener("pointerup", release);
toggle.addEventListener("pointercancel", release);
toggle.addEventListener("lostpointercapture", () => {
  if (gesture) {
    gesture = null;
    desktopPet.dockDrag("end");
    toggle.classList.remove("dragging");
  }
});
toggle.addEventListener("click", (e) => {
  if (e.detail === 0) setExpanded(!expanded);
});
document.querySelector("#closePanel").onclick = () => setExpanded(false);
document.querySelectorAll("[data-command]").forEach(
  (b) =>
    (b.onclick = () => {
      desktopPet.command(b.dataset.command);
      notice.textContent = "已執行：" + b.textContent;
    }),
);
document.querySelector("#quit").onclick = () => desktopPet.quit();
document.querySelector("#shortcut").onclick = async () => {
  try {
    notice.textContent = await desktopPet.shortcut();
  } catch {
    notice.textContent = "捷徑建立失敗，請將程式移到可寫入的資料夾後重試。";
  }
};
desktopPet.onState((s) => {
  document.querySelector("#roam").textContent =
    "自主跳動：" + (s.roaming ? "開啟" : "暫停");
  document.querySelector("#calendar").textContent = s.calendarOpen
    ? "關閉課表"
    : "顯示課表";
  document.querySelector("#clean").textContent =
    "一鍵清理" + (s.poops ? "（" + s.poops + "）" : "");
});
addEventListener("keydown", (e) => {
  if (e.key === "Escape") setExpanded(false);
});

function showUpdate(s) {
  document.querySelector("#updateStatus").textContent =
    `目前 ${s.currentVersion} · ${s.message}` +
    (s.phase === "downloading" ? ` ${Math.round(s.percent || 0)}%` : "");
  document.querySelector("#checkUpdate").disabled = [
    "checking",
    "downloading",
    "downloaded",
    "installing",
  ].includes(s.phase);
  document.querySelector("#downloadUpdate").hidden = s.phase !== "available";
  document.querySelector("#downloadUpdate").textContent = s.manualDownload
    ? "開啟新版下載頁"
    : "下載更新";
  document.querySelector("#installUpdate").hidden = s.phase !== "downloaded";
}
async function updateAction(fn) {
  try {
    const result = await fn();
    if (result && typeof result === "object") showUpdate(result);
  } catch {
    document.querySelector("#updateStatus").textContent =
      "更新操作失敗，請稍後重試。";
  }
}
desktopPet.onUpdate(showUpdate);
void updateAction(() => desktopPet.updateStatus());
document.querySelector("#checkUpdate").onclick = () =>
  updateAction(() => desktopPet.checkUpdate());
document.querySelector("#downloadUpdate").onclick = () =>
  updateAction(() => desktopPet.downloadUpdate());
document.querySelector("#installUpdate").onclick = () =>
  updateAction(() => desktopPet.installUpdate());

document.querySelector("#studio").onclick = async () => {
  try {
    await desktopPet.studioOpen();
  } catch {
    notice.textContent = "圖片工作室無法開啟，請重啟兔兔。";
  }
};
