const $ = (id) => document.getElementById(id);
let localState = {},
  localAction = false;
let theme = "",
  busy = false;
function showConfig(s) {
  $("config").textContent = `已匯入 ${s.references} 張照片 · 本機生成不需金鑰`;
}
async function run(fn) {
  try {
    return await fn();
  } catch (e) {
    $("status").textContent = e.message.replace(
      /^Error invoking remote method '[^']+': Error: /,
      "",
    );
  }
}
$("random").onclick = () =>
  run(async () => {
    theme = await desktopPet.studioTheme();
    $("theme").textContent = theme;
  });
$("photos").onclick = () =>
  run(async () => showConfig(await desktopPet.studioPhotos()));
$("key").onclick = () =>
  run(async () => showConfig(await desktopPet.studioKey()));
$("generate").onclick = () =>
  run(async () => {
    if (busy || localAction) return;
    if ($("mode").value === "local" && localState.phase !== "ready") {
      $("status").textContent = "請先安裝並啟動本機生圖。";
      return;
    }
    if (!theme && !$("prompt").value.trim()) {
      $("status").textContent = "請輸入想法，或選擇隨機主題。";
      return;
    }
    busy = true;
    for (const id of ["generate", "random", "photos", "key"])
      $(id).disabled = true;
    $("status").textContent = "兔兔正在創作，可能需要幾分鐘…";
    try {
      const r = await desktopPet.studioGenerate({
        mode: $("mode").value,
        theme,
        prompt: $("prompt").value,
      });
      $("image").src = r.image;
      $("image").hidden = false;
      $("empty").hidden = true;
      $("download").disabled = false;
      $("status").textContent = "完成了！可以下載，或再試另一個故事。";
    } finally {
      busy = false;
      showLocal({});
      for (const id of ["generate", "random", "photos", "key"])
        $(id).disabled = false;
    }
  });
$("download").onclick = () =>
  run(async () => {
    if (await desktopPet.studioSave()) $("status").textContent = "圖片已儲存。";
  });
void run(async () => showConfig(await desktopPet.studioStatus()));

function showLocal(value) {
  localState = { ...localState, ...value };
  const h = localState.hardware;
  if (h)
    $("hardware").textContent =
      h.label +
      " · 記憶體 " +
      h.memoryGB +
      " GB\n" +
      h.message +
      "\n所需空間：約 " +
      h.requiredGB +
      " GB";
  $("localStatus").textContent = localState.message || "";
  const working =
    localAction ||
    ["installing", "starting", "generating"].includes(localState.phase);
  $("installLocal").disabled = working || !h?.supported;
  $("installLocal").hidden = !!localState.installed;
  $("startLocal").disabled = working || !localState.installed;
  $("startLocal").hidden = localState.phase === "ready";
  $("stopLocal").hidden = localState.phase !== "ready";
  $("cancelLocal").hidden = !working;
  $("localProgress").hidden = localState.phase !== "installing";
  if (Number.isFinite(localState.percent))
    $("localProgress").value = localState.percent;
  else $("localProgress").removeAttribute("value");
  $("mode").disabled = working || busy;
}
async function localOperation(fn) {
  if (localAction) return;
  localAction = true;
  showLocal({});
  try {
    showLocal(await fn());
  } catch (e) {
    $("status").textContent = e.message.replace(
      /^Error invoking remote method '[^']+': Error: /,
      "",
    );
  } finally {
    localAction = false;
    showLocal(await desktopPet.localAIStatus());
  }
}
$("installLocal").onclick = () =>
  run(() => localOperation(() => desktopPet.localAIInstall()));
$("startLocal").onclick = () =>
  run(() => localOperation(() => desktopPet.localAIStart()));
$("stopLocal").onclick = () =>
  run(() => localOperation(() => desktopPet.localAIStop()));
$("cancelLocal").onclick = () => run(() => desktopPet.localAICancel());
$("mode").onchange = () => {
  $("key").hidden = $("mode").value !== "cloud";
  $("status").textContent =
    $("mode").value === "cloud"
      ? "雲端模式會上傳照片至 OpenAI，依 API 用量計費。"
      : "已選擇免費本機生成。";
};
desktopPet.onLocalAI(showLocal);
void run(async () => showLocal(await desktopPet.localAIStatus()));
