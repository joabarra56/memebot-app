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

  global.DeskCharts = { drawLineChart, drawCandles, drawScoreRing, nice };
})(window);
