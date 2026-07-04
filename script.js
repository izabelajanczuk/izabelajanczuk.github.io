/* ============================================================
   script.js — the behavior shared across every page
   - underlines the nav link for the page you're on
   - opens/closes the mobile menu
   - builds the Projects grid, a single Project page, and the
     Gallery masonry + the click-to-enlarge lightbox
   - shows a friendly placeholder when an image hasn't been
     added yet (so nothing ever looks broken)
   ============================================================ */

/* ---- a soft placeholder shown if an image file is missing ---- */
function placeholderSrc(label) {
  const svg =
    "<svg xmlns='http://www.w3.org/2000/svg' width='800' height='600'>" +
    "<rect width='100%' height='100%' fill='rgba(205,238,125,0.22)'/>" +
    "</svg>";
  return "data:image/svg+xml;utf8," + encodeURIComponent(svg);
}
// attach the fallback to an <img>
function withFallback(img, path) {
  const name = path.split("/").pop();
  img.addEventListener("error", function handle() {
    img.removeEventListener("error", handle);
    img.src = placeholderSrc(name);
  });
}

/* ---- highlight the current page in the nav ---- */
function markActiveNav() {
  let page = location.pathname.split("/").pop();
  if (page === "" ) page = "index.html";
  if (page === "project.html") page = "projects.html";   // detail page counts as Projects
  document.querySelectorAll(".nav a").forEach((a) => {
    if (a.getAttribute("href") === page) a.classList.add("active");
  });
}

/* ---- mobile menu open/close ---- */
function setupMenu() {
  const toggle = document.querySelector(".menu-toggle");
  const nav = document.querySelector(".nav");
  if (!toggle || !nav) return;
  toggle.addEventListener("click", () => {
    const open = nav.classList.toggle("open");
    toggle.textContent = open ? "×" : "☰";   // × or ☰
  });
}

/* ============================================================
   PROJECTS grid (runs only on projects.html)
   ============================================================ */
function buildProjectsGrid() {
  const grid = document.getElementById("projects-grid");
  if (!grid || typeof PROJECTS === "undefined") return;

  PROJECTS.forEach((p) => {
    const card = document.createElement("a");
    card.className = "project-card";
    // a project can point to its own custom page via "link"; otherwise the generic template
    card.href = p.link ? p.link : "project.html?p=" + encodeURIComponent(p.slug);

    const thumb = document.createElement("div");
    thumb.className = "thumb";
    const img = document.createElement("img");
    img.alt = p.title;
    withFallback(img, p.cover);
    img.src = p.cover;
    thumb.appendChild(img);

    const overlay = document.createElement("div");
    overlay.className = "project-overlay";
    overlay.textContent = p.title;

    card.appendChild(thumb);
    card.appendChild(overlay);
    grid.appendChild(card);
  });
}

/* ============================================================
   Single PROJECT page (runs only on project.html)
   reads ?p=slug from the address and shows that project
   ============================================================ */
function buildProjectDetail() {
  const root = document.getElementById("project-detail");
  if (!root || typeof PROJECTS === "undefined") return;

  const slug = new URLSearchParams(location.search).get("p");
  const p = PROJECTS.find((x) => x.slug === slug) || PROJECTS[0];

  const h1 = document.createElement("h1");
  h1.textContent = p.title;

  const blurb = document.createElement("p");
  blurb.className = "blurb";
  blurb.textContent = p.blurb;

  const body = document.createElement("div");
  body.className = "body";
  (p.body || []).forEach((para) => {
    const el = document.createElement("p");
    el.textContent = para;
    body.appendChild(el);
  });

  const shots = document.createElement("div");
  shots.className = "shots";
  (p.images || []).forEach((src) => {
    const img = document.createElement("img");
    img.alt = p.title;
    withFallback(img, src);
    img.src = src;
    shots.appendChild(img);
  });

  root.appendChild(h1);
  root.appendChild(blurb);
  root.appendChild(body);
  root.appendChild(shots);
  document.title = p.title + " — Izabela Janczuk";
}

/* ============================================================
   GALLERY masonry + lightbox (runs only on gallery.html)
   Photos are distributed round-robin across columns so each
   category group appears at the same scroll depth in all columns
   rather than filling column 1 entirely before starting column 2.
   ============================================================ */
function buildGallery() {
  const masonry = document.getElementById("gallery-masonry");
  if (!masonry || typeof GALLERY === "undefined") return;

  // column count matches CSS breakpoints
  const w = window.innerWidth;
  const numCols = w <= 480 ? 1 : w <= 900 ? 2 : 3;

  // create column containers
  const cols = [];
  for (let i = 0; i < numCols; i++) {
    const col = document.createElement("div");
    col.className = "masonry-col";
    masonry.appendChild(col);
    cols.push(col);
  }

  // distribute photos round-robin so groups stay visually together
  GALLERY.forEach((src, i) => {
    const img = document.createElement("img");
    img.alt = "Photograph " + (i + 1);
    img.loading = "lazy";
    withFallback(img, src);
    img.src = src;
    img.addEventListener("click", () => openLightbox(i));
    cols[i % numCols].appendChild(img);
  });

  // ---- the enlarged view with prev/next arrows ----
  const box = document.getElementById("lightbox");
  const big = document.getElementById("lightbox-img");
  let current = 0;

  function show(i) {
    current = (i + GALLERY.length) % GALLERY.length;
    big.src = GALLERY[current];
  }
  window.openLightbox = function (i) {
    show(i);
    box.classList.add("open");
  };
  function close() { box.classList.remove("open"); }

  document.querySelector(".lb-prev").addEventListener("click", () => show(current - 1));
  document.querySelector(".lb-next").addEventListener("click", () => show(current + 1));
  document.querySelector(".lb-close").addEventListener("click", close);
  box.addEventListener("click", (e) => { if (e.target === box) close(); });
  document.addEventListener("keydown", (e) => {
    if (!box.classList.contains("open")) return;
    if (e.key === "Escape") close();
    if (e.key === "ArrowLeft") show(current - 1);
    if (e.key === "ArrowRight") show(current + 1);
  });
}

