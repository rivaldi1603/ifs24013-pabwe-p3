/**
 * Latihan JavaScript — Praktikum 3
 * Fitur: Expense Tracker, Bookmark Manager, Quiz App
 * Tab aktif disimpan lewat query URL (?tab=expense|bookmark|quiz)
 */

/* ========== UTILITAS ========== */
function $(selector) {
  return document.querySelector(selector);
}
function $all(selector) {
  return document.querySelectorAll(selector);
}

/** Cegah XSS saat menyisipkan teks user ke innerHTML */
function escapeHTML(str) {
  return String(str).replace(/[&<>'"]/g, (tag) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "'": "&#39;",
    '"': "&quot;",
  }[tag]));
}

/** Baca array/objek dari localStorage; kembalikan default jika kosong/rusak/salah tipe */
function loadData(key, defaultVal) {
  try {
    const raw = localStorage.getItem(key);
    if (raw === null) return defaultVal;
    const parsed = JSON.parse(raw);
    // Pastikan tipe data sama dengan default (mis. array tetap array)
    return Array.isArray(defaultVal) === Array.isArray(parsed) ? parsed : defaultVal;
  } catch {
    return defaultVal;
  }
}
function saveData(key, data) {
  localStorage.setItem(key, JSON.stringify(data));
}

function formatRupiah(number) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
  }).format(number);
}

/** Baca nilai field dengan aman (kembalikan "" jika elemen tidak ada di markup) */
function getFieldValue(selector) {
  return $(selector)?.value?.trim() ?? "";
}

/** Isi teks elemen dengan aman (dilewati jika elemen tidak ada) */
function setText(selector, text) {
  const el = $(selector);
  if (el) el.textContent = text;
}

/** Isi nilai field dengan aman (dilewati jika elemen tidak ada) */
function setFieldValue(selector, value) {
  const el = $(selector);
  if (el) el.value = value ?? "";
}

/** Buat tombol ikon (ubah/hapus) yang reusable dan aksesibel */
function createIconButton({ icon, label, className, onClick, action, id }) {
  const btn = document.createElement("button");
  btn.type = "button";
  // data-* dipakai untuk menemukan kembali tombol pemicu setelah daftar dirender ulang
  if (action) btn.dataset.action = action;
  if (id) btn.dataset.id = id;
  btn.className = className;
  btn.title = label;
  btn.setAttribute("aria-label", label);
  btn.innerHTML = `<i class="ti ${icon}"></i>`;
  btn.addEventListener("click", onClick);
  return btn;
}

/** Atur tampilan empty state vs daftar */
function toggleEmptyState(emptyEl, listEl, isEmpty) {
  if (emptyEl) emptyEl.classList.toggle("hidden", !isEmpty);
  if (listEl) listEl.classList.toggle("hidden", isEmpty);
}

/** Pesan "tidak ada yang cocok" untuk hasil pencarian/filter kosong */
function createNoMatchNode(tag, message, extraClass = "") {
  const el = document.createElement(tag);
  el.className = `rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600 ${extraClass}`;
  el.textContent = message;
  return el;
}

/** Notifikasi sukses singkat (toast); otomatis hilang, aman untuk pembaca layar */
function showToast(message) {
  let container = $("#toast-container");
  if (!container) {
    container = document.createElement("div");
    container.id = "toast-container";
    container.className = "fixed bottom-4 right-4 left-4 sm:left-auto z-[60] flex flex-col gap-2 items-end pointer-events-none";
    container.setAttribute("role", "status");
    container.setAttribute("aria-live", "polite");
    document.body.appendChild(container);
  }

  const toast = document.createElement("div");
  toast.className =
    "pointer-events-auto flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 text-emerald-800 px-4 py-3 text-sm font-medium shadow-lg transition-all duration-300 opacity-0 translate-y-2";
  toast.innerHTML = '<i class="ti ti-circle-check-filled text-lg"></i><span></span>';
  toast.lastChild.textContent = message;
  container.appendChild(toast);

  // Animasi masuk, lalu keluar setelah 2,5 detik
  requestAnimationFrame(() => toast.classList.remove("opacity-0", "translate-y-2"));
  setTimeout(() => {
    toast.classList.add("opacity-0", "translate-y-2");
    setTimeout(() => toast.remove(), 300);
  }, 2500);
}

/* ========== TAB SWITCHER (via URL Query) ========== */
const DEFAULT_TAB = "expense";
const tabButtons = $all(".tab-btn");
const panels = {
  expense: $("#panel-expense"),
  bookmark: $("#panel-bookmark"),
  quiz: $("#panel-quiz"),
};
const TAB_ACTIVE_CLASS = {
  expense: "bg-indigo-600",
  bookmark: "bg-emerald-600",
  quiz: "bg-violet-600",
};
const TAB_BASE_CLASS =
  "tab-btn flex-1 flex items-center justify-center gap-2 px-3 py-3 sm:py-2.5 rounded-lg text-sm font-semibold transition";

function getTabFromUrl() {
  const tab = new URLSearchParams(window.location.search).get("tab");
  return panels[tab] ? tab : DEFAULT_TAB;
}

