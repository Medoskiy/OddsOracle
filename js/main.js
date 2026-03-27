/* ============================================================
   OddsOracle — Shared JavaScript Utilities
   ============================================================ */

// ---- Navigation active state ----
document.addEventListener('DOMContentLoaded', () => {
  const path = window.location.pathname.split('/').pop() || 'index.html';
  document.querySelectorAll('.nav-link').forEach(link => {
    if (link.getAttribute('href') === path) link.classList.add('active');
  });

  // Hamburger menu
  const ham = document.getElementById('hamburger');
  const navLinks = document.getElementById('navLinks');
  if (ham && navLinks) {
    ham.addEventListener('click', (e) => {
      e.stopPropagation();
      const isOpen = navLinks.classList.toggle('open');
      ham.classList.toggle('open', isOpen);
      // Prevent body scroll when menu open
      document.body.style.overflow = isOpen ? 'hidden' : '';
    });
    document.addEventListener('click', e => {
      if (!ham.contains(e.target) && !navLinks.contains(e.target)) {
        navLinks.classList.remove('open');
        ham.classList.remove('open');
        document.body.style.overflow = '';
      }
    });
    // Close menu on nav link click
    navLinks.querySelectorAll('.nav-link').forEach(link => {
      link.addEventListener('click', () => {
        navLinks.classList.remove('open');
        ham.classList.remove('open');
        document.body.style.overflow = '';
      });
    });
  }

  // Tabs
  document.querySelectorAll('[data-tab]').forEach(btn => {
    btn.addEventListener('click', () => {
      const group = btn.dataset.tabGroup;
      const target = btn.dataset.tab;
      document.querySelectorAll(`[data-tab-group="${group}"]`).forEach(b => b.classList.remove('active'));
      document.querySelectorAll(`[data-tab-content="${group}"]`).forEach(c => c.classList.add('hidden'));
      btn.classList.add('active');
      const content = document.getElementById(`tab-${group}-${target}`);
      if (content) content.classList.remove('hidden');
    });
  });
});

// ---- Auth-aware navbar ----
(function updateNavForAuth() {
  fetch('api/auth-check.php')
    .then(r => r.json())
    .then(auth => {
      if (!auth.logged_in) return; // keep default Login/Sign Up buttons

      /* Desktop nav actions — replace Login + Sign Up with Dashboard + Logout */
      const navActions = document.querySelector('.nav-actions');
      if (navActions) {
        const loginBtn  = navActions.querySelector('a[href="login.html"]');
        const signupBtn = navActions.querySelector('a[href="register.html"]');
        if (loginBtn) {
          loginBtn.href      = 'dashboard.html';
          loginBtn.innerHTML = '<i class="fa fa-user"></i> @' + auth.username;
          loginBtn.className = 'btn btn-ghost btn-sm';
        }
        if (signupBtn) {
          signupBtn.href      = 'api/logout.php';
          signupBtn.innerHTML = 'Logout';
          signupBtn.className = 'btn btn-ghost btn-sm';
        }
      }

      /* Mobile nav — replace Login + Sign Up buttons */
      const mobileLogin  = document.querySelector('.hide-desktop a[href="login.html"]');
      const mobileSignup = document.querySelector('.hide-desktop a[href="register.html"]');
      if (mobileLogin) {
        mobileLogin.href      = 'dashboard.html';
        mobileLogin.textContent = 'Dashboard';
      }
      if (mobileSignup) {
        mobileSignup.href      = 'api/logout.php';
        mobileSignup.textContent = 'Logout';
      }
    })
    .catch(() => {}); // silently fail — keep default buttons
})();

// ---- Sportsbook data ----
const SPORTSBOOKS = [
  'DraftKings','FanDuel','BetMGM','Caesars','bet365','PointsBet','Unibet','William Hill',
  'Bet9ja','Betwinner','Bc.game','Stake','Betano','1xBet',
  '22bet','Betking','Msport','Afropari','Helabet'
];

