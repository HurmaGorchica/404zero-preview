// Радио 404 — общий эфир без сервера. Порядок треков случайный, но одинаковый у всех слушателей: он выводится из часов.
// Эфир идёт блоками: блок = все треки в перемешанном порядке, номер блока от EPOCH — семя перемешивания.
// Кто включил — попадает в середину того, что сейчас звучит у всех. Выключить = выключить приёмник: при включении снова прямой эфир.
// Следующий трек играет с начала; если слушатель отстал больше чем на 20 с (вкладка спала, сеть), он возвращается в эфир по часам.
// Список треков — radio/list.js (собирает _build/make_radio.py). Звук без Web Audio, как signal.js; с шумом сигнала не смешивается.
// Потом эфир можно перевести на настоящую станцию (поток Icecast/AzuraCast): кнопка и экран блокировки останутся те же.
(function () {
  const T = window.RADIO && window.RADIO.tracks;
  if (!T || !T.length) return;
  const root = window.SIGNAL_ROOT || "../";
  const EPOCH = Date.UTC(2026, 10, 1) / 1000, LEN = T.reduce((s, t) => s + t.d, 0);
  const now = () => Date.now() / 1000;

  // Перемешивание с семенем (mulberry32 + Фишер — Йейтс). Стык блоков без повтора одного трека подряд.
  const rnd = s => () => { s = (s + 0x6D2B79F5) | 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  const shuffle = b => { const r = rnd(Math.imul(b, 2654435761)), o = T.map((_, i) => i);
    for (let i = o.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [o[i], o[j]] = [o[j], o[i]]; } return o; };
  const order = b => { const o = shuffle(b), p = shuffle(b - 1); if (o.length > 2 && o[0] === p[p.length - 1]) [o[0], o[1]] = [o[1], o[0]]; return o; };
  // Что звучит в момент x: блок b, место k в блоке, трек i
  function at(x) {
    const s = x - EPOCH, b = Math.floor(s / LEN), o = order(b); let off = s - b * LEN, k = 0;
    while (k < o.length - 1 && off >= T[o[k]].d) off -= T[o[k++]].d;
    return { b, k, i: o[k] };
  }
  const startOf = p => { const o = order(p.b); let s = EPOCH + p.b * LEN; for (let j = 0; j < p.k; j++) s += T[o[j]].d; return s; };
  const next = p => { const o = order(p.b); return p.k + 1 < o.length ? { b: p.b, k: p.k + 1, i: o[p.k + 1] } : { b: p.b + 1, k: 0, i: order(p.b + 1)[0] }; };

  const a = new Audio(); a.preload = "none";
  let on = false, cur = null, live = false, tuning = false, fails = 0;

  function load(p, isLive) {
    cur = p; live = isLive; tuning = true;
    a.src = root + T[p.i].src; ui(); meta();
    a.play().catch(e => { if (e && e.name === "NotAllowedError") stop(); });
  }
  function start() {
    if (on) return; on = true; fails = 0;
    if (window.SIGNAL_MUTE) window.SIGNAL_MUTE();       // шум сигнала и радио вместе не звучат
    load(at(now()), true);
  }
  function stop() {
    on = false; tuning = false; a.pause(); a.removeAttribute("src"); a.load(); ui();
    if ("mediaSession" in navigator) navigator.mediaSession.playbackState = "none";
  }
  // В прямом эфире — сразу в нужное место трека (сервер должен отдавать файлы кусками: GitHub Pages и Heroku умеют)
  a.addEventListener("loadedmetadata", () => {
    if (!on || !live) return;
    const off = now() - startOf(cur);
    if (off >= T[cur.i].d - 1) return load(at(now()), true);   // пока грузилось, трек в эфире кончился
    if (off > 1) a.currentTime = off;
  });
  a.addEventListener("playing", () => { tuning = false; fails = 0; ui(); });
  a.addEventListener("waiting", () => { if (on) { tuning = true; ui(); } });
  a.addEventListener("ended", () => {
    if (!on) return;
    const n = next(cur), late = now() - startOf(n);
    Math.abs(late) > 20 ? load(at(now()), true) : load(n, false);
  });
  a.addEventListener("error", () => {
    if (!on || !a.getAttribute("src")) return;
    if (++fails >= 3) return stop();                          // нет сети — выключаемся, а не перебираем треки
    setTimeout(() => on && load(next(cur), false), 1500);
  });
  // Пауза снаружи (звонок, наушники вынули) — приёмник выключен
  a.addEventListener("pause", () => { if (on && !a.ended && !tuning) { on = false; ui(); } });
  addEventListener("signal:sound", e => { if (e.detail && on) stop(); });

  // Экран блокировки и шторка телефона: название, альбом, обложка; пауза = выключить, play = снова в эфир
  function meta() {
    if (!("mediaSession" in navigator) || !window.MediaMetadata) return;
    const t = T[cur.i];
    navigator.mediaSession.metadata = new MediaMetadata({ title: t.title, artist: "404.zero", album: `${t.album} · 404 Radio`,
      artwork: [{ src: new URL(/^https?:/.test(t.cover) ? t.cover : root + t.cover, location.href).href, sizes: "512x512", type: "image/jpeg" }] });
    navigator.mediaSession.playbackState = "playing";
  }
  if ("mediaSession" in navigator) [["play", start], ["pause", stop], ["stop", stop], ["seekto", null], ["seekbackward", null], ["seekforward", null], ["previoustrack", null], ["nexttrack", null]]
    .forEach(([k, f]) => { try { navigator.mediaSession.setActionHandler(k, f); } catch (e) {} });

  // Кнопка-приёмник в шапке, рядом с логотипом. Любой элемент с data-radio на странице тоже включает и выключает эфир.
  const el = document.createElement("button");
  el.type = "button"; el.className = "radio"; el.innerHTML = `<i></i><span class="rl"></span><span class="rn"></span>`;
  (document.querySelector("header .logo") || document.body.firstChild).after(el);
  document.documentElement.classList.add("hasradio");
  el.onclick = () => on ? stop() : start();
  document.addEventListener("click", e => { if (e.target.closest("[data-radio]")) { e.preventDefault(); on ? stop() : start(); } });
  function ui() {
    const t = cur && T[cur.i];
    el.dataset.st = !on ? "off" : tuning ? "tune" : "air";
    el.setAttribute("aria-pressed", on);
    el.querySelector(".rl").textContent = !on ? "Radio" : tuning ? "Tuning…" : "On air";
    el.querySelector(".rn").textContent = on && t ? `${t.title} — ${t.album}` : "";
    el.title = on ? "Turn the radio off" : "404 Radio: our records on air, the same moment for everyone listening";
    el.setAttribute("aria-label", on ? `404 Radio on air: ${t ? t.title + ", " + t.album : ""}. Turn off` : "Turn on 404 Radio");
    document.documentElement.classList.toggle("onair", on);
  }
  ui();
  window.RADIO.audio = a;   // для проверки из консоли
  window.RADIO.now = () => { const p = at(now()), t = T[p.i]; return { title: t.title, album: t.album, left: Math.round(startOf(p) + t.d - now()) }; };
})();