/** updateUrl: "push" | "replace" | false */
function switchTab(name, updateUrl = "push") {
  if (!panels[name]) name = DEFAULT_TAB;

  Object.entries(panels).forEach(([key, panel]) => {
    if (panel) panel.classList.toggle("hidden", key !== name);
  });

  tabButtons.forEach((btn) => {
    const active = btn.dataset.tab === name;
    btn.setAttribute("aria-selected", String(active));
    btn.className = TAB_BASE_CLASS;
    if (active) btn.classList.add(TAB_ACTIVE_CLASS[name], "text-white", "shadow");
    else btn.classList.add("text-slate-600", "hover:bg-slate-100");
  });

  if (!updateUrl) return;
  try {
    const url = new URL(window.location);
    // Jangan menumpuk history jika tab yang diklik sudah aktif
    if (updateUrl === "push" && url.searchParams.get("tab") === name) return;
    url.searchParams.set("tab", name);
    window.history[updateUrl === "push" ? "pushState" : "replaceState"]({}, "", url);
  } catch {
    // History API bisa gagal di iframe/lingkungan terbatas
  }
}

tabButtons.forEach((btn) => {
  btn.addEventListener("click", () => switchTab(btn.dataset.tab));
});

// Tombol back/forward browser
window.addEventListener("popstate", () => switchTab(getTabFromUrl(), false));

/* ========== MODAL & VALIDASI GLOBAL ========== */

/** Tampilkan error inline; hilang saat user mengetik lagi atau submit berikutnya */
function showInlineError(formEl, message) {
  let errEl = formEl.querySelector(".inline-error-msg");
  if (!errEl) {
    errEl = document.createElement("div");
    errEl.className =
      "inline-error-msg col-span-full rounded-lg bg-rose-50 text-rose-600 px-3 py-2 text-sm border border-rose-200 mt-1 mb-2 flex items-center gap-2";
    errEl.setAttribute("role", "alert");
    formEl.insertBefore(errEl, formEl.firstChild);
  }
  errEl.innerHTML = '<i class="ti ti-alert-circle"></i><span></span>';
  errEl.lastChild.textContent = message;
  errEl.classList.remove("hidden");

  formEl.addEventListener("input", () => clearInlineError(formEl), { once: true });
}

function clearInlineError(formEl) {
  const errEl = formEl.querySelector(".inline-error-msg");
  if (errEl) errEl.classList.add("hidden");
}

/* --- Manajemen fokus modal --- */
const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';
let modalTrigger = null; // elemen pemicu, untuk mengembalikan fokus saat modal ditutup

function getFocusable(modal) {
  return [...modal.querySelectorAll(FOCUSABLE_SELECTOR)].filter((el) => el.offsetParent !== null || el === document.activeElement);
}

function openModal(modal) {
  if (!modal) return;
  const trigger = document.activeElement;
  modalTrigger = {
    el: trigger,
    // Selector cadangan: daftar dirender ulang setelah ubah, jadi tombol lama bisa terlepas dari DOM
    selector: trigger?.dataset?.action
      ? `[data-action="${trigger.dataset.action}"][data-id="${trigger.dataset.id}"]`
      : null,
  };

  modal.classList.remove("hidden");
  modal.classList.add("flex");
  document.body.classList.add("overflow-hidden");

  // Pindahkan fokus ke field/tombol pertama di dalam modal
  const first = modal.querySelector("input, select, textarea") || getFocusable(modal)[0];
  if (first) first.focus();
}

/** Kembalikan fokus ke pemicu; jika sudah hilang (mis. item dihapus) pakai tab aktif */
function restoreFocus() {
  if (!modalTrigger) return;
  const { el, selector } = modalTrigger;
  modalTrigger = null;

  const target =
    (el && el.isConnected && el) ||
    (selector && $(selector)) ||
    $(`.tab-btn[aria-selected="true"]`);
  if (target) target.focus();
}

function closeModal(modal) {
  if (!modal) return;
  const wasOpen = !modal.classList.contains("hidden");
  modal.classList.add("hidden");
  modal.classList.remove("flex");
  document.body.classList.remove("overflow-hidden");
  const form = modal.querySelector("form");
  if (form) clearInlineError(form);
  if (wasOpen) restoreFocus();
}

/** Focus trap: Tab/Shift+Tab berputar di dalam modal yang terbuka */
function trapFocus(e, modal) {
  const focusable = getFocusable(modal);
  if (focusable.length === 0) return;
  const first = focusable[0];
  const last = focusable[focusable.length - 1];
  const active = document.activeElement;

  if (e.shiftKey && (active === first || !modal.contains(active))) {
    e.preventDefault();
    last.focus();
  } else if (!e.shiftKey && (active === last || !modal.contains(active))) {
    e.preventDefault();
    first.focus();
  }
}

/* --- Builder modal ubah (satu template HTML, banyak modal) --- */

/** Kelas Tailwind per warna aksen (ditulis utuh agar terbaca oleh Tailwind) */
const MODAL_ACCENTS = {
  indigo: {
    icon: "text-indigo-600",
    ring: "focus:ring-indigo-500",
    button: "bg-indigo-600 hover:bg-indigo-700",
  },
  emerald: {
    icon: "text-emerald-600",
    ring: "focus:ring-emerald-500",
    button: "bg-emerald-600 hover:bg-emerald-700",
  },
};

const FIELD_LABEL_CLASS = "block text-sm font-medium text-slate-700 mb-1";
const FIELD_INPUT_CLASS = "w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2";

