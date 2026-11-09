(() => {
  const $ = (sel, el = document) => el.querySelector(sel);
  const app = $("#app");
  const errorBar = $("#errorBar");
  let token = localStorage.getItem("desk_token") || "";
  let dataPath = localStorage.getItem("desk_data_path") || "";
  const hash = location.hash || "";
  const tm = hash.match(/(?:^|#|&)t=([^&]+)/);
  const dm = hash.match(/(?:^|#|&)d=([^&]+)/);
  if (tm) {
    token = decodeURIComponent(tm[1]);
    localStorage.setItem("desk_token", token);
  }
  if (dm) {
    const cand = decodeURIComponent(dm[1]);
    if (/^[A-Za-z0-9_-]{16,128}$/.test(cand)) {
      dataPath = cand;
      localStorage.setItem("desk_data_path", dataPath);
    }
  }
  if (tm || dm) {
    history.replaceState(null, "", location.pathname + location.search);
  }
  const staticMode = !!dataPath && (!token || /github\.io$/i.test(location.hostname));
  const fileCache = {};
  const params = new URLSearchParams(location.search);
  let state = { tab: params.get("tab") || "home", screen: params.get("screen") || "home", mode: "PAPER", range: "LIVE",
    data: null, activity: [], unread: false, lastOk: Date.now(), retry: 3 };
  if (params.get("mint")) state.mint = params.get("mint");
  let searchOpen = false;

  function headers() {
    return { Authorization: "Bearer " + token, "Content-Type": "application/json" };
  }
  function staticFileUrl(name) {
    const base = location.href.split("#")[0];
    const url = new URL("d/" + encodeURIComponent(dataPath) + "/" + name, base);
    url.searchParams.set("v", String(Math.floor(Date.now() / 15000)));
    return url.toString();
  }
  async function loadStaticFile(name) {
    const hit = fileCache[name];
    if (hit && Date.now() - hit.t < 8000) return hit.d;
    const r = await fetch(staticFileUrl(name), { cache: "no-store" });
    if (!r.ok) throw new Error(r.statusText || String(r.status));
    const d = await r.json();
    fileCache[name] = { t: Date.now(), d };
    return d;
  }
  async function api(path, opts = {}) {
    if (staticMode) {
      if (opts.method && opts.method !== "GET") {
        throw new Error("Lecture seule. Ouvre le desk en direct pour modifier.");
      }
      const u = new URL(path, "https://local.invalid");
      const p = u.pathname;
      if (p === "/api/state") return loadStaticFile("state.json");
      if (p === "/api/activity") return loadStaticFile("activity.json");
      if (p === "/api/account") return loadStaticFile("account.json");
      if (p === "/api/settings") return loadStaticFile("settings.json");
      if (p === "/api/chart") {
        const all = await loadStaticFile("chart.json");
        const range = (u.searchParams.get("range") || "LIVE").toUpperCase();
        return all[range] || all.LIVE || { points: [], marks: [], start: 0 };
      }
      const dec = p.match(/^\/api\/agents\/([^/]+)\/decisions$/);
      if (dec) {
        const all = await loadStaticFile("decisions.json");
        return all[dec[1].toLowerCase()] || { rows: [] };
      }
      const coin = p.match(/^\/api\/coin\/([^/]+)$/);
      if (coin) {
        const all = await loadStaticFile("coins.json");
        const row = all[decodeURIComponent(coin[1])];
        if (!row) throw new Error("Unknown coin");
        return row;
      }
      const aud = p.match(/^\/api\/audit\/([^/]+)$/);
      if (aud) {
        const all = await loadStaticFile("audits.json");
        const row = all[decodeURIComponent(aud[1])];
        if (!row) return { mint: decodeURIComponent(aud[1]), layers: [], passed: null, coin_url: "#" };
        return row;
      }
      if (p === "/api/search") {
        const all = await loadStaticFile("search.json");
        const q = (u.searchParams.get("q") || "").trim().toLowerCase();
        const rows = (all.rows || []).filter((r) =>
          !q || (r.name || "").toLowerCase().includes(q) ||
          (r.symbol || "").toLowerCase().includes(q) ||
          (r.mint || "").toLowerCase().includes(q)
        ).slice(0, 20);
        return { rows };
      }
      if (p === "/api/hypergrok") return loadStaticFile("hypergrok.json");
      throw new Error("Not available in snapshot");
    }
    const r = await fetch(path, { ...opts, headers: { ...headers(), ...(opts.headers || {}) } });
    if (r.status === 401) throw new Error("401");
    if (!r.ok) {
      let d = {};
      try { d = await r.json(); } catch (e) {}
      throw new Error(d.detail || r.statusText);
    }
    return r.json();
  }

  function money(n) {
    if (n == null || Number.isNaN(n)) return "—";
    const sign = n < 0 ? "-" : "";
    return sign + "$" + Math.abs(n).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }
  function fmtPct(n) {
    if (n == null) return "—";
    const s = (n >= 0 ? "+" : "") + n.toFixed(2) + "%";
    return s;
  }
  function signedMoney(n) {
    if (n == null || Number.isNaN(n)) return "—";
    return (n > 0 ? "+" : "") + money(n);
  }
  function fmtPrice(n) {
    if (n == null || Number.isNaN(n)) return "—";
    const a = Math.abs(n);
    const sign = n < 0 ? "-" : "";
    let body;
    if (a >= 1) body = a.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 4 });
    else if (a >= 0.0001) body = a.toPrecision(4);
    else body = a.toExponential(2);
    return sign + "$" + body;
  }
  function initials(name) { return (name || "?").slice(0, 2).toUpperCase(); }
  function logoHtml(url, name) {
    if (url) return `<img class="logo" src="${url}" alt="">`;
    return `<div class="logo ph">${initials(name)}</div>`;
  }
  function reduceMotion() {
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  }

  function showError(msg) {
    errorBar.textContent = msg;
    errorBar.classList.toggle("hidden", !msg);
  }

  /* ---------- screens ---------- */
  function render() {
    if (state.screen === "coin") return renderCoin();
    if (state.screen === "auditor") return renderAuditor();
    if (state.screen === "search") return renderSearch();
    if (state.tab === "agents") return renderAgents();
    if (state.tab === "activity") return renderActivity();
    if (state.tab === "account") return renderAccount();
    return renderHome();
  }

  function navbar(title) {
    return `<div class="navbar">
      <button class="avatar" id="goAccount">${initials("B")}</button>
      <div class="nav-title">${title} <span>›</span></div>
      <button class="icon-btn" id="goSearch" aria-label="Search">
        <svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="6.5"/><path d="M16 16l5 5"/></svg>
      </button>
      <button class="icon-btn" id="bell" aria-label="Alerts">
        <svg viewBox="0 0 24 24"><path d="M6 16V10a6 6 0 1 1 12 0v6l1.5 2H4.5z"/><path d="M10 19a2 2 0 0 0 4 0"/></svg>
        ${state.unread ? '<i class="dot"></i>' : ""}
      </button>
    </div>`;
  }

  function paperBadge() {
    return state.mode === "PAPER" ? '<span class="pill paper">PAPER</span>' : "";
  }

  function renderHome() {
    const d = state.data;
    if (!d) {
      app.innerHTML = navbar("Grok Bot") + `<div class="pad">
        <div class="skel" style="height:56px;width:70%;margin:16px 0"></div>
        <div class="skel" style="height:180px;margin:8px 0"></div>
      </div>`;
      bindNav();
      return;
    }
    const up = d.today_pct >= 0;
    const cards = (d.agents || []).map(agentCard).join("");
    app.innerHTML = navbar("Grok Bot") + `
      <div class="balance-row">
        <div class="display balance num" id="bal">${money(d.balance)}</div>
        ${paperBadge()}
      </div>
      <div class="sub ${up ? "up" : "down"}">${fmtPct(d.today_pct)} aujourd'hui
        <span class="pill mult">${(d.multiplier || 0).toFixed(2)}×</span>
      </div>
      <div class="sub">copie ${signedMoney(d.copy_pnl||0)} · scanner ${signedMoney(d.scanner_pnl||0)}${(d.copy_open?` · ${d.copy_open} copie ouverte${d.copy_open>1?"s":""}`:"")}</div>
      <div class="chart-wrap"><canvas id="homeChart" style="width:100%;height:180px"></canvas></div>
      <div class="ranges" id="ranges">
        ${["LIVE","1H","4H","1D","1W","ALL"].map(r =>
          `<button data-r="${r}" class="${state.range===r?"on":""}">${r}</button>`).join("")}
      </div>
      <div class="section"><h2>Agents · ${(d.agents || []).length} en marche</h2></div>
      <div class="carousel" id="carousel">${cards}</div>
      <div class="section"><h2>Activité</h2><button class="link" id="seeAll">Tout voir</button></div>
      <div class="list" id="homeAct">${activityRows(state.activity.slice(0,5))}</div>
      ${walletBlock(d)}
      ${hypergrokBlock(state.hypergrok)}
    `;
    bindNav();
    sizeCards();
    $("#seeAll").onclick = () => { state.tab = "activity"; highlightTab(); render(); };
    $("#ranges").onclick = (e) => {
      const b = e.target.closest("button");
      if (!b) return;
      state.range = b.dataset.r;
      loadChart();
      render();
    };
    drawHomeChart();
    bindRows();
  }

  function agentCard(a) {
    const r = Math.round(42 * ((window.innerWidth - 32) / 504));
    let body = "";
    if (a.name === "Scanner") {
      const rows = (a.feed || []).slice(-6).map(f => {
        if (f.verdict === "kill")
          return `<div class="feed-row"><span class="killed">${esc(f.name)}</span><span class="why">${esc(f.reason||"")}</span></div>`;
        return `<div class="feed-row"><span>${esc(f.name)} · liq ${f.liq!=null?("$"+Math.round(f.liq)):"—"} · → auditor</span></div>`;
      }).join("") || `<div class="empty" style="padding:16px">En écoute des nouvelles pools</div>`;
      body = `<div class="meta">${a.subtitle || ""}</div><div class="feed">${rows}</div>`;
    } else if (a.name === "Auditor") {
      const layers = (a.layers || []).map(l =>
        `<div class="layer-strip ${l.pass?"ok":"bad"}">${l.n}. ${esc(l.name)} · ${esc(l.value||"")}</div>`
      ).join("");
      body = `<div class="meta">${a.subtitle || ""} · ${a.rejected||0} rejected</div>
        <div class="layers-grid">${layers}</div>
        <div class="meta">${esc(a.detail||"")}</div>`;
    } else if (a.name === "Analyst") {
      body = `<div class="meta">${a.subtitle}</div>
        <canvas class="scoreRing" width="120" height="120" style="width:120px;height:120px;align-self:center"></canvas>
        <div class="meta">${esc(a.detail||"")}</div>`;
    } else if (a.name === "Executor") {
      body = `<div class="meta">${a.subtitle}</div>
        <div>${esc(a.size_line||"")}</div>
        <div class="meta">${esc(a.detail||"")}</div>`;
    } else {
      const p = a.pills || {};
      body = `<div class="meta">${a.subtitle}</div>
        <div>${esc(a.detail||"Guarding")}</div>
        <div class="pills-row">
          <span class="th-pill stop mono">${esc(p.stop||"")}</span>
          <span class="th-pill trail mono">${esc(p.trail||"")}</span>
        </div>`;
    }
    return `<article class="agent-card" data-agent="${a.name}" style="border-radius:${r}px;color:${a.color||"#fff"}">
      <h3 style="color:#fff">${a.name}</h3>${body}</article>`;
  }

  function sizeCards() {
    document.querySelectorAll(".scoreRing").forEach((c, i) => {
      const a = (state.data && state.data.agents || []).find(x => x.name === "Analyst");
      if (a) DeskCharts.drawScoreRing(c, a.score, a.min_score || 70);
    });
  }

  function walletBlock(d) {
    const cash = d.cash != null ? d.cash : d.balance;
    const openValue = d.open_value != null ? d.open_value : 0;
    const total = d.balance != null ? d.balance : (Number(cash) + Number(openValue));
    return `
      <div class="trades-block">
        <div class="section"><h2>Ton argent</h2></div>
        <div class="wallet-card">
          <div class="wallet-total">
            <div class="k">Total PAPER</div>
            <div class="v num">${money(total)}</div>
          </div>
          <div class="wallet-split">
            <div><span class="k">Cash</span><span class="v num">${money(cash)}</span></div>
            <div><span class="k">En position</span><span class="v num">${money(openValue)}</span></div>
          </div>
        </div>
        <div class="section"><h2>Mes memecoins</h2></div>
        <div class="list" id="homeTrades">${positionRows(d.positions || [])}</div>
      </div>`;
  }

  function positionRows(rows) {
    if (!rows || !rows.length) {
      return `<div class="empty">Aucun trade pour l'instant</div>`;
    }
    const statusLabel = { open: "Ouvert", exiting: "En vente", closed: "Fermé" };
    return rows.map((p) => {
      const isOpen = p.status !== "closed";
      const pnl = Number(p.pnl_usd || 0);
      const cls = pnl > 0 ? "up" : pnl < 0 ? "down" : "";
      const src = p.source_kind === "copy"
        ? ("copie " + (p.source || p.copy_trader || ""))
        : "scanner";
      const rightMain = isOpen ? money(p.current_value) : signedMoney(pnl);
      const rightSub = isOpen ? (signedMoney(pnl) + " · " + fmtPct(p.pnl_pct)) : ("P&amp;L " + signedMoney(pnl));
      return `<div class="row" data-open="coin" data-mint="${esc(p.mint || "")}">
        ${logoHtml(p.logo_url, p.name || p.symbol)}
        <div class="mid">
          <div class="t">${esc(p.symbol || p.name || "memecoin")}
            <span class="status-pill ${esc(p.status || "open")}">${statusLabel[p.status] || esc(p.status)}</span>
          </div>
          <div class="s">Misé ${money(p.size_usd)} · entrée ${fmtPrice(p.entry_price)} · ${esc(src)}</div>
        </div>
        <div class="right ${cls}">${rightMain}<div class="s">${rightSub}</div></div>
      </div>`;
    }).join("");
  }


  function hypergrokBlock(hg) {
    if (!hg || !hg.challenge) {
      return "";
    }
    const c = hg.challenge;
    const st = String(c.day_status || c.challenge_status || "").toUpperCase();
    const statusLabel = {
      OPEN: "Ouvert", RUNNING: "En cours", STOPPED: "Journée stoppée",
      ENDED: "Terminé", CLOSED: "Fermé"
    }[st] || esc(c.day_status || "—");
    const eq = money(c.equity);
    const dayPnl = Number(c.day_pnl || 0);
    const pnlCls = dayPnl > 0 ? "up" : dayPnl < 0 ? "down" : "";
    const pos = hg.open_position;
    let posHtml;
    if (!pos) {
      posHtml = `<div class="empty">Aucune position ouverte</div>`;
    } else {
      const u = Number(pos.unrealized_pnl || 0);
      const cls = u > 0 ? "up" : u < 0 ? "down" : "";
      posHtml = `<div class="row">
        <div class="logo ph">HG</div>
        <div class="mid">
          <div class="t">${esc(pos.market || "")} ${esc(pos.side || "")}
            <span class="status-pill open">Ouvert</span>
          </div>
          <div class="s">entrée ${fmtPrice(pos.entry)} · stop ${fmtPrice(pos.stop)} · cible ${fmtPrice(pos.target)}</div>
        </div>
        <div class="right ${cls}">${signedMoney(u)}<div class="s">${esc(pos.units || "")} unités</div></div>
      </div>`;
    }
    const statusMap = {
      OPEN: "Ouvert", CLOSED: "Fermé", SKIP: "Ignoré", BLOCKED: "Bloqué",
      UNFILLABLE: "Non remplissable", UNVERIFIED: "Non vérifié",
      DAY_STOPPED: "Journée stoppée"
    };
    const rows = (hg.journal || []).slice(0, 12);
    let journalHtml;
    if (!rows.length) {
      journalHtml = `<div class="empty">Aucun cas pour l'instant</div>`;
    } else {
      journalHtml = rows.map((r) => {
        const pnl = r.net_pnl;
        const cls = pnl > 0 ? "up" : pnl < 0 ? "down" : "";
        const label = statusMap[r.status] || esc(r.status || "");
        const sub = r.status === "CLOSED"
          ? ("P&amp;L " + signedMoney(pnl))
          : esc(r.block_reason || r.notes || "");
        const right = r.status === "CLOSED" ? signedMoney(pnl) : label;
        return `<div class="row">
          <div class="mid">
            <div class="t">${esc(r.market || "—")} · ${esc(r.case_id || "")}
              <span class="status-pill ${esc((r.status || "").toLowerCase())}">${label}</span>
            </div>
            <div class="s">${sub}</div>
          </div>
          <div class="right ${cls}">${right}</div>
        </div>`;
      }).join("");
    }
    const rule = (hg.strategy && hg.strategy.name) || "TF-FUND-1";
    return `
      <div class="trades-block hg-block">
        <div class="section"><h2>HyperGrok</h2><span class="pill paper">PAPER</span></div>
        <div class="wallet-card">
          <div class="wallet-total">
            <div class="k">Solde PAPER</div>
            <div class="v num">${eq}</div>
          </div>
          <div class="wallet-split">
            <div><span class="k">Jour</span><span class="v num">${esc(c.day || 1)}/${esc(c.days || 6)}</span></div>
            <div><span class="k">Statut du jour</span><span class="v">${statusLabel}</span></div>
            <div><span class="k">P&amp;L du jour</span><span class="v num ${pnlCls}">${signedMoney(c.day_pnl)}</span></div>
            <div><span class="k">Entrées aujourd'hui</span><span class="v num">${esc(c.entries_today || 0)}/${esc(c.max_entries_per_day || 2)}</span></div>
          </div>
          <div class="hg-rule">Règle : ${esc(rule)} · 1 % de risque · pas de levier</div>
        </div>
        <div class="section"><h2>Position ouverte</h2></div>
        <div class="list">${posHtml}</div>
        <div class="section"><h2>Journal</h2></div>
        <div class="list" id="hgJournal">${journalHtml}</div>
      </div>`;
  }

  function activityRows(rows) {
    if (!rows || !rows.length) return `<div class="empty">Rien pour l'instant</div>`;
    return rows.map(r => {
      const up = (r.value || "").startsWith("+") || (r.kind === "bought");
      const down = r.kind === "stopped" || (r.value || "").startsWith("-");
      return `<div class="row" data-open="${r.open||"coin"}" data-mint="${r.mint||""}">
        ${logoHtml(r.logo_url, r.name || r.title)}
        <div class="mid"><div class="t">${esc(r.title)}</div><div class="s">${esc(r.subtitle)}</div></div>
        <div class="right ${down?"down":up?"up":""}">${esc(r.value||"")}</div>
      </div>`;
    }).join("");
  }

  function renderAgents() {
    const agents = (state.data && state.data.agents) || [];
    if (!state.agentDecisions) state.agentDecisions = {};
    app.innerHTML = `<div class="screen-head"><h1>Agents</h1></div>` +
      agents.map(a => {
        const on = a.status !== "paused";
        const decs = (state.agentDecisions[a.name] || []).map(d =>
          `<div class="dec"><span>${fmtTime(d.ts)} · <a href="${d.coin_url||"#"}" target="_blank" rel="noopener">${esc(d.name||d.mint||"")}</a></span>
           <span>${esc(d.verdict)} · ${esc(d.reason||"")}</span></div>`
        ).join("") || `<div class="empty" style="padding:12px">Aucune décision pour l'instant</div>`;
        return `<section class="agent-full">
          <div class="agent-head">
            <i class="status-dot ${on?"":"off"}"></i>
            <strong>${a.name}</strong>
            <span class="meta" style="color:var(--secondary);font-size:13px">${a.subtitle||""}</span>
            <button class="switch ${on?"on":""}" data-agent="${a.name}" ${a.name==="Risk"&&!on?"":""}><i></i></button>
          </div>
          <div class="decisions">${decs}</div>
        </section>`;
      }).join("");
    document.querySelectorAll(".switch").forEach(sw => {
      sw.onclick = async () => {
        const name = sw.dataset.agent;
        const on = sw.classList.contains("on");
        try {
          await api(`/api/agents/${name}/${on ? "pause" : "resume"}`, { method: "POST" });
          await refresh();
        } catch (e) { alert(e.message); }
      };
    });
  }

  function renderActivity() {
    app.innerHTML = `<div class="screen-head"><h1>Activité</h1></div>
      <div class="list">${activityRows(state.activity)}</div>`;
    bindRows();
  }

  async function renderAccount() {
    let acc = state.account, settings = state.settings;
    try {
      if (!acc) acc = state.account = await api("/api/account");
      if (!settings) settings = state.settings = await api("/api/settings");
    } catch (e) { /* keep last */ }
    const s = (settings && settings.settings) || {};
    const groups = Object.keys(s);
    app.innerHTML = `<div class="screen-head"><h1>Compte</h1></div>
      <div class="mode-row">
        <button data-m="PAPER" class="${state.mode==="PAPER"?"on":""}">PAPER</button>
        <button data-m="LIVE" class="${state.mode==="LIVE"?"on":""}">LIVE</button>
      </div>
      <div class="group">
        <div class="setting"><label>Stack PAPER</label>
          <input type="number" id="stackField" value="${(acc&&acc.paper_start_stack)||200}"></div>
        <a class="row" id="fomoProfile" href="${(acc&&acc.profile_url)||"#"}" target="_blank" rel="noopener">
          <div class="mid"><div class="t">Ton profil FOMO</div><div class="s">${esc((acc&&acc.fomo_handle)||"")}</div></div>
        </a>
        <button class="row" id="invite"><div class="mid"><div class="t">Inviter un ami</div>
          <div class="s">Partage ton lien FOMO</div></div></button>
      </div>
      ${groups.map(g => `<div class="section"><h2>${g}</h2></div><div class="group">
        ${Object.entries(s[g]).map(([k,v]) => settingRow(g,k,v, settings.meta?.[g]?.[k])).join("")}
      </div>`).join("")}
      <div class="group">
        <div class="row"><div class="mid"><div class="t">Telegram</div>
          <div class="s">${acc&&acc.telegram ? "connecté" : "pas connecté"}</div></div></div>
        <button class="row" id="testPush"><div class="mid"><div class="t">Envoyer une notif test</div></div></button>
      </div>`;
    $(".mode-row button").forEach(b => b.onclick = () => switchMode(b.dataset.m));
    $("#invite").onclick = invite;
    $("#testPush").onclick = async () => {
      try { await api("/api/test-push", { method: "POST" }); alert("Envoyé"); }
      catch (e) { alert(e.message); }
    };
    $("#stackField").onchange = async (e) => {
      await api("/api/settings", { method: "POST", body: JSON.stringify({ key: "desk.paper_start_stack", value: e.target.value })});
    };
    document.querySelectorAll("[data-set]").forEach(el => {
      el.onchange = async () => {
        try {
          const res = await api("/api/settings", { method: "POST", body: JSON.stringify({ key: el.dataset.set, value: el.value })});
          if (res.warning) alert(res.warning);
          state.settings = null;
        } catch (err) { alert(err.message); }
      };
    });
  }

  function settingRow(g, k, v, meta) {
    const key = g + "." + k;
    if (typeof v === "boolean") {
      return `<div class="setting"><label>${k}<input type="checkbox" data-set="${key}" ${v?"checked":""} onchange="this.value=this.checked"></label></div>`;
    }
    if (meta && meta.kind === "choice" && meta.choices) {
      return `<div class="setting"><label>${k}</label>
        <select data-set="${key}">${meta.choices.map(c => `<option ${c===v?"selected":""}>${c}</option>`).join("")}</select></div>`;
    }
    if (typeof v === "number") {
      const lo = meta && meta.min != null ? meta.min : "";
      const hi = meta && meta.max != null ? meta.max : "";
      return `<div class="setting"><label>${k}<span class="mono">${v}</span></label>
        <input type="range" min="${lo}" max="${hi}" step="any" value="${v}" data-set="${key}">
        <input type="number" data-set="${key}" value="${v}" step="any"></div>`;
    }
    return `<div class="setting"><label>${k}</label><input type="text" data-set="${key}" value="${esc(String(v))}"></div>`;
  }

  async function switchMode(m) {
    if (m === "LIVE") {
      const typed = prompt("Tape LIVE pour confirmer");
      if (typed !== "LIVE") return;
      try {
        await api("/api/mode", { method: "POST", body: JSON.stringify({ mode: "LIVE", confirm: "LIVE" }) });
      } catch (e) { alert(e.message); return; }
    } else {
      await api("/api/mode", { method: "POST", body: JSON.stringify({ mode: "PAPER" }) });
    }
    state.account = null;
    await refresh();
  }

  async function invite() {
    const url = (state.account && state.account.signup_url) || "https://fomo.family/r/savipww";
    if (navigator.share) {
      try { await navigator.share({ title: "FOMO", url }); return; } catch (e) {}
    }
    try { await navigator.clipboard.writeText(url); alert("Lien copié"); }
    catch (e) { alert(url); }
  }

  async function renderCoin() {
    const mint = state.mint;
    let c;
    try { c = await api("/api/coin/" + mint); } catch (e) { app.innerHTML = `<div class="empty">${e.message}</div>`; return; }
    const pos = c.position;
    app.innerHTML = `<div class="screen-head">
        <button class="back" id="back"><svg viewBox="0 0 24 24"><path d="M15 5l-7 7 7 7"/></svg></button>
        <h1>${esc(c.name)} ${state.mode==="PAPER"?'<span class="pill paper">PAPER</span>':""}</h1>
        ${c.shield ? `<span class="chip">${c.shield}</span>` : ""}
      </div>
      <div class="pad" style="color:var(--secondary);font-size:13px">${esc(c.symbol||"")} · Solana · ${c.age_h!=null?c.age_h+"h":""}</div>
      <div class="display big-price num">${c.price!=null?c.price: "—"}</div>
      <div class="sub ${c.since_entry>=0?"up":"down"}">${c.since_entry!=null?("▲ "+fmtPct(c.since_entry)+" depuis l\'entrée"):""}</div>
      <div class="chart-wrap" style="height:220px"><canvas id="coinChart" style="width:100%;height:220px"></canvas></div>
      <div class="stats">
        <div class="stat"><div class="k">Market cap</div><div class="v">${nfmt(c.stats.market_cap)}</div></div>
        <div class="stat"><div class="k">Liquidité</div><div class="v">${nfmt(c.stats.liquidity)}</div></div>
        <div class="stat"><div class="k">Volume 24h</div><div class="v">${nfmt(c.stats.volume_h24)}</div></div>
        <div class="stat"><div class="k">Holders</div><div class="v">${c.stats.holders==null?"n/a":c.stats.holders}</div></div>
      </div>
      ${pos ? `<div class="pos-card">
        <div>Ta position · ${money(pos.size_usd)} misés · Executor</div>
        <div class="s" style="color:var(--secondary);margin-top:8px">
          Stop ${pos.stop_price} · trail ${c.trail_line || "—"} ·
          ${c.timeout_left_s!=null?Math.round(c.timeout_left_s/60)+"m left":""}
        </div>
      </div>` : ""}
      <a class="cta" href="${c.coin_url}" target="_blank" rel="noopener">${pos ? "Vendre sur FOMO" : "Acheter sur FOMO"}</a>`;
    $("#back").onclick = () => { state.screen = "home"; render(); };
    DeskCharts.drawCandles($("#coinChart"), c.candles, c.exit_line);
  }

  async function renderAuditor() {
    const mint = state.mint;
    let a;
    try { a = await api("/api/audit/" + mint); } catch (e) { app.innerHTML = `<div class="empty">${e.message}</div>`; return; }
    if (!a.layers.length) {
      app.innerHTML = `<div class="screen-head"><button class="back" id="back"><svg viewBox="0 0 24 24"><path d="M15 5l-7 7 7 7"/></svg></button><h1>Auditor</h1></div>
        <div class="empty">Aucun coin audité pour l'instant</div>`;
      $("#back").onclick = () => { state.screen = "home"; render(); };
      return;
    }
    const layers = a.layers.map(l =>
      `<div class="disc ${l.pass?"ok":"bad"}"><span class="n">${l.n}</span>
        <div class="mid"><div class="t">${esc(l.name)}</div><div class="s">${esc(l.value)}</div></div>
        <span class="mark">${l.pass ? "✓" : "✗"}</span></div>`
    ).join("");
    const foot = a.passed
      ? `Validé · 8/8 parties<br>Envoyé à Analyst`
      : `Rejeté · ${esc(a.reason||"")}<br>Grok Bot n'achètera pas ${esc(a.name)}`;
    app.innerHTML = `<div class="screen-head">
        <button class="back" id="back"><svg viewBox="0 0 24 24"><path d="M15 5l-7 7 7 7"/></svg></button>
        <h1>${esc(a.name)}</h1></div>
      <div class="discs">${layers}</div>
      <div class="pad" style="padding:16px">${foot}</div>
      <a class="cta" href="${a.coin_url}" target="_blank" rel="noopener">Ouvrir sur FOMO</a>`;
    $("#back").onclick = () => { state.screen = "home"; render(); };
  }

  function renderSearch() {
    app.innerHTML = `<div class="screen-head"><button class="back" id="back"><svg viewBox="0 0 24 24"><path d="M15 5l-7 7 7 7"/></svg></button><h1>Search</h1></div>
      <div class="search-box"><input id="q" placeholder="Name, symbol or mint"></div>
      <div class="list" id="sres"></div>`;
    $("#back").onclick = () => { state.screen = "home"; render(); };
    const input = $("#q");
    input.focus();
    input.oninput = debounce(async () => {
      const q = input.value.trim();
      if (!q) { $("#sres").innerHTML = ""; return; }
      const res = await api("/api/search?q=" + encodeURIComponent(q));
      $("#sres").innerHTML = (res.rows || []).map(r =>
        `<div class="row" data-open="coin" data-mint="${r.mint}">
          ${logoHtml(r.logo_url, r.name)}<div class="mid"><div class="t">${esc(r.name)}</div>
          <div class="s">${esc(r.symbol)} · ${r.mint.slice(0,6)}…</div></div></div>`
      ).join("") || `<div class="empty">No match</div>`;
      bindRows();
    }, 200);
  }

  function bindNav() {
    const acc = $("#goAccount"); if (acc) acc.onclick = () => { state.tab = "account"; highlightTab(); render(); };
    const se = $("#goSearch"); if (se) se.onclick = () => { state.screen = "search"; render(); };
  }
  function bindRows() {
    document.querySelectorAll(".row[data-mint]").forEach(el => {
      el.onclick = () => {
        state.mint = el.dataset.mint;
        state.screen = el.dataset.open === "auditor" ? "auditor" : "coin";
        render();
      };
    });
  }
  function highlightTab() {
    document.querySelectorAll(".tabbar button").forEach(b => {
      b.classList.toggle("active", b.dataset.tab === state.tab);
    });
  }
  document.querySelectorAll(".tabbar button").forEach(b => {
    b.onclick = () => {
      state.tab = b.dataset.tab;
      state.screen = "home";
      highlightTab();
      render();
      if (state.tab === "agents") loadDecisions();
      if (state.tab === "account") { state.account = null; state.settings = null; render(); }
    };
  });

  let chartCache = { points: [], marks: [], start: 0 };
  async function loadChart() {
    try {
      const c = await api("/api/chart?range=" + state.range);
      chartCache = c;
      drawHomeChart();
    } catch (e) {}
  }
  function drawHomeChart() {
    const canvas = $("#homeChart");
    if (!canvas) return;
    DeskCharts.drawLineChart(canvas, chartCache.points || [], chartCache.marks || [], chartCache.start);
  }

  async function loadDecisions() {
    const names = ["scanner","auditor","analyst","executor","risk","copy"];
    const out = {};
    for (const n of names) {
      try {
        const r = await api("/api/agents/" + n + "/decisions");
        out[n[0].toUpperCase() + n.slice(1)] = r.rows || [];
        if (n === "scanner") out.Scanner = r.rows;
        if (n === "auditor") out.Auditor = r.rows;
        if (n === "analyst") out.Analyst = r.rows;
        if (n === "executor") out.Executor = r.rows;
        if (n === "risk") out.Risk = r.rows;
      } catch (e) {}
    }
    state.agentDecisions = out;
    if (state.tab === "agents") render();
  }

  async function refresh() {
    if (staticMode) {
      /* ok — secret path from the Telegram fragment */
    } else if (!token) {
      showError("Lien manquant. Ouvre le lien reçu sur Telegram.");
      app.innerHTML = `<div class="empty">Ouvre le lien privé reçu sur Telegram pour te connecter.</div>`;
      return;
    }
    try {
      const [st, act] = await Promise.all([api("/api/state"), api("/api/activity")]);
      state.data = st;
      state.mode = st.mode;
      state.activity = act.rows || [];
      try { state.hypergrok = await api("/api/hypergrok"); }
      catch (e) { /* section hidden if the snapshot is not there yet */ }
      state.lastOk = Date.now();
      showError("");
      if (state.screen === "home" && (state.tab === "home" || state.tab === "agents" || state.tab === "activity"))
        render();
      else if (state.tab === "home" && state.screen === "home") render();
    } catch (e) {
      const n = 3;
      showError(`Desk hors ligne · nouvel essai dans ${n}s · dernière màj ${new Date(state.lastOk).toLocaleTimeString()}`);
    }
  }

  function startSSE() {
    if (staticMode) return;
    // fetch-based SSE so the token stays in a header, not the query string
    (async function loop() {
      while (true) {
        if (!token) { await sleep(2000); continue; }
        try {
          const res = await fetch("/api/stream", { headers: headers() });
          if (!res.ok) throw new Error("sse " + res.status);
          const reader = res.body.getReader();
          const dec = new TextDecoder();
          let buf = "";
          while (true) {
            const { value, done } = await reader.read();
            if (done) break;
            buf += dec.decode(value, { stream: true });
            const parts = buf.split("\n\n");
            buf = parts.pop();
            for (const p of parts) {
              if (p.includes("event: fill") || p.includes("event: exit") ||
                  p.includes("event: scan") || p.includes("event: verdict") ||
                  p.includes("event: audit") || p.includes("event: balance") ||
                  p.includes("event: signal") || p.includes("event: audit_layer")) {
                state.unread = true;
                refresh();
                loadChart();
              }
            }
          }
        } catch (e) {
          await sleep(3000);
        }
      }
    })();
  }

  function esc(s) {
    return String(s ?? "").replace(/[&<>"']/g, (c) => ({
      "&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"
    }[c]));
  }
  function fmtTime(ts) {
    if (!ts) return "";
    try { return new Date(ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }); }
    catch (e) { return ts; }
  }
  function nfmt(n) {
    if (n == null) return "—";
    return DeskCharts.nice(n);
  }
  function debounce(fn, ms) {
    let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); };
  }
  function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }

  if ("serviceWorker" in navigator) {
    try { navigator.serviceWorker.register(new URL("sw.js", location.href)); } catch (e) {}
  }
  highlightTab();
  render();
  refresh();
  loadChart();
  startSSE();
  setInterval(refresh, staticMode ? 20000 : 15000);
  setInterval(loadChart, staticMode ? 30000 : 20000);
})();
