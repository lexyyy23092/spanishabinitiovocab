/* ===========================================================
   Fichero — app logic
   Vanilla JS, no build step. Data loaded from data/vocab.json.
   Custom "Mis palabras" persisted in localStorage.
=========================================================== */

const LS_KEY_MYWORDS = 'fichero_my_words_v1';

let VOCAB = {};          // { theme: { subtheme: [{es,en}] } }
let selectedTheme = null;
let selectedSubthemes = new Set();
let direction = 'mixed';       // 'mixed' | 'es-en' | 'en-es'
let shuffleOn = true;

let deck = [];            // array of {es, en, theme, dirFront} for current session
let cursor = 0;
let sessionSeenCount = 0;
let isFlipped = false;

// ---------- helpers ----------
function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function getMyWords() {
  try {
    const raw = localStorage.getItem(LS_KEY_MYWORDS);
    return raw ? JSON.parse(raw) : [];
  } catch (e) { return []; }
}
function saveMyWords(list) {
  localStorage.setItem(LS_KEY_MYWORDS, JSON.stringify(list));
}

// ---------- load data ----------
async function loadVocab() {
  const res = await fetch('data/vocab.json');
  VOCAB = await res.json();

  // fold in "Mis palabras" as its own theme, only once it has words
  const mine = getMyWords();
  if (mine.length > 0) {
    VOCAB['Mis palabras'] = { 'Palabras añadidas': mine.map(w => ({ es: w.es, en: w.en, note: w.note })) };
  }

  renderThemeList();
  renderMyWords();
}

// ---------- setup view rendering ----------
function renderThemeList() {
  const el = document.getElementById('themeList');
  el.innerHTML = '';
  Object.keys(VOCAB).forEach(theme => {
    const count = Object.values(VOCAB[theme]).reduce((a, w) => a + w.length, 0);
    const item = document.createElement('div');
    item.className = 'theme-item' + (theme === selectedTheme ? ' active' : '');
    item.innerHTML = `<span class="t-name">${theme}</span><span class="t-count">${count}</span>`;
    item.addEventListener('click', () => {
      selectedTheme = theme;
      selectedSubthemes = new Set(Object.keys(VOCAB[theme])); // default: all subthemes on
      renderThemeList();
      renderSubthemeList();
      updateSetupCount();
    });
    el.appendChild(item);
  });
}

function renderSubthemeList() {
  const el = document.getElementById('subthemeList');
  el.innerHTML = '';
  if (!selectedTheme) {
    el.innerHTML = '<p class="hint">Elige un tema para ver sus subtemas.</p>';
    return;
  }
  const subs = VOCAB[selectedTheme];
  Object.keys(subs).forEach(sub => {
    const row = document.createElement('label');
    row.className = 'subtheme-row';
    const checked = selectedSubthemes.has(sub) ? 'checked' : '';
    row.innerHTML = `
      <input type="checkbox" ${checked} data-sub="${sub}">
      <span>${sub}</span>
      <span class="s-count">${subs[sub].length}</span>
    `;
    row.querySelector('input').addEventListener('change', e => {
      if (e.target.checked) selectedSubthemes.add(sub);
      else selectedSubthemes.delete(sub);
      updateSetupCount();
    });
    el.appendChild(row);
  });
}

function currentSelectionWords() {
  if (!selectedTheme) return [];
  const subs = VOCAB[selectedTheme];
  let words = [];
  selectedSubthemes.forEach(sub => {
    if (subs[sub]) words = words.concat(subs[sub].map(w => ({ ...w, theme: selectedTheme, subtheme: sub })));
  });
  return words;
}

function updateSetupCount() {
  const n = currentSelectionWords().length;
  document.getElementById('setupCount').textContent = `${n} palabra${n === 1 ? '' : 's'} seleccionada${n === 1 ? '' : 's'}`;
  document.getElementById('startBtn').disabled = n === 0;
}

// ---------- my words ----------
function renderMyWords() {
  const list = getMyWords();
  const el = document.getElementById('myWordsList');
  if (list.length === 0) {
    el.innerHTML = '<p class="hint">Todavía no has añadido palabras propias.</p>';
    return;
  }
  el.innerHTML = '';
  list.forEach((w, idx) => {
    const card = document.createElement('div');
    card.className = 'my-word-card';
    card.innerHTML = `
      <button class="mw-del" title="Eliminar" data-idx="${idx}">×</button>
      <div class="mw-es">${w.es}</div>
      <div class="mw-en">${w.en}${w.note ? ' · ' + w.note : ''}</div>
    `;
    card.querySelector('.mw-del').addEventListener('click', () => {
      const cur = getMyWords();
      cur.splice(idx, 1);
      saveMyWords(cur);
      if (cur.length > 0) {
        VOCAB['Mis palabras'] = { 'Palabras añadidas': cur.map(x => ({ es: x.es, en: x.en, note: x.note })) };
      } else {
        delete VOCAB['Mis palabras'];
        if (selectedTheme === 'Mis palabras') { selectedTheme = null; selectedSubthemes = new Set(); }
      }
      renderMyWords();
      renderThemeList();
      renderSubthemeList();
      updateSetupCount();
    });
    el.appendChild(card);
  });
}

