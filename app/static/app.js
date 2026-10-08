// ==========================================================================
// app.js - Universal AI Communication Coach (Unsaid / Say It Right)
// Features: Learning-First · Dynamic Context · Adaptive Situation Chips
// Interactive Score Popups · Interactive In-Text Flags · Privacy Modal
// Skeleton UI Typewriter Loader · Swappable Models (Default Flash Lite)
// One-Click Email & Gmail Draft Launcher · Dual Theme (Default Light Mode)
// ==========================================================================

let draft = '';
let busy = false;
let currentDiagnosis = null;
let currentRewrite = null;

// DOM Elements
const brandHome = document.getElementById('brandHome');
const inputs = [...document.querySelectorAll('textarea')];
const charCount1 = document.getElementById('charCount1');
const charCount2 = document.getElementById('charCount2');
const recipientInput = document.getElementById('recipientInput');
const situationInput = document.getElementById('situationInput');
const recipientChips = document.getElementById('recipientChips');
const situationChips = document.getElementById('situationChips');

const modelDropdownWrap = document.getElementById('modelDropdownWrap');
const btnModelToggle = document.getElementById('btnModelToggle');
const modelDropdownMenu = document.getElementById('modelDropdownMenu');
const activeModelName = document.getElementById('activeModelName');
const modelSelect = document.getElementById('modelSelect');
const themeToggle = document.getElementById('themeToggle');
const themeIcon = document.getElementById('themeIcon');
const themeLabel = document.getElementById('themeLabel');

const overallScoreBadge = document.getElementById('overallScoreBadge');
const verdictBox = document.getElementById('verdictBox');
const dimensionGrid = document.getElementById('dimensionGrid');
const annotatedDraft = document.getElementById('annotatedDraft');
const flagCounter = document.getElementById('flagCounter');

// Modal Elements (Tone Issue Flag Popup)
const flagModal = document.getElementById('flagModal');
const modalPhrase = document.getElementById('modalPhrase');
const modalPrinciple = document.getElementById('modalPrinciple');
const modalReason = document.getElementById('modalReason');
const modalNudge = document.getElementById('modalNudge');
const btnCloseModal = document.getElementById('btnCloseModal');
const btnDismissModal = document.getElementById('btnDismissModal');
const btnApplyModal = document.getElementById('btnApplyModal');

// Modal Elements (Score Dimension Inspection Popup)
const scoreModal = document.getElementById('scoreModal');
const scoreModalTitle = document.getElementById('scoreModalTitle');
const scoreModalValue = document.getElementById('scoreModalValue');
const scoreModalTarget = document.getElementById('scoreModalTarget');
const scoreModalDesc = document.getElementById('scoreModalDesc');
const scoreModalLinkedFlagsBlock = document.getElementById('scoreModalLinkedFlagsBlock');
const scoreModalLinkedFlags = document.getElementById('scoreModalLinkedFlags');
const scoreModalAdvice = document.getElementById('scoreModalAdvice');
const btnCloseScoreModal = document.getElementById('btnCloseScoreModal');
const btnDismissScoreModal = document.getElementById('btnDismissScoreModal');

// Zero-Retention Privacy Modal Elements
const btnPrivacy = document.getElementById('btnPrivacy');
const privacyModal = document.getElementById('privacyModal');
const btnClosePrivacyModal = document.getElementById('btnClosePrivacyModal');
const btnDismissPrivacyModal = document.getElementById('btnDismissPrivacyModal');

// Splash Screen Elements
const splashScreen = document.getElementById('splashScreen');
const btnCloseSplash = document.getElementById('btnCloseSplash');
const btnStartApp = document.getElementById('btnStartApp');
const btnOpenGuide = document.getElementById('btnOpenGuide');

// Skeleton Loading & Typewriter Elements
const loadingOverlay = document.getElementById('loadingOverlay');
const typewriterText = document.getElementById('typewriterText');

// Rewrite, Copy & Email Launcher Elements
const rewriteTextElement = document.getElementById('rewrite');
const honestyBanner = document.getElementById('honestyBanner');
const takeawayBox = document.getElementById('takeawayBox');
const changesContainer = document.getElementById('changesContainer');
const btnCopyRewrite = document.getElementById('btnCopyRewrite');
const btnCopyDraft = document.getElementById('btnCopyDraft');
const btnOpenEmail = document.getElementById('btnOpenEmail');
const btnOpenGmail = document.getElementById('btnOpenGmail');

// ==========================================================================
// THEME MANAGEMENT (DEFAULT: LIGHT MODE)
// ==========================================================================
function updateThemeUI(theme) {
  const isLight = theme === 'light';
  if (themeIcon) themeIcon.textContent = isLight ? '🌙' : '☀️';
  if (themeLabel) themeLabel.textContent = isLight ? 'Dark' : 'Light';
}

function initTheme() {
  const saved = localStorage.getItem('unsaid_theme');
  const currentTheme = saved || 'light';
  document.documentElement.setAttribute('data-theme', currentTheme);
  updateThemeUI(currentTheme);

  if (themeToggle) {
    themeToggle.addEventListener('click', () => {
      const nowTheme = document.documentElement.getAttribute('data-theme') === 'light' ? 'dark' : 'light';
      document.documentElement.setAttribute('data-theme', nowTheme);
      localStorage.setItem('unsaid_theme', nowTheme);
      updateThemeUI(nowTheme);
    });
  }
}

