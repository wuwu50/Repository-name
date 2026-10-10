const fs = require("node:fs"),
  path = require("node:path");
const { pickTheme } = require("./studio-themes");
function readKey(file) {
  try {
    const line = fs
      .readFileSync(file, "utf8")
      .split(/\r?\n/)
      .find((x) => /^\s*OPENAI_API_KEY\s*=/.test(x));
    return (
      line
        ?.slice(line.indexOf("=") + 1)
        .trim()
        .replace(/^(['"])(.*)\1$/, "$2") || ""
    );
  } catch {
    return "";
  }
}
function createStudio({ root, userData, fetchImpl = fetch, localAI }) {
  const folder = path.join(userData, "rabbit-studio"),
    refs = path.join(folder, "references"),
    historyFile = path.join(folder, "themes.json");
  fs.mkdirSync(refs, { recursive: true });
  let history = [];
  try {
    history = JSON.parse(fs.readFileSync(historyFile, "utf8"));
    if (!Array.isArray(history)) history = [];
  } catch {}
  let busy = false,
    last = null,
    theme = "";
  const key = () =>
    process.env.OPENAI_API_KEY ||
    readKey(path.join(root, ".env.local")) ||
    readKey(path.join(folder, ".env.local"));
  const referenceFiles = () =>
    fs
      .readdirSync(refs)
      .filter((x) => /^\d+\.png$/.test(x))
      .sort();
  function status() {
    return {
      configured: !!key(),
      references: referenceFiles().length,
      busy,
      theme,
    };
  }
  function randomTheme() {
    theme = pickTheme(new Date(), history);
    history.push(theme);
    history = history.slice(-500);
    fs.writeFileSync(historyFile, JSON.stringify(history));
    return theme;
  }
  async function importReferences(files, convert) {
    if (busy) throw Error("請等圖片生成完成。");
    if (!Array.isArray(files) || !files.length || files.length > 10)
      throw Error("請選擇 1～10 張兔兔照片。");
    const images = files.map((file) => {
      if (fs.statSync(file).size > 50 * 1024 * 1024) throw Error("照片過大。");
      const bytes = convert(file);
      if (!bytes?.length) throw Error("無法讀取照片。");
      return bytes;
    });
    for (const name of referenceFiles()) fs.unlinkSync(path.join(refs, name));
    images.forEach((bytes, i) =>
      fs.writeFileSync(path.join(refs, `${i + 1}.png`), bytes),
    );
    return status();
  }
  function importKey(file) {
    const value = readKey(file);
    if (!value.startsWith("sk-"))
      throw Error("所選檔案沒有有效的 OPENAI_API_KEY。");
    fs.writeFileSync(
      path.join(folder, ".env.local"),
      `OPENAI_API_KEY=${value}\n`,
      { mode: 0o600 },
    );
    return status();
  }
  async function generate(input) {
    if (busy) throw Error("正在生成，請稍候。");
    const prompt = typeof input?.prompt === "string" ? input.prompt.trim() : "";
    if (prompt.length > 2000) throw Error("要求最多 2000 字。");
    const token = key(),
      files = referenceFiles();
    const mode = input?.mode === "cloud" ? "cloud" : "local";
    if (mode === "cloud" && !token) throw Error("請先匯入金鑰設定檔。");
    if (!files.length) throw Error("請先匯入兔兔照片。");
    busy = true;
    try {
      const selected =
        typeof input?.theme === "string" ? input.theme.slice(0, 200) : "";
      if (!prompt && !selected) throw Error("請輸入要求或選擇隨機主題。");
      if (mode === "local") {
        if (!localAI) throw Error("請先安裝並啟動本機生圖。");
        const bytes = await localAI.generate({
          files: files.map((file) => path.join(refs, file)),
          text: [selected, prompt].filter(Boolean).join("。"),
        });
        last = bytes;
        fs.writeFileSync(path.join(folder, "latest.png"), bytes);
        return {
          image: "data:image/png;base64," + bytes.toString("base64"),
          theme: selected || "自訂主題",
        };
      }
      const form = new FormData();
      form.append("model", "gpt-image-1.5");
      form.append("n", "1");
      form.append("size", "1024x1024");
      form.append("quality", "medium");
      form.append("input_fidelity", "high");
      form.append("output_format", "png");
      form.append(
        "prompt",
        `所有參考照片是同一隻兔子。只畫這一隻兔子，保留白色身體、棕色眼周與鼻部斑紋、黑眼睛、粉紅鼻子和蓬鬆臉頰。解剖正確：恰好兩隻耳朵、四隻腳、一條尾巴，不要多耳或多肢，不要變成其他兔子。主題：${selected || "依照使用者要求"}。使用者要求：${prompt || "生成完整且精緻的主題作品，讓兔兔成為主角。"}。`,
      );
      for (const file of files)
        form.append(
          "image[]",
          new Blob([fs.readFileSync(path.join(refs, file))], {
            type: "image/png",
          }),
          file,
        );
      const response = await fetchImpl(
        "https://api.openai.com/v1/images/edits",
        {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` },
          body: form,
          signal: AbortSignal.timeout(300000),
        },
      );
      if (!response.ok)
        throw Error(
          response.status === 401
            ? "金鑰無效，請重新匯入。"
            : response.status === 429
              ? "額度不足或請求太頻繁，請檢查 API 帳戶。"
              : response.status === 403
                ? "帳戶尚未取得圖片模型權限。"
                : `生成失敗（${response.status}），請稍後重試。`,
        );
      const data = await response.json(),
        b64 = data.data?.[0]?.b64_json;
      if (typeof b64 !== "string" || b64.length > 80 * 1024 * 1024)
        throw Error("服務沒有傳回可用圖片。");
      const bytes = Buffer.from(b64, "base64");
      if (
        !bytes
          .subarray(0, 8)
          .equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
      )
        throw Error("圖片格式不正確。");
      last = bytes;
      fs.writeFileSync(path.join(folder, "latest.png"), bytes);
      return {
        image: `data:image/png;base64,${b64}`,
        theme: selected || "自訂主題",
      };
    } catch (error) {
      if (error.name === "TimeoutError" || error.name === "AbortError")
        throw Error("生成逾時，請稍後重試。");
      if (error instanceof TypeError) throw Error("無法連線，請檢查網路。");
      throw error;
    } finally {
      busy = false;
    }
  }
  function save(file) {
    if (!last) throw Error("請先生成圖片。");
    fs.writeFileSync(file, last);
    return true;
  }
  return { status, randomTheme, importReferences, importKey, generate, save };
}
module.exports = { createStudio, readKey };
