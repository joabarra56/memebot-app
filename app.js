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

  const LANG_KEY = "desk_lang";
  let lang = localStorage.getItem(LANG_KEY) === "fr" ? "fr" : "en";
  document.documentElement.lang = lang;

  const I18N = {
    en: {
      tab_home: "Home",
      tab_agents: "Agents",
      tab_activity: "Activity",
      tab_account: "Account",
      language: "Language",
      hours_active: "Active {range}",
      hours_paused: "Paused until {time}",
      readonly: "Read-only. Open the live desk to make changes.",
      listening_traders: "Listening for traders",
      listening_pools: "Listening for new pools",
      no_buy_yet: "no buy yet",
      pools_scanned: "pools scanned",
      copy_exit: "exit ",
      safety_minus: "safety −",
      n_open: "{n} open",
      no_coin_open: "no coin open",
      n_running: "{n} running",
      n_trades: "{n} trade{s}",
      n_traders: "{n} trader{s}",
      last_buy: "last buy · {token}",
      see_all: "See all",
      your_money: "Your money",
      total_paper: "Total PAPER",
      cash: "Cash",
      in_position: "Open",
      my_memecoins: "My memecoins",
      no_coins_now: "No coins right now — the bot buys when a trader buys",
      history: "History",
      realized: "Realized {amount}",
      pnl_total: "Total P&L",
      copy_of: "copy {trader}",
      scanner: "scanner",
      memecoin: "memecoin",
      bought: "Bought {token}",
      sold: "Sold {token}",
      trader_sold: "{trader} sold",
      trader_sold_generic: "trader sold",
      trailing_stop: "trailing stop",
      safety_stop: "safety stop",
      nothing_yet: "Nothing yet",
      no_decisions: "No decisions yet",
      agents: "Agents",
      activity: "Activity",
      account: "Account",
      stack_paper: "PAPER stack",
      your_fomo_profile: "Your FOMO profile",
      invite_friend: "Invite a friend",
      share_fomo_link: "Share your FOMO link",
      telegram: "Telegram",
      connected: "connected",
      not_connected: "not connected",
      send_test_notif: "Send a test notification",
      sent: "Sent",
      link_copied: "Link copied",
      type_live: "Type LIVE to confirm",
      missing_link: "Missing link. Open the link you received on Telegram.",
      open_private_link: "Open the private link you received on Telegram to sign in.",
      desk_offline: "Desk offline · retrying in {n}s · last update {time}",
      since_entry: "since entry",
      liquidity: "Liquidity",
      your_paper_pos: "Your PAPER position",
      copy_dot: " · copy ",
      staked: "Size",
      entry: "Entry",
      current: "Current",
      exit_when_sells: "Exit: when {trader} sells · safety {pct}",
      the_trader: "the trader",
      m_left: "{m}m left",
      sell_on_fomo: "Sell on FOMO",
      buy_on_fomo: "Buy on FOMO",
      no_audited: "No coins audited yet",
      passed_sent: "Passed · {n}/{n} checks<br>Sent to Analyst",
      rejected_wont_buy: "Rejected · {reason}<br>Grok Bot will not buy {name}",
      open_on_fomo: "Open on FOMO",
      buy_mark: "Buy",
      sell_mark: "Sell",
      hg_open: "Open",
      hg_running: "Running",
      hg_day_stopped: "Day stopped",
      hg_ended: "Ended",
      hg_closed: "Closed",
      hg_skipped: "Skipped",
      hg_blocked: "Blocked",
      hg_unfillable: "Unfillable",
      hg_unverified: "Unverified",
      hg_no_open: "No open position",
      hg_entry: "entry",
      hg_stop: "stop",
      hg_target: "target",
      hg_units: "{n} units",
      hg_no_cases: "No cases yet",
      hg_paper_balance: "PAPER balance",
      hg_day: "Day",
      hg_day_status: "Day status",
      hg_day_pnl: "Day P&L",
      hg_entries_today: "Entries today",
      hg_rule: "Rule: {name} · 1–3% risk · 2.5% stop · 5% target · no leverage",
      hg_open_pos: "Open position",
      hg_journal: "Journal",
      hg_strategy_name: "1h trend + aligned funding",
      no_match: "No match",
    },
    fr: {
      tab_home: "Accueil",
      tab_agents: "Agents",
      tab_activity: "Activité",
      tab_account: "Compte",
      language: "Langue",
      hours_active: "Actif {range}",
      hours_paused: "En pause jusqu'à {time}",
      readonly: "Lecture seule. Ouvre le desk en direct pour modifier.",
      listening_traders: "En écoute des traders",
      listening_pools: "En écoute des nouvelles pools",
      no_buy_yet: "aucun achat encore",
      pools_scanned: "pools scannées",
      copy_exit: "sortie ",
      safety_minus: "sécurité −",
      n_open: "{n} ouvert{s}",
      no_coin_open: "aucun coin ouvert",
      n_running: "{n} actifs",
      n_trades: "{n} trade{s}",
      n_traders: "{n} trader{s}",
      last_buy: "dernier achat · {token}",
      see_all: "Tout voir",
      your_money: "Ton argent",
      total_paper: "Total PAPER",
      cash: "Cash",
      in_position: "En position",
      my_memecoins: "Mes memecoins",
      no_coins_now: "Aucun coin en ce moment — le bot achète dès qu'un trader achète",
      history: "Historique",
      realized: "Réalisé {amount}",
      pnl_total: "P&L total",
      copy_of: "copie {trader}",
      scanner: "scanner",
      memecoin: "memecoin",
      bought: "Achat {token}",
      sold: "Vente {token}",
      trader_sold: "{trader} a vendu",
      trader_sold_generic: "trader a vendu",
      trailing_stop: "trailing stop",
      safety_stop: "stop de sécurité",
      nothing_yet: "Rien pour l'instant",
      no_decisions: "Aucune décision pour l'instant",
      agents: "Agents",
      activity: "Activité",
      account: "Compte",
      stack_paper: "Stack PAPER",
      your_fomo_profile: "Ton profil FOMO",
      invite_friend: "Inviter un ami",
      share_fomo_link: "Partage ton lien FOMO",
      telegram: "Telegram",
      connected: "connecté",
      not_connected: "pas connecté",
      send_test_notif: "Envoyer une notif test",
      sent: "Envoyé",
      link_copied: "Lien copié",
      type_live: "Tape LIVE pour confirmer",
      missing_link: "Lien manquant. Ouvre le lien reçu sur Telegram.",
      open_private_link: "Ouvre le lien privé reçu sur Telegram pour te connecter.",
      desk_offline: "Desk hors ligne · nouvel essai dans {n}s · dernière màj {time}",
      since_entry: "depuis l'entrée",
      liquidity: "Liquidité",
      your_paper_pos: "Ta position PAPER",
      copy_dot: " · copie ",
      staked: "Misés",
      entry: "Entrée",
      current: "Actuel",
      exit_when_sells: "Sortie : quand {trader} vend · sécurité {pct}",
      the_trader: "le trader",
      m_left: "{m}m restantes",
      sell_on_fomo: "Vendre sur FOMO",
      buy_on_fomo: "Acheter sur FOMO",
      no_audited: "Aucun coin audité pour l'instant",
      passed_sent: "Validé · {n}/{n} parties<br>Envoyé à Analyst",
      rejected_wont_buy: "Rejeté · {reason}<br>Grok Bot n'achètera pas {name}",
      open_on_fomo: "Ouvrir sur FOMO",
      buy_mark: "Achat",
      sell_mark: "Vente",
      hg_open: "Ouvert",
      hg_running: "En cours",
      hg_day_stopped: "Journée stoppée",
      hg_ended: "Terminé",
      hg_closed: "Fermé",
      hg_skipped: "Ignoré",
      hg_blocked: "Bloqué",
      hg_unfillable: "Non remplissable",
      hg_unverified: "Non vérifié",
      hg_no_open: "Aucune position ouverte",
      hg_entry: "entrée",
      hg_stop: "stop",
      hg_target: "cible",
      hg_units: "{n} unités",
      hg_no_cases: "Aucun cas pour l'instant",
      hg_paper_balance: "Solde PAPER",
      hg_day: "Jour",
      hg_day_status: "Statut du jour",
      hg_day_pnl: "P&L du jour",
      hg_entries_today: "Entrées aujourd'hui",
      hg_rule: "Règle : {name} · 1–3 % de risque · stop 2,5 % · cible 5 % · pas de levier",
      hg_open_pos: "Position ouverte",
      hg_journal: "Journal",
      hg_strategy_name: "Tendance 1h + funding alignés",
      no_match: "Aucun résultat",
    }
  };

  function t(key, vars) {
    const dict = I18N[lang] || I18N.en;
    let s = dict[key];
    if (s == null) s = I18N.en[key];
    if (s == null) return key;
    if (vars) {
      s = s.replace(/\{(\w+)\}/g, (_, k) => (vars[k] != null ? String(vars[k]) : ""));
    }
    return s;
  }
  function localeTag() { return lang === "fr" ? "fr-FR" : "en-GB"; }
  function setLang(next) {
    lang = next === "fr" ? "fr" : "en";
    localStorage.setItem(LANG_KEY, lang);
    document.documentElement.lang = lang;
    applyTabLabels();
    state._homeLive = false;
    render();
  }
  function applyTabLabels() {
    document.querySelectorAll(".tabbar button[data-tab]").forEach((b) => {
      const span = b.querySelector("span");
      const map = { home: "tab_home", agents: "tab_agents", activity: "tab_activity", account: "tab_account" };
      if (span && map[b.dataset.tab]) span.textContent = t(map[b.dataset.tab]);
    });
  }
  function langToggleHtml() {
    return `<div class="lang-toggle" role="group" aria-label="${esc(t("language"))}">
      <button type="button" data-lang="en" class="${lang==="en"?"on":""}">EN</button>
      <button type="button" data-lang="fr" class="${lang==="fr"?"on":""}">FR</button>
    </div>`;
  }
  function bindLangToggle() {
    document.querySelectorAll(".lang-toggle button[data-lang]").forEach((b) => {
      b.onclick = (ev) => {
        ev.preventDefault();
        ev.stopPropagation();
        if (b.dataset.lang !== lang) setLang(b.dataset.lang);
      };
    });
  }
  function fmtHourLabel(hhmm) {
    const parts = String(hhmm || "").split(":");
    const hour = parseInt(parts[0], 10);
    const min = parseInt(parts[1] || "0", 10);
    if (!Number.isFinite(hour)) return hhmm || "";
    if (lang === "fr") return min ? (hour + "h" + String(min).padStart(2, "0")) : (hour + "h");
    return hour + ":" + String(min).padStart(2, "0");
  }
  function frenchHourToClock(s) {
    return String(s).replace(/(\d{1,2})h(\d{2})?/g, (_, h, m) => h + ":" + (m || "00"));
  }
  function localizeServer(s) {
    if (s == null || s === "") return s == null ? "" : s;
    let out = String(s);
    if (lang !== "en") return out;
    const reps = [
      [/En écoute des nouvelles pools/gi, "Listening for new pools"],
      [/En écoute des traders/gi, "Listening for traders"],
      [/^Actif\s+(.+)$/i, (_, r) => "Active " + frenchHourToClock(r)],
      [/^En pause jusqu'à\s+(.+)$/i, (_, r) => "Paused until " + frenchHourToClock(r)],
      [/Sortie\s*:\s*quand\s+(.+?)\s+vend\s*·\s*sécurité\s*/gi, "Exit: when $1 sells · safety "],
      [/sécurité\s*(?=[-−])/gi, "safety "],
      [/fin de journée\s+/gi, "end of day "],
      [/déjà\s+(\d+)\s+entrées aujourd'hui(?:\s*\(UTC\))?/gi, "already $1 entries today"],
      [/snapshot indisponible\s*\(([^)]+)\)/gi, "snapshot unavailable ($1)"],
      [/une position déjà ouverte/gi, "a position is already open"],
      [/Market Analyst n'a pas pu lire \/info/gi, "Market Analyst could not read /info"],
      [/pas d'alignement/gi, "no alignment"],
      [/rendement 1h/gi, "1h return"],
      [/\(alignés\)/gi, "(aligned)"],
      [/signal valide, mais ([A-Z0-9-]+) retenu \(une position à la fois\)/gi, "valid signal, but $1 taken (one position at a time)"],
      [/Tendance 1h \+ funding alignés/g, "1h trend + aligned funding"],
      [/^LONG si le rendement mid sur 1 heure est strictement positif ET le funding horaire est strictement négatif\. SHORT si le rendement mid sur 1 heure est strictement négatif ET le funding horaire est strictement positif\. Sinon SKIP\. Si les deux marchés qualifient, on prend celui dont la valeur absolue du rendement 1h est la plus grande ; égalité : ETH\. Seuils figés à 0, sans optimisation a posteriori\.$/,
        "LONG if the 1-hour mid return is strictly positive AND hourly funding is strictly negative. SHORT if the 1-hour mid return is strictly negative AND hourly funding is strictly positive. Otherwise SKIP. If both markets qualify, take the one with the larger absolute 1h return; tie: ETH. Thresholds fixed at 0, no ex-post optimization."],
      [/^PAPER copie\s+/i, "PAPER copy "],
      [/\bRisk · sécurité\b/gi, "Risk · safety"],
    ];
    for (const [re, repl] of reps) out = out.replace(re, repl);
    out = out.replace(/(\d{1,2})h(\d{2})/g, "$1:$2");
    return out;
  }


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
        throw new Error(t("readonly"));
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
    if (n == null || Number.isNaN(Number(n))) return "—";
    n = Number(n);
    const sign = n < 0 ? "-" : "";
    const a = Math.abs(n);
    let body;
    if (a >= 1000) body = a.toLocaleString(undefined, { maximumFractionDigits: 2 });
    else if (a >= 1) body = a.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 4 });
    else if (a >= 0.01) body = a.toFixed(4);
    else if (a > 0) {
      const s = a.toPrecision(4);
      body = /e/i.test(s) ? a.toExponential(2) : String(Number(s));
    } else body = "0.00";
    return sign + "$" + body;
  }
  function nusd(n) {
    if (n == null || Number.isNaN(Number(n))) return "—";
    const nice = (typeof DeskCharts !== "undefined" && DeskCharts.nice) ? DeskCharts.nice(Number(n)) : String(n);
    if (nice === "—") return "—";
    return "$" + nice;
  }
  function arrow(n) { return n == null ? "" : (n >= 0 ? "▲" : "▼"); }
  function sparkSvg(pts) {
    if (!pts || pts.length < 2) return "";
    const nums = pts.map(Number).filter((x) => !Number.isNaN(x));
    if (nums.length < 2) return "";
    const min = Math.min(...nums), max = Math.max(...nums), span = max - min || 1;
    const w = 72, h = 28;
    const d = nums.map((p, i) => {
      const x = (i / (nums.length - 1)) * w;
      const y = h - 2 - ((p - min) / span) * (h - 4);
      return (i ? "L" : "M") + x.toFixed(1) + "," + y.toFixed(1);
    }).join(" ");
    const up = nums[nums.length - 1] >= nums[0];
    const color = up ? "#00d35a" : "#ff453a";
    return `<svg class="spark" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" aria-hidden="true"><path d="${d}" fill="none" stroke="${color}" stroke-width="1.6" stroke-linejoin="round" stroke-linecap="round"/></svg>`;
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
    if (state.screen !== "coin") stopCoinLive();
    if (!(state.screen === "home" && state.tab === "home")) {
      stopEquityAnim();
      stopClock();
      state._homeLive = false;
    }
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

  const TRADER_NICE = {
    "0xsneakky": "Sneaky", "sneaky": "Sneaky",
    "DIARRA_MMD": "DIARRA", "diarra": "DIARRA",
    "seralberttrades": "Ser Albert", "ser albert": "Ser Albert",
    "RunningClam": "Clam", "runningclam": "Clam", "clam": "Clam",
    "brrrgrrrz": "Burgz", "burgz": "Burgz",
    "panceramic": "Panceramic",
    "starcatcher444": "Starcatcher", "starcatcher": "Starcatcher",
    "end837": "end837", "leo": "Leo",
  };
  function coinName(ev) { return (ev && (ev.coin || ev.token || ev.symbol || ev.name || ev.label)) || ""; }
  function prettyTrader(name) {
    const raw = String(name || "").trim();
    if (!raw) return "";
    return TRADER_NICE[raw] || TRADER_NICE[raw.toLowerCase()] || raw;
  }
  function terminalOf(d) {
    if (d && d.terminal && d.terminal.scanner) return d.terminal;
    const agents = (d && d.agents) || [];
    const find = (n) => agents.find((a) => (a.name || "").toLowerCase() === n) || {};
    const scan = find("scanner");
    const copy = find("copy");
    const exe = find("executor");
    const risk = find("risk");
    const opens = ((d && d.positions) || []).filter((p) => p.status !== "closed").length;
    const lastAct = (state.activity || []).find((r) => r.kind === "bought" || r.kind === "sold" || r.kind === "stopped");
    const pack = (r) => r ? {
      kind: r.kind, token: r.symbol || r.name || r.label,
      logo_url: r.logo_url, mint: r.mint, value: r.value,
      subtitle: r.subtitle, title: r.title, ts: r.ts,
      trader: (r.subtitle || "").replace(/^(suit|ajout|copie)\s+/i, "") || null,
    } : null;
    return {
      scanner: { pools: scan.count || 0, passed: scan.passed || 0, killed: scan.killed || 0, last: scan.detail, status: scan.status || "running" },
      copy: { traders: 0, opens: copy.count || 0, last: pack((state.activity || []).find((r) => /copie|suit |ajout /i.test((r.title || "") + " " + (r.subtitle || "")))), status: copy.status || "running" },
      executor: { last_buy: pack((state.activity || []).find((r) => r.kind === "bought")), fills: exe.count || 0, status: exe.status || "running", mode: "PAPER" },
      risk: { open: opens, safety_stop_pct: 30, state: opens ? "holding" : "watching", last_exit: pack((state.activity || []).find((r) => r.kind === "sold" || r.kind === "stopped")), status: risk.status || "running" },
      last_trade: pack(lastAct),
      open: opens,
      trades: (state.activity || []).filter((r) => r.kind === "bought" || r.kind === "sold" || r.kind === "stopped").length,
    };
  }
  function setOdometer(el, text, opts) {
    if (!el) return;
    text = String(text);
    const reduce = reduceMotion();
    const chars = Array.from(text);
    const isDigit = (c) => c >= "0" && c <= "9";
    const kids = [...el.children];
    const same = kids.length === chars.length && kids.every((ch, i) => {
      const want = isDigit(chars[i]);
      return want ? ch.classList.contains("odo-col") : !ch.classList.contains("odo-col");
    });
    const apply = () => {
      [...el.children].forEach((ch, i) => {
        if (!ch.classList.contains("odo-col")) {
          if (ch.textContent !== chars[i]) ch.textContent = chars[i];
          return;
        }
        const d = +chars[i];
        const strip = ch.querySelector(".odo-strip");
        if (strip) strip.style.transform = "translateY(-" + d + "em)";
      });
    };
    if (!same) {
      el.innerHTML = chars.map((c) => {
        if (isDigit(c)) {
          return '<span class="odo-col"><span class="odo-strip" style="transform:translateY(0)">' +
            "0123456789".split("").map((d) => "<span>" + d + "</span>").join("") +
            "</span></span>";
        }
        return '<span class="odo-ch">' + esc(c) + "</span>";
      }).join("");
      el.classList.add("odometer");
      if (opts && opts.fromZero && !reduce) {
        requestAnimationFrame(() => requestAnimationFrame(apply));
      } else {
        apply();
      }
    } else {
      apply();
    }
    el.setAttribute("data-odo", text);
  }
  function fmtParis(ts) {
    if (!ts) return "";
    try {
      const d = new Date(ts);
      if (Number.isNaN(d.getTime())) return "";
      return d.toLocaleTimeString(localeTag(), { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "Europe/Lisbon" });
    } catch (e) { return ""; }
  }
  function sessionHoursLabel(d) {
    const s = (d && d.session) || {};
    const start = s.active_start || "08:00";
    const end = s.active_end || "22:30";
    const paused = s.paused || s.active === false || s.hours_status === "paused";
    if (paused) return t("hours_paused", { time: fmtHourLabel(start) });
    return t("hours_active", { range: fmtHourLabel(start) + "–" + fmtHourLabel(end) });
  }
  function tradeReason(r) {
    const sub = r.subtitle || "";
    const kind = r.kind || "";
    const m = sub.match(/^(?:suit|ajout|copie)\s+(.+)$/i);
    if (kind === "bought" && m) return t("copy_of", { trader: prettyTrader(m[1]) });
    if ((kind === "sold" || kind === "stopped") && m) return t("trader_sold", { trader: prettyTrader(m[1]) });
    if (/trail/i.test(sub)) return t("trailing_stop");
    const pct = sub.match(/-?\d+(?:\.\d+)?\s*%/);
    if (/stop/i.test(sub)) return t("safety_stop") + " " + (pct ? pct[0].replace(/\s+/g, "") : "-30%");
    if (kind === "sold") return t("trader_sold_generic");
    return localizeServer(sub);
  }
  function tradeTitle(r) {
    const token = r.symbol || r.name || r.label || t("memecoin");
    if (r.kind === "bought") return t("bought", { token });
    if (r.kind === "sold") return t("sold", { token });
    if (r.kind === "stopped") return t("sold", { token });
    return localizeServer(r.title || token);
  }
  function valueTone(val, kind) {
    const s = String(val || "");
    if (s.startsWith("+") || (kind === "bought" && !s.startsWith("-"))) return "up";
    if (s.startsWith("-") || kind === "stopped") return "down";
    return "";
  }

  let clockTimer = null;
  function tickClock() {
    const el = $("#termClock");
    if (!el) return;
    el.textContent = new Date().toLocaleTimeString(localeTag(), {
      hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false, timeZone: "Europe/Lisbon"
    });
  }
  function startClock() {
    tickClock();
    if (clockTimer) clearInterval(clockTimer);
    clockTimer = setInterval(tickClock, 1000);
  }
  function stopClock() {
    if (clockTimer) { clearInterval(clockTimer); clockTimer = null; }
  }

  const equityAnim = {
    raf: 0, intro: 1, introT: 0, yMin: null, yMax: null, tipPhase: 0,
    knownMarks: new Set(), primed: false, lastRange: "",
  };
  const RANGE_MS = { LIVE: 4 * 3600e3, "1H": 3600e3, "4H": 4 * 3600e3, "1D": 86400e3, "1W": 7 * 86400e3, ALL: 3650 * 86400e3 };
  function stopEquityAnim() {
    if (equityAnim.raf) cancelAnimationFrame(equityAnim.raf);
    equityAnim.raf = 0;
  }
  function startEquity() {
    stopEquityAnim();
    equityAnim.intro = 1;
    equityAnim.introT = 0;
    equityAnim.yMin = null;
    equityAnim.yMax = null;
    equityAnim.lastRange = state.range;
    const loop = (ts) => {
      if (!equityAnim._t0) equityAnim._t0 = ts;
      const dt = Math.min(48, ts - (equityAnim._last || ts));
      equityAnim._last = ts;
      tickEquity(dt);
      equityAnim.raf = requestAnimationFrame(loop);
    };
    equityAnim._t0 = 0;
    equityAnim._last = 0;
    equityAnim.raf = requestAnimationFrame(loop);
  }
  function tickEquity(dt) {
    const canvas = $("#homeChart");
    if (!canvas || typeof DeskCharts === "undefined" || !DeskCharts.drawEquityFrame) return;
    const live = state.range === "LIVE";
    const now = Date.now();
    const pts = (chartCache.points || []).slice();
    const marks = chartCache.marks || [];
    const startVal = (state.data && state.data.stack != null) ? Number(state.data.stack) : (chartCache.start != null ? Number(chartCache.start) : 20);
    let t0, t1;
    if (state.range === "ALL") {
      const times = pts.map((p) => DeskCharts.parseTs(p.ts)).filter(Number.isFinite);
      t0 = times.length ? times[0] : now - 3600e3;
      t1 = now;
    } else {
      const win = RANGE_MS[state.range] || RANGE_MS.LIVE;
      t0 = now - win;
      t1 = now;
    }
    if (state.range === "LIVE" || state.range === "4H" || state.range === "1H") {
      const jump = Math.max(4, 0.25 * (startVal || 20));
      let cut = t0;
      for (let i = 1; i < pts.length; i++) {
        if (Math.abs(+pts[i].value - +pts[i - 1].value) >= jump) {
          const t = DeskCharts.parseTs(pts[i].ts);
          if (Number.isFinite(t) && t > cut) cut = t;
        }
      }
      if (cut > t0 && cut < t1 - 60e3) t0 = cut;
    }
    if (equityAnim.intro) {
      equityAnim.introT = Math.min(1, equityAnim.introT + dt / 900);
      const e = 1 - Math.pow(1 - equityAnim.introT, 3);
      var drawUntil = t0 + e * (t1 - t0);
      if (equityAnim.introT >= 1) equityAnim.intro = 0;
    } else {
      var drawUntil = t1;
    }
    if (reduceMotion()) { equityAnim.intro = 0; drawUntil = t1; }
    const vis = pts.map((p) => +p.value).filter((v) => !Number.isNaN(v));
    if (startVal != null) vis.push(startVal);
    let tMin, tMax;
    if (vis.length) {
      tMin = Math.min.apply(null, vis);
      tMax = Math.max.apply(null, vis);
      if (tMin === tMax) { tMin -= 1; tMax += 1; }
      const pad = (tMax - tMin) * 0.14;
      tMin -= pad; tMax += pad;
    } else {
      tMin = startVal - 2; tMax = startVal + 2;
    }
    if (equityAnim.yMin == null || reduceMotion()) {
      equityAnim.yMin = tMin; equityAnim.yMax = tMax;
    } else {
      const k = 1 - Math.pow(0.001, dt / 400);
      equityAnim.yMin += (tMin - equityAnim.yMin) * k;
      equityAnim.yMax += (tMax - equityAnim.yMax) * k;
    }
    const lastV = pts.length ? +pts[pts.length - 1].value : startVal;
    const up = lastV >= startVal;
    equityAnim.tipPhase = (equityAnim.tipPhase + dt / 1400) % 1;
    const frame = DeskCharts.drawEquityFrame(canvas, {
      points: pts, marks, startValue: startVal,
      t0, t1, drawUntil, yMin: equityAnim.yMin, yMax: equityAnim.yMax,
      up, tipPhase: equityAnim.tipPhase,
    });
    syncEquityMarks(frame && frame.marks, canvas);
  }
  function syncEquityMarks(markPos, canvas) {
    const layer = $("#eqMarks");
    if (!layer) return;
    const hits = markPos || [];
    // keep last 6 as pills, prefer most recent
    const sorted = hits.slice().sort((a, b) => DeskCharts.parseTs(b.ts) - DeskCharts.parseTs(a.ts));
    const pillIds = new Set(sorted.slice(0, 3).map((m) => m.id));
    // stack close x
    const shown = hits.filter((m) => pillIds.has(m.id));
    shown.sort((a, b) => a.x - b.x);
    const stemOf = {};
    let cluster = [];
    const flush = () => {
      cluster.forEach((m, i) => { stemOf[m.id] = 28 + i * 30; });
      cluster = [];
    };
    shown.forEach((m) => {
      if (cluster.length && m.x - cluster[cluster.length - 1].x < 18) cluster.push(m);
      else { flush(); cluster = [m]; }
    });
    flush();
    const existing = new Map([...layer.querySelectorAll(".eq-mark")].map((el) => [el.dataset.id, el]));
    const seenNow = new Set();
    shown.forEach((m) => {
      seenNow.add(m.id);
      let el = existing.get(m.id);
      const isNew = !el;
      if (!el) {
        el = document.createElement("div");
        el.className = "eq-mark";
        el.dataset.id = m.id;
        el.dataset.mint = m.mint || "";
        const buy = m.kind === "bought";
        const tone = valueTone(m.value, m.kind);
        const verb = buy ? "bought" : "sold";
        const amtCls = tone ? ("amt " + tone) : "amt";
        el.innerHTML = '<div class="eq-stem"></div>' +
          '<div class="eq-pill ' + (buy ? "bought" : "sold") + '">' +
          logoHtml(m.logo, m.label || m.symbol) +
          '<span>' + esc(m.label || m.symbol || "") + ' ' + verb + ' <span class="' + amtCls + '">' + esc(m.value || "") + "</span></span>" +
          "</div>" +
          '<div class="eq-sparks"><i class="eq-spark"></i><i class="eq-spark"></i><i class="eq-spark"></i><i class="eq-spark"></i><i class="eq-spark"></i></div>';
        el.onclick = (ev) => {
          ev.stopPropagation();
          if (m.mint) { state.mint = m.mint; state.screen = "coin"; render(); }
        };
        layer.appendChild(el);
        if (equityAnim.primed && !equityAnim.knownMarks.has(m.id) && !reduceMotion()) {
          const pill = el.querySelector(".eq-pill");
          if (pill) pill.classList.add("pop");
          el.classList.add("burst");
          setTimeout(() => el.classList.remove("burst"), 320);
        }
        equityAnim.knownMarks.add(m.id);
      }
      const stem = stemOf[m.id] || 26;
      el.style.left = m.x + "px";
      el.style.top = m.y + "px";
      el.style.setProperty("--stem", stem + "px");
      const stemEl = el.querySelector(".eq-stem");
      if (stemEl) stemEl.style.height = stem + "px";
      const pill = el.querySelector(".eq-pill");
      if (pill) pill.style.bottom = stem + "px";
    });
    existing.forEach((el, id) => { if (!seenNow.has(id)) el.remove(); });
    if (!equityAnim.primed) {
      hits.forEach((m) => equityAnim.knownMarks.add(m.id));
      equityAnim.primed = true;
    }
    // reuse tooltip hit testing for non-pill dots
    canvas._markHits = hits;
  }

  function lastTradeHtml(ev) {
    if (!ev) return "";
    const token = coinName(ev) || "trade";
    const tone = valueTone(ev.value, ev.kind);
    return logoHtml(ev.logo_url, token) + "<span>" + esc(token) + " " + esc(ev.value || "") + "</span>";
  }
  function paintEquityNumbers(d, term, opts) {
    const stack = Number(d.stack != null ? d.stack : 20) || 20;
    const bal = Number(d.balance);
    const chg = bal - stack;
    const pct = stack ? (chg / stack) * 100 : 0;
    const mult = stack ? bal / stack : 1;
    setOdometer($("#bal"), money(bal), opts);
    const up = chg >= 0;
    const chgEl = $("#termChg");
    if (chgEl) chgEl.className = "chg " + (up ? "up" : "down");
    const arrowEl = $("#termArrow");
    if (arrowEl) arrowEl.textContent = up ? "▲" : "▼";
    setOdometer($("#termChgUsd"), money(Math.abs(chg)), opts);
    setOdometer($("#termChgPct"), fmtPct(pct), opts);
    const m = $("#termMult");
    if (m) {
      m.textContent = (Number.isFinite(mult) ? mult : 0).toFixed(2) + "×";
      m.className = "pill mult" + (up ? "" : " red");
    }
    const opens = (term && term.open != null) ? term.open : ((d.positions || []).filter((p) => p.status !== "closed").length);
    const fo = $("#fomoOpen");
    if (fo) fo.textContent = t("n_open", { n: opens, s: opens > 1 ? "s" : "" });
    const pill = $("#lastTradePill");
    const ev = term && term.last_trade;
    if (pill) {
      if (!ev) pill.classList.add("hidden");
      else {
        pill.classList.remove("hidden");
        const tone = valueTone(ev.value, ev.kind);
        pill.className = "last-trade-pill" + (tone ? " " + tone : "");
        pill.innerHTML = lastTradeHtml(ev);
        pill.onclick = () => { if (ev.mint) { state.mint = ev.mint; state.screen = "coin"; render(); } };
      }
    }
  }

  function agentGridHtml(term) {
    const s = term.scanner || {};
    const c = term.copy || {};
    const e = term.executor || {};
    const r = term.risk || {};
    const lastC = c.last;
    const lastB = e.last_buy;
    const copyBody = lastC ? `<div class="ag-swap" data-k="${esc(lastC.ts || coinName(lastC) || "")}">
        ${logoHtml(lastC.logo_url, coinName(lastC))}
        <div><div class="t">${esc(prettyTrader(lastC.trader) || coinName(lastC) || "")}</div>
        <div class="s">${esc((lastC.kind === "bought" ? "bought " : "sold ") + (coinName(lastC) || "") + (lastC.value ? " · " + lastC.value : ""))}</div></div>
      </div>` : `<div class="ag-line">${esc(t("listening_traders"))}</div>`;
    const buyVal = lastB && lastB.value ? lastB.value : "—";
    const buyTok = lastB && coinName(lastB) ? coinName(lastB) : t("no_buy_yet");
    const st = r.state || (r.open ? "holding" : "watching");
    const exit = r.last_exit;
    const exitLine = exit ? ((exit.kind === "stopped" ? "stop " : t("copy_exit")) + (coinName(exit) || "") + (exit.value ? " · " + exit.value : "")) : t("safety_minus") + (r.safety_stop_pct != null ? r.safety_stop_pct : 30) + "%";
    return `
      <article class="ag-card" id="agScanner">
        <div class="ag-top">
          <div class="ag-icon scanner"><i class="ring r1"></i><i class="ring r2"></i><i class="ring-pulse"></i><i class="core"></i></div>
          <div><div class="ag-name">Scanner</div><div class="ag-sub">${esc(t("pools_scanned"))}</div></div>
        </div>
        <div class="ag-body">
          <div class="ag-metric num" id="agScanCount"></div>
          <div class="ag-line" id="agScanLast">${esc(localizeServer(s.last || t("listening_pools")))}</div>
        </div>
      </article>
      <article class="ag-card" id="agCopy">
        <div class="ag-top">
          <div class="ag-icon copy"><svg viewBox="0 0 36 36" aria-hidden="true">
            <defs><linearGradient id="hexg" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stop-color="#ff7ad9"/><stop offset="50%" stop-color="#7c5cff"/>
              <stop offset="100%" stop-color="#3d9bff"/></linearGradient></defs>
            <polygon points="18,3 32,11 32,25 18,33 4,25 4,11" fill="url(#hexg)"/>
          </svg></div>
          <div><div class="ag-name">Copy-watcher</div><div class="ag-sub" id="agCopySub">${esc(t("n_traders", { n: (c.traders || 0), s: (c.traders || 0) > 1 ? "s" : "" }))}</div></div>
        </div>
        <div class="ag-body" id="agCopyBody">${copyBody}</div>
      </article>
      <article class="ag-card exec" id="agExec">
        <div class="ag-top">
          <div class="ag-icon exec"><div class="sq"></div>
            <svg viewBox="0 0 36 36" aria-hidden="true"><rect class="trace" x="5" y="5" width="26" height="26" rx="6" pathLength="104"/></svg>
          </div>
          <div><div class="ag-name">Executor</div><div class="ag-sub">PAPER</div></div>
        </div>
        <div class="ag-body">
          <div class="ag-metric num" id="agExecVal">${esc(buyVal)}</div>
          <div class="ag-line" id="agExecLast">${esc(t("last_buy", { token: buyTok }))}</div>
        </div>
      </article>
      <article class="ag-card" id="agRisk">
        <div class="ag-top">
          <div class="ag-icon brain"><div class="chip"></div></div>
          <div><div class="ag-name">Brain</div><div class="ag-sub">Risk · −${esc(r.safety_stop_pct != null ? r.safety_stop_pct : 30)}%</div></div>
        </div>
        <div class="ag-body">
          <div class="ag-state ${esc(st)}" id="agRiskState">${esc(st)}</div>
          <div class="ag-line" id="agRiskLine">${esc(r.open ? t("n_open", { n: r.open, s: r.open > 1 ? "s" : "" }) : t("no_coin_open"))} · ${esc(exitLine)}</div>
        </div>
      </article>`;
  }
  function updateAgentGrid(term) {
    const s = term.scanner || {};
    const c = term.copy || {};
    const e = term.executor || {};
    const r = term.risk || {};
    setOdometer($("#agScanCount"), String(s.pools || 0));
    const lastEl = $("#agScanLast");
    const scanLast = localizeServer(s.last || t("listening_pools"));
    if (lastEl && scanLast && lastEl.textContent !== scanLast) lastEl.textContent = scanLast;
    const sub = $("#agCopySub");
    if (sub) sub.textContent = t("n_traders", { n: (c.traders || 0), s: (c.traders || 0) > 1 ? "s" : "" });
    const body = $("#agCopyBody");
    const lastC = c.last;
    const key = lastC ? (lastC.ts || coinName(lastC) || "") : "";
    if (body && body.getAttribute("data-key") !== key) {
      body.setAttribute("data-key", key);
      if (lastC) {
        body.innerHTML = `<div class="ag-swap in" data-k="${esc(key)}">
          ${logoHtml(lastC.logo_url, coinName(lastC))}
          <div><div class="t">${esc(prettyTrader(lastC.trader) || coinName(lastC) || "")}</div>
          <div class="s">${esc((lastC.kind === "bought" ? "bought " : "sold ") + (coinName(lastC) || "") + (lastC.value ? " · " + lastC.value : ""))}</div></div>
        </div>`;
        const card = $("#agCopy");
        if (card) { card.classList.remove("pulse-upd"); void card.offsetWidth; card.classList.add("pulse-upd"); }
      }
    }
    const buyVal = lastC && e.last_buy && e.last_buy.value ? e.last_buy.value : (e.last_buy && e.last_buy.value) || "—";
    const ev = e.last_buy;
    const evVal = ev && ev.value ? ev.value : "—";
    const evTok = ev && coinName(ev) ? coinName(ev) : t("no_buy_yet");
    const evLine = t("last_buy", { token: evTok });
    const evEl = $("#agExecVal");
    const evLast = $("#agExecLast");
    if (evEl && evEl.getAttribute("data-v") !== evVal) {
      evEl.textContent = evVal;
      evEl.setAttribute("data-v", evVal);
      if (evLast) { evLast.textContent = evLine; evLast.classList.remove("snap"); void evLast.offsetWidth; evLast.classList.add("snap"); }
      const card = $("#agExec");
      if (card) { card.classList.remove("pulse-upd"); void card.offsetWidth; card.classList.add("pulse-upd"); }
    }
    const st = r.state || (r.open ? "holding" : "watching");
    const stEl = $("#agRiskState");
    if (stEl && stEl.textContent !== st) {
      stEl.className = "ag-state " + st;
      stEl.textContent = st;
    }
    const exit = r.last_exit;
    const exitLine = exit ? ((exit.kind === "stopped" ? "stop " : t("copy_exit")) + (coinName(exit) || "") + (exit.value ? " · " + exit.value : "")) : (t("safety_minus") + (r.safety_stop_pct != null ? r.safety_stop_pct : 30) + "%");
    const line = (r.open ? t("n_open", { n: r.open, s: r.open > 1 ? "s" : "" }) : t("no_coin_open")) + " · " + exitLine;
    const rLine = $("#agRiskLine");
    if (rLine && rLine.textContent !== line) rLine.textContent = line;
    const run = [s, c, e, r].filter((x) => (x.status || "running") !== "paused").length;
    const runEl = $("#agRunning");
    if (runEl) runEl.textContent = t("n_running", { n: run });
  }

  const seenActivity = new Set();
  let activityPrimed = false;



  function renderHome() {
    const d = state.data;
    if (!d) {
      app.innerHTML = `<div class="term-skel">
        <div class="term-head"><div class="term-brand">Grok Bot</div></div>
        <div class="pad">
          <div class="skel" style="height:56px;width:70%;margin:16px 0"></div>
          <div class="skel" style="height:220px;margin:8px 0"></div>
        </div>
      </div>`;
      bindNav();
      return;
    }
    if (state._homeLive && app.querySelector(".term-equity") && $("#bal")) {
      patchHome();
      return;
    }
    buildHome();
  }

  function buildHome() {
    const d = state.data;
    const term = terminalOf(d);
    const opens = term.open != null ? term.open : ((d.positions || []).filter((p) => p.status !== "closed").length);
    const tradesN = term.trades != null ? term.trades : (state.activity || []).filter((r) => r.kind === "bought" || r.kind === "sold" || r.kind === "stopped").length;
    const runN = ["scanner","copy","executor","risk"].filter((k) => ((term[k === "executor" ? "executor" : k] || {}).status || "running") !== "paused").length;
    app.innerHTML = `
      <div class="term-home">
        <div class="term-head">
          <div class="term-brand">Grok Bot</div>
          <div class="term-head-right">
            ${langToggleHtml()}
            <div class="term-clock mono" id="termClock"></div>
          </div>
        </div>
        <div class="term-status">
          <span class="live-pill"><i class="live-dot"></i> Live · ${d.mode === "LIVE" ? "LIVE" : "PAPER"}</span>
          <span class="fomo-pill">fomo · <b id="fomoOpen">${esc(t("n_open", { n: opens, s: opens > 1 ? "s" : "" }))}</b></span>
        </div>
        <div class="term-equity">
          <div class="display balance num odometer" id="bal"></div>
          <div class="last-trade-pill hidden" id="lastTradePill"></div>
        </div>
        <div class="term-stats">
          <div class="chg" id="termChg">
            <span id="termArrow"></span>
            <span class="odometer" id="termChgUsd"></span>
            <span class="odometer" id="termChgPct"></span>
          </div>
          <span class="pill mult" id="termMult"></span>
        </div>
        <div class="term-chart chart-wrap" id="termChart">
          <canvas id="homeChart" style="width:100%;height:240px"></canvas>
          <div id="eqMarks" class="eq-marks"></div>
          <div id="equityTip" class="chart-tip hidden"></div>
        </div>
        <div class="ranges term-ranges" id="ranges">
          ${["LIVE","1H","4H","1D","1W","ALL"].map((r) =>
            `<button data-r="${r}" class="${state.range===r?"on":""}">${r}</button>`).join("")}
        </div>
        <div class="section term-sec"><h2>Agents · <span class="muted" id="agRunning">${esc(t("n_running", { n: runN }))}</span></h2></div>
        <div class="agent-grid" id="agentGrid">${agentGridHtml(term)}</div>
        <div class="section term-sec"><h2>${esc(t("activity"))} · <span class="muted" id="actCount">${esc(t("n_trades", { n: tradesN, s: tradesN>1?"s":"" }))}</span></h2>
          <button class="link" id="seeAll">${esc(t("see_all"))}</button></div>
        <div class="list" id="homeAct">${activityRows(state.activity.slice(0,8), {prime: true})}</div>
        ${walletBlock(d)}
        ${hypergrokBlock(state.hypergrok)}
      </div>`;
    bindNav();
    bindHome();
    startClock();
    paintEquityNumbers(d, term, { fromZero: !reduceMotion() });
    setOdometer($("#agScanCount"), String((term.scanner && term.scanner.pools) || 0), { fromZero: !reduceMotion() });
    const copyBody = $("#agCopyBody");
    if (copyBody && term.copy && term.copy.last) copyBody.setAttribute("data-key", term.copy.last.ts || coinName(term.copy.last) || "");
    const ev = term.executor && term.executor.last_buy;
    const evEl = $("#agExecVal");
    if (evEl) evEl.setAttribute("data-v", ev && ev.value ? ev.value : "—");
    equityAnim.primed = false;
    equityAnim.knownMarks = new Set();
    startEquity();
    state._homeLive = true;
    activityPrimed = true;
    bindRows();
  }

  function bindHome() {
    bindLangToggle();
    const all = $("#seeAll");
    if (all) all.onclick = () => { state.tab = "activity"; highlightTab(); render(); };
    const ranges = $("#ranges");
    if (ranges) ranges.onclick = (e) => {
      const b = e.target.closest("button");
      if (!b) return;
      state.range = b.dataset.r;
      ranges.querySelectorAll("button").forEach((x) => x.classList.toggle("on", x === b));
      equityAnim.intro = 1;
      equityAnim.introT = 0;
      loadChart();
    };
  }

  function patchHome() {
    const d = state.data;
    if (!d) return;
    const term = terminalOf(d);
    paintEquityNumbers(d, term, { fromZero: false });
    updateAgentGrid(term);
    const tradesN = term.trades != null ? term.trades : (state.activity || []).filter((r) => r.kind === "bought" || r.kind === "sold" || r.kind === "stopped").length;
    const cnt = $("#actCount");
    if (cnt) cnt.textContent = t("n_trades", { n: tradesN, s: tradesN > 1 ? "s" : "" });
    const list = $("#homeAct");
    if (list) {
      list.innerHTML = activityRows(state.activity.slice(0, 8), { animateNew: true });
    }
    const histWas = document.querySelector(".term-home > .trades-block:not(.hg-block) .hist-block");
    const detailsOpen = !!(histWas && histWas.open);
    const wrap = document.querySelector(".term-home > .trades-block:not(.hg-block)");
    if (wrap) {
      const tmp = document.createElement("div");
      tmp.innerHTML = walletBlock(d);
      wrap.replaceWith(tmp.firstElementChild);
      const hist = document.querySelector(".term-home > .trades-block:not(.hg-block) .hist-block");
      if (hist && detailsOpen) hist.open = true;
    }
    const hg = document.querySelector(".hg-block");
    const freshHg = hypergrokBlock(state.hypergrok);
    if (hg && freshHg) {
      const tmp = document.createElement("div");
      tmp.innerHTML = freshHg;
      if (tmp.firstElementChild) hg.replaceWith(tmp.firstElementChild);
    } else if (!hg && freshHg) {
      const home = document.querySelector(".term-home");
      if (home) home.insertAdjacentHTML("beforeend", freshHg);
    }
    bindRows();
  }


  function agentCard(a) {
    const r = Math.round(42 * ((window.innerWidth - 32) / 504));
    let body = "";
    if (a.name === "Scanner") {
      const rows = (a.feed || []).slice(-6).map(f => {
        if (f.verdict === "kill")
          return `<div class="feed-row"><span class="killed">${esc(f.name)}</span><span class="why">${esc(localizeServer(f.reason||""))}</span></div>`;
        return `<div class="feed-row"><span>${esc(f.name)} · liq ${f.liq!=null?("$"+Math.round(f.liq)):"—"} · → auditor</span></div>`;
      }).join("") || `<div class="empty" style="padding:16px">${esc(t("listening_pools"))}</div>`;
      body = `<div class="meta">${esc(localizeServer(a.subtitle || ""))}</div><div class="feed">${rows}</div>`;
    } else if (a.name === "Auditor") {
      const layers = (a.layers || []).map(l =>
        `<div class="layer-strip ${l.pass?"ok":"bad"}">${l.n}. ${esc(l.name)} · ${esc(l.value||"")}</div>`
      ).join("");
      body = `<div class="meta">${esc(localizeServer(a.subtitle || ""))} · ${a.rejected||0} rejected</div>
        <div class="layers-grid">${layers}</div>
        <div class="meta">${esc(localizeServer(a.detail||""))}</div>`;
    } else if (a.name === "Analyst") {
      body = `<div class="meta">${esc(localizeServer(a.subtitle))}</div>
        <canvas class="scoreRing" width="120" height="120" style="width:120px;height:120px;align-self:center"></canvas>
        <div class="meta">${esc(localizeServer(a.detail||""))}</div>`;
    } else if (a.name === "Executor") {
      body = `<div class="meta">${esc(localizeServer(a.subtitle))}</div>
        <div>${esc(localizeServer(a.size_line||""))}</div>
        <div class="meta">${esc(localizeServer(a.detail||""))}</div>`;
    } else {
      const p = a.pills || {};
      body = `<div class="meta">${esc(localizeServer(a.subtitle))}</div>
        <div>${esc(localizeServer(a.detail||"Guarding"))}</div>
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
    const { opens, closed } = openClosedSplit(d.positions || []);
    return `
      <div class="trades-block">
        <div class="section"><h2>${esc(t("your_money"))}</h2></div>
        <div class="wallet-card">
          <div class="wallet-total">
            <div class="k">${esc(t("total_paper"))}</div>
            <div class="v num">${money(total)}</div>
          </div>
          <div class="wallet-split">
            <div><span class="k">${esc(t("cash"))}</span><span class="v num">${money(cash)}</span></div>
            <div><span class="k">${esc(t("in_position"))}</span><span class="v num">${money(openValue)}</span></div>
          </div>
          <div class="wallet-hours${((d.session||{}).paused || (d.session||{}).active === false) ? " paused" : ""}">${esc(sessionHoursLabel(d))}</div>
        </div>
        <div class="section"><h2>${esc(t("my_memecoins"))}</h2></div>
        <div class="list" id="homeTrades">${openPositionRows(opens)}</div>
        ${historyBlock(closed, { expand: opens.length === 0 })}
      </div>`;
  }

  function openClosedSplit(rows) {
    const list = rows || [];
    const opens = list.filter((p) => p.status !== "closed");
    const closed = list.filter((p) => p.status === "closed");
    const recency = (p) => p.opened_at || p.closed_at || "";
    opens.sort((a, b) => recency(b).localeCompare(recency(a)));
    return { opens, closed };
  }

  function traderLabel(p) {
    if (p.source_kind === "copy" || p.copy_trader || p.strategy === "copy") {
      return t("copy_of", { trader: prettyTrader(p.source || p.copy_trader || "trader") });
    }
    return t("scanner");
  }

  function openPositionRows(rows) {
    if (!rows || !rows.length) {
      return `<div class="empty">${esc(t("no_coins_now"))}</div>`;
    }
    return rows.map((p) => {
      const pnl = Number(p.pnl_usd || 0);
      const cls = pnl > 0 ? "up" : pnl < 0 ? "down" : "";
      const name = p.symbol || p.name || t("memecoin");
      return `<div class="row token-row" data-open="coin" data-mint="${esc(p.mint || "")}">
        ${logoHtml(p.logo_url, p.name || p.symbol)}
        <div class="mid">
          <div class="t">${esc(name)}</div>
          <div class="s">${esc(traderLabel(p))}</div>
        </div>
        ${sparkSvg(p.spark)}
        <div class="right ${cls}">
          <div class="px num">${money(p.current_value)}</div>
          <div class="s">${signedMoney(pnl)} · ${fmtPct(p.pnl_pct)}</div>
        </div>
      </div>`;
    }).join("");
  }

  function historyGroups(rows) {
    const map = new Map();
    for (const p of rows || []) {
      const key = p.mint || p.symbol || p.name || "?";
      let g = map.get(key);
      if (!g) {
        g = {
          mint: p.mint || "",
          name: p.symbol || p.name || t("memecoin"),
          logo: p.logo_url,
          count: 0,
          pnl: 0,
          last: p.closed_at || p.opened_at || "",
        };
        map.set(key, g);
      }
      g.count += 1;
      g.pnl += Number(p.pnl_usd || 0);
      const ts = p.closed_at || p.opened_at || "";
      if (ts > g.last) g.last = ts;
      if (p.logo_url) g.logo = p.logo_url;
      if (p.symbol) g.name = p.symbol;
      else if (p.name && g.name === t("memecoin")) g.name = p.name;
    }
    return [...map.values()].sort((a, b) => (b.last || "").localeCompare(a.last || ""));
  }

  function historyBlock(rows, opts) {
    const groups = historyGroups(rows);
    if (!groups.length) return "";
    const total = groups.reduce((s, g) => s + g.pnl, 0);
    const cls = total > 0 ? "up" : total < 0 ? "down" : "";
    const openAttr = (opts && opts.expand) ? " open" : "";
    const items = groups.map((g) => {
      const gcls = g.pnl > 0 ? "up" : g.pnl < 0 ? "down" : "";
      return `<div class="row token-row hist-row" data-open="coin" data-mint="${esc(g.mint)}">
        ${logoHtml(g.logo, g.name)}
        <div class="mid">
          <div class="t">${esc(g.name)} <span class="hist-count">×${g.count}</span></div>
          <div class="s">${t("pnl_total")}</div>
        </div>
        <div class="right ${gcls}"><div class="px num">${signedMoney(g.pnl)}</div></div>
      </div>`;
    }).join("");
    return `<details class="hist-block"${openAttr}>
      <summary class="hist-summary">
        <h2>${esc(t("history"))}</h2>
        <span class="hist-realized ${cls}">${t("realized", { amount: signedMoney(total) })}</span>
      </summary>
      <div class="list" id="homeHistory">${items}</div>
    </details>`;
  }


  function hypergrokBlock(hg) {
    if (!hg || !hg.challenge) {
      return "";
    }
    const c = hg.challenge;
    const st = String(c.day_status || c.challenge_status || "").toUpperCase();
    const statusLabel = {
      OPEN: t("hg_open"), RUNNING: t("hg_running"), STOPPED: t("hg_day_stopped"),
      ENDED: t("hg_ended"), CLOSED: t("hg_closed")
    }[st] || esc(c.day_status || "—");
    const eq = money(c.equity);
    const dayPnl = Number(c.day_pnl || 0);
    const pnlCls = dayPnl > 0 ? "up" : dayPnl < 0 ? "down" : "";
    const pos = hg.open_position;
    let posHtml;
    if (!pos) {
      posHtml = `<div class="empty">${esc(t("hg_no_open"))}</div>`;
    } else {
      const u = Number(pos.unrealized_pnl || 0);
      const cls = u > 0 ? "up" : u < 0 ? "down" : "";
      posHtml = `<div class="row">
        <div class="logo ph">HG</div>
        <div class="mid">
          <div class="t">${esc(pos.market || "")} ${esc(pos.side || "")}
            <span class="status-pill open">${esc(t("hg_open"))}</span>
          </div>
          <div class="s">${esc(t("hg_entry"))} ${fmtPrice(pos.entry)} · ${esc(t("hg_stop"))} ${fmtPrice(pos.stop)} · ${esc(t("hg_target"))} ${fmtPrice(pos.target)}</div>
        </div>
        <div class="right ${cls}">${signedMoney(u)}<div class="s">${esc(t("hg_units", { n: pos.units || "" }))}</div></div>
      </div>`;
    }
    const statusMap = {
      OPEN: t("hg_open"), CLOSED: t("hg_closed"), SKIP: t("hg_skipped"), BLOCKED: t("hg_blocked"),
      UNFILLABLE: t("hg_unfillable"), UNVERIFIED: t("hg_unverified"),
      DAY_STOPPED: t("hg_day_stopped")
    };
    const rows = (hg.journal || []).slice(0, 12);
    let journalHtml;
    if (!rows.length) {
      journalHtml = `<div class="empty">${esc(t("hg_no_cases"))}</div>`;
    } else {
      journalHtml = rows.map((r) => {
        const pnl = r.net_pnl;
        const cls = pnl > 0 ? "up" : pnl < 0 ? "down" : "";
        const label = statusMap[r.status] || esc(r.status || "");
        const sub = r.status === "CLOSED"
          ? ("P&amp;L " + signedMoney(pnl))
          : esc(localizeServer(r.block_reason || r.notes || ""));
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
    const rule = localizeServer((hg.strategy && hg.strategy.name) || "TF-FUND-1");
    return `
      <div class="trades-block hg-block">
        <div class="section"><h2>HyperGrok</h2><span class="pill paper">PAPER</span></div>
        <div class="wallet-card">
          <div class="wallet-total">
            <div class="k">${esc(t("hg_paper_balance"))}</div>
            <div class="v num">${eq}</div>
          </div>
          <div class="wallet-split">
            <div><span class="k">${esc(t("hg_day"))}</span><span class="v num">${esc(c.day || 1)}/${esc(c.days || 6)}</span></div>
            <div><span class="k">${esc(t("hg_day_status"))}</span><span class="v">${statusLabel}</span></div>
            <div><span class="k">${esc(t("hg_day_pnl"))}</span><span class="v num ${pnlCls}">${signedMoney(c.day_pnl)}</span></div>
            <div><span class="k">${esc(t("hg_entries_today"))}</span><span class="v num">${esc(c.entries_today || 0)}/${esc(c.max_entries_per_day || 15)}</span></div>
          </div>
          <div class="hg-rule">${esc(t("hg_rule", { name: rule }))}</div>
        </div>
        <div class="section"><h2>${esc(t("hg_open_pos"))}</h2></div>
        <div class="list">${posHtml}</div>
        <div class="section"><h2>${esc(t("hg_journal"))}</h2></div>
        <div class="list" id="hgJournal">${journalHtml}</div>
      </div>`;
  }

  function activityRows(rows, opts) {
    if (!rows || !rows.length) return `<div class="empty">${esc(t("nothing_yet"))}</div>`;
    const animate = opts && opts.animateNew;
    const prime = opts && opts.prime;
    return rows.map((r) => {
      const id = String(r.id != null ? r.id : (r.ts || "") + "|" + (r.kind || "") + "|" + (r.mint || ""));
      const isNew = animate && activityPrimed && !seenActivity.has(id);
      if (prime || animate || !activityPrimed) seenActivity.add(id);
      const tone = valueTone(r.value, r.kind);
      const trade = r.kind === "bought" || r.kind === "sold" || r.kind === "stopped";
      const title = trade ? tradeTitle(r) : (r.title || "");
      const sub = trade ? (tradeReason(r) + (fmtParis(r.ts) ? " · " + fmtParis(r.ts) : "")) : localizeServer(r.subtitle || "");
      return `<div class="row${isNew ? " fresh" : ""}" data-open="${r.open||"coin"}" data-mint="${r.mint||""}" data-id="${esc(id)}">
        ${logoHtml(r.logo_url, r.symbol || r.name || r.title)}
        <div class="mid"><div class="t">${esc(title)}</div><div class="s">${esc(sub)}</div></div>
        <div class="right ${tone}">${esc(r.value||"")}</div>
      </div>`;
    }).join("");
  }

  function renderAgents() {
    const agents = (state.data && state.data.agents) || [];
    if (!state.agentDecisions) state.agentDecisions = {};
    app.innerHTML = `<div class="screen-head"><h1>${esc(t("agents"))}</h1>${langToggleHtml()}</div>` +
      agents.map(a => {
        const on = a.status !== "paused";
        const decs = (state.agentDecisions[a.name] || []).map(d =>
          `<div class="dec"><span>${fmtTime(d.ts)} · <a href="${d.coin_url||"#"}" target="_blank" rel="noopener">${esc(d.name||d.mint||"")}</a></span>
           <span>${esc(d.verdict)} · ${esc(localizeServer(d.reason||""))}</span></div>`
        ).join("") || `<div class="empty" style="padding:12px">${esc(t("no_decisions"))}</div>`;
        return `<section class="agent-full">
          <div class="agent-head">
            <i class="status-dot ${on?"":"off"}"></i>
            <strong>${a.name}</strong>
            <span class="meta" style="color:var(--secondary);font-size:13px">${esc(localizeServer(a.subtitle||""))}</span>
            <button class="switch ${on?"on":""}" data-agent="${a.name}" ${a.name==="Risk"&&!on?"":""}><i></i></button>
          </div>
          <div class="decisions">${decs}</div>
        </section>`;
      }).join("");
    bindLangToggle();
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
    app.innerHTML = `<div class="screen-head"><h1>${esc(t("activity"))}</h1>${langToggleHtml()}</div>
      <div class="list">${activityRows(state.activity)}</div>`;
    bindLangToggle();
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
    app.innerHTML = `<div class="screen-head"><h1>${esc(t("account"))}</h1>${langToggleHtml()}</div>
      <div class="mode-row">
        <button data-m="PAPER" class="${state.mode==="PAPER"?"on":""}">PAPER</button>
        <button data-m="LIVE" class="${state.mode==="LIVE"?"on":""}">LIVE</button>
      </div>
      <div class="group">
        <div class="setting"><label>${esc(t("language"))}${langToggleHtml()}</label></div>
        <div class="setting"><label>${esc(t("stack_paper"))}</label>
          <input type="number" id="stackField" value="${(acc&&acc.paper_start_stack)||200}"></div>
        <a class="row" id="fomoProfile" href="${(acc&&acc.profile_url)||"#"}" target="_blank" rel="noopener">
          <div class="mid"><div class="t">${esc(t("your_fomo_profile"))}</div><div class="s">${esc((acc&&acc.fomo_handle)||"")}</div></div>
        </a>
        <button class="row" id="invite"><div class="mid"><div class="t">${esc(t("invite_friend"))}</div>
          <div class="s">${esc(t("share_fomo_link"))}</div></div></button>
      </div>
      ${groups.map(g => `<div class="section"><h2>${g}</h2></div><div class="group">
        ${Object.entries(s[g]).map(([k,v]) => settingRow(g,k,v, settings.meta?.[g]?.[k])).join("")}
      </div>`).join("")}
      <div class="group">
        <div class="row"><div class="mid"><div class="t">${esc(t("telegram"))}</div>
          <div class="s">${acc&&acc.telegram ? esc(t("connected")) : esc(t("not_connected"))}</div></div></div>
        <button class="row" id="testPush"><div class="mid"><div class="t">${esc(t("send_test_notif"))}</div></div></button>
      </div>`;
    bindLangToggle();
    $(".mode-row button").forEach(b => b.onclick = () => switchMode(b.dataset.m));
    $("#invite").onclick = invite;
    $("#testPush").onclick = async () => {
      try { await api("/api/test-push", { method: "POST" }); alert(t("sent")); }
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
      const typed = prompt(t("type_live"));
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
    try { await navigator.clipboard.writeText(url); alert(t("link_copied")); }
    catch (e) { alert(url); }
  }

  let coinLive = { timer: null, chart: null, series: null, mint: null, range: "15m" };

  function stopCoinLive() {
    if (coinLive.timer) { clearInterval(coinLive.timer); coinLive.timer = null; }
    if (coinLive.chart) {
      try { coinLive.chart.remove(); } catch (e) {}
      coinLive.chart = null;
      coinLive.series = null;
    }
    coinLive.mint = null;
  }

  function candleTime(ts) {
    if (ts == null) return null;
    if (typeof ts === "number") return Math.floor(ts > 1e12 ? ts / 1000 : ts);
    const s = String(ts);
    const d = new Date(s.length === 16 ? s + ":00Z" : s);
    const sec = Math.floor(d.getTime() / 1000);
    return Number.isFinite(sec) ? sec : null;
  }

  function snapshotCandles(c) {
    return (c.candles || []).map((x) => {
      const time = candleTime(x.ts || x.time);
      if (time == null) return null;
      return { time, open: +x.o, high: +x.h, low: +x.l, close: +x.c };
    }).filter((x) => x && Number.isFinite(x.open) && Number.isFinite(x.close));
  }

  async function fetchDexToken(mint) {
    const r = await fetch("https://api.dexscreener.com/latest/dex/tokens/" + encodeURIComponent(mint), { cache: "no-store" });
    if (!r.ok) throw new Error("dex");
    const d = await r.json();
    const pairs = (d && d.pairs) || (Array.isArray(d) ? d : []);
    const priced = (arr) => arr.filter((p) => p.priceUsd);
    const asBase = (arr) => arr.filter((p) => ((p.baseToken || {}).address === mint));
    const sol = priced(pairs.filter((p) => (p.chainId || "").toLowerCase() === "solana"));
    let pool = asBase(sol.length ? sol : priced(pairs));
    if (!pool.length) return null;
    pool.sort((a, b) => Number((b.liquidity || {}).usd || 0) - Number((a.liquidity || {}).usd || 0));
    const best = pool[0];
    if (!best) return null;
    return {
      price: Number(best.priceUsd),
      market_cap: Number(best.marketCap || best.fdv || 0) || null,
      liquidity: Number((best.liquidity || {}).usd || 0) || null,
      volume_h24: Number((best.volume || {}).h24 || 0) || null,
      change_h24: best.priceChange && best.priceChange.h24 != null ? Number(best.priceChange.h24) : null,
      pool: best.pairAddress,
      name: (best.baseToken || {}).name,
      symbol: (best.baseToken || {}).symbol,
      logo: (best.info || {}).imageUrl,
    };
  }

  async function fetchOhlcv(pool, range) {
    const map = {
      "1m": ["minute", 1], "5m": ["minute", 5], "15m": ["minute", 15],
      "1H": ["hour", 1], "4H": ["hour", 4], "1D": ["day", 1],
    };
    const [tf, agg] = map[range] || ["minute", 15];
    const url = "https://api.geckoterminal.com/api/v2/networks/solana/pools/"
      + encodeURIComponent(pool) + "/ohlcv/" + tf + "?aggregate=" + agg + "&limit=200";
    const r = await fetch(url, { cache: "no-store", headers: { Accept: "application/json" } });
    if (!r.ok) throw new Error("ohlcv");
    const d = await r.json();
    const list = (((d || {}).data || {}).attributes || {}).ohlcv_list || [];
    return list.map((row) => ({
      time: Math.floor(Number(row[0])),
      open: Number(row[1]),
      high: Number(row[2]),
      low: Number(row[3]),
      close: Number(row[4]),
    })).filter((x) => Number.isFinite(x.time) && Number.isFinite(x.open));
  }

  function applyCoinMarkers(series, markers) {
    if (!series || !markers || !markers.length) return;
    const mapped = markers.map((m) => {
      const time = candleTime(m.ts || m.time);
      if (time == null) return null;
      const buy = (m.side || "") === "buy";
      return {
        time,
        position: buy ? "belowBar" : "aboveBar",
        color: buy ? "#00d35a" : "#ff453a",
        shape: buy ? "arrowUp" : "arrowDown",
        text: buy ? t("buy_mark") : t("sell_mark"),
      };
    }).filter(Boolean).sort((a, b) => a.time - b.time);
    try { series.setMarkers(mapped); } catch (e) {}
  }

  function ensureCoinChart(candles, markers) {
    const el = $("#tvChart");
    if (!el || typeof LightweightCharts === "undefined") return false;
    if (!coinLive.chart) {
      coinLive.chart = LightweightCharts.createChart(el, {
        layout: { background: { color: "#000000" }, textColor: "rgba(235,235,245,0.6)", fontFamily: "-apple-system, BlinkMacSystemFont, sans-serif" },
        grid: { vertLines: { color: "rgba(84,84,88,0.22)" }, horzLines: { color: "rgba(84,84,88,0.22)" } },
        rightPriceScale: { borderColor: "rgba(84,84,88,0.35)", scaleMargins: { top: 0.12, bottom: 0.08 } },
        timeScale: { borderColor: "rgba(84,84,88,0.35)", timeVisible: true, secondsVisible: false },
        crosshair: { mode: 0 },
        width: el.clientWidth || el.parentElement.clientWidth,
        height: 280,
        handleScroll: { mouseWheel: false, pressedMouseMove: true, horzTouchDrag: true, vertTouchDrag: false },
        handleScale: { pinch: true, mouseWheel: false },
      });
      coinLive.series = coinLive.chart.addCandlestickSeries({
        upColor: "#00d35a", downColor: "#ff453a",
        wickUpColor: "#00d35a", wickDownColor: "#ff453a",
        borderVisible: false,
      });
      const ro = new ResizeObserver(() => {
        if (!coinLive.chart) return;
        const w = el.clientWidth;
        if (w) coinLive.chart.applyOptions({ width: w });
      });
      ro.observe(el);
      coinLive._ro = ro;
    }
    if (candles && candles.length) {
      const seen = new Set();
      const data = candles.filter((c) => {
        if (seen.has(c.time)) return false;
        seen.add(c.time);
        return true;
      }).sort((a, b) => a.time - b.time);
      coinLive.series.setData(data);
      applyCoinMarkers(coinLive.series, markers);
      coinLive.chart.timeScale().fitContent();
    }
    return true;
  }

  async function tickCoin(mint, c) {
    const pos = c && c.position;
    try {
      const dex = await fetchDexToken(mint);
      if (dex) {
        const priceEl = $("#coinPrice");
        if (priceEl) priceEl.textContent = fmtPrice(dex.price);
        if (pos && pos.entry_price && dex.price) {
          const since = ((dex.price / Number(pos.entry_price)) - 1) * 100;
          const el = $("#coinSince");
          if (el) {
            el.className = "sub " + (since >= 0 ? "up" : "down");
            el.textContent = arrow(since) + " " + fmtPct(since) + " " + t("since_entry");
          }
          const pnl = Number(pos.size_usd || 0) * (dex.price / Number(pos.entry_price) - 1);
          const pnlEl = $("#posPnl");
          if (pnlEl) {
            pnlEl.className = "v num " + (pnl >= 0 ? "up" : "down");
            pnlEl.textContent = signedMoney(pnl) + " (" + fmtPct(since) + ")";
          }
          const curEl = $("#posNow");
          if (curEl) curEl.textContent = fmtPrice(dex.price);
        }
        const chg = $("#coinChg");
        if (chg && dex.change_h24 != null) {
          chg.className = "chg " + (dex.change_h24 >= 0 ? "up" : "down");
          chg.textContent = arrow(dex.change_h24) + " " + fmtPct(dex.change_h24) + " 24h";
        }
        const set = (id, val) => { const n = document.getElementById(id); if (n) n.textContent = val; };
        set("statMcap", nusd(dex.market_cap));
        set("statLiq", nusd(dex.liquidity));
        set("statVol", nusd(dex.volume_h24));
        try {
          const ohlcv = await fetchOhlcv(dex.pool, coinLive.range);
          if (ohlcv && ohlcv.length) ensureCoinChart(ohlcv, (c && c.markers) || []);
        } catch (e) {}
      }
    } catch (e) {}
  }

  async function renderCoin() {
    const mint = state.mint;
    let c;
    try { c = await api("/api/coin/" + mint); } catch (e) { app.innerHTML = `<div class="empty">${e.message}</div>`; return; }
    const pos = c.position;
    const since = c.since_entry;
    const sinceUp = since == null ? true : since >= 0;
    const chg = c.stats && c.stats.change_h24;
    const stat = c.stats || {};
    const fallback = snapshotCandles(c);
    app.innerHTML = `<div class="screen-head">
        <button class="back" id="back"><svg viewBox="0 0 24 24"><path d="M15 5l-7 7 7 7"/></svg></button>
        <div class="coin-head">
          ${logoHtml(c.logo_url, c.name || c.symbol)}
          <div>
            <h1>${esc(c.symbol || c.name)} ${state.mode==="PAPER"?'<span class="pill paper">PAPER</span>':""}</h1>
            <div class="coin-subname">${esc(c.name || "")} · Solana</div>
          </div>
        </div>
        ${c.shield ? `<span class="chip">${c.shield}</span>` : ""}
        ${langToggleHtml()}
      </div>
      <div class="display big-price num" id="coinPrice">${c.price!=null?fmtPrice(c.price): "—"}</div>
      <div class="chg-row">
        <div class="sub ${sinceUp?"up":"down"}" id="coinSince">${since!=null?(arrow(since)+" "+fmtPct(since)+" "+t("since_entry")):""}</div>
        <div class="chg ${chg>=0?"up":"down"}" id="coinChg">${chg!=null?(arrow(chg)+" "+fmtPct(chg)+" 24h"):""}</div>
      </div>
      <div class="ranges" id="coinRanges">
        ${["1m","5m","15m","1H","4H","1D"].map((r) =>
          `<button data-r="${r}" class="${(coinLive.range||"15m")===r?"on":""}">${r}</button>`).join("")}
      </div>
      <div class="chart-wrap coin-chart">
        <div id="tvChart" style="width:100%;height:280px"></div>
        <canvas id="coinChart" class="hidden" style="width:100%;height:220px"></canvas>
      </div>
      <div class="stats">
        <div class="stat"><div class="k">Market cap</div><div class="v num" id="statMcap">${nusd(stat.market_cap)}</div></div>
        <div class="stat"><div class="k">${esc(t("liquidity"))}</div><div class="v num" id="statLiq">${nusd(stat.liquidity)}</div></div>
        <div class="stat"><div class="k">Volume 24h</div><div class="v num" id="statVol">${nusd(stat.volume_h24)}</div></div>
        <div class="stat"><div class="k">Holders</div><div class="v num" id="statHold">${stat.holders==null?"n/a":stat.holders}</div></div>
      </div>
      ${pos ? `<div class="pos-card">
        <div class="pos-title">${esc(t("your_paper_pos"))}${pos.copy_trader ? t("copy_dot") + esc(prettyTrader(pos.copy_trader)) : ""}</div>
        <div class="pos-grid">
          <div><div class="k">${esc(t("staked"))}</div><div class="v num">${money(pos.size_usd)}</div></div>
          <div><div class="k">${esc(t("entry"))}</div><div class="v num">${fmtPrice(pos.entry_price)}</div></div>
          <div><div class="k">${esc(t("current"))}</div><div class="v num" id="posNow">${fmtPrice(c.price)}</div></div>
          <div><div class="k">P&amp;L</div><div class="v num ${sinceUp?"up":"down"}" id="posPnl">${since!=null?(signedMoney((pos.size_usd||0)*((c.price||pos.entry_price)/pos.entry_price-1))+" ("+fmtPct(since)+")"):"—"}</div></div>
        </div>
        <div class="s pos-stop">${
          (pos.strategy === "copy" || pos.copy_trader)
            ? esc(localizeServer(c.exit_label) || t("exit_when_sells", { trader: prettyTrader(pos.copy_trader) || t("the_trader"), pct: "-" + (c.copy_safety_stop_pct != null ? c.copy_safety_stop_pct : 30) + "%" }))
            : ("Stop " + fmtPrice(pos.stop_price) + (c.trail_line ? " · trail " + fmtPrice(c.trail_line) : "") + (c.timeout_left_s!=null?" · "+t("m_left", { m: Math.round(c.timeout_left_s/60) }):""))
        }</div>
      </div>` : ""}
      <a class="cta" href="${c.coin_url}" target="_blank" rel="noopener">${pos ? t("sell_on_fomo") : t("buy_on_fomo")}</a>`;
    bindLangToggle();
    $("#back").onclick = () => { stopCoinLive(); state.screen = "home"; render(); };
    const ranges = $("#coinRanges");
    if (ranges) ranges.onclick = (e) => {
      const b = e.target.closest("button");
      if (!b) return;
      coinLive.range = b.dataset.r;
      ranges.querySelectorAll("button").forEach((x) => x.classList.toggle("on", x === b));
      tickCoin(mint, c);
    };
    const usedTv = ensureCoinChart(fallback, c.markers || []);
    if (!usedTv) {
      const canvas = $("#coinChart");
      if (canvas) {
        canvas.classList.remove("hidden");
        const tv = $("#tvChart"); if (tv) tv.classList.add("hidden");
        if (typeof DeskCharts !== "undefined") DeskCharts.drawCandles(canvas, c.candles, c.exit_line);
      }
    }
    if (coinLive.timer) { clearInterval(coinLive.timer); coinLive.timer = null; }
    coinLive.mint = mint;
    tickCoin(mint, c);
    coinLive.timer = setInterval(() => tickCoin(mint, c), 6000);
  }

  async function renderAuditor() {
    const mint = state.mint;
    let a;
    try { a = await api("/api/audit/" + mint); } catch (e) { app.innerHTML = `<div class="empty">${e.message}</div>`; return; }
    if (!a.layers.length) {
      app.innerHTML = `<div class="screen-head"><button class="back" id="back"><svg viewBox="0 0 24 24"><path d="M15 5l-7 7 7 7"/></svg></button><h1>Auditor</h1>${langToggleHtml()}</div>
        <div class="empty">${esc(t("no_audited"))}</div>`;
      bindLangToggle();
      $("#back").onclick = () => { state.screen = "home"; render(); };
      return;
    }
    const layers = a.layers.map(l =>
      `<div class="disc ${l.pass?"ok":"bad"}"><span class="n">${l.n}</span>
        <div class="mid"><div class="t">${esc(l.name)}</div><div class="s">${esc(l.value)}</div></div>
        <span class="mark">${l.pass ? "✓" : "✗"}</span></div>`
    ).join("");
    const n = (a.layers && a.layers.length) || 9;
    const foot = a.passed
      ? t("passed_sent", { n })
      : t("rejected_wont_buy", { reason: esc(a.reason||""), name: esc(a.name) });
    app.innerHTML = `<div class="screen-head">
        <button class="back" id="back"><svg viewBox="0 0 24 24"><path d="M15 5l-7 7 7 7"/></svg></button>
        <h1>${esc(a.name)}</h1>${langToggleHtml()}</div>
      <div class="discs">${layers}</div>
      <div class="pad" style="padding:16px">${foot}</div>
      <a class="cta" href="${a.coin_url}" target="_blank" rel="noopener">${t("open_on_fomo")}</a>`;
    bindLangToggle();
    $("#back").onclick = () => { state.screen = "home"; render(); };
  }

  function renderSearch() {
    app.innerHTML = `<div class="screen-head"><button class="back" id="back"><svg viewBox="0 0 24 24"><path d="M15 5l-7 7 7 7"/></svg></button><h1>Search</h1>${langToggleHtml()}</div>
      <div class="search-box"><input id="q" placeholder="Name, symbol or mint"></div>
      <div class="list" id="sres"></div>`;
    bindLangToggle();
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
      ).join("") || `<div class="empty">${esc(t("no_match"))}</div>`;
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
  function hideEquityTip() {
    const tip = $("#equityTip");
    if (tip) tip.classList.add("hidden");
  }
  function showEquityTip(canvas, hit) {
    const tip = $("#equityTip");
    if (!tip) return;
    if (!hit) { tip.classList.add("hidden"); return; }
    const cls = hit.kind === "bought" ? "up" : "down";
    const val = hit.value ? " · " + hit.value : "";
    tip.innerHTML = `<span class="${cls}">●</span> ${esc(hit.label || "")}${esc(val)}`;
    tip.classList.remove("hidden");
    const wrap = canvas.parentElement;
    const wRect = wrap.getBoundingClientRect();
    const cRect = canvas.getBoundingClientRect();
    const x = cRect.left - wRect.left + hit.x;
    const y = cRect.top - wRect.top + hit.y;
    tip.style.left = x + "px";
    tip.style.top = y + "px";
    const tipW = tip.offsetWidth || 80;
    const maxL = (wrap.clientWidth || wRect.width) - tipW / 2 - 8;
    const minL = tipW / 2 + 8;
    if (x > maxL) tip.style.left = maxL + "px";
    if (x < minL) tip.style.left = minL + "px";
  }
  function bindHomeChartTaps(canvas) {
    if (canvas._boundMarks) return;
    canvas._boundMarks = true;
    const pick = (ev) => {
      const hits = canvas._markHits || [];
      if (!hits.length) { hideEquityTip(); return; }
      const src = (ev.changedTouches && ev.changedTouches[0]) || (ev.touches && ev.touches[0]) || ev;
      const rect = canvas.getBoundingClientRect();
      const x = src.clientX - rect.left;
      const y = src.clientY - rect.top;
      let best = null, bestD = 28;
      hits.forEach((h) => {
        const d = Math.hypot(h.x - x, h.y - y);
        if (d < bestD) { best = h; bestD = d; }
      });
      if (best) {
        if (ev.cancelable) ev.preventDefault();
        ev.stopPropagation();
        showEquityTip(canvas, best);
      } else {
        hideEquityTip();
      }
    };
    canvas.addEventListener("click", pick);
    canvas.addEventListener("touchend", pick, { passive: false });
  }
  function drawHomeChart() {
    const canvas = $("#homeChart");
    if (!canvas) return;
    hideEquityTip();
    if (app.querySelector(".term-chart") && typeof DeskCharts !== "undefined" && DeskCharts.drawEquityFrame) {
      if (!equityAnim.raf) startEquity();
      bindHomeChartTaps(canvas);
      return;
    }
    DeskCharts.drawLineChart(canvas, chartCache.points || [], chartCache.marks || [], chartCache.start);
    bindHomeChartTaps(canvas);
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
      showError(t("missing_link"));
      app.innerHTML = `<div class="empty">${esc(t("open_private_link"))}</div>`;
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
      if (state.screen === "home" && state.tab === "home" && app.querySelector(".term-equity") && $("#bal"))
        patchHome();
      else if (state.screen === "home" && (state.tab === "home" || state.tab === "agents" || state.tab === "activity"))
        render();
      else if (state.tab === "home" && state.screen === "home") render();
    } catch (e) {
      const n = 3;
      showError(t("desk_offline", { n, time: new Date(state.lastOk).toLocaleTimeString(localeTag()) }));
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
    try { return new Date(ts).toLocaleTimeString(localeTag(), { hour: "2-digit", minute: "2-digit", hour12: false }); }
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
  applyTabLabels();
  highlightTab();
  render();
  refresh();
  loadChart();
  startSSE();
  setInterval(refresh, staticMode ? 20000 : 15000);
  setInterval(loadChart, staticMode ? 30000 : 20000);
})();