// ---------- direction / shuffle buttons ----------
document.getElementById('directionOptions').addEventListener('click', e => {
  const btn = e.target.closest('.dir-btn');
  if (!btn) return;
  direction = btn.dataset.dir;
  document.querySelectorAll('#directionOptions .dir-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
});

document.querySelectorAll('.direction-options')[1].addEventListener('click', e => {
  const btn = e.target.closest('.dir-btn');
  if (!btn) return;
  shuffleOn = btn.dataset.shuffle === 'true';
  btn.parentElement.querySelectorAll('.dir-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
});

document.getElementById('selectAllSub').addEventListener('click', () => {
  if (!selectedTheme) return;
  selectedSubthemes = new Set(Object.keys(VOCAB[selectedTheme]));
  renderSubthemeList();
  updateSetupCount();
});
document.getElementById('selectNoneSub').addEventListener('click', () => {
  selectedSubthemes = new Set();
  renderSubthemeList();
  updateSetupCount();
});

// ---------- deck building ----------
function buildDeck() {
  let words = currentSelectionWords();
  if (shuffleOn) words = shuffle(words);
  deck = words.map(w => {
    let front;
    if (direction === 'es-en') front = 'es';
    else if (direction === 'en-es') front = 'en';
    else front = Math.random() < 0.5 ? 'es' : 'en';
    return { ...w, front };
  });
  cursor = 0;
  sessionSeenCount = 0;
}

// ---------- study view rendering ----------
function showCard() {
  const card = deck[cursor];
  isFlipped = false;
  document.getElementById('flashcard').classList.remove('flipped');
  document.getElementById('ratingRow').classList.remove('show');

  const frontIsEs = card.front === 'es';
  document.getElementById('frontFlag').textContent = frontIsEs ? 'ES' : 'EN';
  document.getElementById('frontText').textContent = frontIsEs ? card.es : card.en;
  document.getElementById('backFlag').textContent = frontIsEs ? 'EN' : 'ES';
  document.getElementById('backText').textContent = frontIsEs ? card.en : card.es;

  document.getElementById('cardTheme').textContent = `${card.theme} · ${card.subtheme}`;
  document.getElementById('sessionStamp').textContent = `${cursor + 1} / ${deck.length} tarjetas`;

  const pct = ((cursor) / deck.length) * 100;
  document.getElementById('progressFill').style.width = pct + '%';

  document.getElementById('prevCard').disabled = cursor === 0;
}

function flipCard() {
  isFlipped = !isFlipped;
  document.getElementById('flashcard').classList.toggle('flipped', isFlipped);
  document.getElementById('ratingRow').classList.toggle('show', isFlipped);
}

function goNext() {
  if (cursor < deck.length - 1) {
    cursor++;
    showCard();
  } else {
    finishSession();
  }
}
function goPrev() {
  if (cursor > 0) {
    cursor--;
    showCard();
  }
}

function finishSession() {
  document.getElementById('studyView').classList.add('hidden');
  document.getElementById('doneView').classList.remove('hidden');
  document.getElementById('doneStats').textContent = `Has repasado ${deck.length} tarjeta${deck.length === 1 ? '' : 's'} de "${selectedTheme}".`;
}

// ---------- view switching ----------
function goToStudy() {
  buildDeck();
  document.getElementById('setupView').classList.add('hidden');
  document.getElementById('doneView').classList.add('hidden');
  document.getElementById('studyView').classList.remove('hidden');
  showCard();
}
function goToSetup() {
  document.getElementById('studyView').classList.add('hidden');
  document.getElementById('doneView').classList.add('hidden');
  document.getElementById('setupView').classList.remove('hidden');
  document.getElementById('sessionStamp').textContent = `0 / 0 tarjetas`;
}

// ---------- event wiring ----------
document.getElementById('startBtn').addEventListener('click', goToStudy);
document.getElementById('backToSetup').addEventListener('click', goToSetup);
document.getElementById('restartNew').addEventListener('click', goToSetup);
document.getElementById('restartSame').addEventListener('click', () => {
  document.getElementById('doneView').classList.add('hidden');
  document.getElementById('studyView').classList.remove('hidden');
  goToStudy();
});
document.getElementById('shuffleAgain').addEventListener('click', () => {
  deck = shuffle(deck);
  cursor = 0;
  showCard();
});

const flashcardEl = document.getElementById('flashcard');
flashcardEl.addEventListener('click', flipCard);
flashcardEl.addEventListener('keydown', e => {
  if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); flipCard(); }
});

document.getElementById('nextCard').addEventListener('click', goNext);
document.getElementById('prevCard').addEventListener('click', goPrev);

document.getElementById('ratingRow').addEventListener('click', e => {
  const btn = e.target.closest('.rate-btn');
  if (!btn) return;
  // simple self-assessment; could be extended to weight future sessions
  goNext();
});

document.addEventListener('keydown', e => {
  if (document.getElementById('studyView').classList.contains('hidden')) return;
  if (e.key === 'ArrowRight') goNext();
  if (e.key === 'ArrowLeft') goPrev();
});

// ---------- add word modal ----------
const modal = document.getElementById('addWordModal');
document.getElementById('addWordBtn').addEventListener('click', () => modal.classList.remove('hidden'));
document.getElementById('closeModal').addEventListener('click', () => modal.classList.add('hidden'));
modal.addEventListener('click', e => { if (e.target === modal) modal.classList.add('hidden'); });

document.getElementById('addWordForm').addEventListener('submit', e => {
  e.preventDefault();
  const es = document.getElementById('inputEs').value.trim();
  const en = document.getElementById('inputEn').value.trim();
  const note = document.getElementById('inputNote').value.trim();
  if (!es || !en) return;
  const cur = getMyWords();
  cur.push({ es, en, note });
  saveMyWords(cur);
  VOCAB['Mis palabras'] = { 'Palabras añadidas': cur.map(x => ({ es: x.es, en: x.en, note: x.note })) };
  document.getElementById('addWordForm').reset();
  modal.classList.add('hidden');
  renderMyWords();
  renderThemeList();
  if (selectedTheme === 'Mis palabras') { renderSubthemeList(); updateSetupCount(); }
});

// ---------- init ----------
loadVocab();
