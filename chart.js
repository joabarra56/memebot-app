/* Hand-drawn canvas charts. No chart library. */
(function (global) {
  function dpr(c) {
    const r = window.devicePixelRatio || 1;
    const w = c.clientWidth || c.width || 300;
    const h = c.clientHeight || c.height || 160;
    if (c.width !== Math.round(w * r) || c.height !== Math.round(h * r)) {
      c.width = Math.round(w * r);
      c.height = Math.round(h * r);
    }
    const ctx = c.getContext("2d");
    ctx.setTransform(r, 0, 0, r, 0, 0);
    return { ctx, w, h };
  }

  function nice(n) {
    if (n == null || Number.isNaN(n)) return "—";
    const a = Math.abs(n);
    if (a >= 1e6) return (n / 1e6).toFixed(2) + "M";
    if (a >= 1e3) return (n / 1e3).toFixed(1) + "K";
    if (a >= 1) return n.toFixed(2);
    if (a >= 0.0001) return n.toPrecision(4);
    return n.toExponential(2);
  }

  function drawLineChart(canvas, points, marks, startValue) {
    const { ctx, w, h } = dpr(canvas);
    ctx.clearRect(0, 0, w, h);
    if (!points || points.length === 0) {
      ctx.setLineDash([5, 5]);
      ctx.strokeStyle = "rgba(235,235,245,0.3)";
      ctx.beginPath();
      ctx.moveTo(8, h * 0.65);
      ctx.lineTo(w - 8, h * 0.65);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = "rgba(235,235,245,0.6)";
      ctx.font = "14px -apple-system, BlinkMacSystemFont, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("Waiting for the first trade", w / 2, h * 0.65 - 14);
      return;
    }
    const ys = points.map((p) => +p.value);
    if (startValue != null) ys.push(+startValue);
    let min = Math.min.apply(null, ys);
    let max = Math.max.apply(null, ys);
    if (min === max) { min -= 1; max += 1; }
    const pad = (max - min) * 0.12;
    min -= pad; max += pad;
    const left = 8, right = w - 8, top = 18, bot = h - 10;
    const xAt = (i) => left + (i / Math.max(1, points.length - 1)) * (right - left);
    const yAt = (v) => bot - ((v - min) / (max - min)) * (bot - top);

    // dashed start
    if (startValue != null) {
      ctx.setLineDash([4, 4]);
      ctx.strokeStyle = "rgba(235,235,245,0.3)";
      ctx.beginPath();
      ctx.moveTo(left, yAt(startValue));
      ctx.lineTo(right, yAt(startValue));
      ctx.stroke();
      ctx.setLineDash([]);
    }

    ctx.beginPath();
    points.forEach((p, i) => {
      const x = xAt(i), y = yAt(+p.value);
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    });
    ctx.lineTo(xAt(points.length - 1), bot);
    ctx.lineTo(xAt(0), bot);
    ctx.closePath();
    const g = ctx.createLinearGradient(0, top, 0, bot);
    g.addColorStop(0, "rgba(0,211,90,0.28)");
    g.addColorStop(1, "rgba(0,211,90,0)");
    ctx.fillStyle = g;
    ctx.fill();

    ctx.beginPath();
    points.forEach((p, i) => {
      const x = xAt(i), y = yAt(+p.value);
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    });
    ctx.strokeStyle = "#00d35a";
    ctx.lineWidth = 2;
    ctx.stroke();

    // Buy / sell dots on the equity line. Labels are shown only on tap
    // (see bindHomeChartTaps in app.js) so they never stack at the right edge.
    const hits = [];
    const firstT = new Date(points[0].ts).getTime();
    const lastT = new Date(points[points.length - 1].ts).getTime();
    const valueAt = (ts) => {
      const t = new Date(ts).getTime();
      if (!Number.isFinite(t)) return +points[points.length - 1].value;
      if (t <= firstT) return +points[0].value;
      if (t >= lastT) return +points[points.length - 1].value;
      for (let i = 1; i < points.length; i++) {
        const t0 = new Date(points[i - 1].ts).getTime();
        const t1 = new Date(points[i].ts).getTime();
        if (t <= t1) {
          const r = t1 === t0 ? 0 : (t - t0) / (t1 - t0);
          return +points[i - 1].value + r * (+points[i].value - +points[i - 1].value);
        }
      }
      return +points[points.length - 1].value;
    };
    (marks || []).forEach((m) => {
      const t = new Date(m.ts).getTime();
      const r = lastT === firstT ? 1 : (t - firstT) / (lastT - firstT);
      const x = left + Math.min(1, Math.max(0, r)) * (right - left);
      const y = yAt(valueAt(m.ts));
      const buy = m.kind === "bought";
      ctx.beginPath();
      ctx.arc(x, y, 4.5, 0, Math.PI * 2);
      ctx.fillStyle = buy ? "#00d35a" : "#ff453a";
      ctx.fill();
      ctx.lineWidth = 1.5;
      ctx.strokeStyle = "#000";
      ctx.stroke();
      hits.push({
        x, y,
        kind: m.kind,
        label: m.label || "",
        value: m.value || "",
        mint: m.mint || "",
      });
    });
    canvas._markHits = hits;
    return hits;
  }

  function drawCandles(canvas, candles, exitLine) {
    const { ctx, w, h } = dpr(canvas);
    ctx.clearRect(0, 0, w, h);
    if (!candles || !candles.length) {
      ctx.fillStyle = "rgba(235,235,245,0.6)";
      ctx.font = "14px -apple-system, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("No candles yet", w / 2, h / 2);
      return;
    }
    const highs = candles.map((c) => c.h);
    const lows = candles.map((c) => c.l);
    let min = Math.min.apply(null, lows);
    let max = Math.max.apply(null, highs);
    if (exitLine != null) { min = Math.min(min, exitLine); max = Math.max(max, exitLine); }
    if (min === max) { min *= 0.99; max *= 1.01; }
    const pad = (max - min) * 0.08;
    min -= pad; max += pad;
    const volH = 36;
    const top = 8, bot = h - volH - 8, left = 8, right = w - 8;
    const n = candles.length;
    const slot = (right - left) / n;
    const body = Math.max(1.5, slot * 0.62);
    const yAt = (v) => bot - ((v - min) / (max - min)) * (bot - top);
    const maxV = Math.max.apply(null, candles.map((c) => c.v || 0)) || 1;

    if (exitLine != null) {
      ctx.setLineDash([5, 4]);
      ctx.strokeStyle = "#ff9f0a";
      ctx.beginPath();
      ctx.moveTo(left, yAt(exitLine));
      ctx.lineTo(right, yAt(exitLine));
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = "#ff9f0a";
      ctx.font = "11px -apple-system, sans-serif";
      ctx.textAlign = "left";
      ctx.fillText("Risk trailing stop", left + 4, yAt(exitLine) - 4);
    }

    candles.forEach((c, i) => {
      const x = left + i * slot + slot / 2;
      const up = c.c >= c.o;
      ctx.strokeStyle = up ? "#00d35a" : "#ff453a";
      ctx.fillStyle = up ? "#00d35a" : "#ff453a";
      ctx.beginPath();
      ctx.moveTo(x, yAt(c.h));
      ctx.lineTo(x, yAt(c.l));
      ctx.stroke();
      const y1 = yAt(Math.max(c.o, c.c));
      const y2 = yAt(Math.min(c.o, c.c));
      ctx.fillRect(x - body / 2, y1, body, Math.max(1, y2 - y1));
      const vh = ((c.v || 0) / maxV) * (volH - 6);
      ctx.globalAlpha = 0.55;
      ctx.fillRect(x - body / 2, h - 6 - vh, body, vh);
      ctx.globalAlpha = 1;
    });
  }

  function drawScoreRing(canvas, score, minScore) {
    const { ctx, w, h } = dpr(canvas);
    ctx.clearRect(0, 0, w, h);
    const cx = w / 2, cy = h / 2, r = Math.min(w, h) / 2 - 8;
    ctx.lineWidth = 8;
    ctx.strokeStyle = "#2c2c2e";
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.stroke();
    const s = score == null ? 0 : score;
    const col = s >= (minScore || 70) ? "#00d35a" : "#ffd60a";
    ctx.strokeStyle = col;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.arc(cx, cy, r, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * (s / 100));
    ctx.stroke();
    ctx.fillStyle = "#fff";
    ctx.font = "600 22px -apple-system, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(score == null ? "—" : String(score), cx, cy);
  }


  function parseTs(ts) {
    if (ts == null) return NaN;
    if (typeof ts === "number") return ts > 1e12 ? ts : ts * 1000;
    const t = new Date(ts).getTime();
    return t;
  }

  function drawEquityFrame(canvas, opts) {
    const { ctx, w, h } = dpr(canvas);
    ctx.clearRect(0, 0, w, h);
    const points = (opts && opts.points) || [];
    const marks = (opts && opts.marks) || [];
    const startValue = opts && opts.startValue;
    const t0 = opts && opts.t0;
    const t1 = opts && opts.t1;
    const drawUntil = (opts && opts.drawUntil != null) ? opts.drawUntil : t1;
    const yMin = opts && opts.yMin;
    const yMax = opts && opts.yMax;
    const up = opts && opts.up;
    const tipPhase = (opts && opts.tipPhase) || 0;
    const neon = up === false ? "#ff453a" : "#00ff6a";
    const glow = up === false ? "rgba(255,69,58,0.55)" : "rgba(0,255,106,0.55)";
    const fillTop = up === false ? "rgba(255,69,58,0.22)" : "rgba(0,255,106,0.22)";
    const left = 8, right = w - 8, top = 36, bot = h - 10;
    const spanT = (t1 - t0) || 1;
    const xAt = (t) => left + ((t - t0) / spanT) * (right - left);
    const spanY = (yMax - yMin) || 1;
    const yAt = (v) => bot - ((v - yMin) / spanY) * (bot - top);

    if (!points.length || !Number.isFinite(t0) || !Number.isFinite(t1)) {
      ctx.setLineDash([5, 5]);
      ctx.strokeStyle = "rgba(235,235,245,0.3)";
      ctx.beginPath();
      ctx.moveTo(left, h * 0.65);
      ctx.lineTo(right, h * 0.65);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = "rgba(235,235,245,0.6)";
      ctx.font = "13px -apple-system, BlinkMacSystemFont, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("En attente du premier mouvement", w / 2, h * 0.65 - 14);
      return { tip: null, marks: [] };
    }

    const pts = [];
    for (const p of points) {
      const t = parseTs(p.ts);
      if (!Number.isFinite(t)) continue;
      if (t < t0 - 1000) continue;
      if (drawUntil != null && t > drawUntil + 1) continue;
      pts.push({ t, v: +p.value });
    }
    if (!pts.length) return { tip: null, marks: [] };
    pts.sort((a, b) => a.t - b.t);
    // extend last value to the draw head (LIVE tip at "now")
    if (drawUntil != null && drawUntil > pts[pts.length - 1].t) {
      pts.push({ t: drawUntil, v: pts[pts.length - 1].v });
    }

    if (startValue != null && Number.isFinite(+startValue)) {
      ctx.setLineDash([4, 4]);
      ctx.strokeStyle = "rgba(235,235,245,0.22)";
      ctx.beginPath();
      ctx.moveTo(left, yAt(+startValue));
      ctx.lineTo(right, yAt(+startValue));
      ctx.stroke();
      ctx.setLineDash([]);
    }

    ctx.beginPath();
    pts.forEach((p, i) => {
      const x = xAt(p.t), y = yAt(p.v);
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    });
    const last = pts[pts.length - 1];
    ctx.lineTo(xAt(last.t), bot);
    ctx.lineTo(xAt(pts[0].t), bot);
    ctx.closePath();
    const g = ctx.createLinearGradient(0, top, 0, bot);
    g.addColorStop(0, fillTop);
    g.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = g;
    ctx.fill();

    ctx.save();
    ctx.beginPath();
    pts.forEach((p, i) => {
      const x = xAt(p.t), y = yAt(p.v);
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    });
    ctx.strokeStyle = neon;
    ctx.lineWidth = 2.2;
    ctx.shadowColor = glow;
    ctx.shadowBlur = 12;
    ctx.lineJoin = "round";
    ctx.lineCap = "round";
    ctx.stroke();
    ctx.restore();

    const tip = { x: xAt(last.t), y: yAt(last.v) };
    const pulse = 1 + 0.35 * Math.sin(tipPhase * Math.PI * 2);
    ctx.beginPath();
    ctx.arc(tip.x, tip.y, 10 * pulse, 0, Math.PI * 2);
    ctx.fillStyle = up === false ? "rgba(255,69,58,0.16)" : "rgba(0,255,106,0.16)";
    ctx.fill();
    ctx.beginPath();
    ctx.arc(tip.x, tip.y, 4.2, 0, Math.PI * 2);
    ctx.fillStyle = neon;
    ctx.shadowColor = glow;
    ctx.shadowBlur = 10;
    ctx.fill();
    ctx.shadowBlur = 0;

    const markPos = [];
    marks.forEach((m) => {
      const t = parseTs(m.ts);
      if (!Number.isFinite(t)) return;
      if (t < t0 || t > t1) return;
      if (drawUntil != null && t > drawUntil + 50) return;
      // value at mark time
      let v = pts[0].v;
      if (t <= pts[0].t) v = pts[0].v;
      else if (t >= pts[pts.length - 1].t) v = pts[pts.length - 1].v;
      else {
        for (let i = 1; i < pts.length; i++) {
          if (t <= pts[i].t) {
            const a = pts[i - 1], b = pts[i];
            const r = b.t === a.t ? 0 : (t - a.t) / (b.t - a.t);
            v = a.v + r * (b.v - a.v);
            break;
          }
        }
      }
      markPos.push({
        x: xAt(t), y: yAt(v),
        kind: m.kind, label: m.label || "", value: m.value || "",
        mint: m.mint || "", logo: m.logo_url || "", symbol: m.symbol || "",
        subtitle: m.subtitle || "", ts: m.ts,
        id: (m.kind || "") + "|" + (m.ts || "") + "|" + (m.mint || ""),
      });
    });
    // dots under pills
    markPos.forEach((m) => {
      const buy = m.kind === "bought";
      ctx.beginPath();
      ctx.arc(m.x, m.y, 3.2, 0, Math.PI * 2);
      ctx.fillStyle = buy ? "#00ff6a" : "#ff453a";
      ctx.fill();
      ctx.lineWidth = 1.2;
      ctx.strokeStyle = "#000";
      ctx.stroke();
    });
    return { tip, marks: markPos, width: w, height: h };
  }

  global.DeskCharts = { drawLineChart, drawCandles, drawScoreRing, drawEquityFrame, parseTs, nice };
})(window);