const EVENTS = [
  // Soccer
  { id:1,  sport:'Soccer',    league:'Premier League',       home:'Manchester City',  away:'Arsenal',            time:'Today 15:00',    flag:'⚽' },
  { id:2,  sport:'Soccer',    league:'La Liga',              home:'Real Madrid',      away:'Barcelona',          time:'Today 20:45',    flag:'⚽' },
  { id:3,  sport:'Soccer',    league:'Champions League',     home:'Bayern Munich',    away:'PSG',                time:'Tomorrow 20:00', flag:'⚽' },
  { id:4,  sport:'Soccer',    league:'Serie A',              home:'Inter Milan',      away:'Juventus',           time:'Tomorrow 19:45', flag:'⚽' },
  // Basketball
  { id:5,  sport:'NBA',       league:'NBA Regular Season',   home:'Los Angeles Lakers',away:'Boston Celtics',    time:'Today 19:30',    flag:'🏀' },
  { id:6,  sport:'NBA',       league:'NBA Regular Season',   home:'Golden State Warriors',away:'Miami Heat',     time:'Today 21:00',    flag:'🏀' },
  // American Football
  { id:7,  sport:'NFL',       league:'NFL Week 18',          home:'Kansas City Chiefs',away:'Buffalo Bills',     time:'Tomorrow 18:00', flag:'🏈' },
  // Tennis
  { id:8,  sport:'Tennis',    league:'ATP Masters',          home:'Novak Djokovic',   away:'Carlos Alcaraz',     time:'Today 14:00',    flag:'🎾' },
  { id:9,  sport:'Tennis',    league:'WTA Finals',           home:'Iga Swiatek',      away:'Aryna Sabalenka',    time:'Tomorrow 13:00', flag:'🎾' },
  // Boxing
  { id:10, sport:'Boxing',    league:'WBC Heavyweight',      home:'Tyson Fury',       away:'Anthony Joshua',     time:'Sat 22:00',      flag:'🥊' },
  { id:11, sport:'Boxing',    league:'IBF Welterweight',     home:'Errol Spence Jr.', away:'Terence Crawford',   time:'Sat 20:00',      flag:'🥊' },
  // Darts
  { id:12, sport:'Darts',     league:'PDC World Championship',home:'Luke Littler',    away:'Michael van Gerwen', time:'Today 19:00',    flag:'🎯' },
  // Baseball
  { id:13, sport:'Baseball',  league:'MLB Regular Season',   home:'NY Yankees',       away:'LA Dodgers',         time:'Today 19:05',    flag:'⚾' },
  { id:14, sport:'Baseball',  league:'MLB Regular Season',   home:'Houston Astros',   away:'Chicago Cubs',       time:'Today 20:10',    flag:'⚾' },
  // Badminton
  { id:15, sport:'Badminton', league:'BWF World Tour Finals',home:'Viktor Axelsen',   away:'Shi Yuqi',           time:'Tomorrow 10:00', flag:'🏸' },
  // Cricket
  { id:16, sport:'Cricket',   league:'ICC T20 World Cup',    home:'India',            away:'Australia',          time:'Tomorrow 14:00', flag:'🏏' },
  { id:17, sport:'Cricket',   league:'IPL 2025',             home:'Mumbai Indians',   away:'Chennai Super Kings',time:'Today 15:30',    flag:'🏏' },
  // Formula 1
  { id:18, sport:'Formula 1', league:'F1 Monaco Grand Prix', home:'Max Verstappen',   away:'Lewis Hamilton',     time:'Sun 15:00',      flag:'🏎️' },
  { id:19, sport:'Formula 1', league:'F1 British Grand Prix',home:'Lando Norris',     away:'Charles Leclerc',    time:'Sun 14:00',      flag:'🏎️' },
  // Volleyball
  { id:20, sport:'Volleyball',league:'FIVB Nations League',  home:'Brazil',           away:'Poland',             time:'Tomorrow 18:00', flag:'🏐' },
  // Water Polo
  { id:21, sport:'Water Polo',league:'LEN Champions League', home:'Pro Recco',        away:'Barceloneta',        time:'Tomorrow 20:00', flag:'🤽' },
  // Golf
  { id:22, sport:'Golf',      league:'The Masters H2H',      home:'Scottie Scheffler',away:'Rory McIlroy',       time:'Sun 16:00',      flag:'⛳' },
  // Cycling
  { id:23, sport:'Cycling',   league:'Tour de France H2H',   home:'Tadej Pogacar',    away:'Jonas Vingegaard',   time:'Sat 14:00',      flag:'🚴' },
];

const SIGNALS = ['Recent Form','H2H Record','Home Advantage','Sharp Line Movement','Injury Report','Public Money Fade'];

