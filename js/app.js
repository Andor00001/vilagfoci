(function () {
  const NAME = (window.SITE && window.SITE.name) || "A név még nincs meg";
  document.querySelectorAll("[data-site-name]").forEach((el) => {
    el.textContent = NAME;
  });
  document.title = document.title.replace("{{name}}", NAME);

  const HU = {
    Belgien: "Belgium",
    Frankreich: "Franciaország",
    Türkei: "Törökország",
    Italien: "Olaszország",
    Tschechien: "Csehország",
    England: "Anglia",
    Spanien: "Spanyolország",
    Kroatien: "Horvátország",
    Deutschland: "Németország",
    Serbien: "Szerbia",
    Griechenland: "Görögország",
    Niederlande: "Hollandia",
    Dänemark: "Dánia",
    Norwegen: "Norvégia",
    Portugal: "Portugália",
    Wales: "Wales"
  };

  const LEAGUES = [
    { shortcut: "nla", season: 2026, league: "UEFA Nemzetek Ligája A", country: "Európa" },
    { shortcut: "bl1", season: 2026, league: "Bundesliga", country: "Németország" },
    { shortcut: "pl", season: 2026, league: "Premier League", country: "Anglia" },
    { shortcut: "la1", season: 2026, league: "LaLiga", country: "Spanyolország" },
    { shortcut: "ucl", season: 2026, league: "Bajnokok Ligája", country: "Európa" }
  ];

  const page = document.body.dataset.page;
  const bud = new Intl.DateTimeFormat("hu-HU", {
    timeZone: "Europe/Budapest",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  });

  function teamName(raw) {
    return HU[raw] || raw;
  }

  function parseUtc(value) {
    if (!value) return null;
    const v = String(value).trim();
    const iso = /[zZ]|[+-]\d\d:?\d\d$/.test(v) ? v : v.replace(" ", "T") + "Z";
    const d = new Date(iso);
    return Number.isNaN(d.getTime()) ? null : d;
  }

  function when(d) {
    return d ? bud.format(d) + " (Budapest)" : "ismeretlen időpont";
  }

  function scoreText(m) {
    if (!m.score || m.score.home == null || m.score.away == null) {
      return m.finished ? "nincs állás a feedben" : "még nincs eredmény";
    }
    const s = m.score.home + "–" + m.score.away;
    return m.score.partial ? s + " (" + (m.score.label || "részeredmény") + ")" : s;
  }

  function fromOpenLiga(m, meta) {
    const results = m.matchResults || [];
    const finalR = results.find((r) => r.resultTypeID === 2);
    let score = null;
    if (m.matchIsFinished && finalR && finalR.pointsTeam1 != null && finalR.pointsTeam2 != null) {
      score = { home: finalR.pointsTeam1, away: finalR.pointsTeam2, label: finalR.resultName || "végeredmény" };
    } else if (!m.matchIsFinished && results.length) {
      const last = results[results.length - 1];
      if (last.pointsTeam1 != null && last.pointsTeam2 != null) {
        score = { home: last.pointsTeam1, away: last.pointsTeam2, label: last.resultName || "részeredmény", partial: true };
      }
    }
    const home = m.team1 && m.team1.teamName;
    const away = m.team2 && m.team2.teamName;
    if (!home || !away) return null;
    return {
      id: "ol-" + m.matchID,
      at: parseUtc(m.matchDateTimeUTC || m.matchDateTime),
      league: meta.league,
      country: meta.country,
      group: (m.group && m.group.groupName) || "",
      home: teamName(home),
      away: teamName(away),
      homeRaw: home,
      awayRaw: away,
      finished: !!m.matchIsFinished,
      score,
      city: (m.location && m.location.locationCity) || "",
      source: "OpenLigaDB",
      sourceUrl: "https://api.openligadb.de/getmatchdata/" + m.matchID
    };
  }

  function fromSportsDb(e) {
    const status = (e.strStatus || "").toUpperCase();
    const finished = status === "FT" || status === "AET" || status === "PEN";
    const hs = e.intHomeScore;
    const as = e.intAwayScore;
    let score = null;
    if (hs != null && as != null && hs !== "" && as !== "" && (finished || status === "LIVE" || status === "1H" || status === "2H" || status === "HT")) {
      score = { home: Number(hs), away: Number(as), label: status || "állás", partial: !finished };
    }
    if (!e.strHomeTeam || !e.strAwayTeam) return null;
    return {
      id: "ts-" + e.idEvent,
      at: parseUtc(e.strTimestamp || (e.dateEvent && e.strTime ? e.dateEvent + "T" + e.strTime : e.dateEvent)),
      league: e.strLeague || "TheSportsDB",
      country: e.strCountry || "",
      group: "",
      home: e.strHomeTeam,
      away: e.strAwayTeam,
      homeRaw: e.strHomeTeam,
      awayRaw: e.strAwayTeam,
      finished,
      score: finished || (score && score.partial) ? score : null,
      city: e.strCity || e.strVenue || "",
      source: "TheSportsDB (ingyenes kulcs, napi szelet)",
      sourceUrl: "https://www.thesportsdb.com/api/v1/json/123/lookupevent.php?id=" + e.idEvent
    };
  }

  function ymd(d) {
    return d.toISOString().slice(0, 10);
  }

  async function loadLive() {
    const cacheKey = "vilagfoci-live-v1";
    try {
      const cached = JSON.parse(sessionStorage.getItem(cacheKey) || "null");
      if (cached && Date.now() - cached.saved < 5 * 60 * 1000 && Array.isArray(cached.matches)) {
        return cached;
      }
    } catch (e) { /* ignore */ }

    const jobs = LEAGUES.map(async (meta) => {
      const url = "https://api.openligadb.de/getmatchdata/" + meta.shortcut + "/" + meta.season;
      const res = await fetch(url);
      if (!res.ok) throw new Error(meta.shortcut + " " + res.status);
      const data = await res.json();
      return data.map((m) => fromOpenLiga(m, meta)).filter(Boolean);
    });

    const now = new Date();
    const days = [-1, 0, 1].map((n) => {
      const d = new Date(now.getTime() + n * 86400000);
      return fetch("https://www.thesportsdb.com/api/v1/json/123/eventsday.php?d=" + ymd(d) + "&s=Soccer")
        .then((r) => (r.ok ? r.json() : { events: [] }))
        .then((j) => (j.events || []).map(fromSportsDb).filter(Boolean))
        .catch(() => []);
    });

    const settled = await Promise.allSettled(jobs);
    const open = [];
    const failed = [];
    settled.forEach((s, i) => {
      if (s.status === "fulfilled") open.push(...s.value);
      else failed.push(LEAGUES[i].league);
    });
    const extra = (await Promise.all(days)).flat();
    const seen = new Set();
    const matches = [];
    for (const m of open.concat(extra)) {
      const key = (m.homeRaw + "|" + m.awayRaw + "|" + (m.at ? m.at.toISOString().slice(0, 10) : "")).toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      matches.push(m);
    }
    const pack = { matches, failed, live: open.length > 0, fetchedAt: new Date().toISOString(), partialSportsDb: true };
    try { sessionStorage.setItem(cacheKey, JSON.stringify({ ...pack, matches: pack.matches.map(serialize), saved: Date.now() })); } catch (e) { /* ignore */ }
    return pack;
  }

  function serialize(m) {
    return { ...m, at: m.at ? m.at.toISOString() : null };
  }
  function revive(m) {
    return { ...m, at: m.at ? new Date(m.at) : null };
  }

  async function loadSnapshot() {
    const res = await fetch("data/snapshot.json");
    if (!res.ok) throw new Error("snapshot");
    const data = await res.json();
    return {
      matches: (data.matches || []).map((m) => revive({
        id: "snap-" + m.id,
        at: m.utc,
        league: m.league,
        country: m.country,
        group: m.group || "",
        home: teamName(m.home),
        away: teamName(m.away),
        homeRaw: m.home,
        awayRaw: m.away,
        finished: m.finished,
        score: m.score,
        city: m.city || "",
        source: "OpenLigaDB, buildkor mentett válasz",
        sourceUrl: m.sourceUrl
      })),
      failed: [],
      live: false,
      fetchedAt: data.fetchedAt,
      snapshot: true
    };
  }

  function statusLine(pack) {
    const el = document.querySelector("[data-feed-status]");
    if (!el || !pack) return;
    const t = pack.fetchedAt ? bud.format(new Date(pack.fetchedAt)) + " (Budapest)" : "";
    if (pack.live) {
      el.innerHTML = "<strong>Élő adat.</strong> OpenLigaDB kulcs nélkül, a böngészőből. Lekérve: " + t +
        ". A TheSportsDB ingyenes kulcsa naponta csak néhány meccset ad, az nem teljes világlista. " +
        "A football-data.org tokent kér, onnan nincs sor, és kitalált állást nem írunk." +
        (pack.failed.length ? " Most nem jött meg: " + pack.failed.join(", ") + "." : "");
    } else {
      el.innerHTML = "<strong>Most a buildkor mentett OpenLigaDB-válasz látszik, nem élő lekérés.</strong> Időpont: " + t +
        ". Frissítsd az oldalt. Ha a feed nem elérhető, üres lista jobb, mint egy kitalált gól. A football-data.org-hoz kulcs kellene.";
    }
  }

  function inLast24h(m, now) {
    if (!m.at) return false;
    return m.at.getTime() <= now.getTime() && m.at.getTime() >= now.getTime() - 24 * 3600 * 1000;
  }

  function card(m) {
    const art = document.createElement("article");
    art.className = "match-card";
    const score = scoreText(m);
    art.innerHTML =
      "<header><span>" + escapeHtml(m.league) + (m.group ? " · " + escapeHtml(m.group) : "") + " · " + escapeHtml(m.country) + "</span><span>" + escapeHtml(when(m.at)) + "</span></header>" +
      "<div class='teams'><span class='home-side'>" + escapeHtml(m.home) + "</span><strong>" + escapeHtml(score) + "</strong><span class='away-side'>" + escapeHtml(m.away) + "</span></div>" +
      "<div class='meta'>" + escapeHtml(m.city ? m.city + " · " : "") + escapeHtml(m.source) + " · <a href='" + escapeAttr(m.sourceUrl) + "'>forrás</a></div>";
    return art;
  }

  function escapeHtml(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  }
  function escapeAttr(s) { return escapeHtml(s); }

  function searchable(m) {
    return [m.home, m.away, m.homeRaw, m.awayRaw, m.league, m.country, m.group, m.city].join(" ").toLowerCase();
  }

  function renderMatches(list, target, emptyText) {
    const box = document.querySelector(target);
    if (!box) return;
    box.innerHTML = "";
    if (!list.length) {
      const p = document.createElement("p");
      p.className = "empty";
      p.textContent = emptyText;
      box.appendChild(p);
      return;
    }
    list.forEach((m) => box.appendChild(card(m)));
  }

  async function bootMatches() {
    if (!document.querySelector("[data-needs-matches]")) return null;
    let pack;
    try {
      pack = await loadLive();
      if (!pack.matches.length) throw new Error("empty");
    } catch (e) {
      try { pack = await loadSnapshot(); }
      catch (e2) { pack = { matches: [], live: false, fetchedAt: null, failed: ["minden feed"] }; }
    }
    if (pack.snapshot !== true && pack.matches && pack.matches[0] && typeof pack.matches[0].at === "string") {
      pack.matches = pack.matches.map(revive);
    }
    statusLine(pack);
    const now = new Date();
    const recent = pack.matches.filter((m) => inLast24h(m, now)).sort((a, b) => b.at - a.at);
    const upcoming = pack.matches.filter((m) => m.at && m.at > now && !m.finished).sort((a, b) => a.at - b.at);
    const soon = upcoming.filter((m) => m.at.getTime() < now.getTime() + 21 * 86400000);

    const strip = document.querySelector("[data-score-strip]");
    if (strip) {
      strip.innerHTML = "";
      const show = recent.slice(0, 8);
      if (!show.length) {
        strip.innerHTML = "<p class='empty'>Az elmúlt 24 órában ezek a feedek nem adtak meccset. Üres sáv, nem kitalált eredmény.</p>";
      } else {
        show.forEach((m) => {
          const div = document.createElement("div");
          div.className = "score-card";
          div.innerHTML = "<div class='league'>" + escapeHtml(m.league) + "</div><div class='score-line'><span>" + escapeHtml(m.home) + "</span><span class='score-num'>" + escapeHtml(scoreText(m)) + "</span></div><div class='score-line'><span>" + escapeHtml(m.away) + "</span><span class='meta'>" + escapeHtml(when(m.at)) + "</span></div>";
          strip.appendChild(div);
        });
      }
    }

    const hero = document.querySelector("[data-next-hero]");
    if (hero) {
      const n = soon[0];
      if (!n) {
        hero.innerHTML = "<p class='empty'>A feedekben nincs következő meccs a látóhatáron.</p>";
      } else {
        hero.innerHTML = "<div class='when'>Következő a feedből</div><h2>" + escapeHtml(n.home) + " – " + escapeHtml(n.away) + "</h2><p>" + escapeHtml(n.league) + (n.city ? " · " + escapeHtml(n.city) : "") + "</p><p><strong>" + escapeHtml(when(n.at)) + "</strong></p><p class='meta'>Állás nincs, amíg a feed nem ad eredményt. <a href='" + escapeAttr(n.sourceUrl) + "'>forrás</a></p>";
      }
    }

    const resultsBox = document.querySelector("[data-results]");
    if (resultsBox) {
      const input = document.querySelector("[data-search]");
      const apply = () => {
        const q = (input && input.value || "").trim().toLowerCase();
        const list = recent.filter((m) => !q || searchable(m).includes(q));
        renderMatches(list, "[data-results]", q ? "Nincs találat erre a keresésre az elmúlt 24 óra meccsei között." : "Az elmúlt 24 órában az OpenLigaDB és a TheSportsDB szelete nem adott meccset. Nem írunk be helyette eredményt.");
      };
      if (input) input.addEventListener("input", apply);
      apply();
    }

    const nextBox = document.querySelector("[data-upcoming]");
    if (nextBox) {
      const input = document.querySelector("[data-search]");
      const apply = () => {
        const q = (input && input.value || "").trim().toLowerCase();
        const list = soon.filter((m) => !q || searchable(m).includes(q));
        renderMatches(list, "[data-upcoming]", q ? "Nincs ilyen következő meccs a feedekben." : "A következő 21 napban ezek a feedek nem adtak kiírt meccset.");
      };
      if (input) input.addEventListener("input", apply);
      apply();
    }
    return pack;
  }

  async function bootHeadlines() {
    const box = document.querySelector("[data-headlines]");
    if (!box) return;
    try {
      const res = await fetch("data/headlines.json");
      const data = await res.json();
      const t = data.fetchedAt ? bud.format(new Date(data.fetchedAt)) + " (Budapest)" : "";
      box.innerHTML = "<p class='meta'>BBC Sport foci RSS, csak cím és link. A cikk szövegét nem vesszük át. Mentve: " + escapeHtml(t) + ".</p>";
      (data.items || []).slice(0, 8).forEach((item) => {
        const div = document.createElement("div");
        div.className = "wire";
        div.innerHTML = "<a href='" + escapeAttr(item.link) + "'>" + escapeHtml(item.title) + "</a><div class='meta'>" + escapeHtml(item.source) + " · " + escapeHtml(item.published || "") + "</div>";
        box.appendChild(div);
      });
    } catch (e) {
      box.innerHTML = "<p class='empty'>A címlapi hírlista most nem tölthető. Nem pótoljuk kitalált címekkel.</p>";
    }
  }

  async function bootArticles() {
    if (!document.querySelector("[data-article-list]") && !document.querySelector("[data-article]")) return;
    const res = await fetch("data/articles.json");
    const data = await res.json();
    const items = data.items || [];
    const list = document.querySelector("[data-article-list]");
    if (list) {
      list.innerHTML = "";
      items.forEach((a) => {
        const cardEl = document.createElement("article");
        cardEl.className = "article-card";
        cardEl.innerHTML =
          "<img src='" + escapeAttr(a.image) + "' alt=''><div class='pad'><span class='tag'>" + escapeHtml(a.kicker) + "</span><h3><a href='cikk.html?id=" + encodeURIComponent(a.id) + "'>" + escapeHtml(a.title) + "</a></h3><p class='meta'>" + escapeHtml(a.deck) + "</p></div>";
        list.appendChild(cardEl);
      });
    }
    const host = document.querySelector("[data-article]");
    if (host) {
      const id = new URLSearchParams(location.search).get("id");
      const a = items.find((x) => x.id === id);
      if (!a) {
        host.innerHTML = "<p class='empty'>Nincs ilyen váz. A cikkek oldalon csak forrásolt szövegek vannak.</p>";
        return;
      }
      document.title = a.title + " – " + NAME;
      const src = (a.sources || []).map((s) => "<li><a href='" + escapeAttr(s.url) + "'>" + escapeHtml(s.label) + "</a></li>").join("");
      host.innerHTML =
        "<p class='kicker'>" + escapeHtml(a.kicker) + " · " + escapeHtml(a.published) + "</p>" +
        "<h1>" + escapeHtml(a.title) + "</h1>" +
        "<p class='lead'>" + escapeHtml(a.deck) + "</p>" +
        "<figure class='hero-figure'><img src='" + escapeAttr(a.image) + "' alt=''><figcaption class='credit'>Fotó: <a href='" + escapeAttr(a.imageSource) + "'>" + escapeHtml(a.imageCredit) + "</a></figcaption></figure>" +
        a.paragraphs.map((p) => "<p>" + escapeHtml(p) + "</p>").join("") +
        "<h2>Források</h2><ul class='sources'>" + src + "</ul>";
    }
  }

  function bootIntake() {
    if (page !== "intake") return;
    const KEY = "vilagfoci-atvetelek";
    const form = document.querySelector("[data-intake-form]");
    const list = document.querySelector("[data-intake-list]");
    const read = () => {
      try { return JSON.parse(localStorage.getItem(KEY) || "[]"); }
      catch (e) { return []; }
    };
    const write = (rows) => localStorage.setItem(KEY, JSON.stringify(rows));
    const paint = () => {
      const rows = read();
      list.innerHTML = "";
      if (!rows.length) {
        list.innerHTML = "<p class='empty'>Még nincs saját átvétel ezen a böngészőn. A lista csak a te gépeden tárolódik.</p>";
        return;
      }
      rows.forEach((row) => {
        const div = document.createElement("article");
        div.className = "intake-item";
        div.innerHTML = "<span class='tag quiet'>" + escapeHtml(row.source || "forrás nélkül") + "</span><h3>" + escapeHtml(row.title) + "</h3><p><a href='" + escapeAttr(row.link) + "'>Eredeti link</a></p><p>" + escapeHtml(row.summary || "Saját magyar összefoglaló még nincs.") + "</p><p class='meta'>" + escapeHtml(row.createdAt) + "</p>";
        list.appendChild(div);
      });
    };
    form.addEventListener("submit", (ev) => {
      ev.preventDefault();
      const fd = new FormData(form);
      const title = String(fd.get("title") || "").trim();
      const link = String(fd.get("link") || "").trim();
      const source = String(fd.get("source") || "").trim();
      const summary = String(fd.get("summary") || "").trim();
      if (!title || !link) return;
      const rows = read();
      rows.unshift({ title, link, source, summary, createdAt: bud.format(new Date()) + " (Budapest)" });
      write(rows.slice(0, 30));
      form.reset();
      paint();
    });
    const probe = document.querySelector("[data-probe]");
    probe.addEventListener("click", async () => {
      const url = document.querySelector("[name=rss]").value.trim();
      const msg = document.querySelector("[data-probe-msg]");
      if (!url) { msg.textContent = "Előbb írj be egy RSS-címet vagy cikk-linket."; return; }
      msg.textContent = "Csak a címet és a linket próbáljuk kiolvasni, a szövegtörzset nem.";
      try {
        const res = await fetch(url);
        const text = await res.text();
        const doc = new DOMParser().parseFromString(text, "text/xml");
        const item = doc.querySelector("item");
        const title = item ? (item.querySelector("title") && item.querySelector("title").textContent) : "";
        const link = item ? (item.querySelector("link") && item.querySelector("link").textContent) : url;
        const source = (doc.querySelector("channel > title") && doc.querySelector("channel > title").textContent) || "";
        if (!title) {
          msg.textContent = "Nem RSS-cím jött vissza, vagy a feed nem engedte a böngészőt. Írd be kézzel a címet és a linket. A teljes idegen szöveget nem vesszük át.";
          return;
        }
        form.elements.title.value = title.trim();
        form.elements.link.value = (link || url).trim();
        if (source) form.elements.source.value = source.trim();
        msg.textContent = "Cím és link beírva. A leírást és a cikk szövegét szándékosan nem másoltuk át. A rövid magyar összefoglalót te írod.";
      } catch (e) {
        msg.textContent = "A böngésző nem éri el ezt a címet (gyakran CORS miatt). Írd be kézzel a címet, a forrást és a linket. A teljes idegen szöveget nem vesszük át.";
      }
    });
    paint();
  }

  bootMatches();
  bootHeadlines();
  bootArticles();
  bootIntake();
})();
