(() => {
  const $ = (id) => document.getElementById(id);
  let data = null,
    week,
    lastRenderKey = "";
  const esp = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Madrid",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const fmt = (d) => d.toISOString().slice(0, 10);
  const add = (d, n) => {
    const r = new Date(d + "T00:00:00Z");
    r.setUTCDate(r.getUTCDate() + n);
    return fmt(r);
  };
  const monday = () => {
    const d = new Date(esp.format(new Date()) + "T00:00:00Z");
    return add(fmt(d), -((d.getUTCDay() + 6) % 7));
  };
  week = monday();
  const esc = (s) =>
    String(s ?? "").replace(
      /[&<>"']/g,
      (c) =>
        ({
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "'": "&#39;",
        })[c],
    );
  function groups() {
    const year = Number($("year").value),
      selected = $("group").value;
    const names = [
      ...new Set(
        (data?.events || [])
          .filter((e) => e.years.includes(year))
          .flatMap((e) => e.groups),
      ),
    ].sort();
    $("group").innerHTML =
      '<option value="">全部組別</option>' +
      names.map((g) => `<option value="${esc(g)}">${esc(g)}</option>`).join("");
    if (names.includes(selected)) $("group").value = selected;
  }
  function render() {
    if (!data) return;
    const end = add(week, 6),
      year = Number($("year").value),
      group = $("group").value;
    const entries = data.events.filter(
      (e) =>
        e.date >= week &&
        e.date <= end &&
        e.years.includes(year) &&
        (!group || e.groups.includes(group)),
    );
    const today = esp.format(new Date()),
      clock = new Intl.DateTimeFormat("en-GB", {
        timeZone: "Europe/Madrid",
        hour: "2-digit",
        minute: "2-digit",
        hourCycle: "h23",
      }).format(new Date());
    const next = entries.find(
      (e) => e.date > today || (e.date === today && e.end > clock),
    );
    $("weekLabel").textContent =
      `${week.slice(5).replace("-", "/")} – ${end.slice(5).replace("-", "/")}`;
    $("prevWeek").disabled = add(week, -7) < data.range.start;
    $("nextWeek").disabled = add(week, 7) > data.range.end;
    const fresh =
      Date.now() - Date.parse(data.updatedAt) < 7200000 && !data.stale;
    $("sync").classList.toggle("error", !fresh);
    $("sync").textContent =
      `${fresh ? "已同步" : "資料可能已過期"} · 上次成功更新 ${new Intl.DateTimeFormat("zh-TW", { timeZone: "Asia/Taipei", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }).format(new Date(data.updatedAt))}（台灣） · 每小時抓取` +
      (data.error ? ` · ${data.error}` : "");
    $("summary").textContent =
      `本週 ${entries.length} 堂 · ${new Set(entries.map((e) => e.title)).size} 門課` +
      (next
        ? ` · 下一堂 ${next.date.slice(5)} ${next.start} ${next.title}`
        : "");
    const renderKey = [data.updatedAt, week, year, group, today, next?.id].join(
      "|",
    );
    if (renderKey === lastRenderKey) return;
    lastRenderKey = renderKey;
    const scrollTop = $("agendaBody").scrollTop;
    let html = "";
    for (let i = 0; i < 7; i++) {
      const date = add(week, i),
        rows = entries.filter((e) => e.date === date);
      const title = new Intl.DateTimeFormat("zh-TW", {
        timeZone: "UTC",
        month: "numeric",
        day: "numeric",
        weekday: "long",
      }).format(new Date(date + "T00:00:00Z"));
      html +=
        `<section class="day ${date === today ? "today" : ""}"><h3>${esc(title)}${date === today ? " · 今天" : ""}</h3>` +
        (rows.length
          ? rows
              .map(
                (e) =>
                  `<article class="lesson ${next?.id === e.id ? "next" : ""}">${next?.id === e.id ? '<span class="badge">下一堂</span>' : ""}<time>${esc(e.start)} – ${esc(e.end)}</time><strong>${esc(e.title)}</strong><small>教室：${esc(e.rooms.join(" · ") || "未提供")} · ${esc(e.section || e.type)}</small>${e.teachers.length ? `<small>教師：${esc(e.teachers.join(" · "))}</small>` : ""}<small>組別：${esc(e.groups.join(" · "))}</small>${e.notes ? `<small>${esc(e.notes)}</small>` : ""}</article>`,
              )
              .join("")
          : '<div class="empty">本日沒有課程</div>') +
        "</section>";
    }
    if (week < data.range.start || week > data.range.end) {
      html = "<p>此週超出已抓取範圍，請選擇本週。</p>";
    }
    $("days").innerHTML = html;
    $("agendaBody").scrollTop = scrollTop;
  }
  async function load() {
    try {
      const j = await desktopPet.calendar();
      if (!Array.isArray(j.events)) throw Error();
      data = j;
      groups();
      render();
    } catch {
      $("sync").classList.add("error");
      $("sync").textContent = "暫時無法讀取課表，稍後會自動重試。";
      if (!data)
        $("days").innerHTML =
          "<p>目前無法載入課表。可先點「查看原始課表」。</p>";
    }
  }
  $("prevWeek").onclick = () => {
    week = add(week, -7);
    render();
  };
  $("nextWeek").onclick = () => {
    week = add(week, 7);
    render();
  };
  $("thisWeek").onclick = () => {
    week = monday();
    render();
  };
  $("year").onchange = () => {
    groups();
    render();
  };
  $("group").onchange = render;
  load();
  setInterval(load, 300000);
  setInterval(render, 60000);
})();
