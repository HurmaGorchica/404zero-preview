// Общее для трёх макетов: данные, адреса страниц, мелкие помощники. Вид каждого варианта задаёт его VIEWS.
const D = window.SITE;
const $ = (s, r = document) => r.querySelector(s);
const esc = s => String(s ?? "").replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const img = (p, size = "img") => `../${size}/${p.id}.jpg`;

// Выбор из редактора витрин (edit.html) лежит в localStorage этого браузера и применяется поверх data.js
const EDIT_KEY = "404-site-v5-edit";
(function applyEdits() {
  let E = null;
  try { E = JSON.parse(localStorage.getItem(EDIT_KEY) || "null"); } catch (e) {}
  if (!E) { D.works = D.works.filter(w => !w.hidden); return; }  // выбор уже вшит в data.js (_build/bake_selection.py)
  const byId = Object.fromEntries(D.works.map(w => [w.id, w]));
  const order = (E.order || []).filter(id => byId[id]).concat(D.works.map(w => w.id).filter(id => !(E.order || []).includes(id)));
  D.works = order.map(id => byId[id]).filter(w => {
    const o = (E.works || {})[w.id]; if (!o) return !w.hidden;
    if ("featured" in o) w.featured = o.featured;
    if (o.cover || o.gallery) {
      const P = Object.fromEntries((D.pool[w.id] || []).map(([id, wd, h, by, v]) => [id, { id, w: wd, h, by, video: !!v }]));
      // Новые фото (D.fresh), которых не было, когда выбор сохраняли: встают сразу после витрины, пока их не разберут в edit.html (E.ack)
      const add = ((D.fresh || {})[w.id] || []).filter(i => !(E.ack || []).includes(i) && !(o.gallery || []).includes(i));
      // Кадры, которые Кристина попросила убрать по скринам (D.drop): уходят из сохранённой галереи, пока edit.html не отметит это в E.ack как "-id"
      const drop = ((D.drop || {})[w.id] || []).filter(i => !(E.ack || []).includes("-" + i));
      const gal = [...add, ...(o.gallery || [])].filter(i => !drop.includes(i));
      const cover = P[o.cover] ? o.cover : gal.find(i => P[i]) || w.images[0].id;
      const list = [cover, ...gal.filter(i => P[i] && i !== cover)];
      w.images = list.map(i => P[i] || w.images.find(x => x.id === i)).filter(Boolean);
      w.credits = [...new Set(w.images.map(x => x.by).filter(Boolean))].sort();
    }
    return !o.hidden;
  });
})();
addEventListener("storage", e => { if (e.key === EDIT_KEY) location.reload(); });

const work = id => D.works.find(w => w.id === id);
const cats = [...new Set(D.works.map(w => w.cat))];
const ext = (href, text, cls = "") => `<a class="${cls}" href="${esc(href)}" target="_blank" rel="noopener">${esc(text)}</a>`;
const pic = (p, cls = "", size = "img", alt = "") =>
  `<img class="${cls}" src="${img(p, size)}" width="${p.w}" height="${p.h}" style="width:100%" loading="lazy" decoding="async" alt="${esc(alt)}">`;
const NAV = [["works", "Works"], ["music", "Music"], ["publications", "Publications"], ["plugins", "Plugins"], ["contact", "Contact"]];

function route() {
  const [page, arg] = location.hash.replace(/^#\/?/, "").split("/");
  const p = VIEWS[page] ? page : "home";
  document.body.dataset.page = p;
  document.querySelectorAll("[data-nav]").forEach(a => a.classList.toggle("on", a.dataset.nav === p || (p === "work" && a.dataset.nav === "works")));
  $("#app").innerHTML = VIEWS[p](arg);
  scrollTo(0, 0);
  if (window.after) after(p, arg);
}
function start() { addEventListener("hashchange", route); route(); }