// ---- Generate realistic odds ----
// Soccer & Boxing have 3 outcomes (inc. draw); all others are 2-way moneyline
const SPORT_ODDS_BASE = {
  'Soccer':    [2.1,  3.4,  3.8 ],   // Home / Draw / Away
  'NBA':       [1.85, 2.05],
  'NFL':       [1.90, 1.95],
  'Tennis':    [1.60, 2.40],
  'Boxing':    [1.85, 2.20, 16.0],   // Fighter1 / Fighter2 / Draw
  'Darts':     [1.70, 2.10],
  'Baseball':  [1.90, 2.00],
  'Badminton': [1.60, 2.30],
  'Cricket':   [1.75, 2.10],
  'Formula 1': [1.65, 2.30],         // H2H driver matchup
  'Volleyball':[1.70, 2.15],
  'Water Polo':[1.75, 2.10],
  'Golf':      [1.60, 2.40],         // H2H golfer matchup
  'Cycling':   [1.70, 2.20],
};
function generateOdds(sport, bookIndex) {
  const odds = SPORT_ODDS_BASE[sport] || [1.9, 1.9];
  const variance = 1 + (Math.random() * 0.08 - 0.04) + (bookIndex * 0.005);
  return odds.map(o => Math.round(o * variance * 100) / 100);
}

// ---- Format odds as American ----
function toAmerican(decimal) {
  if (decimal >= 2.0) return '+' + Math.round((decimal - 1) * 100);
  return Math.round(-100 / (decimal - 1)).toString();
}

// ---- Calculate implied probability ----
function impliedProb(decimal) {
  return Math.round((1 / decimal) * 100);
}

// ---- Get confidence color class ----
function confClass(score) {
  if (score >= 80) return 'conf-high';
  if (score >= 72) return 'conf-mid';
  return 'conf-low';
}

function confColor(score) {
  if (score >= 80) return 'var(--accent-green)';
  if (score >= 72) return 'var(--accent-yellow)';
  return 'var(--accent-orange)';
}

// Sports with 3-way markets (Home / Draw / Away or Fighter1 / Draw / Fighter2)
const THREE_WAY_SPORTS = new Set(['Soccer', 'Boxing']);

// ---- Generate prediction for an event ----
function generatePrediction(event) {
  const outcomes = THREE_WAY_SPORTS.has(event.sport)
    ? [event.home + ' Win', 'Draw', event.away + ' Win']
    : [event.home + ' Win', event.away + ' Win'];

  const predIdx = Math.random() < 0.6 ? 0 : Math.floor(Math.random() * outcomes.length);
  const confidence = Math.round(68 + Math.random() * 20);
  const grade = confidence >= 83 ? 'A' : confidence >= 76 ? 'B' : 'C';
  const prob = Math.round(50 + Math.random() * 35);
  const edge = Math.round((Math.random() * 8 + 1) * 10) / 10;
  const isValue = edge > 4.5;

  const signals = SIGNALS.map(s => {
    const val = Math.random();
    return { name: s, rating: val > 0.6 ? 'Strong' : val > 0.3 ? 'Neutral' : 'Weak', val };
  });

  return { predicted: outcomes[predIdx], confidence, grade, prob, edge, isValue, signals };
}

// ---- Show toast ----
function showToast(msg, type = 'info') {
  const t = document.createElement('div');
  t.className = 'toast';
  t.style.borderColor = type === 'success' ? 'var(--accent-green)' : type === 'error' ? '#ef4444' : 'var(--accent-cyan)';
  t.innerHTML = `<span style="color:${type === 'success' ? 'var(--accent-green)' : type === 'error' ? '#ef4444' : 'var(--accent-cyan)'}">
    ${type === 'success' ? '✓' : type === 'error' ? '✕' : 'ℹ'}</span> ${msg}`;
  document.body.appendChild(t);
  setTimeout(() => t.remove(), 3500);
}

// ---- Live clock ----
function startClock(el) {
  if (!el) return;
  const update = () => {
    const now = new Date();
    el.textContent = now.toLocaleTimeString('en-US', { hour12: false });
  };
  update();
  setInterval(update, 1000);
}