/* ---- static images in the HTML get the same soft placeholder ---- */
function initStaticFallbacks() {
  document.querySelectorAll("img.ph-img").forEach((img) => {
    const name = (img.getAttribute("src") || "image").split("/").pop();
    function fix() { img.removeEventListener("error", fix); img.src = placeholderSrc(name); }
    img.addEventListener("error", fix);
    if (img.complete && img.naturalWidth === 0) fix();   // already failed before we attached
  });
}

/* ============================================================
   HOME — drag an image onto the page to set the background.
   The choice is remembered in this browser (localStorage), so it
   sticks when you come back. NOTE: this preview lives only in YOUR
   browser. To show the background to everyone who visits, the image
   also needs to be saved as images/home-bg.jpg (which is the file
   the page loads by default).
   ============================================================ */
function setupHomeDropzone() {
  const home = document.querySelector(".home");
  const bg = document.querySelector(".home-bg");
  const hint = document.getElementById("drop-hint");
  if (!home || !bg) return;

  // restore a previously dropped image
  try {
    const saved = localStorage.getItem("home-bg-image");
    if (saved) {
      bg.style.backgroundImage = "url(" + saved + ")";
      if (hint) hint.textContent = "Drag a new image here to replace your background";
    }
  } catch (e) {}

  ["dragenter", "dragover"].forEach((ev) =>
    home.addEventListener(ev, (e) => { e.preventDefault(); home.classList.add("dragover"); })
  );
  ["dragleave", "dragend", "drop"].forEach((ev) =>
    home.addEventListener(ev, () => home.classList.remove("dragover"))
  );

  home.addEventListener("drop", (e) => {
    e.preventDefault();
    const file = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
    if (!file || !file.type.startsWith("image/")) return;
    const reader = new FileReader();
    reader.onload = () => {
      const url = reader.result;
      bg.style.backgroundImage = "url(" + url + ")";
      try {
        localStorage.setItem("home-bg-image", url);
      } catch (err) {
        console.warn("That image is a bit large to remember in the browser — it's showing for now, but save it as images/home-bg.jpg to make it permanent.");
      }
      if (hint) hint.textContent = "Background set! Drag a new image to replace it.";
    };
    reader.readAsDataURL(file);
  });
}

/* ============================================================
   DRAG-AND-DROP IMAGE SLOTS (used on the EcoBite page)
   Each .drop-slot shows, in order of preference:
     1. an image you dragged in (remembered in this browser), or
     2. the committed file at its data-src (shown to all visitors), or
     3. a "drag an image here" hint.
   Drag an image file onto a slot to preview it instantly.
   ============================================================ */
function setupDropSlots() {
  document.querySelectorAll(".drop-slot").forEach((slot) => {
    const key = slot.dataset.key;
    const src = slot.dataset.src;
    const img = slot.querySelector("img");
    const hint = slot.querySelector(".slot-hint");

    function showImage(url) {
      img.src = url;
      img.style.display = "block";
      if (hint) hint.style.display = "none";
      slot.classList.add("filled");
    }
    function showHint() {
      img.style.display = "none";
      if (hint) hint.style.display = "";
      slot.classList.remove("filled");
    }

    // 1) a previously dropped image?  2) else the committed file?  3) else the hint
    let saved = null;
    try { saved = localStorage.getItem(key); } catch (e) {}
    if (saved) {
      showImage(saved);
    } else if (src) {
      img.onload = () => showImage(src);
      img.onerror = () => { img.onerror = null; showHint(); };
      img.src = src;
    }

    ["dragenter", "dragover"].forEach((ev) =>
      slot.addEventListener(ev, (e) => { e.preventDefault(); slot.classList.add("drag"); })
    );
    ["dragleave", "dragend", "drop"].forEach((ev) =>
      slot.addEventListener(ev, () => slot.classList.remove("drag"))
    );
    slot.addEventListener("drop", (e) => {
      e.preventDefault();
      const file = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
      if (!file || !file.type.startsWith("image/")) return;
      const reader = new FileReader();
      reader.onload = () => {
        try { localStorage.setItem(key, reader.result); }
        catch (err) { console.warn("Image too large to remember in browser; showing this session only."); }
        showImage(reader.result);
      };
      reader.readAsDataURL(file);
    });
  });
}

/* ---- run everything once the page is ready ---- */
document.addEventListener("DOMContentLoaded", () => {
  markActiveNav();
  setupMenu();
  initStaticFallbacks();
  buildProjectsGrid();
  buildProjectDetail();
  buildGallery();
  setupHomeDropzone();
  setupDropSlots();
});