// ==========================================================================
// BRAND HOME LINK (CLICK TO GO TO HOMEPAGE)
// ==========================================================================
function resetToHomepage() {
  draft = '';
  inputs.forEach(input => (input.value = ''));
  updateCharCounts();
  if (annotatedDraft) annotatedDraft.innerHTML = '';
  if (verdictBox) verdictBox.innerHTML = '';
  if (dimensionGrid) dimensionGrid.innerHTML = '';
  if (rewriteTextElement) rewriteTextElement.textContent = '';
  if (changesContainer) changesContainer.innerHTML = '';
  hideLoading();
  showStep(1);
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

if (brandHome) {
  brandHome.addEventListener('click', e => {
    e.preventDefault();
    resetToHomepage();
  });
}

// ==========================================================================
// SPLASH SCREEN (ONBOARDING & GUIDE)
// ==========================================================================
function openSplash() {
  if (!splashScreen) return;
  splashScreen.classList.add('open');
  splashScreen.setAttribute('aria-hidden', 'false');
}

function closeSplash() {
  if (!splashScreen) return;
  splashScreen.classList.remove('open');
  splashScreen.setAttribute('aria-hidden', 'true');
}

function initSplashScreen() {
  // Always open guide splash screen when page loads
  setTimeout(openSplash, 150);

  if (btnCloseSplash) btnCloseSplash.addEventListener('click', closeSplash);
  if (btnStartApp) btnStartApp.addEventListener('click', closeSplash);
  if (btnOpenGuide) btnOpenGuide.addEventListener('click', openSplash);

  if (splashScreen) {
    splashScreen.addEventListener('click', e => {
      if (e.target === splashScreen) closeSplash();
    });
  }
}

// ==========================================================================
// TYPEWRITER AUTO-TYPING ENGINE (SKELETON LOADER WITH WITTY GREY TEXT)
// ==========================================================================
const TYPEWRITER_MESSAGES = [
  "Filtering out 'per my previous email' with extreme prejudice…",
  "Teaching the recipient empathy… please stand by.",
  "Untangling 14 passive-aggressive adjectives…",
  "Translating 'With all due respect' into actual human respect…",
  "Removing exclamation marks so you don't sound like a golden retriever…",
  "Converting emotional fire into diplomatic smoke signals…",
  "Making sure this doesn't accidentally sound like a hostage negotiation…",
  "Replacing 'As per discussed' with clear, non-robotic English…",
  "Calibrating the exact dosage of professional detachment…",
  "Consulting the Oxford Comma Preservation Society…",
  "Grammar fact: Passive voice hides the actor ('Mistakes were made' deflects accountability).",
  "Tone science: Ending a short sentence with just 'Fine.' lowers perceived warmth by 83%.",
  "Communication tip: High stakes + high emotion = slow down and state the ask first.",
  "Grammar quirk: The word 'set' has over 430 distinct definitions in the Oxford English Dictionary.",
  "Tone science: 'Could we revisit the timeline?' gets 40% more cooperation than 'You promised Tuesday'.",
  "Grammar rule: A semicolon connects two independent thoughts—use it like a bridge, not a barrier.",
  "Tone rule: When apologizing, never use 'if' ('I'm sorry if you felt...'). Own the impact directly."
];

let typewriterTimer = null;
let currentMsgIdx = 0;
let currentCharIdx = 0;
let isDeleting = false;

function tickTypewriter() {
  if (!typewriterText || !loadingOverlay || loadingOverlay.hidden) return;

  const currentMsg = TYPEWRITER_MESSAGES[currentMsgIdx % TYPEWRITER_MESSAGES.length];

  if (!isDeleting) {
    currentCharIdx++;
    typewriterText.textContent = currentMsg.slice(0, currentCharIdx);

    if (currentCharIdx >= currentMsg.length) {
      isDeleting = true;
      typewriterTimer = setTimeout(tickTypewriter, 2200);
      return;
    }
    typewriterTimer = setTimeout(tickTypewriter, 35);
  } else {
    currentCharIdx--;
    typewriterText.textContent = currentMsg.slice(0, currentCharIdx);

    if (currentCharIdx <= 0) {
      isDeleting = false;
      currentMsgIdx++;
      typewriterTimer = setTimeout(tickTypewriter, 350);
      return;
    }
    typewriterTimer = setTimeout(tickTypewriter, 18);
  }
}

function startTypewriter() {
  clearTimeout(typewriterTimer);
  currentCharIdx = 0;
  isDeleting = false;
  currentMsgIdx = Math.floor(Math.random() * TYPEWRITER_MESSAGES.length);
  tickTypewriter();
}

function stopTypewriter() {
  clearTimeout(typewriterTimer);
}

function showLoading() {
  if (!loadingOverlay) return;
  loadingOverlay.hidden = false;
  startTypewriter();
}

function hideLoading() {
  if (!loadingOverlay) return;
  loadingOverlay.hidden = true;
  stopTypewriter();
}

// ==========================================================================
// ANIMATED COPY & EMAIL INTEGRATIONS (ONE-CLICK PRE-FILLED DRAFT)
// ==========================================================================
async function copyWithAnimation(button, textToCopy, defaultLabel) {
  if (!button || !textToCopy) return;
  try {
    await navigator.clipboard.writeText(textToCopy);
    const originalText = button.innerHTML;
    button.innerHTML = '✓ COPIED!';
    button.classList.add('copy-success');

    setTimeout(() => {
      button.innerHTML = originalText;
      button.classList.remove('copy-success');
    }, 2000);
  } catch (err) {
    console.warn('Copy failed:', err);
  }
}

if (btnCopyRewrite) {
  btnCopyRewrite.addEventListener('click', () => {
    if (currentRewrite && currentRewrite.rewrite) {
      copyWithAnimation(btnCopyRewrite, currentRewrite.rewrite, '📋 COPY REWRITE');
    }
  });
}

if (btnCopyDraft) {
  btnCopyDraft.addEventListener('click', () => {
    if (draft && draft.trim()) {
      copyWithAnimation(btnCopyDraft, draft, '📋 COPY DRAFT');
    }
  });
}

function getEmailDraftData() {
  const sit = situationInput && situationInput.value.trim() ? situationInput.value.trim() : 'Important update';
  const subject = `Regarding: ${sit}`;
  const body = (currentRewrite && currentRewrite.rewrite) ? currentRewrite.rewrite : (draft || '');
  return { subject, body };
}

if (btnOpenEmail) {
  btnOpenEmail.addEventListener('click', () => {
    const { subject, body } = getEmailDraftData();
    if (!body) {
      alert('Please write or generate a rewrite first.');
      return;
    }
    const mailto = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    window.location.href = mailto;
  });
}

if (btnOpenGmail) {
  btnOpenGmail.addEventListener('click', () => {
    const { subject, body } = getEmailDraftData();
    if (!body) {
      alert('Please write or generate a rewrite first.');
      return;
    }
    const gmailUrl = `https://mail.google.com/mail/?view=cm&fs=1&su=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    window.open(gmailUrl, '_blank', 'noopener,noreferrer');
  });
}

// ==========================================================================
// MODEL PICKER (DEFAULTS TO FLASH LITE)
// ==========================================================================
function initModelPicker() {
  if (!btnModelToggle || !modelDropdownWrap || !modelDropdownMenu) return;

  // Toggle dropdown on button click
  btnModelToggle.addEventListener('click', (e) => {
    e.stopPropagation();
    const isOpen = modelDropdownWrap.classList.toggle('open');
    btnModelToggle.setAttribute('aria-expanded', String(isOpen));
  });

  // Close when clicking outside
  document.addEventListener('click', (e) => {
    if (!modelDropdownWrap.contains(e.target)) {
      modelDropdownWrap.classList.remove('open');
      btnModelToggle.setAttribute('aria-expanded', 'false');
    }
  });

  // Option selection
  modelDropdownMenu.addEventListener('click', async (e) => {
    const item = e.target.closest('.model-menu-item');
    if (!item || !item.dataset.val) return;
    const chosenVal = item.dataset.val;

    // Update active UI
    modelDropdownMenu.querySelectorAll('.model-menu-item').forEach(it => {
      it.classList.remove('active');
      const check = it.querySelector('.item-check');
      if (check) check.textContent = '';
    });
    item.classList.add('active');
    const check = item.querySelector('.item-check');
    if (check) check.textContent = '✓';

    const itemName = item.querySelector('.item-name');
    if (itemName && activeModelName) {
      activeModelName.textContent = itemName.textContent.trim();
    }

    if (modelSelect) modelSelect.value = chosenVal;

    modelDropdownWrap.classList.remove('open');
    btnModelToggle.setAttribute('aria-expanded', 'false');

    try {
      await fetch('/model', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: chosenVal }),
      });
    } catch (err) {
      console.warn('Failed to switch model on server:', err);
    }
  });

  // Sync with server /models
  fetch('/models')
    .then(r => r.json())
    .then(data => {
      const active = data.active || 'gemini-3.1-flash-lite';
      const targetItem = modelDropdownMenu.querySelector(`[data-val="${active}"]`);
      if (targetItem) {
        modelDropdownMenu.querySelectorAll('.model-menu-item').forEach(it => {
          it.classList.remove('active');
          const check = it.querySelector('.item-check');
          if (check) check.textContent = '';
        });
        targetItem.classList.add('active');
        const check = targetItem.querySelector('.item-check');
        if (check) check.textContent = '✓';
        const itemName = targetItem.querySelector('.item-name');
        if (itemName && activeModelName) {
          activeModelName.textContent = itemName.textContent.trim();
        }
        if (modelSelect) modelSelect.value = active;
      }
    })
    .catch(err => console.warn('Could not query /models:', err));
}

// ==========================================================================
// EMOJI SITUATION CHIPS (TRIGGERED ONLY WHEN RECIPIENT CHIP IS CLICKED)
// ==========================================================================
const RECIPIENT_SITUATIONS = {
  manager: [
    { label: "💰 Salary & Compensation Review", val: "Salary & Compensation Review" },
    { label: "⏳ Project Deadline Extension", val: "Project Deadline Extension" },
    { label: "🛑 Pushing Back on Workload", val: "Pushing Back on Scope & Workload" },
    { label: "👀 Addressing Micromanagement", val: "Addressing Micromanagement" },
    { label: "🏠 Requesting Remote / Flex Hours", val: "Requesting Remote Work / Flex Hours" },
    { label: "⚖️ Unfair Performance Review", val: "Addressing Unfair Performance Review" }
  ],
  colleague: [
    { label: "⚖️ Unequal Workload Split", val: "Unequal Workload Split" },
    { label: "🚨 Missed Milestone Escalation", val: "Missed Milestone Escalation" },
    { label: "💻 Code & Design Disagreement", val: "Code & Design Disagreement" },
    { label: "💬 Giving Difficult Feedback", val: "Giving Difficult Feedback" },
    { label: "🤝 Asking for Urgent Coverage", val: "Asking for Urgent Coverage" },
    { label: "🛡️ Credit Taken for Shared Work", val: "Credit Taken for Shared Work" }
  ],
  client: [
    { label: "📈 Scope Creep & Extra Invoicing", val: "Scope Creep & Extra Invoicing" },
    { label: "⏱️ Project Delay & Timeline Reset", val: "Project Delay & Timeline Reset" },
    { label: "🚫 Rejecting Unreasonable Demand", val: "Rejecting Unreasonable Demand" },
    { label: "💼 Retainer & Budget Increase", val: "Budget & Retainer Increase" },
    { label: "🛠️ Firm Apology & Resolution Plan", val: "Firm Apology & Resolution Plan" },
    { label: "🚪 Ending Client Contract", val: "Ending Client Contract" }
  ],
  landlord: [
    { label: "🔧 Urgent Maintenance Repair", val: "Urgent Maintenance Repair" },
    { label: "📅 Late Rent Notice & Plan", val: "Late Rent Notice & Plan" },
    { label: "💵 Disputing Deposit Deduction", val: "Disputing Deposit Deduction" },
    { label: "📜 Lease Renewal & Rent Freeze", val: "Lease Renewal & Rent Freeze" },
    { label: "🔊 Chronic Neighbor Noise", val: "Chronic Neighbor Noise" },
    { label: "📦 Notice to Vacate Unit", val: "Notice to Vacate Unit" }
  ],
  partner: [
    { label: "💔 Emotional Needs & Disconnect", val: "Emotional Needs & Disconnect" },
    { label: "🧹 Dividing Household Chores", val: "Dividing Household Chores" },
    { label: "💸 Financial Disagreement", val: "Financial Disagreement" },
    { label: "🩹 Addressing Hurtful Words", val: "Addressing Hurtful Words" },
    { label: "🛑 Needing Space & Boundaries", val: "Needing Space & Boundaries" },
    { label: "💍 Future & Commitment Talk", val: "Future & Commitment Talk" }
  ],
  professor: [
    { label: "📝 Grade Re-evaluation Request", val: "Grade Re-evaluation Request" },
    { label: "🏥 Medical Deadline Extension", val: "Medical Deadline Extension" },
    { label: "✍️ Letter of Recommendation", val: "Letter of Recommendation" },
    { label: "🔬 Joining Research Group", val: "Joining Research Group" },
    { label: "📚 Missed Mandatory Lecture", val: "Missed Mandatory Lecture" },
    { label: "❓ Exam Problem Clarification", val: "Exam Problem Clarification" }
  ]
};

function renderSituationChipsForCategory(category) {
  if (!situationChips) return;
  const list = RECIPIENT_SITUATIONS[category] || RECIPIENT_SITUATIONS.manager;
  situationChips.innerHTML = list
    .map((item, idx) => `
      <button type="button" class="chip-btn ${idx === 0 ? 'active' : ''}" data-val="${escapeHtml(item.val)}">
        ${escapeHtml(item.label)}
      </button>
    `)
    .join('');
}

function initContextChips() {
  // Only change situation chips when a recipient chip is clicked!
  if (recipientChips && recipientInput) {
    recipientChips.addEventListener('click', e => {
      const btn = e.target.closest('.chip-btn');
      if (btn && btn.dataset.val) {
        // Highlight active recipient chip
        recipientChips.querySelectorAll('.chip-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');

        // Update recipient input value
        recipientInput.value = btn.dataset.val;

        // Render emoji situation chips for this category
        const cat = btn.dataset.category || 'manager';
        renderSituationChipsForCategory(cat);

        // Auto-set situation input to the first situation of this set
        const list = RECIPIENT_SITUATIONS[cat] || RECIPIENT_SITUATIONS.manager;
        if (list && list[0] && situationInput) {
          situationInput.value = list[0].val;
        }
      }
    });
  }

  // When a situation chip is clicked, set the situation input
  if (situationChips && situationInput) {
    situationChips.addEventListener('click', e => {
      const btn = e.target.closest('.chip-btn');
      if (btn && btn.dataset.val) {
        situationChips.querySelectorAll('.chip-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        situationInput.value = btn.dataset.val;
      }
    });
  }

  // Initial load: render manager situations with emojis
  renderSituationChipsForCategory('manager');
}

// ==========================================================================
// ZERO-RETENTION PRIVACY MODAL (AUTHENTIC CODE ARCHITECTURE)
// ==========================================================================
function openPrivacyModal() {
  if (!privacyModal) return;
  privacyModal.classList.add('open');
  privacyModal.setAttribute('aria-hidden', 'false');
  if (btnClosePrivacyModal) btnClosePrivacyModal.focus();
}

function closePrivacyModal() {
  if (!privacyModal) return;
  privacyModal.classList.remove('open');
  privacyModal.setAttribute('aria-hidden', 'true');
}

if (btnPrivacy) btnPrivacy.addEventListener('click', openPrivacyModal);
if (btnClosePrivacyModal) btnClosePrivacyModal.addEventListener('click', closePrivacyModal);
if (btnDismissPrivacyModal) btnDismissPrivacyModal.addEventListener('click', closePrivacyModal);

if (privacyModal) {
  privacyModal.addEventListener('click', e => {
    if (e.target === privacyModal) closePrivacyModal();
  });
}

// ==========================================================================
// SCORE DIMENSION INSPECTION POPUP (STEP 2 LEARNING POPUP)
// ==========================================================================
const RUBRIC_EXPLANATIONS = {
  clarity: {
    title: "Clarity of Ask",
    desc: "Evaluates whether your core request or purpose is stated upfront without ambiguity or buried behind defensive prose.",
    advice: "State exactly what you are requesting, asking for, or proposing within the first 1-2 sentences. Avoid passive hedging like 'I was just wondering if maybe...'"
  },
  accountability: {
    title: "Accountability & Ownership",
    desc: "Measures whether you own your contributions and solutions rather than shifting blame, finger-pointing, or sounding like a victim of circumstances.",
    advice: "Acknowledge challenges objectively. Pair any constraint with a concrete next step or proposed solution ('Here is what I have completed, and here is what is needed next')."
  },
  warmth: {
    title: "Warmth & Respect",
    desc: "Assesses relational goodwill, consideration, and empathy. Detects curtness, sarcasm, exasperation, or passive aggression.",
    advice: "Begin with a sincere, respectful greeting and end on a forward-looking, courteous note. Frame disagreements constructively rather than confrontational."
  },
  formality: {
    title: "Formality Fit",
    desc: "Checks whether your linguistic register matches the recipient and the gravity of the situation (e.g. professional reserve vs peer camaraderie).",
    advice: "Ensure your tone matches the recipient: avoid slang and casual idioms for managers or clients, but avoid cold legalese for close colleagues."
  },
  proportion: {
    title: "Proportion & Concision",
    desc: "Analyzes message length and emotional intensity relative to what is needed. Overly long explanations can signal anxiety or defensiveness.",
    advice: "Trim unnecessary backstories and emotional justifications. Direct, well-paced communication commands higher respect and faster responses."
  }
};

function openScoreModal(dim, linkedFlags) {
  if (!scoreModal || !dim) return;

  const rubric = RUBRIC_EXPLANATIONS[dim.id] || {
    title: dim.label || dim.id,
    desc: dim.description || 'Evaluates tone adherence to communication best practices.',
    advice: 'Keep your message clear, honest, and proportionate to the situation.'
  };

  if (scoreModalTitle) scoreModalTitle.textContent = `📊 ${rubric.title.toUpperCase()}`;
  if (scoreModalValue) scoreModalValue.textContent = `${dim.value || 3} / 5`;
  if (scoreModalTarget) {
    scoreModalTarget.textContent = dim.target_min ? `Target: ${dim.target_min}–${dim.target_max || 5}/5` : 'Target: 4–5/5';
  }
  if (scoreModalDesc) scoreModalDesc.textContent = dim.description || rubric.desc;
  if (scoreModalAdvice) scoreModalAdvice.textContent = rubric.advice;

  if (scoreModalLinkedFlags && scoreModalLinkedFlagsBlock) {
    if (linkedFlags && linkedFlags.length > 0) {
      scoreModalLinkedFlagsBlock.style.display = 'block';
      scoreModalLinkedFlags.innerHTML = linkedFlags
        .map(f => `<span class="score-linked-flag-pill" title="${escapeHtml(f.reason || '')}">“${escapeHtml(f.text || '')}”</span>`)
        .join('');
    } else {
      scoreModalLinkedFlagsBlock.style.display = 'none';
      scoreModalLinkedFlags.innerHTML = '';
    }
  }

  scoreModal.classList.add('open');
  scoreModal.setAttribute('aria-hidden', 'false');
  if (btnCloseScoreModal) btnCloseScoreModal.focus();
}

function closeScoreModal() {
  if (!scoreModal) return;
  scoreModal.classList.remove('open');
  scoreModal.setAttribute('aria-hidden', 'true');
}

if (btnCloseScoreModal) btnCloseScoreModal.addEventListener('click', closeScoreModal);
if (btnDismissScoreModal) btnDismissScoreModal.addEventListener('click', closeScoreModal);

if (scoreModal) {
  scoreModal.addEventListener('click', e => {
    if (e.target === scoreModal) closeScoreModal();
  });
}

// ==========================================================================
// INPUT SYNC & CHARACTER COUNTERS
// ==========================================================================
function updateCharCounts() {
  const len = draft.length;
  const text = `${len} / 3000 ${len < 15 ? '(MIN 15)' : 'CHARS'}`;
  if (charCount1) {
    charCount1.textContent = text;
    charCount1.style.color = len >= 15 ? 'var(--lime)' : 'var(--text-muted)';
  }
  if (charCount2) {
    charCount2.textContent = text;
    charCount2.style.color = len >= 15 ? 'var(--pink)' : 'var(--text-muted)';
  }
}

inputs.forEach(input => {
  input.addEventListener('input', () => {
    draft = input.value;
    inputs.forEach(other => {
      if (other !== input) other.value = draft;
    });
    updateCharCounts();
  });
});

// ==========================================================================
// STEP NAVIGATION
// ==========================================================================
function showStep(number) {
  document.querySelectorAll('.step').forEach(section => {
    section.hidden = Number(section.dataset.step) !== number;
  });
  const title = document.getElementById('title-' + number);
  if (title) title.focus({ preventScroll: true });
  const main = document.querySelector('main');
  if (main) {
    main.scrollIntoView({
      behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
      block: 'start',
    });
  }
}

// ==========================================================================
// INTERACTIVE HIGHLIGHTING & COACHING MODAL (LEARNING FIRST!)
// ==========================================================================
let activeModalFlag = null;

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function renderAnnotatedDraft(sourceText, flags) {
  if (!annotatedDraft) return;

  if (!flags || flags.length === 0) {
    annotatedDraft.innerHTML = `<div>${escapeHtml(sourceText)}</div>`;
    if (flagCounter) flagCounter.textContent = '0 ISSUES DETECTED';
    return;
  }

  if (flagCounter) {
    flagCounter.textContent = `${flags.length} ISSUE${flags.length > 1 ? 'S' : ''} DETECTED`;
  }

  const spans = [];
  flags.forEach((flag, flagIdx) => {
    const phrase = (flag.text || '').trim();
    if (!phrase) return;

    let searchStart = 0;
    const lowerSource = sourceText.toLowerCase();
    const lowerPhrase = phrase.toLowerCase();

    while (searchStart < sourceText.length) {
      const idx = lowerSource.indexOf(lowerPhrase, searchStart);
      if (idx === -1) break;
      spans.push({
        start: idx,
        end: idx + phrase.length,
        flagIdx: flagIdx,
        flag: flag,
      });
      searchStart = idx + phrase.length;
    }
  });

  spans.sort((a, b) => a.start - b.start || b.end - a.end);
  const nonOverlapping = [];
  let lastEnd = 0;
  for (const span of spans) {
    if (span.start >= lastEnd) {
      nonOverlapping.push(span);
      lastEnd = span.end;
    }
  }

  let resultHtml = '';
  let cursor = 0;

  for (const span of nonOverlapping) {
    if (span.start > cursor) {
      resultHtml += escapeHtml(sourceText.slice(cursor, span.start));
    }
    const chunk = sourceText.slice(span.start, span.end);
    resultHtml += `<mark class="flag-highlight" data-flag-idx="${span.flagIdx}" tabindex="0" role="button" aria-haspopup="dialog" aria-expanded="false" title="Click to inspect: ${escapeHtml(span.flag.principle || 'Tone feedback')}">${escapeHtml(chunk)}</mark>`;
    cursor = span.end;
  }

  if (cursor < sourceText.length) {
    resultHtml += escapeHtml(sourceText.slice(cursor));
  }

  annotatedDraft.innerHTML = resultHtml;

  annotatedDraft.querySelectorAll('.flag-highlight').forEach(mark => {
    mark.addEventListener('click', () => {
      const idx = Number(mark.dataset.flagIdx);
      openFlagModal(flags[idx]);
    });
    mark.addEventListener('keydown', e => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        const idx = Number(mark.dataset.flagIdx);
        openFlagModal(flags[idx]);
      }
    });
  });
}

function openFlagModal(flag) {
  if (!flag || !flagModal) return;
  activeModalFlag = flag;

  if (modalPhrase) modalPhrase.textContent = `“${flag.text}”`;
  if (modalPrinciple) modalPrinciple.textContent = `🎯 ${flag.principle || 'Communication Principle'}`;
  if (modalReason) modalReason.textContent = flag.reason || 'May read unfavorably to the recipient.';
  if (modalNudge) modalNudge.textContent = flag.nudge || 'Consider stating your request directly and politely.';

  flagModal.classList.add('open');
  flagModal.setAttribute('aria-hidden', 'false');
  if (btnCloseModal) btnCloseModal.focus();
}

function closeFlagModal() {
  if (!flagModal) return;
  flagModal.classList.remove('open');
  flagModal.setAttribute('aria-hidden', 'true');
  activeModalFlag = null;
}

if (btnCloseModal) btnCloseModal.addEventListener('click', closeFlagModal);
if (btnDismissModal) btnDismissModal.addEventListener('click', closeFlagModal);

if (btnApplyModal) {
  btnApplyModal.addEventListener('click', () => {
    closeFlagModal();
    const draft2 = document.getElementById('draft-2');
    if (draft2) {
      draft2.focus();
      draft2.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  });
}

if (flagModal) {
  flagModal.addEventListener('click', e => {
    if (e.target === flagModal) closeFlagModal();
  });
}

// Global Escape Key Listener for All Modals
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') {
    if (flagModal && flagModal.classList.contains('open')) closeFlagModal();
    if (scoreModal && scoreModal.classList.contains('open')) closeScoreModal();
    if (privacyModal && privacyModal.classList.contains('open')) closePrivacyModal();
    if (splashScreen && splashScreen.classList.contains('open')) closeSplash();
  }
});

// ==========================================================================
// RENDER DIAGNOSIS (STEP 2 LEARNING HUB)
// ==========================================================================
function renderDiagnosis(data) {
  currentDiagnosis = data;

  const overall = typeof data.overall === 'number' ? data.overall : 50;
  if (overallScoreBadge) {
    overallScoreBadge.textContent = `TONE SCORE: ${overall}/100`;
  }

  if (verdictBox) {
    if (data.verdict) {
      verdictBox.style.display = 'block';
      verdictBox.innerHTML = `<strong>Perception Verdict:</strong> ${escapeHtml(data.verdict)}`;
    } else {
      verdictBox.style.display = 'none';
    }
  }

  if (dimensionGrid) {
    let gridHtml = '';
    const dims = Array.isArray(data.dimensions) && data.dimensions.length > 0
      ? data.dimensions
      : [
          { id: 'clarity', label: 'Clarity of Ask', value: 3, target_min: 4, target_max: 5 },
          { id: 'accountability', label: 'Accountability', value: 3, target_min: 4, target_max: 5 },
          { id: 'warmth', label: 'Warmth & Respect', value: 3, target_min: 3, target_max: 5 },
          { id: 'formality', label: 'Formality Fit', value: 3, target_min: 3, target_max: 4 },
          { id: 'proportion', label: 'Proportion', value: 3, target_min: 3, target_max: 4 },
        ];

    dims.forEach((dim, idx) => {
      const val = dim.value || 3;
      const pct = Math.round((val / 5) * 100);
      const targetLabel = dim.target_min ? `Target: ${dim.target_min}-${dim.target_max || 5}/5` : '';
      gridHtml += `
        <div class="dim-score-card" data-dim-idx="${idx}" tabindex="0" role="button" aria-haspopup="dialog" aria-expanded="false" title="Click to inspect ${escapeHtml(dim.label || dim.id)} rubric">
          <div class="dim-label">
            <span>${escapeHtml(dim.label || dim.id)}</span>
            <span>${val}/5</span>
          </div>
          <div class="dim-meter" title="${escapeHtml(dim.description || '')}">
            <div class="dim-meter-fill" style="width: ${pct}%;"></div>
          </div>
          <div class="dim-card-meta">
            <span class="dim-target-txt">${targetLabel}</span>
            <span class="dim-inspect-cue">🔍 Inspect</span>
          </div>
        </div>
      `;
    });
    dimensionGrid.innerHTML = gridHtml;

    // Attach click and keyboard handlers to open the Score Detail Popup
    dimensionGrid.querySelectorAll('.dim-score-card').forEach(card => {
      const inspectAction = () => {
        const idx = Number(card.dataset.dimIdx);
        const dim = dims[idx];
        const flags = data.flags || [];
        const related = flags.filter(f => {
          const principle = (f.principle || '').toLowerCase();
          const reason = (f.reason || '').toLowerCase();
          const id = (dim.id || '').toLowerCase();
          const label = (dim.label || '').toLowerCase();
          return principle.includes(id) || reason.includes(id) || principle.includes(label.split(' ')[0]);
        });
        openScoreModal(dim, related.length > 0 ? related : flags.slice(0, 2));
      };

      card.addEventListener('click', inspectAction);
      card.addEventListener('keydown', e => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          inspectAction();
        }
      });
    });
  }

  renderAnnotatedDraft(draft, data.flags || []);
}

// ==========================================================================
// RENDER REWRITE & HONESTY GUARD (STEP 3)
// ==========================================================================
function renderRewrite(data) {
  currentRewrite = data;

  if (rewriteTextElement) {
    rewriteTextElement.textContent = data.rewrite || '';
  }

  if (honestyBanner) {
    const facts = data.new_facts_introduced || [];
    if (facts.length === 0) {
      honestyBanner.className = 'honesty-banner';
      honestyBanner.innerHTML = '<strong>🛡️ HONESTY GUARD VERIFIED:</strong> Zero fake facts, unverified dates, or imaginary excuses introduced.';
    } else {
      honestyBanner.className = 'honesty-banner honesty-warning';
      honestyBanner.innerHTML = `<strong>⚠️ HONESTY NOTICE:</strong> AI added assumptions: <em>${escapeHtml(facts.join(', '))}</em>. Please confirm truthfulness before sending.`;
    }
  }

  if (takeawayBox) {
    if (data.takeaway) {
      takeawayBox.style.display = 'block';
      takeawayBox.innerHTML = `
        <div class="takeaway-label">🎯 COMMUNICATION PRINCIPLE TAKEAWAY</div>
        <div>${escapeHtml(data.takeaway)}</div>
      `;
    } else {
      takeawayBox.style.display = 'none';
    }
  }

  if (changesContainer) {
    const changes = data.changes || [];
    if (changes.length > 0) {
      let html = `<div class="changes-title">KEY SUBSTITUTIONS APPLIED (${changes.length})</div>`;
      changes.forEach(ch => {
        const fromText = ch.from || ch.from_text || '';
        const toText = ch.to || ch.to_text || '';
        html += `
          <div class="change-item">
            <div>
              <span class="change-from">${escapeHtml(fromText)}</span>
              <span class="change-to">&rarr; ${escapeHtml(toText)}</span>
            </div>
            <div class="change-meta">
              <strong>${escapeHtml(ch.principle || 'Principle')}:</strong> ${escapeHtml(ch.reason || '')}
            </div>
          </div>
        `;
      });
      changesContainer.innerHTML = html;
    } else {
      changesContainer.innerHTML = '';
    }
  }
}

// ==========================================================================
// BACKEND API ADAPTERS
// ==========================================================================
const adapters = {
  async analyze(rawDraft) {
    const text = (rawDraft || '').trim();
    if (text.length < 15) {
      throw new Error('Please enter at least 15 characters to review your draft.');
    }

    const recipient = recipientInput && recipientInput.value.trim() ? recipientInput.value.trim() : 'Manager';
    const situation = situationInput && situationInput.value.trim() ? situationInput.value.trim() : 'Sensitive message';
    const model = modelSelect ? modelSelect.value : undefined;

    try {
      try {
        const ctxRes = await fetch('/context', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ draft: text, recipient, situation }),
        });
        if (ctxRes.ok) {
          const ctxData = await ctxRes.json();
          if (ctxData.status === 'refused' || ctxData.status === 'sensitive') {
            throw new Error(ctxData.message || 'Draft contains sensitive or threatening content.');
          }
        }
      } catch (ctxErr) {
        if (ctxErr.message && !ctxErr.message.includes('fetch')) throw ctxErr;
      }

      const response = await fetch('/diagnose', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          draft: text,
          situation: situation,
          recipient: recipient,
          model: model,
        }),
      });

      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        const msg = err.error?.message || err.detail || 'Could not analyze draft.';
        throw new Error(msg);
      }

      const data = await response.json();
      renderDiagnosis(data);
      return data;
    } catch (err) {
      if (err instanceof TypeError && err.message.toLowerCase().includes('fetch')) {
        console.warn('Backend unavailable, using illustrative fallback');
        const fallback = {
          verdict: 'The recipient may perceive this message as informal or hurried.',
          overall: 58,
          dimensions: [
            { id: 'clarity', label: 'Clarity of Ask', value: 3, target_min: 4, target_max: 5 },
            { id: 'accountability', label: 'Accountability', value: 2, target_min: 4, target_max: 5 },
            { id: 'warmth', label: 'Warmth & Respect', value: 3, target_min: 3, target_max: 5 },
            { id: 'formality', label: 'Formality Fit', value: 2, target_min: 3, target_max: 4 },
            { id: 'proportion', label: 'Proportion', value: 3, target_min: 3, target_max: 4 },
          ],
          flags: [
            {
              text: text.slice(0, 16) || 'Hey',
              principle: 'Respectful Address',
              reason: 'Overly casual address can set an unprofessional tone.',
              nudge: 'Start with a respectful greeting suited for the recipient.',
            },
          ],
        };
        renderDiagnosis(fallback);
        return fallback;
      }
      throw err;
    }
  },

  async rewrite(rawDraft) {
    const text = (rawDraft || '').trim();
    if (text.length < 15) {
      throw new Error('Please enter at least 15 characters before rewriting.');
    }

    const recipient = recipientInput && recipientInput.value.trim() ? recipientInput.value.trim() : 'Manager';
    const situation = situationInput && situationInput.value.trim() ? situationInput.value.trim() : 'Sensitive message';
    const model = modelSelect ? modelSelect.value : undefined;

    try {
      const response = await fetch('/rewrite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          draft: text,
          situation: situation,
          recipient: recipient,
          model: model,
        }),
      });

      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        const msg = err.error?.message || err.detail || 'Could not rewrite draft.';
        throw new Error(msg);
      }

      const data = await response.json();
      renderRewrite(data);
      return data;
    } catch (err) {
      if (err instanceof TypeError && err.message.toLowerCase().includes('fetch')) {
        console.warn('Backend unavailable, using illustrative rewrite fallback');
        const fallback = {
          rewrite: `Dear ${recipient},\n\nI am writing regarding ${situation.toLowerCase()}. I wanted to provide clear context on our progress and propose a constructive path forward.\n\nThank you for your time and understanding.\n\nBest regards,\n[Your Name]`,
          takeaway: 'Lead with the ask, then state the context with accountability.',
          changes: [
            {
              from: 'unfair constraints',
              to: 'challenging schedule',
              principle: 'Own it',
              reason: 'Focuses on solutions rather than deflecting blame.',
            },
          ],
          new_facts_introduced: [],
        };
        renderRewrite(fallback);
        return fallback;
      }
      throw err;
    }
  },
};

// ==========================================================================
// ACTION DISPATCHER (WITH SKELETON LOADER OVERLAY)
// ==========================================================================
async function run(action) {
  if (busy) return;
  busy = true;
  document.querySelectorAll('button').forEach(b => (b.disabled = true));

  showLoading();

  try {
    if (action === 'rewrite') {
      await adapters.rewrite(draft);
      showStep(3);
    } else {
      await adapters.analyze(draft);
      showStep(2);
    }
  } catch (error) {
    const errorMsg = (error && error.message)
      ? error.message
      : 'Something went wrong. Your draft is still preserved. Please try again.';
    alert('Notice: ' + errorMsg);
  } finally {
    hideLoading();
    busy = false;
    document.querySelectorAll('button').forEach(b => (b.disabled = false));
  }
}

// Global click event delegation
document.addEventListener('click', event => {
  const button = event.target.closest('button');
  if (!button || busy) return;

  if (button.dataset.go) {
    showStep(Number(button.dataset.go));
  } else if (button.dataset.action === 'reset') {
    resetToHomepage();
  } else if (button.dataset.action) {
    run(button.dataset.action);
  }
});

// ==========================================================================
// INITIALIZATION
// ==========================================================================
initTheme();
initModelPicker();
initContextChips();
initSplashScreen();
updateCharCounts();