/**
 * Konfigurasi modal ubah. ID yang dihasilkan: modal-{prefix}, {prefix}-form, {prefix}-{key}.
 * Item fields berupa array = beberapa field dalam satu baris (grid 2 kolom).
 * optionsFrom = salin opsi <select> dari form tambah supaya daftar opsi tidak ditulis dua kali.
 */
const EDIT_MODAL_CONFIGS = [
  {
    prefix: "expense-edit",
    title: "Ubah Transaksi",
    accent: "indigo",
    fields: [
      { key: "title", label: "Judul", type: "text" },
      { key: "category", label: "Kategori", type: "select", optionsFrom: "#expense-category" },
      [
        { key: "amount", label: "Jumlah", type: "number", min: 1 },
        { key: "type", label: "Tipe", type: "select", optionsFrom: "#expense-type" },
      ],
      { key: "date", label: "Tanggal", type: "date" },
    ],
  },
  {
    prefix: "bookmark-edit",
    title: "Ubah Bookmark",
    accent: "emerald",
    fields: [
      { key: "title", label: "Judul", type: "text" },
      { key: "url", label: "URL", type: "url" },
      { key: "category", label: "Kategori", type: "text" },
      { key: "notes", label: "Catatan", type: "text", required: false },
    ],
  },
];

/** Buat satu field (label + input/select) */
function createModalField(prefix, field, accent) {
  const id = `${prefix}-${field.key}`;
  const wrap = document.createElement("div");

  const label = document.createElement("label");
  label.htmlFor = id;
  label.className = FIELD_LABEL_CLASS;
  label.textContent = field.label;

  let input;
  if (field.type === "select") {
    input = document.createElement("select");
    const source = field.optionsFrom ? $(field.optionsFrom) : null;
    if (source) {
      [...source.options]
        .filter((opt) => !opt.disabled) // lewati placeholder "Kategori..."
        .forEach((opt) => input.add(new Option(opt.text, opt.value)));
    }
  } else {
    input = document.createElement("input");
    input.type = field.type;
    if (field.min !== undefined) input.min = field.min;
  }
  input.id = id;
  input.required = field.required !== false;
  input.className = `${FIELD_INPUT_CLASS} ${accent.ring}`;

  wrap.append(label, input);
  return wrap;
}

/** Bangun modal dari template + konfigurasi, lalu tempel ke <body> */
function buildEditModal(template, config) {
  const accent = MODAL_ACCENTS[config.accent] || MODAL_ACCENTS.indigo;
  const root = template.content.firstElementChild;
  if (!root) return; // template kosong: lewati tanpa error
  const modal = root.cloneNode(true);
  const slot = (name) => modal.querySelector(`[data-slot="${name}"]`);

  modal.id = `modal-${config.prefix}`;
  modal.setAttribute("aria-labelledby", `${modal.id}-title`);

  // Setiap slot opsional: jika markup template berubah, bagian itu dilewati
  const title = slot("title");
  if (title) title.id = `${modal.id}-title`;
  const titleText = slot("title-text");
  if (titleText) titleText.textContent = config.title;
  slot("icon")?.classList.add(accent.icon);

  const form = modal.querySelector("form");
  if (form) form.id = `${config.prefix}-form`;
  ["close", "cancel"].forEach((name) => {
    const btn = slot(name);
    if (btn) btn.dataset.closeModal = config.prefix;
  });
  slot("submit")?.classList.add(...accent.button.split(" "));

  const fieldsWrap = slot("fields");
  if (!fieldsWrap) return;
  config.fields.forEach((item) => {
    if (Array.isArray(item)) {
      const row = document.createElement("div");
      row.className = "grid grid-cols-2 gap-4";
      item.forEach((f) => row.appendChild(createModalField(config.prefix, f, accent)));
      fieldsWrap.appendChild(row);
    } else {
      fieldsWrap.appendChild(createModalField(config.prefix, item, accent));
    }
  });

  document.body.appendChild(modal);
}

function mountEditModals() {
  const template = $("#tpl-edit-modal");
  if (!template) return;
  EDIT_MODAL_CONFIGS.forEach((config) => buildEditModal(template, config));
}
mountEditModals(); // harus sebelum listener tombol tutup di bawah

// Tombol tutup (X / Batal)
$all("[data-close-modal]").forEach((btn) => {
  btn.addEventListener("click", () => {
    const modal = $(`#modal-${btn.dataset.closeModal}`) || btn.closest("[role='dialog']");
    closeModal(modal);
  });
});

// Klik backdrop menutup modal
$all(".modal-backdrop").forEach((backdrop) => {
  backdrop.addEventListener("click", () => closeModal(backdrop.closest("[role='dialog']")));
});

// Keyboard: Escape menutup modal, Tab dikunci di dalam modal
document.addEventListener("keydown", (e) => {
  const openModalEl = [...$all("[role='dialog']")].find((m) => !m.classList.contains("hidden"));
  if (!openModalEl) return;

  if (e.key === "Escape") closeModal(openModalEl);
  else if (e.key === "Tab") trapFocus(e, openModalEl);
});

/* ========== FITUR 1: EXPENSE TRACKER ========== */
const EXPENSE_STORAGE_KEY = "pabwe-expense";
let expenses = loadData(EXPENSE_STORAGE_KEY, []);
let editExpenseId = null;

