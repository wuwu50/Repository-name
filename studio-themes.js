const scenes = [
  "森林野餐",
  "星空露營",
  "花園午茶",
  "海邊度假",
  "秋日書店",
  "雲端旅行",
  "胡蘿蔔咖啡館",
  "雪地小屋",
  "魔法學院",
  "月球探險",
  "雨天窗邊",
  "櫻花散步",
  "小小畫家",
  "花店店長",
  "偵探冒險",
  "童話城堡",
  "音樂派對",
  "熱氣球旅行",
  "復古車站",
  "溫暖廚房",
];
const styles = [
  "自然攝影",
  "水彩插畫",
  "童話繪本",
  "柔和粉彩",
  "黏土模型",
  "電影海報",
];
function holiday(date) {
  const m = date.getMonth() + 1,
    d = date.getDate();
  if (m === 10 && d >= 17) return "萬聖節南瓜派對";
  if (m === 12 && d >= 10 && d <= 26) return "聖誕節禮物小屋";
  if ((m === 12 && d >= 27) || (m === 1 && d <= 3)) return "新年星光派對";
  if (m === 2 && d >= 7 && d <= 15) return "情人節愛心花園";
  try {
    const p = new Intl.DateTimeFormat("en-u-ca-chinese", {
      month: "numeric",
      day: "numeric",
    }).formatToParts(date);
    const lm = p.find((x) => x.type === "month")?.value,
      ld = Number(p.find((x) => x.type === "day")?.value);
    if (lm === "1" && ld <= 15) return "農曆新年燈籠花園";
    if (lm === "5" && ld >= 1 && ld <= 7) return "端午節龍舟與粽子";
    if (lm === "8" && ld >= 1 && ld <= 16) return "中秋節月光與桂花";
  } catch {}
  return null;
}
function pickTheme(date, history = [], random = Math.random) {
  const h = holiday(date),
    season = ["冬日", "春日", "夏日", "秋日"][
      Math.floor((date.getMonth() % 12) / 3)
    ];
  const bases = h ? [h, ...scenes.slice(0, 5)] : scenes.map((s) => season + s);
  const all = bases.flatMap((scene) =>
    styles.map((style) => `${scene} · ${style}`),
  );
  const fresh = all.filter((x) => !history.includes(x));
  const preferred = h ? fresh.filter((x) => x.startsWith(h)) : [];
  const choices = preferred.length
    ? preferred
    : fresh.length
      ? fresh
      : all.filter((x) => x !== history.at(-1));
  return choices[Math.floor(random() * choices.length)];
}
module.exports = { pickTheme, holiday };
