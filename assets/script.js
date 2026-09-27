/**
 * Latihan JavaScript — Praktikum 3
 * Fitur: Expense Tracker, Bookmark Manager, Quiz App
 */

/* ========== UTILITAS ========== */
function $(selector) {
  const el = document.querySelector(selector);
  if (!el) console.warn(`Elemen tidak ditemukan: ${selector}`);
  return el;
}
function $all(selector) {
  return document.querySelectorAll(selector);
}

/* ========== TAB SWITCHER (via URL Query) ========== */
const tabButtons = $all(".tab-btn");
const panels = {
  expense: $("#panel-expense"),
  bookmark: $("#panel-bookmark"),
  quiz: $("#panel-quiz"),
};

function switchTab(name, updateUrl = true) {
  if (!panels[name]) name = "expense";
  
  // Sembunyikan panel lain
  Object.entries(panels).forEach(([key, panel]) => {
    if (panel) panel.classList.toggle("hidden", key !== name);
  });

  // Update styling tombol tab
  tabButtons.forEach((btn) => {
    const active = btn.dataset.tab === name;
    btn.setAttribute("aria-selected", String(active));
    
    // Reset styling
    btn.className = "tab-btn flex-1 flex items-center justify-center gap-2 px-3 py-3 sm:py-2.5 rounded-lg text-sm font-semibold transition";
    
    if (active) {
      if (name === "expense") btn.classList.add("bg-indigo-600", "text-white", "shadow");
      else if (name === "bookmark") btn.classList.add("bg-emerald-600", "text-white", "shadow");
      else if (name === "quiz") btn.classList.add("bg-violet-600", "text-white", "shadow");
    } else {
      btn.classList.add("text-slate-600", "hover:bg-slate-100");
    }
  });

  // Update URL Query String tanpa mereload halaman
  if (updateUrl) {
    const url = new URL(window.location);
    url.searchParams.set("tab", name);
    window.history.pushState({}, "", url);
  }
}

// Event Listener klik tombol tab
tabButtons.forEach((btn) => {
  btn.addEventListener("click", () => switchTab(btn.dataset.tab));
});

// Event Listener handle tombol back browser
window.addEventListener("popstate", () => {
  const params = new URLSearchParams(window.location.search);
  switchTab(params.get("tab") || "expense", false);
});


/* ========== MODAL GLOBAL ========== */
function openModal(modal) {
  if (!modal) return;
  modal.classList.remove("hidden");
  modal.classList.add("flex");
  document.body.classList.add("overflow-hidden");
}

function closeModal(modal) {
  if (!modal) return;
  modal.classList.add("hidden");
  modal.classList.remove("flex");
  document.body.classList.remove("overflow-hidden");
}

// Setup tombol tutup modal
$all("[data-close-modal]").forEach((btn) => {
  btn.addEventListener("click", () => {
    const modalId = btn.getAttribute("data-close-modal");
    const modal = $(`#modal-${modalId}`);
    if (modal) closeModal(modal);
    else closeModal(btn.closest("[role='dialog']"));
  });
});

// Escape key tutup semua modal
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") {
    $all("[role='dialog']").forEach((modal) => {
      if (!modal.classList.contains("hidden")) closeModal(modal);
    });
  }
});


/* ========== FITUR 1: EXPENSE TRACKER ========== */
const EXPENSE_STORAGE_KEY = "pabwe-expense";
let expenses = loadData(EXPENSE_STORAGE_KEY, []);
let editExpenseId = null;
let deleteTarget = { type: null, id: null }; // Digunakan bersama oleh Delete Modal

// DOM Elements
const expenseForm = $("#expense-form");
const expenseList = $("#expense-list");
const expenseEmpty = $("#expense-empty");
// Form Add
const expTitle = $("#expense-title");
const expCategory = $("#expense-category");
const expAmount = $("#expense-amount");
const expType = $("#expense-type");
const expDate = $("#expense-date");
// Filter & Sort
const expSearch = $("#expense-search");
const expFilterType = $("#expense-filter-type");
const expSort = $("#expense-sort");
// Summary
const expTotalIn = $("#expense-total-in");
const expTotalOut = $("#expense-total-out");
const expBalance = $("#expense-balance");
// Edit Form
const expenseEditForm = $("#expense-edit-form");