const expenseForm = $("#expense-form");
const expenseEditForm = $("#expense-edit-form");
const expenseList = $("#expense-list");
const expenseEmpty = $("#expense-empty");
const expSearch = $("#expense-search");
const expFilterType = $("#expense-filter-type");
const expSort = $("#expense-sort");
const expTotalIn = $("#expense-total-in");
const expTotalOut = $("#expense-total-out");
const expBalance = $("#expense-balance");

/** Baca field form tambah (prefix "expense") atau ubah (prefix "expense-edit") */
function readExpenseFields(prefix) {
  return {
    title: getFieldValue(`#${prefix}-title`),
    category: getFieldValue(`#${prefix}-category`),
    amount: Number(getFieldValue(`#${prefix}-amount`)),
    type: getFieldValue(`#${prefix}-type`),
    date: getFieldValue(`#${prefix}-date`),
  };
}

/** Validasi eksplisit di JS; kembalikan pesan error atau null jika valid */
function validateExpense({ title, category, amount, type, date }) {
  if (!title) return "Judul transaksi tidak boleh kosong!";
  if (!category) return "Pilih kategori transaksi!";
  if (!type) return "Pilih tipe transaksi!";
  if (!date) return "Tanggal transaksi wajib diisi!";
  if (!Number.isFinite(amount) || amount <= 0) {
    return "Jumlah transaksi harus berupa angka lebih dari 0!";
  }
  return null;
}

function updateExpenseSummary() {
  const totalIn = expenses
    .filter((e) => e.type === "Pemasukan")
    .reduce((sum, e) => sum + e.amount, 0);
  const totalOut = expenses
    .filter((e) => e.type !== "Pemasukan")
    .reduce((sum, e) => sum + e.amount, 0);
  const balance = totalIn - totalOut;

  if (expTotalIn) expTotalIn.textContent = formatRupiah(totalIn);
  if (expTotalOut) expTotalOut.textContent = formatRupiah(totalOut);
  if (expBalance) {
    expBalance.textContent = formatRupiah(balance);
    expBalance.classList.toggle("text-rose-700", balance < 0);
    expBalance.classList.toggle("text-indigo-900", balance >= 0);
  }
}

/** Filter + sort daftar transaksi */
function getVisibleExpenses() {
  const query = (expSearch?.value || "").trim().toLowerCase();
  const filterType = expFilterType?.value || "Semua";
  const sort = expSort?.value || "terbaru";

  const items = expenses.filter(
    (e) =>
      e.title.toLowerCase().includes(query) &&
      (filterType === "Semua" || e.type === filterType)
  );

  const sorters = {
    terbaru: (a, b) => b.createdAt - a.createdAt,
    terlama: (a, b) => a.createdAt - b.createdAt,
    terbesar: (a, b) => b.amount - a.amount,
    terkecil: (a, b) => a.amount - b.amount,
  };
  return items.sort(sorters[sort] || sorters.terbaru);
}

/** Bangun satu baris transaksi (reusable, tidak menyentuh state global) */
function createExpenseItem(exp) {
  const isIncome = exp.type === "Pemasukan";
  const li = document.createElement("li");
  li.className =
    "flex flex-col sm:flex-row sm:items-center gap-3 rounded-xl border border-slate-200 px-4 py-3 bg-white hover:bg-slate-50 transition";

  const iconDiv = document.createElement("div");
  iconDiv.className = `flex items-center justify-center w-10 h-10 rounded-lg shrink-0 ${
    isIncome ? "bg-emerald-100 text-emerald-600" : "bg-rose-100 text-rose-600"
  }`;
  iconDiv.innerHTML = `<i class="ti ${isIncome ? "ti-arrow-down-left" : "ti-arrow-up-right"} text-xl"></i>`;

  const infoDiv = document.createElement("div");
  infoDiv.className = "flex-1 min-w-0";
  infoDiv.innerHTML = `
    <p class="font-medium text-slate-900 truncate">${escapeHTML(exp.title)}</p>
    <div class="flex flex-wrap items-center gap-2 mt-1">
      <span class="inline-flex text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-md bg-slate-100 text-slate-600">${escapeHTML(exp.category)}</span>
      <span class="text-xs text-slate-500"><i class="ti ti-calendar text-[10px]"></i> ${escapeHTML(exp.date)}</span>
    </div>`;

  const rightDiv = document.createElement("div");
  rightDiv.className =
    "flex flex-row sm:flex-col items-center sm:items-end justify-between sm:justify-center gap-2 shrink-0 mt-2 sm:mt-0";

  const amountP = document.createElement("p");
  amountP.className = `font-bold ${isIncome ? "text-emerald-600" : "text-rose-600"}`;
  amountP.textContent = `${isIncome ? "+" : "-"}${formatRupiah(exp.amount)}`;

  const actions = document.createElement("div");
  actions.className = "flex items-center gap-1.5";
  actions.append(
    createIconButton({
      icon: "ti-pencil",
      label: `Ubah ${exp.title}`,
      className: "p-1.5 rounded-md text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 transition",
      onClick: () => openEditExpenseModal(exp.id),
      action: "edit-expense",
      id: exp.id,
    }),
    createIconButton({
      icon: "ti-trash",
      label: `Hapus ${exp.title}`,
      className: "p-1.5 rounded-md text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition",
      onClick: () => openDeleteModal("expense", exp.id, exp.title),
      action: "delete-expense",
      id: exp.id,
    })
  );

  rightDiv.append(amountP, actions);
  li.append(iconDiv, infoDiv, rightDiv);
  return li;
}

