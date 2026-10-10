const $ = (id) => document.getElementById(id);
let theme = "",
  busy = false;
function showConfig(s) {
  $("config").textContent =
    `已匯入 ${s.references} 張照片 · ${s.configured ? "連線金鑰已設定" : "尚未設定金鑰"}`;
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
    if (busy) return;
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
      for (const id of ["generate", "random", "photos", "key"])
        $(id).disabled = false;
    }
  });
$("download").onclick = () =>
  run(async () => {
    if (await desktopPet.studioSave()) $("status").textContent = "圖片已儲存。";
  });
void run(async () => showConfig(await desktopPet.studioStatus()));