function loadData(key, defaultVal) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : defaultVal;
  } catch {
    return defaultVal;
  }
}
function saveData(key, data) {
  localStorage.setItem(key, JSON.stringify(data));
}

function formatRupiah(number) {
  return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(number);
}

function renderExpenses() {
  const query = expSearch.value.trim().toLowerCase();
  const filterType = expFilterType.value;
  const sort = expSort.value;

  // Filter
  let items = expenses.filter((e) => {
    const matchQuery = e.title.toLowerCase().includes(query);
    const matchType = filterType === "Semua" || e.type === filterType;
    return matchQuery && matchType;
  });

  // Sort
  items.sort((a, b) => {
    switch (sort) {
      case "terbaru": return b.createdAt - a.createdAt;
      case "terlama": return a.createdAt - b.createdAt;
      case "terbesar": return b.amount - a.amount;
      case "terkecil": return a.amount - b.amount;
      default: return b.createdAt - a.createdAt;
    }
  });

  // Summary
  let totalIn = 0;
  let totalOut = 0;
  expenses.forEach(e => {
    if (e.type === "Pemasukan") totalIn += e.amount;
    else totalOut += e.amount;
  });
  
  if (expTotalIn) expTotalIn.textContent = formatRupiah(totalIn);
  if (expTotalOut) expTotalOut.textContent = formatRupiah(totalOut);
  if (expBalance) {
    const balance = totalIn - totalOut;
    expBalance.textContent = formatRupiah(balance);
    if (balance < 0) expBalance.classList.replace("text-indigo-900", "text-rose-700");
    else expBalance.classList.replace("text-rose-700", "text-indigo-900");
  }

  // Render DOM
  const noData = expenses.length === 0;
  if (expenseEmpty) expenseEmpty.classList.toggle("hidden", !noData);
  if (expenseList) expenseList.classList.toggle("hidden", noData);
  
  if (!expenseList) return;
  expenseList.innerHTML = "";

  if (items.length === 0 && !noData) {
    expenseList.innerHTML = `<li class="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">Tidak ada transaksi yang cocok dengan pencarian/filter.</li>`;
    return;
  }

  items.forEach(exp => {
    const isIncome = exp.type === "Pemasukan";
    const li = document.createElement("li");
    li.className = "flex flex-col sm:flex-row sm:items-center gap-3 rounded-xl border border-slate-200 px-4 py-3 bg-white hover:bg-slate-50 transition";
    
    // Icon
    const iconDiv = document.createElement("div");
    iconDiv.className = `flex items-center justify-center w-10 h-10 rounded-lg shrink-0 ${isIncome ? 'bg-emerald-100 text-emerald-600' : 'bg-rose-100 text-rose-600'}`;
    iconDiv.innerHTML = `<i class="ti ${isIncome ? 'ti-arrow-down-left' : 'ti-arrow-up-right'} text-xl"></i>`;
    
    // Info
    const infoDiv = document.createElement("div");
    infoDiv.className = "flex-1 min-w-0";
    infoDiv.innerHTML = `
      <p class="font-medium text-slate-900 truncate">${exp.title}</p>
      <div class="flex flex-wrap items-center gap-2 mt-1">
        <span class="inline-flex text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-md bg-slate-100 text-slate-600">${exp.category}</span>
        <span class="text-xs text-slate-500"><i class="ti ti-calendar text-[10px]"></i> ${exp.date}</span>
      </div>
    `;

    // Amount & Actions
    const rightDiv = document.createElement("div");
    rightDiv.className = "flex flex-row sm:flex-col items-center sm:items-end justify-between sm:justify-center gap-2 shrink-0 mt-2 sm:mt-0";
    
    const amountP = document.createElement("p");
    amountP.className = `font-bold ${isIncome ? 'text-emerald-600' : 'text-rose-600'}`;
    amountP.textContent = `${isIncome ? '+' : '-'}${formatRupiah(exp.amount)}`;

    const actions = document.createElement("div");
    actions.className = "flex items-center gap-1.5";
    
    const editBtn = document.createElement("button");
    editBtn.className = "p-1.5 rounded-md text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 transition";
    editBtn.innerHTML = '<i class="ti ti-pencil"></i>';
    editBtn.title = "Ubah";
    editBtn.onclick = () => openEditExpenseModal(exp.id);

    const deleteBtn = document.createElement("button");
    deleteBtn.className = "p-1.5 rounded-md text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition";
    deleteBtn.innerHTML = '<i class="ti ti-trash"></i>';
    deleteBtn.title = "Hapus";
    deleteBtn.onclick = () => openDeleteModal("expense", exp.id, exp.title);

    actions.append(editBtn, deleteBtn);
    rightDiv.append(amountP, actions);
    
    li.append(iconDiv, infoDiv, rightDiv);
    expenseList.appendChild(li);
  });
}