function renderExpenses() {
  updateExpenseSummary();

  const noData = expenses.length === 0;
  toggleEmptyState(expenseEmpty, expenseList, noData);
  if (!expenseList) return;
  expenseList.innerHTML = "";
  if (noData) return;

  const items = getVisibleExpenses();
  if (items.length === 0) {
    expenseList.appendChild(
      createNoMatchNode("li", "Tidak ada transaksi yang cocok dengan pencarian/filter.")
    );
    return;
  }
  items.forEach((exp) => expenseList.appendChild(createExpenseItem(exp)));
}

// Tambah transaksi
if (expenseForm) {
  expenseForm.addEventListener("submit", (e) => {
    e.preventDefault();
    clearInlineError(expenseForm);

    const data = readExpenseFields("expense");
    const error = validateExpense(data);
    if (error) return showInlineError(expenseForm, error);

    expenses.push({ id: crypto.randomUUID(), ...data, createdAt: Date.now() });
    saveData(EXPENSE_STORAGE_KEY, expenses);
    expenseForm.reset();
    renderExpenses();
    showToast("Transaksi berhasil ditambahkan!");
  });
}

// Cari: 'input' (real-time saat mengetik); dropdown filter/sort: 'change'
if (expSearch) expSearch.addEventListener("input", renderExpenses);
[expFilterType, expSort].forEach((el) => {
  if (el) el.addEventListener("change", renderExpenses);
});

// Ubah transaksi
function openEditExpenseModal(id) {
  const exp = expenses.find((e) => e.id === id);
  if (!exp) return;
  editExpenseId = id;

  setFieldValue("#expense-edit-title", exp.title);
  setFieldValue("#expense-edit-category", exp.category);
  setFieldValue("#expense-edit-amount", exp.amount);
  setFieldValue("#expense-edit-type", exp.type);
  setFieldValue("#expense-edit-date", exp.date);
  openModal($("#modal-expense-edit"));
}

if (expenseEditForm) {
  expenseEditForm.addEventListener("submit", (e) => {
    e.preventDefault();
    clearInlineError(expenseEditForm);

    const exp = expenses.find((x) => x.id === editExpenseId);
    if (!exp) return closeModal($("#modal-expense-edit"));

    const data = readExpenseFields("expense-edit");
    const error = validateExpense(data);
    if (error) return showInlineError(expenseEditForm, error);

    Object.assign(exp, data);
    saveData(EXPENSE_STORAGE_KEY, expenses);
    renderExpenses();
    closeModal($("#modal-expense-edit"));
    showToast("Transaksi berhasil diperbarui!");
  });
}

/* ========== FITUR 2: BOOKMARK MANAGER ========== */
const BOOKMARK_STORAGE_KEY = "pabwe-bookmark";
let bookmarks = loadData(BOOKMARK_STORAGE_KEY, []);
let editBookmarkId = null;

const bookmarkForm = $("#bookmark-form");
const bookmarkEditForm = $("#bookmark-edit-form");
const bookmarkList = $("#bookmark-list");
const bookmarkEmpty = $("#bookmark-empty");
const bookmarkSearch = $("#bookmark-search");
const bookmarkSort = $("#bookmark-sort");