// ---- Animate numbers ----
function animateNum(el, target, duration = 1200, suffix = '') {
  if (!el) return;
  let start = 0, startTime = null;
  const step = ts => {
    if (!startTime) startTime = ts;
    const progress = Math.min((ts - startTime) / duration, 1);
    const eased = 1 - Math.pow(1 - progress, 3);
    el.textContent = Math.round(eased * target) + suffix;
    if (progress < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}

// ---- Scroll reveal ----
function initReveal() {
  const observer = new IntersectionObserver(entries => {
    entries.forEach(e => {
      if (e.isIntersecting) {
        e.target.style.opacity = '1';
        e.target.style.transform = 'translateY(0)';
        observer.unobserve(e.target);
      }
    });
  }, { threshold: 0.1 });

  document.querySelectorAll('.reveal').forEach(el => {
    el.style.opacity = '0';
    el.style.transform = 'translateY(24px)';
    el.style.transition = 'opacity 0.6s ease, transform 0.6s ease';
    observer.observe(el);
  });
}

document.addEventListener('DOMContentLoaded', initReveal);

// ════════════════════════════════════════════════════════════
//  WIN PUSH NOTIFICATION SYSTEM
//  Appears at the top of every page on all devices
// ════════════════════════════════════════════════════════════
(function initWinNotifications() {
  // Prevent duplicate initialisation (e.g. SPA navigations)
  if (document.getElementById('winNotify')) return;

  /* ── Win pool — realistic match wins with sport flags ── */
  const WIN_POOL = [
    { flag:'⚽', match:'Manchester City',       prediction:'Man City Win',       league:'Premier League',        odds:2.10, profit:8500  },
    { flag:'🏀', match:'LA Lakers',             prediction:'Lakers Win',          league:'NBA Regular Season',    odds:1.85, profit:6200  },
    { flag:'⚽', match:'Real Madrid',           prediction:'Real Madrid Win',     league:'La Liga',               odds:2.25, profit:12400 },
    { flag:'🏈', match:'Kansas City Chiefs',    prediction:'Chiefs Win',          league:'NFL Week 18',           odds:1.92, profit:5800  },
    { flag:'🎾', match:'Djokovic vs Alcaraz',   prediction:'Djokovic Win',        league:'ATP Masters',           odds:1.62, profit:4100  },
    { flag:'🥊', match:'Tyson Fury',            prediction:'Fury KO Victory',     league:'WBC Heavyweight',       odds:1.85, profit:9600  },
    { flag:'⚽', match:'Bayern Munich',         prediction:'Bayern Win',          league:'Champions League',      odds:1.95, profit:7300  },
    { flag:'🏏', match:'India vs Australia',    prediction:'India Win',           league:'ICC T20 World Cup',     odds:1.75, profit:11000 },
    { flag:'🎯', match:'Luke Littler',          prediction:'Littler Win',         league:'PDC World Championship',odds:1.72, profit:3800  },
    { flag:'⚾', match:'NY Yankees',            prediction:'Yankees Win',         league:'MLB Regular Season',    odds:1.90, profit:6700  },
    { flag:'🏎️', match:'Max Verstappen',        prediction:'Verstappen Win',      league:'F1 Monaco Grand Prix',  odds:1.65, profit:8200  },
    { flag:'🏸', match:'Viktor Axelsen',        prediction:'Axelsen Win',         league:'BWF World Tour Finals', odds:1.60, profit:4500  },
    { flag:'🏐', match:'Brazil Volleyball',     prediction:'Brazil Win',          league:'FIVB Nations League',   odds:1.70, profit:5600  },
    { flag:'⛳', match:'Scottie Scheffler',     prediction:'Scheffler Win',       league:'The Masters H2H',       odds:1.60, profit:7800  },
    { flag:'⚽', match:'Arsenal FC',            prediction:'Arsenal Win',         league:'Premier League',        odds:3.80, profit:19000 },
    { flag:'🏀', match:'Golden State Warriors', prediction:'Warriors Win',        league:'NBA Regular Season',    odds:2.05, profit:10250 },
    { flag:'🚴', match:'Tadej Pogacar',         prediction:'Pogacar Win',         league:'Tour de France H2H',    odds:1.70, profit:5100  },
    { flag:'🤽', match:'Pro Recco',             prediction:'Recco Win',           league:'LEN Champions League',  odds:1.75, profit:4300  },
    { flag:'🏏', match:'Mumbai Indians',        prediction:'Mumbai Indians Win',  league:'IPL 2025',              odds:1.80, profit:8900  },
    { flag:'🎾', match:'Iga Swiatek',           prediction:'Swiatek Win',         league:'WTA Finals',            odds:1.55, profit:3500  },
    { flag:'🏈', match:'Buffalo Bills',         prediction:'Bills Win',           league:'NFL Playoffs',          odds:2.05, profit:9200  },
    { flag:'⚽', match:'Inter Milan',           prediction:'Inter Win',           league:'Serie A',               odds:2.10, profit:7600  },
  ];

  /* ── Shuffle the pool so order varies per session ── */
  for (let i = WIN_POOL.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [WIN_POOL[i], WIN_POOL[j]] = [WIN_POOL[j], WIN_POOL[i]];
  }

  /* ── Running win counter (randomised daily start) ── */
  let winCount = Math.floor(Math.random() * 60) + 90; // 90–149
  let poolIndex = 0;

  const DISPLAY_MS = 7500;   // how long notification stays visible
  const INTERVAL_MIN = 28000; // min ms between notifications
  const INTERVAL_MAX = 50000; // max ms between notifications

  let dismissTimer = null;
  let nextTimer    = null;

  /* ── Build DOM ── */
  const notify = document.createElement('div');
  notify.id = 'winNotify';
  notify.className = 'win-notify';
  notify.setAttribute('role', 'alert');
  notify.setAttribute('aria-live', 'polite');
  notify.innerHTML = `
    <div class="win-notify-inner">
      <div class="win-notify-icon" id="wnIcon">🏆</div>
      <div class="win-notify-body">
        <div class="win-notify-label">
          <span class="win-notify-tag">🏆 WIN ALERT</span>
          <span class="win-count-chip" id="wnCount">0 Won Today</span>
        </div>
        <div class="win-notify-match" id="wnMatch">Loading…</div>
        <div class="win-notify-meta">
          <span class="win-notify-prediction" id="wnPred"></span>
          <span class="win-notify-sep">·</span>
          <span id="wnLeague" style="color:var(--text-muted)"></span>
          <span class="win-notify-sep">·</span>
          <span class="win-notify-odds" id="wnOdds"></span>
          <span class="win-notify-profit" id="wnProfit"></span>
        </div>
      </div>
      <button class="win-notify-close" id="wnClose" aria-label="Dismiss">✕</button>
    </div>
    <div class="win-notify-progress-track">
      <div class="win-notify-progress-fill" id="wnProgress"></div>
    </div>`;
  document.body.appendChild(notify);

  /* ── Cache elements ── */
  const elIcon    = document.getElementById('wnIcon');
  const elCount   = document.getElementById('wnCount');
  const elMatch   = document.getElementById('wnMatch');
  const elPred    = document.getElementById('wnPred');
  const elLeague  = document.getElementById('wnLeague');
  const elOdds    = document.getElementById('wnOdds');
  const elProfit  = document.getElementById('wnProfit');
  const elProg    = document.getElementById('wnProgress');
  const elClose   = document.getElementById('wnClose');

  /* ── Helpers ── */
  function fmtProfit(n) {
    return n >= 1000 ? '+₦' + (n / 1000).toFixed(1) + 'k' : '+₦' + n;
  }
  function randomBetween(min, max) {
    return min + Math.random() * (max - min);
  }

  /* ── Show next win ── */
  function showWin() {
    const win = WIN_POOL[poolIndex % WIN_POOL.length];
    poolIndex++;
    winCount++;

    // Small profit variance per show
    const profit = Math.round(win.profit * randomBetween(0.8, 1.25) / 100) * 100;

    // Populate
    elIcon.textContent   = win.flag;
    elCount.textContent  = winCount + ' Won Today';
    elMatch.textContent  = win.match;
    elPred.textContent   = '✓ ' + win.prediction;
    elLeague.textContent = win.league;
    elOdds.textContent   = '@' + win.odds.toFixed(2);
    elProfit.textContent = fmtProfit(profit);

    // Animate in
    notify.classList.remove('hide');
    notify.classList.add('show');

    // Progress bar — reset then drain
    elProg.style.transition = 'none';
    elProg.style.width = '100%';
    requestAnimationFrame(() => requestAnimationFrame(() => {
      elProg.style.transition = `width ${DISPLAY_MS}ms linear`;
      elProg.style.width = '0%';
    }));

    // Auto-dismiss
    clearTimeout(dismissTimer);
    dismissTimer = setTimeout(() => dismiss(true), DISPLAY_MS);
  }

  /* ── Dismiss ── */
  function dismiss(scheduleNext) {
    notify.classList.remove('show');
    notify.classList.add('hide');
    clearTimeout(dismissTimer);
    if (scheduleNext) {
      clearTimeout(nextTimer);
      nextTimer = setTimeout(showWin, randomBetween(INTERVAL_MIN, INTERVAL_MAX));
    }
  }

  /* ── Close button ── */
  elClose.addEventListener('click', e => {
    e.stopPropagation();
    dismiss(true);
  });

  /* ── Kick off — first alert after 4 s, then cycles automatically ── */
  nextTimer = setTimeout(showWin, 4000);

  /* ── Restart cycle after each dismiss (already scheduled inside dismiss) ── */
})();

// ---- Crash game simulator ----
function crashMultiplier() {
  const r = Math.random();
  if (r < 0.05) return (1 + Math.random() * 0.5).toFixed(2);
  if (r < 0.4) return (1.5 + Math.random() * 1).toFixed(2);
  if (r < 0.7) return (2 + Math.random() * 2).toFixed(2);
  if (r < 0.9) return (4 + Math.random() * 6).toFixed(2);
  return (10 + Math.random() * 40).toFixed(2);
}