// Add Expense
if (expenseForm) {
  expenseForm.addEventListener("submit", (e) => {
    e.preventDefault();
    expenses.push({
      id: crypto.randomUUID(),
      title: expTitle.value.trim(),
      category: expCategory.value,
      amount: Number(expAmount.value),
      type: expType.value,
      date: expDate.value,
      createdAt: Date.now()
    });
    saveData(EXPENSE_STORAGE_KEY, expenses);
    expenseForm.reset();
    renderExpenses();
  });
}

// Event listeners filter
[expSearch, expFilterType, expSort].forEach(el => {
  if(el) el.addEventListener("input", renderExpenses);
});

// Edit Expense
function openEditExpenseModal(id) {
  const exp = expenses.find(e => e.id === id);
  if (!exp) return;
  editExpenseId = id;
  
  $("#expense-edit-title").value = exp.title;
  $("#expense-edit-category").value = exp.category;
  $("#expense-edit-amount").value = exp.amount;
  $("#expense-edit-type").value = exp.type;
  $("#expense-edit-date").value = exp.date;
  
  openModal($("#modal-expense-edit"));
}

if (expenseEditForm) {
  expenseEditForm.addEventListener("submit", (e) => {
    e.preventDefault();
    const exp = expenses.find(x => x.id === editExpenseId);
    if (exp) {
      exp.title = $("#expense-edit-title").value.trim();
      exp.category = $("#expense-edit-category").value;
      exp.amount = Number($("#expense-edit-amount").value);
      exp.type = $("#expense-edit-type").value;
      exp.date = $("#expense-edit-date").value;
      saveData(EXPENSE_STORAGE_KEY, expenses);
      renderExpenses();
    }
    closeModal($("#modal-expense-edit"));
  });
}


/* ========== FITUR 2: BOOKMARK MANAGER ========== */
const BOOKMARK_STORAGE_KEY = "pabwe-bookmark";
let bookmarks = loadData(BOOKMARK_STORAGE_KEY, []);
let editBookmarkId = null;

const bookmarkForm = $("#bookmark-form");
const bookmarkList = $("#bookmark-list");
const bookmarkSearch = $("#bookmark-search");
const bookmarkSort = $("#bookmark-sort");
const bookmarkEmpty = $("#bookmark-empty");
const bookmarkEditForm = $("#bookmark-edit-form");