function isValidURL(string) {
  try {
    const url = new URL(string);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

/** Baca field form tambah (prefix "bookmark") atau ubah (prefix "bookmark-edit") */
function readBookmarkFields(prefix) {
  return {
    title: getFieldValue(`#${prefix}-title`),
    url: getFieldValue(`#${prefix}-url`),
    category: getFieldValue(`#${prefix}-category`),
    notes: getFieldValue(`#${prefix}-notes`),
  };
}

function validateBookmark({ title, url, category }) {
  if (!title) return "Nama bookmark tidak boleh kosong!";
  if (!isValidURL(url)) return "URL tidak valid! Harus berawalan http:// atau https://";
  if (!category) return "Kategori/tag tidak boleh kosong!";
  return null;
}

function getVisibleBookmarks() {
  const query = (bookmarkSearch?.value || "").trim().toLowerCase();
  const sort = bookmarkSort?.value || "terbaru";

  const items = bookmarks.filter(
    (b) =>
      b.title.toLowerCase().includes(query) ||
      b.url.toLowerCase().includes(query) ||
      b.category.toLowerCase().includes(query)
  );

  const sorters = {
    "judul-asc": (a, b) => a.title.localeCompare(b.title, "id"),
    "judul-desc": (a, b) => b.title.localeCompare(a.title, "id"),
    terbaru: (a, b) => b.createdAt - a.createdAt,
  };
  return items.sort(sorters[sort] || sorters.terbaru);
}

/** Bangun satu kartu bookmark */
function createBookmarkCard(bm) {
  const card = document.createElement("div");
  card.className =
    "flex flex-col p-4 rounded-xl border border-slate-200 bg-white hover:shadow-md transition gap-3";

  const header = document.createElement("div");
  header.className = "flex items-center justify-between";
  header.innerHTML = `<span class="inline-flex text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-100">${escapeHTML(bm.category)}</span>`;

  const actions = document.createElement("div");
  actions.className = "flex gap-1";
  actions.append(
    createIconButton({
      icon: "ti-pencil",
      label: `Ubah ${bm.title}`,
      className: "p-1.5 rounded text-slate-400 hover:text-emerald-600 hover:bg-emerald-50",
      onClick: () => openEditBookmarkModal(bm.id),
      action: "edit-bookmark",
      id: bm.id,
    }),
    createIconButton({
      icon: "ti-trash",
      label: `Hapus ${bm.title}`,
      className: "p-1.5 rounded text-slate-400 hover:text-rose-600 hover:bg-rose-50",
      onClick: () => openDeleteModal("bookmark", bm.id, bm.title),
      action: "delete-bookmark",
      id: bm.id,
    })
  );
  header.appendChild(actions);

  const notesHTML = bm.notes
    ? `<p class="mt-2 text-sm text-slate-600 border-l-2 border-slate-200 pl-2 italic line-clamp-2">${escapeHTML(bm.notes)}</p>`
    : "";

  const body = document.createElement("div");
  body.className = "flex flex-col gap-1";
  body.innerHTML = `
    <a href="${escapeHTML(bm.url)}" target="_blank" rel="noopener noreferrer" class="font-semibold text-slate-900 hover:text-emerald-600 transition truncate line-clamp-1 flex items-center gap-1.5" title="${escapeHTML(bm.url)}">
      ${escapeHTML(bm.title)} <i class="ti ti-external-link text-[10px] text-slate-400"></i>
    </a>
    <p class="text-xs text-slate-500 truncate" title="${escapeHTML(bm.url)}">${escapeHTML(bm.url)}</p>
    ${notesHTML}`;

  card.append(header, body);
  return card;
}

function renderBookmarks() {
  const noData = bookmarks.length === 0;
  toggleEmptyState(bookmarkEmpty, bookmarkList, noData);
  if (!bookmarkList) return;
  bookmarkList.innerHTML = "";
  if (noData) return;

  const items = getVisibleBookmarks();
  if (items.length === 0) {
    bookmarkList.appendChild(
      createNoMatchNode("div", "Tidak ada bookmark yang cocok.", "col-span-1 sm:col-span-2")
    );
    return;
  }
  items.forEach((bm) => bookmarkList.appendChild(createBookmarkCard(bm)));
}

// Tambah bookmark
if (bookmarkForm) {
  bookmarkForm.addEventListener("submit", (e) => {
    e.preventDefault();
    clearInlineError(bookmarkForm);

    const data = readBookmarkFields("bookmark");
    const error = validateBookmark(data);
    if (error) return showInlineError(bookmarkForm, error);

    bookmarks.push({ id: crypto.randomUUID(), ...data, createdAt: Date.now() });
    saveData(BOOKMARK_STORAGE_KEY, bookmarks);
    bookmarkForm.reset();
    renderBookmarks();
    showToast("Bookmark berhasil ditambahkan!");
  });
}

if (bookmarkSearch) bookmarkSearch.addEventListener("input", renderBookmarks);
if (bookmarkSort) bookmarkSort.addEventListener("change", renderBookmarks);

// Ubah bookmark
function openEditBookmarkModal(id) {
  const bm = bookmarks.find((b) => b.id === id);
  if (!bm) return;
  editBookmarkId = id;

  setFieldValue("#bookmark-edit-title", bm.title);
  setFieldValue("#bookmark-edit-url", bm.url);
  setFieldValue("#bookmark-edit-category", bm.category);
  setFieldValue("#bookmark-edit-notes", bm.notes);
  openModal($("#modal-bookmark-edit"));
}

if (bookmarkEditForm) {
  bookmarkEditForm.addEventListener("submit", (e) => {
    e.preventDefault();
    clearInlineError(bookmarkEditForm);

    const bm = bookmarks.find((x) => x.id === editBookmarkId);
    if (!bm) return closeModal($("#modal-bookmark-edit"));

    const data = readBookmarkFields("bookmark-edit");
    const error = validateBookmark(data);
    if (error) return showInlineError(bookmarkEditForm, error);

    Object.assign(bm, data);
    saveData(BOOKMARK_STORAGE_KEY, bookmarks);
    renderBookmarks();
    closeModal($("#modal-bookmark-edit"));
    showToast("Bookmark berhasil diperbarui!");
  });
}

/* ========== MODAL HAPUS (dipakai Expense & Bookmark) ========== */
const deleteModal = $("#modal-delete");
const deleteConfirmBtn = $("#delete-confirm-btn");
const deleteTargetName = $("#delete-target-name");
let deleteTarget = { type: null, id: null };

/** Peta tipe data -> cara menghapus; tambah fitur baru cukup tambah entri di sini */
const DELETE_HANDLERS = {
  expense: (id) => {
    expenses = expenses.filter((e) => e.id !== id);
    saveData(EXPENSE_STORAGE_KEY, expenses);
    renderExpenses();
  },
  bookmark: (id) => {
    bookmarks = bookmarks.filter((b) => b.id !== id);
    saveData(BOOKMARK_STORAGE_KEY, bookmarks);
    renderBookmarks();
  },
};

function openDeleteModal(type, id, name) {
  deleteTarget = { type, id };
  if (deleteTargetName) deleteTargetName.textContent = `"${name}"`;
  openModal(deleteModal);
}

if (deleteConfirmBtn) {
  deleteConfirmBtn.addEventListener("click", () => {
    const handler = DELETE_HANDLERS[deleteTarget.type];
    if (handler) {
      handler(deleteTarget.id);
      showToast("Data berhasil dihapus.");
    }
    deleteTarget = { type: null, id: null };
    closeModal(deleteModal);
  });
}

/* ========== FITUR 3: QUIZ APP ========== */
const QUIZ_STORAGE_KEY = "pabwe-quiz-highscore";

const quizQuestions = [
  {
    q: "Elemen HTML mana yang digunakan untuk menyertakan file JavaScript eksternal?",
    options: ["<script src='...'>", "<js href='...'>", "<script name='...'>", "<link rel='javascript'>"],
    ans: 0,
  },
  {
    q: "Apa singkatan dari CSS?",
    options: ["Creative Style Sheets", "Cascading Style Sheets", "Computer Style Sheets", "Colorful Style Sheets"],
    ans: 1,
  },
  {
    q: "Metode mana yang digunakan untuk mengurai (parse) string JSON ke objek JavaScript?",
    options: ["JSON.stringify()", "JSON.parse()", "JSON.toObject()", "JSON.read()"],
    ans: 1,
  },
  {
    q: "Bagaimana cara membuat fungsi di JavaScript?",
    options: ["function = myFunction()", "function myFunction()", "function:myFunction()", "create myFunction()"],
    ans: 1,
  },
  {
    q: "Properti CSS apa yang digunakan untuk mengatur warna teks?",
    options: ["text-color", "fgcolor", "color", "font-color"],
    ans: 2,
  },
  {
    q: "Method mana yang menambahkan elemen ke akhir sebuah array di JavaScript?",
    options: ["push()", "pop()", "shift()", "concat() tanpa hasil disimpan"],
    ans: 0,
  },
  {
    q: "Apa perbedaan utama antara localStorage dan sessionStorage?",
    options: [
      "localStorage tetap ada setelah browser ditutup, sessionStorage hilang saat tab ditutup",
      "localStorage hanya menyimpan angka",
      "sessionStorage dapat dibaca semua website",
      "Keduanya sama persis",
    ],
    ans: 0,
  },
  {
    q: "Operator '===' di JavaScript berfungsi untuk...",
    options: [
      "Membandingkan nilai dan tipe data",
      "Membandingkan nilai saja",
      "Memberi nilai ke variabel",
      "Menggabungkan dua string",
    ],
    ans: 0,
  },
  {
    q: "Method DOM mana yang mengambil elemen pertama yang cocok dengan selector CSS?",
    options: ["getElement()", "querySelector()", "findByCss()", "selectFirst()"],
    ans: 1,
  },
  {
    q: "Atribut apa yang sebaiknya dipasang pada link target=\"_blank\" agar lebih aman?",
    options: ["rel=\"noopener noreferrer\"", "rel=\"external\"", "type=\"secure\"", "download"],
    ans: 0,
  },
];

// State kuis (semua di-reset lewat resetQuizState())
let currentQuestionIdx = 0; // indeks soal yang sedang tampil (mulai dari 0)
let currentScore = 0;       // jumlah jawaban benar pada permainan ini
let hasAnswered = false;    // true setelah soal dijawab; mencegah menjawab dua kali

const elQuizStart = $("#quiz-start");
const elQuizQuestion = $("#quiz-question");
const elQuizResult = $("#quiz-result");
const elHighScore = $("#quiz-high-score");
const elHighScoreWrap = $("#quiz-high-score-wrap");
const elQuizOptions = $("#quiz-options");
const elQuizFeedback = $("#quiz-feedback");
const elNextBtn = $("#btn-next-question");

// Semua elemen kuis wajib ada; jika tidak, fungsi kuis berhenti tanpa error
const quizReady = [elQuizStart, elQuizQuestion, elQuizResult, elQuizOptions, elQuizFeedback, elNextBtn].every(Boolean);

const QUIZ_OPTION_CLASS =
  "quiz-opt-btn w-full text-left p-4 rounded-xl border-2 border-slate-200 bg-white hover:border-violet-300 hover:bg-violet-50 transition font-medium text-slate-700 flex items-center justify-between";
const QUIZ_FEEDBACK_BASE = "mb-6 p-4 rounded-xl border text-sm font-medium flex items-center gap-2";
const QUIZ_RESULT_STYLES = {
  perfect: { cls: "bg-emerald-100 text-emerald-600", icon: "ti-trophy" },
  good: { cls: "bg-amber-100 text-amber-600", icon: "ti-thumb-up" },
  low: { cls: "bg-slate-100 text-slate-600", icon: "ti-mood-sad" },
};

function loadQuizHighScore() {
  const hs = loadData(QUIZ_STORAGE_KEY, 0);
  if (elHighScore) elHighScore.textContent = `${hs} / ${quizQuestions.length}`;
  // Tampilkan setelah nilai benar terisi (di HTML disembunyikan agar tidak berkedip)
  if (elHighScoreWrap) elHighScoreWrap.classList.remove("invisible");
}

/** Tampilkan tepat satu layar kuis: "start" | "question" | "result" */
function showQuizScreen(name) {
  elQuizStart.classList.toggle("hidden", name !== "start");
  elQuizQuestion.classList.toggle("hidden", name !== "question");
  elQuizResult.classList.toggle("hidden", name !== "result");
}

/** Perbarui teks progres, skor langsung, dan bar progres sesuai state saat ini */
function updateQuizProgress() {
  setText("#quiz-progress-text", `Soal ${currentQuestionIdx + 1} dari ${quizQuestions.length}`);
  setText("#quiz-score-live", `Skor: ${currentScore}`);
  const progressBar = $("#quiz-progress-bar");
  if (progressBar) progressBar.style.width = `${((currentQuestionIdx + 1) / quizQuestions.length) * 100}%`;
}

/** Satu pintu untuk mengembalikan kuis ke kondisi awal (dipakai Mulai dan Main Lagi) */
function resetQuizState() {
  if (!quizReady) return;
  currentQuestionIdx = 0;
  currentScore = 0;
  hasAnswered = false;

  updateQuizProgress();
  setText("#quiz-final-score", `0 / ${quizQuestions.length}`);
  elQuizOptions.innerHTML = "";
  elQuizFeedback.className = `hidden ${QUIZ_FEEDBACK_BASE}`;
  elNextBtn.classList.add("hidden");
}

function startQuiz() {
  if (!quizReady) return;
  resetQuizState();
  showQuizScreen("question");
  renderQuestion();
}

function renderQuestion() {
  if (!quizReady) return;
  hasAnswered = false;
  const qData = quizQuestions[currentQuestionIdx];

  updateQuizProgress();
  setText("#quiz-question-text", qData.q);

  elQuizOptions.innerHTML = "";
  qData.options.forEach((optText, idx) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = QUIZ_OPTION_CLASS;
    btn.innerHTML = `<span>${escapeHTML(optText)}</span> <i class="ti ti-circle text-slate-300 text-xl"></i>`;
    btn.addEventListener("click", () => handleAnswer(idx));
    elQuizOptions.appendChild(btn);
  });

  elQuizFeedback.className = `hidden ${QUIZ_FEEDBACK_BASE}`;
  elNextBtn.classList.add("hidden");
}

function handleAnswer(selectedIdx) {
  if (!quizReady || hasAnswered) return;
  hasAnswered = true;

  const qData = quizQuestions[currentQuestionIdx];
  const isCorrect = selectedIdx === qData.ans;
  if (isCorrect) currentScore++;

  $all(".quiz-opt-btn").forEach((btn, idx) => {
    btn.disabled = true;
    btn.classList.remove("hover:border-violet-300", "hover:bg-violet-50");
    btn.classList.add("opacity-60", "cursor-not-allowed");
    const icon = btn.querySelector("i");

    if (idx === qData.ans) {
      btn.classList.replace("border-slate-200", "border-emerald-500");
      btn.classList.add("bg-emerald-50", "text-emerald-800", "opacity-100");
      if (icon) icon.className = "ti ti-check text-emerald-600 text-xl";
    } else if (idx === selectedIdx) {
      btn.classList.replace("border-slate-200", "border-rose-500");
      btn.classList.add("bg-rose-50", "text-rose-800", "opacity-100");
      if (icon) icon.className = "ti ti-x text-rose-600 text-xl";
    }
  });

  elQuizFeedback.className = QUIZ_FEEDBACK_BASE;
  if (isCorrect) {
    elQuizFeedback.classList.add("border-emerald-200", "bg-emerald-50", "text-emerald-800");
    elQuizFeedback.innerHTML = '<i class="ti ti-circle-check-filled text-lg"></i> Tepat sekali!';
  } else {
    elQuizFeedback.classList.add("border-rose-200", "bg-rose-50", "text-rose-800");
    elQuizFeedback.innerHTML = `<i class="ti ti-alert-circle-filled text-lg"></i> Kurang tepat. Jawaban yang benar adalah: <strong class="ml-1">${escapeHTML(qData.options[qData.ans])}</strong>`;
  }

  updateQuizProgress();

  const isLast = currentQuestionIdx === quizQuestions.length - 1;
  elNextBtn.classList.remove("hidden");
  elNextBtn.innerHTML = isLast
    ? 'Selesai <i class="ti ti-check"></i>'
    : 'Selanjutnya <i class="ti ti-arrow-right"></i>';
}

function finishQuiz() {
  if (!quizReady) return;
  showQuizScreen("result");
  setText("#quiz-final-score", `${currentScore} / ${quizQuestions.length}`);

  if (currentScore > loadData(QUIZ_STORAGE_KEY, 0)) {
    saveData(QUIZ_STORAGE_KEY, currentScore);
    loadQuizHighScore();
  }

  const level =
    currentScore === quizQuestions.length ? "perfect"
    : currentScore >= quizQuestions.length / 2 ? "good"
    : "low";
  const icon = $("#quiz-result-icon");
  if (!icon) return;
  icon.className = `inline-flex items-center justify-center w-20 h-20 rounded-full mb-4 ${QUIZ_RESULT_STYLES[level].cls}`;
  icon.innerHTML = `<i class="ti ${QUIZ_RESULT_STYLES[level].icon} text-4xl"></i>`;
}

$("#btn-start-quiz")?.addEventListener("click", startQuiz);

elNextBtn?.addEventListener("click", () => {
  if (currentQuestionIdx < quizQuestions.length - 1) {
    currentQuestionIdx++;
    renderQuestion();
  } else {
    finishQuiz();
  }
});

$("#btn-retry-quiz")?.addEventListener("click", () => {
  if (!quizReady) return;
  resetQuizState();
  showQuizScreen("start");
});

/* ========== INITIALIZATION ========== */
document.addEventListener("DOMContentLoaded", () => {
  switchTab(getTabFromUrl(), "replace");
  renderExpenses();
  renderBookmarks();
  loadQuizHighScore();
});