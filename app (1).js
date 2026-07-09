/* ===========================================================
   Vocabulario Completo — simplified single-page flashcard app
   Data comes from data/vocab.js (VOCAB_DATA global, no fetch —
   works when opened directly via file:// with no local server).
   Custom words persist in localStorage per unit.
=========================================================== */

const LS_KEY = 'vocab_custom_words_v1';

let units = [];        // [{ key, theme, subtheme, base: [{es,en}] }]
let deck = [];          // current study deck: [{es,en,front}]
let cursor = 0;
let flipped = false;

// ---------- custom words storage ----------
function getCustomWords() {
  try {
    const raw = localStorage.getItem(LS_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch (e) { return {}; }
}
function saveCustomWords(obj) {
  localStorage.setItem(LS_KEY, JSON.stringify(obj));
}

// ---------- build flat unit list from VOCAB_DATA ----------
function buildUnits() {
  units = [];
  Object.keys(VOCAB_DATA).forEach(theme => {
    Object.keys(VOCAB_DATA[theme]).forEach(subtheme => {
      const key = theme + '::' + subtheme;
      units.push({ key, theme, subtheme, base: VOCAB_DATA[theme][subtheme] });
    });
  });
}

function wordsForUnit(unit) {
  const custom = getCustomWords()[unit.key] || [];
  return unit.base.concat(custom);
}

// ---------- populate dropdowns ----------
function populateSelects() {
  const unitSelect = document.getElementById('unitSelect');
  const addUnitSelect = document.getElementById('addUnitSelect');
  unitSelect.innerHTML = '';
  addUnitSelect.innerHTML = '';

  let currentTheme = null;
  let group = null;
  let addGroup = null;

  units.forEach(u => {
    if (u.theme !== currentTheme) {
      currentTheme = u.theme;
      group = document.createElement('optgroup');
      group.label = u.theme;
      unitSelect.appendChild(group);
      addGroup = document.createElement('optgroup');
      addGroup.label = u.theme;
      addUnitSelect.appendChild(addGroup);
    }
    const count = wordsForUnit(u).length;
    const opt = document.createElement('option');
    opt.value = u.key;
    opt.textContent = `${u.subtheme} (${count} palabras)`;
    group.appendChild(opt);

    const addOpt = document.createElement('option');
    addOpt.value = u.key;
    addOpt.textContent = u.subtheme;
    addGroup.appendChild(addOpt);
  });

  const total = units.reduce((sum, u) => sum + wordsForUnit(u).length, 0);
  document.getElementById('totalWordCount').textContent = total;
}

// ---------- deck building ----------
function shuffleArr(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function currentUnit() {
  const key = document.getElementById('unitSelect').value;
  return units.find(u => u.key === key);
}

function buildDeck(preserveOrder) {
  const unit = currentUnit();
  if (!unit) { deck = []; return; }
  const direction = document.getElementById('directionSelect').value;
  let words = wordsForUnit(unit);
  if (!preserveOrder) {
    // keep natural order by default (matches reference behaviour); shuffle only on button press
  }
  deck = words.map(w => {
    let front;
    if (direction === 'es-en') front = 'es';
    else if (direction === 'en-es') front = 'en';
    else front = Math.random() < 0.5 ? 'es' : 'en';
    return { es: w.es, en: w.en, front };
  });
  cursor = 0;
  flipped = false;
}

// ---------- render card ----------
function renderCard() {
  const wordEl = document.getElementById('cardWord');
  const langEl = document.getElementById('cardLang');
  const counterEl = document.getElementById('cardCounter');

  if (deck.length === 0) {
    wordEl.textContent = 'Sin palabras en esta unidad todavía.';
    langEl.textContent = '';
    counterEl.textContent = 'Tarjeta 0 de 0';
    document.getElementById('prevBtn').disabled = true;
    document.getElementById('nextBtn').disabled = true;
    return;
  }

  const card = deck[cursor];
  const showEs = flipped ? card.front !== 'es' : card.front === 'es';
  langEl.textContent = showEs ? 'ESPAÑOL' : 'ENGLISH';
  wordEl.textContent = showEs ? card.es : card.en;
  counterEl.textContent = `Tarjeta ${cursor + 1} de ${deck.length}`;

  document.getElementById('prevBtn').disabled = cursor === 0;
  document.getElementById('nextBtn').disabled = false;
}

// ---------- navigation ----------
function goNext() {
  if (deck.length === 0) return;
  flipped = false;
  cursor = (cursor + 1) % deck.length;
  renderCard();
}
function goPrev() {
  if (deck.length === 0 || cursor === 0) return;
  flipped = false;
  cursor -= 1;
  renderCard();
}
function doShuffle() {
  if (deck.length === 0) return;
  const currentCard = deck[cursor];
  deck = shuffleArr(deck);
  cursor = 0;
  flipped = false;
  renderCard();
}

// ---------- events ----------
document.getElementById('unitSelect').addEventListener('change', () => {
  buildDeck();
  renderCard();
});
document.getElementById('directionSelect').addEventListener('change', () => {
  buildDeck();
  renderCard();
});
document.getElementById('flashcard').addEventListener('click', () => {
  if (deck.length === 0) return;
  flipped = !flipped;
  renderCard();
});
document.getElementById('nextBtn').addEventListener('click', goNext);
document.getElementById('prevBtn').addEventListener('click', goPrev);
document.getElementById('shuffleBtn').addEventListener('click', doShuffle);

document.addEventListener('keydown', e => {
  if (e.key === 'ArrowRight') goNext();
  if (e.key === 'ArrowLeft') goPrev();
  if (e.key === ' ') {
    e.preventDefault();
    document.getElementById('flashcard').click();
  }
});

// ---------- add custom word ----------
document.getElementById('addBtn').addEventListener('click', () => {
  const unitKey = document.getElementById('addUnitSelect').value;
  const es = document.getElementById('addEs').value.trim();
  const en = document.getElementById('addEn').value.trim();
  const hint = document.getElementById('addHint');
  if (!es || !en) {
    hint.textContent = 'Escribe la palabra en español y en inglés.';
    return;
  }
  const custom = getCustomWords();
  if (!custom[unitKey]) custom[unitKey] = [];
  custom[unitKey].push({ es, en });
  saveCustomWords(custom);

  document.getElementById('addEs').value = '';
  document.getElementById('addEn').value = '';
  const unit = units.find(u => u.key === unitKey);
  hint.textContent = `Añadida a "${unit.subtheme}".`;

  populateSelects();
  document.getElementById('unitSelect').value = unitKey;
  if (currentUnit() && currentUnit().key === unitKey) {
    buildDeck();
    renderCard();
  }
});

// ---------- init ----------
function init() {
  buildUnits();
  populateSelects();
  buildDeck();
  renderCard();
}
init();
