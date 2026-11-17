(() => {
  "use strict";

  const source = new URL("news.json", document.currentScript?.src || document.baseURI);
  const fullDateFormatter = new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC"
  });
  const monthFormatter = new Intl.DateTimeFormat("en-US", {
    month: "short",
    year: "numeric",
    timeZone: "UTC"
  });

  function readDate(value) {
    if (typeof value !== "string" || !/^\d{4}-\d{2}(?:-\d{2})?$/.test(value)) {
      throw new Error("A news date must use YYYY-MM or YYYY-MM-DD.");
    }
    const [year, month, day = 1] = value.split("-").map(Number);
    const parsed = new Date(0);
    parsed.setUTCFullYear(year, month - 1, day);
    parsed.setUTCHours(0, 0, 0, 0);
    if (parsed.getUTCFullYear() !== year || parsed.getUTCMonth() !== month - 1 || parsed.getUTCDate() !== day) {
      throw new Error("A news date is invalid.");
    }
    return parsed;
  }

  function safeLink(value) {
    if (typeof value !== "string" || !value.trim()) return null;
    try {
      const link = new URL(value);
      return link.protocol === "http:" || link.protocol === "https:" ? link.href : null;
    } catch {
      return null;
    }
  }

  function createRow(entry, index) {
    const row = document.createElement("li");
    row.className = "activity-row";
    row.id = `news-item-${index + 1}`;
    row.hidden = index >= 4;

    const date = document.createElement("time");
    date.className = "activity-date";
    date.dateTime = entry.date;
    const formatter = entry.date.length === 10 ? fullDateFormatter : monthFormatter;
    date.textContent = `${formatter.format(entry.parsedDate)}:`;

    const body = document.createElement("span");
    body.className = "activity-text";
    const linkSpecs = Array.isArray(entry.links)
      ? entry.links
      : [{ text: entry.linkText || entry.text, url: entry.url }];
    const ranges = linkSpecs.map(spec => {
      const text = typeof spec?.text === "string" ? spec.text : "";
      return { text, href: safeLink(spec?.url), start: text ? entry.text.indexOf(text) : -1 };
    }).filter(link => link.href && link.start >= 0).sort((a, b) => a.start - b.start);
    let cursor = 0;
    for (const range of ranges) {
      if (range.start < cursor) continue;
      body.append(entry.text.slice(cursor, range.start));
      const link = document.createElement("a");
      link.href = range.href;
      link.target = "_blank";
      link.rel = "noopener noreferrer";
      link.textContent = range.text;
      body.append(link);
      cursor = range.start + range.text.length;
    }
    body.append(entry.text.slice(cursor));
    row.append(date, " ", body);
    return row;
  }

  async function loadNews() {
    const feed = document.querySelector("#news-feed");
    if (!feed) return;
    const controls = document.querySelector("#news-archive-controls");
    const status = document.querySelector("#news-load-status");

    try {
      const embedded = document.querySelector('#news-data');
      let data;
      if (embedded) {
        data = JSON.parse(embedded.textContent);
      } else {
        const response = await fetch(source, { cache: "no-cache" });
        if (!response.ok) throw new Error("News could not be loaded.");
        data = await response.json();
      }
      if (!Array.isArray(data)) throw new Error("News must be an array.");
      const entries = data.map((entry, originalIndex) => {
        if (!entry || typeof entry.text !== "string" || !entry.text.trim()) {
          throw new Error("A news entry is incomplete.");
        }
        return { ...entry, originalIndex, parsedDate: readDate(entry.date) };
      }).sort((a, b) => b.parsedDate - a.parsedDate || a.originalIndex - b.originalIndex);

      const rows = entries.map(createRow);
      const fragment = document.createDocumentFragment();
      if (rows.length) {
        fragment.append(...rows);
      } else {
        const empty = document.createElement("li");
        empty.className = "activity-text activity-empty";
        empty.textContent = "Academic updates will appear here.";
        fragment.append(empty);
      }

      let toggle = null;
      if (rows.length > 4 && controls) {
        toggle = document.createElement("button");
        toggle.type = "button";
        toggle.className = "news-toggle";
        toggle.textContent = "Show older news";
        toggle.setAttribute("aria-expanded", "false");
        toggle.setAttribute("aria-controls", rows.slice(4).map(row => row.id).join(" "));
        toggle.addEventListener("click", () => {
          const expanded = toggle.getAttribute("aria-expanded") === "true";
          rows.slice(4).forEach(row => { row.hidden = expanded; });
          toggle.setAttribute("aria-expanded", String(!expanded));
          toggle.textContent = expanded ? "Show older news" : "Show less news";
        });
      } else if (!controls) {
        rows.forEach(row => { row.hidden = false; });
      }

      feed.replaceChildren(fragment);
      if (controls) {
        controls.replaceChildren(...(toggle ? [toggle] : []));
        controls.hidden = !toggle;
      }
      if (status) {
        status.textContent = "";
        status.hidden = true;
      }
    } catch {
      // The static HTML update remains available if loading or validation fails.
      if (status) {
        status.textContent = "The latest updates are temporarily unavailable. Showing the saved update.";
        status.hidden = false;
      }
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", loadNews, { once: true });
  } else {
    loadNews();
  }
})();