function renderBookmarks() {
  const query = (bookmarkSearch?.value || "").trim().toLowerCase();
  const sort = bookmarkSort?.value || "terbaru";

  let items = bookmarks.filter(b => 
    b.title.toLowerCase().includes(query) || 
    b.url.toLowerCase().includes(query) || 
    b.category.toLowerCase().includes(query)
  );

  items.sort((a, b) => {
    switch (sort) {
      case "judul-asc": return a.title.localeCompare(b.title, 'id');
      case "judul-desc": return b.title.localeCompare(a.title, 'id');
      case "terbaru":
      default: return b.createdAt - a.createdAt;
    }
  });

  const noData = bookmarks.length === 0;
  if (bookmarkEmpty) bookmarkEmpty.classList.toggle("hidden", !noData);
  if (bookmarkList) bookmarkList.classList.toggle("hidden", noData);

  if (!bookmarkList) return;
  bookmarkList.innerHTML = "";

  if (items.length === 0 && !noData) {
    bookmarkList.innerHTML = `<div class="col-span-1 sm:col-span-2 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">Tidak ada bookmark yang cocok.</div>`;
    return;
  }

  items.forEach(bm => {
    const card = document.createElement("div");
    card.className = "flex flex-col p-4 rounded-xl border border-slate-200 bg-white hover:shadow-md transition gap-3";
    
    // Header (Kategori + Actions)
    const header = document.createElement("div");
    header.className = "flex items-center justify-between";
    header.innerHTML = `<span class="inline-flex text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-100">${bm.category}</span>`;
    
    const actions = document.createElement("div");
    actions.className = "flex gap-1";
    
    const editBtn = document.createElement("button");
    editBtn.className = "p-1.5 rounded text-slate-400 hover:text-emerald-600 hover:bg-emerald-50";
    editBtn.innerHTML = '<i class="ti ti-pencil text-sm"></i>';
    editBtn.onclick = () => openEditBookmarkModal(bm.id);

    const deleteBtn = document.createElement("button");
    deleteBtn.className = "p-1.5 rounded text-slate-400 hover:text-rose-600 hover:bg-rose-50";
    deleteBtn.innerHTML = '<i class="ti ti-trash text-sm"></i>';
    deleteBtn.onclick = () => openDeleteModal("bookmark", bm.id, bm.title);

    actions.append(editBtn, deleteBtn);
    header.appendChild(actions);

    // Body (Title, URL, Notes)
    const body = document.createElement("div");
    body.className = "flex flex-col gap-1";
    body.innerHTML = `
      <a href="${bm.url}" target="_blank" rel="noopener noreferrer" class="font-semibold text-slate-900 hover:text-emerald-600 transition truncate line-clamp-1 flex items-center gap-1.5" title="${bm.url}">
        ${bm.title} <i class="ti ti-external-link text-[10px] text-slate-400"></i>
      </a>
      <p class="text-xs text-slate-500 truncate" title="${bm.url}">${bm.url}</p>
    `;
    
    if (bm.notes) {
      body.innerHTML += `<p class="mt-2 text-sm text-slate-600 border-l-2 border-slate-200 pl-2 italic line-clamp-2">${bm.notes}</p>`;
    }

    card.append(header, body);
    bookmarkList.appendChild(card);
  });
}

// Validation Helper
function isValidURL(string) {
  try {
    const url = new URL(string);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch (_) {
    return false;  
  }
}

if (bookmarkForm) {
  bookmarkForm.addEventListener("submit", (e) => {
    e.preventDefault();
    const urlInput = $("#bookmark-url").value.trim();
    if (!isValidURL(urlInput)) {
      alert("URL tidak valid! Harus berawalan http:// atau https://");
      return;
    }
    
    bookmarks.push({
      id: crypto.randomUUID(),
      title: $("#bookmark-title").value.trim(),
      url: urlInput,
      category: $("#bookmark-category").value.trim(),
      notes: $("#bookmark-notes") ? $("#bookmark-notes").value.trim() : "",
      createdAt: Date.now()
    });
    
    saveData(BOOKMARK_STORAGE_KEY, bookmarks);
    bookmarkForm.reset();
    renderBookmarks();
  });
}

[bookmarkSearch, bookmarkSort].forEach(el => {
  if (el) el.addEventListener("input", renderBookmarks);
});

function openEditBookmarkModal(id) {
  const bm = bookmarks.find(b => b.id === id);
  if (!bm) return;
  editBookmarkId = id;
  
  $("#bookmark-edit-title").value = bm.title;
  $("#bookmark-edit-url").value = bm.url;
  $("#bookmark-edit-category").value = bm.category;
  if ($("#bookmark-edit-notes")) $("#bookmark-edit-notes").value = bm.notes || "";
  
  openModal($("#modal-bookmark-edit"));
}

if (bookmarkEditForm) {
  bookmarkEditForm.addEventListener("submit", (e) => {
    e.preventDefault();
    const bm = bookmarks.find(x => x.id === editBookmarkId);
    if (bm) {
      const urlInput = $("#bookmark-edit-url").value.trim();
      if (!isValidURL(urlInput)) {
        alert("URL tidak valid! Harus berawalan http:// atau https://");
        return;
      }
      bm.title = $("#bookmark-edit-title").value.trim();
      bm.url = urlInput;
      bm.category = $("#bookmark-edit-category").value.trim();
      bm.notes = $("#bookmark-edit-notes") ? $("#bookmark-edit-notes").value.trim() : "";
      
      saveData(BOOKMARK_STORAGE_KEY, bookmarks);
      renderBookmarks();
    }
    closeModal($("#modal-bookmark-edit"));
  });
}


/* ========== MODAL DELETE UMUM ========== */
const deleteModal = $("#modal-delete");
const deleteConfirmBtn = $("#delete-confirm-btn");
const deleteTargetName = $("#delete-target-name");

function openDeleteModal(type, id, name) {
  deleteTarget = { type, id };
  if (deleteTargetName) deleteTargetName.textContent = `"${name}"`;
  openModal(deleteModal);
}

if (deleteConfirmBtn) {
  deleteConfirmBtn.addEventListener("click", () => {
    if (deleteTarget.type === "expense") {
      expenses = expenses.filter(e => e.id !== deleteTarget.id);
      saveData(EXPENSE_STORAGE_KEY, expenses);
      renderExpenses();
    } else if (deleteTarget.type === "bookmark") {
      bookmarks = bookmarks.filter(b => b.id !== deleteTarget.id);
      saveData(BOOKMARK_STORAGE_KEY, bookmarks);
      renderBookmarks();
    }
    closeModal(deleteModal);
  });
}


/* ========== FITUR 3: QUIZ APP ========== */
const QUIZ_STORAGE_KEY = "pabwe-quiz-highscore";

const quizQuestions = [
  {
    q: "Elemen HTML mana yang digunakan untuk menyertakan file JavaScript eksternal?",
    options: ["<script src='...'>", "<js href='...'>", "<script name='...'>", "<link rel='javascript'>"],
    ans: 0
  },
  {
    q: "Apa singkatan dari CSS?",
    options: ["Creative Style Sheets", "Cascading Style Sheets", "Computer Style Sheets", "Colorful Style Sheets"],
    ans: 1
  },
  {
    q: "Metode mana yang digunakan untuk mengurai (parse) string JSON ke objek JavaScript?",
    options: ["JSON.stringify()", "JSON.parse()", "JSON.toObject()", "JSON.read()"],
    ans: 1
  },
  {
    q: "Bagaimana cara membuat fungsi di JavaScript?",
    options: ["function = myFunction()", "function myFunction()", "function:myFunction()", "create myFunction()"],
    ans: 1
  },
  {
    q: "Properti CSS apa yang digunakan untuk mengatur warna teks?",
    options: ["text-color", "fgcolor", "color", "font-color"],
    ans: 2
  }
];

let currentQuestionIdx = 0;
let currentScore = 0;
let hasAnswered = false;

const elQuizStart = $("#quiz-start");
const elQuizQuestion = $("#quiz-question");
const elQuizResult = $("#quiz-result");
const elHighScore = $("#quiz-high-score");

function loadQuizHighScore() {
  const hs = loadData(QUIZ_STORAGE_KEY, 0);
  if (elHighScore) elHighScore.textContent = `${hs} / ${quizQuestions.length}`;
}

$("#btn-start-quiz")?.addEventListener("click", () => {
  currentQuestionIdx = 0;
  currentScore = 0;
  elQuizStart.classList.add("hidden");
  elQuizResult.classList.add("hidden");
  elQuizQuestion.classList.remove("hidden");
  renderQuestion();
});

function renderQuestion() {
  hasAnswered = false;
  const qData = quizQuestions[currentQuestionIdx];
  
  $("#quiz-progress-text").textContent = `Soal ${currentQuestionIdx + 1} dari ${quizQuestions.length}`;
  $("#quiz-score-live").textContent = `Skor: ${currentScore}`;
  
  const prog = ((currentQuestionIdx) / quizQuestions.length) * 100;
  $("#quiz-progress-bar").style.width = `${prog}%`;
  
  $("#quiz-question-text").textContent = qData.q;
  
  const optsContainer = $("#quiz-options");
  optsContainer.innerHTML = "";
  
  qData.options.forEach((optText, idx) => {
    const btn = document.createElement("button");
    btn.className = "quiz-opt-btn w-full text-left p-4 rounded-xl border-2 border-slate-200 bg-white hover:border-violet-300 hover:bg-violet-50 transition font-medium text-slate-700 flex items-center justify-between";
    btn.innerHTML = `<span>${optText}</span> <i class="ti ti-circle text-slate-300 text-xl"></i>`;
    btn.onclick = () => handleAnswer(idx, btn);
    optsContainer.appendChild(btn);
  });
  
  const feedback = $("#quiz-feedback");
  feedback.classList.add("hidden");
  feedback.className = "hidden mb-6 p-4 rounded-xl border text-sm font-medium flex items-center gap-2";
  
  $("#btn-next-question").classList.add("hidden");
}

function handleAnswer(selectedIdx, btnEl) {
  if (hasAnswered) return;
  hasAnswered = true;
  
  const qData = quizQuestions[currentQuestionIdx];
  const isCorrect = selectedIdx === qData.ans;
  
  if (isCorrect) currentScore++;
  
  // Update Buttons UI
  const allBtns = document.querySelectorAll(".quiz-opt-btn");
  allBtns.forEach((btn, idx) => {
    btn.classList.remove("hover:border-violet-300", "hover:bg-violet-50");
    btn.classList.add("opacity-60", "cursor-not-allowed");
    
    const icon = btn.querySelector("i");
    
    if (idx === qData.ans) {
      btn.classList.replace("border-slate-200", "border-emerald-500");
      btn.classList.add("bg-emerald-50", "text-emerald-800", "opacity-100");
      icon.className = "ti ti-check text-emerald-600 text-xl";
    } else if (idx === selectedIdx && !isCorrect) {
      btn.classList.replace("border-slate-200", "border-rose-500");
      btn.classList.add("bg-rose-50", "text-rose-800", "opacity-100");
      icon.className = "ti ti-x text-rose-600 text-xl";
    }
  });
  
  // Feedback
  const feedback = $("#quiz-feedback");
  feedback.classList.remove("hidden");
  if (isCorrect) {
    feedback.classList.add("border-emerald-200", "bg-emerald-50", "text-emerald-800");
    feedback.innerHTML = `<i class="ti ti-circle-check-filled text-lg"></i> Tepat sekali!`;
  } else {
    feedback.classList.add("border-rose-200", "bg-rose-50", "text-rose-800");
    feedback.innerHTML = `<i class="ti ti-alert-circle-filled text-lg"></i> Kurang tepat. Jawaban yang benar adalah: <strong class="ml-1">${qData.options[qData.ans]}</strong>`;
  }
  
  $("#quiz-score-live").textContent = `Skor: ${currentScore}`;
  
  // Tampilkan Next Button
  const nextBtn = $("#btn-next-question");
  nextBtn.classList.remove("hidden");
  if (currentQuestionIdx === quizQuestions.length - 1) {
    nextBtn.innerHTML = `Selesai <i class="ti ti-check"></i>`;
  } else {
    nextBtn.innerHTML = `Selanjutnya <i class="ti ti-arrow-right"></i>`;
  }
}

$("#btn-next-question")?.addEventListener("click", () => {
  if (currentQuestionIdx < quizQuestions.length - 1) {
    currentQuestionIdx++;
    renderQuestion();
  } else {
    finishQuiz();
  }
});

function finishQuiz() {
  elQuizQuestion.classList.add("hidden");
  elQuizResult.classList.remove("hidden");
  
  $("#quiz-final-score").textContent = `${currentScore} / ${quizQuestions.length}`;
  
  const hs = loadData(QUIZ_STORAGE_KEY, 0);
  if (currentScore > hs) {
    saveData(QUIZ_STORAGE_KEY, currentScore);
    loadQuizHighScore();
  }
  
  const icon = $("#quiz-result-icon");
  if (currentScore === quizQuestions.length) {
    icon.className = "inline-flex items-center justify-center w-20 h-20 rounded-full bg-emerald-100 text-emerald-600 mb-4";
    icon.innerHTML = `<i class="ti ti-trophy text-4xl"></i>`;
  } else if (currentScore >= quizQuestions.length / 2) {
    icon.className = "inline-flex items-center justify-center w-20 h-20 rounded-full bg-amber-100 text-amber-600 mb-4";
    icon.innerHTML = `<i class="ti ti-thumb-up text-4xl"></i>`;
  } else {
    icon.className = "inline-flex items-center justify-center w-20 h-20 rounded-full bg-slate-100 text-slate-600 mb-4";
    icon.innerHTML = `<i class="ti ti-mood-sad text-4xl"></i>`;
  }
}

$("#btn-retry-quiz")?.addEventListener("click", () => {
  elQuizResult.classList.add("hidden");
  elQuizStart.classList.remove("hidden");
});


/* ========== INITIALIZATION ========== */
document.addEventListener("DOMContentLoaded", () => {
  // Inisialisasi tab berdasar URL params
  const params = new URLSearchParams(window.location.search);
  switchTab(params.get("tab") || "expense", false);
  
  // Render awal data
  renderExpenses();
  renderBookmarks();
  loadQuizHighScore();
});
