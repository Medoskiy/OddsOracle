/* ============================================================
   OddsOracle — Live Odds Engine  v2.0
   Fetches real odds, computes value bets, drives predictions page
   ============================================================ */

(function () {
  'use strict';

  /* ── Config ── */
  const API_BASE    = 'api/odds.php';
  const REFRESH_MS  = 5 * 60 * 1000; /* re-fetch every 5 min */
  const DEMO_MODE_MSG = '🔑 API key not configured — showing demo data. Add your key to api/config.php';

  /* ── Sport key map (tab label → API param) ── */
  const SPORT_KEYS = {
    'all':       'soccer',
    'Soccer':    'soccer',
    'NBA':       'nba',
    'NFL':       'nfl',
    'Tennis':    'tennis',
    'Baseball':  'baseball',
    'Cricket':   'cricket',
    'Boxing':    'mma',
  };

  /* ── Sport emoji map ── */
  const SPORT_EMOJI = {
    soccer_epl:                    '⚽',
    soccer_uefa_champs_league:     '⚽',
    soccer_spain_la_liga:          '⚽',
    soccer_germany_bundesliga:     '⚽',
    soccer_italy_serie_a:          '⚽',
    basketball_nba:                '🏀',
    americanfootball_nfl:          '🏈',
    tennis_atp_french_open:        '🎾',
    cricket_ipl:                   '🏏',
    mma_mixed_martial_arts:        '🥊',
    baseball_mlb:                  '⚾',
  };

  /* ── State ── */
  let allEvents   = [];
  let activeSport = 'all';
  let refreshTimer;
  let isLive      = false;

  /* ══════════════════════════════════════════════════
     VALUE BET DETECTION ENGINE
     ══════════════════════════════════════════════════ */

  /**
   * Remove bookmaker margin from a set of decimal odds
   * Returns fair (no-vig) probabilities
   */
  function removeMarginalProbabilities(outcomes) {
    const impliedProbs = outcomes.map(o => 1 / o.price);
    const totalImplied = impliedProbs.reduce((a, b) => a + b, 0);
    return impliedProbs.map(p => p / totalImplied); /* normalise to 100% */
  }

  /**
   * Compute consensus odds across all bookmakers for an event
   * Uses the median price to reduce noise from outliers
   */
  function computeConsensusOdds(bookmakers) {
    const outcomeMap = {};

    bookmakers.forEach(bk => {
      (bk.markets || []).forEach(mkt => {
        if (mkt.key !== 'h2h') return;
        mkt.outcomes.forEach(o => {
          if (!outcomeMap[o.name]) outcomeMap[o.name] = [];
          outcomeMap[o.name].push(o.price);
        });
      });
    });

    const consensus = {};
    Object.entries(outcomeMap).forEach(([name, prices]) => {
      prices.sort((a, b) => a - b);
      const mid = Math.floor(prices.length / 2);
      consensus[name] = prices.length % 2 !== 0
        ? prices[mid]
        : (prices[mid - 1] + prices[mid]) / 2;
    });

    return consensus;
  }

  /**
   * Find the best available price for each outcome across all bookmakers
   */
  function findBestOdds(bookmakers) {
    const best = {};
    bookmakers.forEach(bk => {
      (bk.markets || []).forEach(mkt => {
        if (mkt.key !== 'h2h') return;
        mkt.outcomes.forEach(o => {
          if (!best[o.name] || o.price > best[o.name].price) {
            best[o.name] = { price: o.price, bookmaker: bk.title };
          }
        });
      });
    });
    return best;
  }

  /**
   * Core value detection algorithm
   * Returns enriched event object with AI-style analysis
   */
  function analyseEvent(event) {
    const bks       = event.bookmakers || [];
    if (!bks.length) return null;

    const consensus = computeConsensusOdds(bks);
    const bestOdds  = findBestOdds(bks);
    const names     = Object.keys(consensus);
    if (!names.length) return null;

    const outcomes  = names.map(n => ({ name: n, price: consensus[n] }));
    const fairProbs = removeMarginalProbabilities(outcomes);

    /* Book margin (vig) */
    const impliedTotal = outcomes.reduce((s, o) => s + 1 / o.price, 0);
    const margin       = ((impliedTotal - 1) / impliedTotal * 100).toFixed(1);

    /* Enriched outcomes */
    const enriched = outcomes.map((o, i) => {
      const fairProb    = fairProbs[i];
      const impliedProb = 1 / o.price;
      const edge        = ((fairProb - impliedProb) * 100).toFixed(1);
      const isValue     = fairProb > impliedProb * 1.04; /* 4% threshold */
      const best        = bestOdds[o.name] || { price: o.price, bookmaker: 'N/A' };

      return {
        name:         o.name,
        consensusOdds: +o.price.toFixed(2),
        bestOdds:     +best.price.toFixed(2),
        bestBook:     best.bookmaker,
        fairProb:     +(fairProb * 100).toFixed(1),
        impliedProb:  +(impliedProb * 100).toFixed(1),
        edge:         +edge,
        isValue,
      };
    });

    /* Pick the AI recommendation (highest fair prob outcome) */
    const recommended = [...enriched].sort((a, b) => b.fairProb - a.fairProb)[0];

    /* Confidence score: 50–95 based on edge + bookmaker agreement */
    const maxEdge       = Math.max(...enriched.map(o => Math.abs(o.edge)));
    const bookCount     = bks.length;
    const baseConf      = Math.min(50 + maxEdge * 2.5 + bookCount * 1.5, 95);
    const confidence    = Math.round(baseConf);

    /* Grade */
    const grade = confidence >= 80 ? 'A' : confidence >= 68 ? 'B' : 'C';

    /* Value bet flag */
    const hasValueBet = enriched.some(o => o.isValue);

    /* Sport emoji */
    const sportEmoji = SPORT_EMOJI[event.sport_key] || '🏆';

    /* Commence time */
    const kickoff = new Date(event.commence_time);
    const now     = new Date();
    const diffMin = Math.round((kickoff - now) / 60000);
    let timeLabel;
    if (diffMin < 0)        timeLabel = 'LIVE';
    else if (diffMin < 60)  timeLabel = `${diffMin}m`;
    else if (diffMin < 1440) timeLabel = `${Math.floor(diffMin / 60)}h ${diffMin % 60}m`;
    else                    timeLabel = kickoff.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });

    return {
      id:           event.id,
      sport:        sportEmoji + ' ' + (event.sport_title || event.sport_key),
      sportKey:     event.sport_key,
      league:       event.sport_title || '',
      home:         event.home_team,
      away:         event.away_team,
      match:        event.home_team + ' vs ' + event.away_team,
      kickoff:      timeLabel,
      isLive:       diffMin < 0,
      outcomes:     enriched,
      recommended,
      confidence,
      grade,
      margin:       +margin,
      bookCount,
      hasValueBet,
      rawBookmakers: bks,
    };
  }

  /* ══════════════════════════════════════════════════
     RENDERING
     ══════════════════════════════════════════════════ */

  function gradeBadge(g) {
    return `<span class="grade-${g.toLowerCase()}">${g}</span>`;
  }

  function confidenceBar(c) {
    const col = c >= 80 ? 'var(--accent-green)' : c >= 68 ? 'var(--accent-yellow)' : 'var(--accent-orange)';
    return `<div class="progress-track" style="width:80px;height:5px;display:inline-block;vertical-align:middle;margin-left:6px">
      <div class="progress-fill" style="width:${c}%;background:${col};height:100%;border-radius:3px;transition:width 0.6s ease"></div>
    </div>`;
  }

  function renderOutcomes(outcomes) {
    const cols = outcomes.length === 2 ? 'two-col' : '';
    return `<div class="odds-grid ${cols}">
      ${outcomes.map(o => `
        <div class="odds-cell${o.isValue ? ' best-odds' : ''}">
          <div class="odds-label">${o.name.length > 14 ? o.name.substring(0,13) + '…' : o.name}</div>
          <div class="odds-val">${o.bestOdds.toFixed(2)}</div>
          <div style="font-size:9px;margin-top:2px;color:${o.isValue ? 'var(--accent-green)' : 'var(--text-muted)'}">
            ${o.isValue ? '⚡ VALUE' : o.fairProb + '%'}
          </div>
        </div>`).join('')}
    </div>`;
  }

  function renderBookmakers(bks, recommended) {
    if (!bks || !bks.length) return '';
    const sliced = bks.slice(0, 6);
    return `<div style="margin-top:12px">
      <div style="font-size:11px;font-weight:700;letter-spacing:1px;color:var(--text-muted);margin-bottom:6px;text-transform:uppercase">Best Odds by Book</div>
      <div class="books-grid">
        ${sliced.map(bk => {
          const mkt = (bk.markets || []).find(m => m.key === 'h2h');
          if (!mkt) return '';
          const rec = mkt.outcomes.find(o => o.name === recommended.name);
          const isTop = rec && rec.price >= recommended.bestOdds * 0.99;
          return `<div class="book-row${isTop ? ' top-book' : ''}">
            <span>${bk.title}</span>
            <span style="font-family:'JetBrains Mono',monospace;font-weight:700">${rec ? rec.price.toFixed(2) : '—'}</span>
          </div>`;
        }).join('')}
      </div>
    </div>`;
  }

  function renderEvent(ev) {
    const val = ev.hasValueBet
      ? `<span class="badge badge-orange" style="font-size:10px">⚡ VALUE BET</span>`
      : '';
    const live = ev.isLive
      ? `<span class="live-badge"><span class="live-dot"></span> LIVE</span>`
      : `<span class="badge" style="font-size:10px;background:var(--bg-secondary)">🕐 ${ev.kickoff}</span>`;

    /* Encode pick data into button attributes for the save handler */
    const safeMatch  = encodeURIComponent(ev.match);
    const safeSport  = encodeURIComponent(ev.sport);
    const safeLeague = encodeURIComponent(ev.league);
    const safePick   = encodeURIComponent(ev.recommended.name);
    const odds       = ev.recommended.bestOdds;
    const conf       = ev.confidence;

    return `
    <div class="event-card" data-id="${ev.id}">
      <div class="event-header">
        <div>
          <div class="event-teams">${ev.home} <span style="color:var(--text-muted);font-weight:400">vs</span> ${ev.away}</div>
          <div class="event-meta">
            <span class="badge badge-cyan" style="font-size:10px">${ev.sport}</span>
            <span style="font-size:11px;color:var(--text-muted)">${ev.league}</span>
            ${val}
          </div>
        </div>
        <div style="display:flex;flex-direction:column;align-items:flex-end;gap:6px;flex-shrink:0">
          ${live}
          <span style="font-size:11px;color:var(--text-muted)">${ev.bookCount} books</span>
        </div>
      </div>

      ${renderOutcomes(ev.outcomes)}

      <div class="pred-box">
        <div class="pred-outcome">🤖 ${ev.recommended.name} &nbsp; ${gradeBadge(ev.grade)}</div>
        <div class="pred-meta-row">
          <span style="font-size:12px;color:var(--text-secondary)">Confidence</span>
          <span style="font-family:'JetBrains Mono',monospace;font-size:13px;font-weight:700;color:${ev.confidence >= 80 ? 'var(--accent-green)' : ev.confidence >= 68 ? 'var(--accent-yellow)' : 'var(--accent-orange)'}">
            ${ev.confidence}%
          </span>
          ${confidenceBar(ev.confidence)}
        </div>
        <div class="pred-meta-row" style="margin-bottom:0">
          <span style="font-size:12px;color:var(--text-secondary)">Fair Value</span>
          <span style="font-family:'JetBrains Mono',monospace;font-size:12px;font-weight:700;color:var(--accent-cyan)">${ev.recommended.fairProb}%</span>
          <span style="font-size:11px;color:var(--text-muted);margin-left:auto">Implied: ${ev.recommended.impliedProb}%</span>
        </div>
        ${ev.recommended.edge > 0 ? `<div style="margin-top:8px;padding:6px 10px;background:rgba(0,255,136,0.06);border-radius:6px;border:1px solid rgba(0,255,136,0.15);font-size:12px;color:var(--accent-green)">
          ⚡ Edge: <b>+${ev.recommended.edge}%</b> over market implied probability
        </div>` : ''}
        ${renderBookmakers(ev.rawBookmakers, ev.recommended)}

        <!-- Claude Analysis link — plain <a> so it always works on mobile -->
        <a class="claude-analyse-btn"
          href="analysis.html?match=${encodeURIComponent(ev.match)}&home=${encodeURIComponent(ev.home)}&away=${encodeURIComponent(ev.away)}&sport=${encodeURIComponent(ev.sport)}&league=${encodeURIComponent(ev.league)}&confidence=${ev.confidence}&grade=${encodeURIComponent(ev.grade)}&edge=${ev.recommended.edge}&fair=${ev.recommended.fairProb}&odds=${ev.recommended.bestOdds}&pick=${encodeURIComponent(ev.recommended.name)}&books=${ev.bookCount}&outcomes=${encodeURIComponent(JSON.stringify(ev.outcomes))}"
          style="margin-top:10px;width:100%;max-width:100%;box-sizing:border-box;padding:13px;
                 background:rgba(124,58,237,0.1);border:1px solid rgba(124,58,237,0.3);
                 border-radius:8px;color:#a78bfa;font-size:13px;font-weight:700;
                 cursor:pointer;transition:all 0.2s;text-decoration:none;
                 display:flex;align-items:center;justify-content:center;gap:8px">
          🤖 Get Claude AI Analysis
        </a>

        <!-- Save Pick Button -->
        <button class="save-pick-btn"
          data-match="${safeMatch}"
          data-sport="${safeSport}"
          data-league="${safeLeague}"
          data-pick="${safePick}"
          data-odds="${odds}"
          data-conf="${conf}"
          style="margin-top:8px;width:100%;max-width:100%;box-sizing:border-box;padding:13px;
                 background:rgba(0,212,255,0.08);border:1px solid rgba(0,212,255,0.25);
                 border-radius:8px;color:var(--accent-cyan);font-size:13px;font-weight:700;
                 cursor:pointer;transition:all 0.2s;
                 display:flex;align-items:center;justify-content:center;gap:8px">
          <i class="fa fa-bookmark"></i> Save This Pick
        </button>
      </div>

    </div>`;
  }

  function renderEvents(events) {
    const container = document.getElementById('eventsList');
    if (!container) return;

    if (!events.length) {
      container.innerHTML = `<div style="text-align:center;padding:60px 20px;color:var(--text-muted)">
        <div style="font-size:48px;margin-bottom:16px">📭</div>
        <div style="font-size:16px;font-weight:600;margin-bottom:8px">No events found</div>
        <div style="font-size:13px">Try a different sport tab or check back later</div>
      </div>`;
      return;
    }

    container.innerHTML = events.map(renderEvent).join('');

    /* Attach save-pick listeners via addEventListener (reliable on all mobile browsers) */
    container.querySelectorAll('.save-pick-btn').forEach(function(btn) {
      btn.addEventListener('click', function(e) {
        e.stopPropagation();
        savePick(btn);
      }, { passive: false });
    });

    /* Update stats bar */
    const totalEl = document.getElementById('statEvents');
    const valueEl = document.getElementById('statValue');
    const confEl  = document.getElementById('statConf');
    if (totalEl) totalEl.textContent = events.length;
    if (valueEl) valueEl.textContent = events.filter(e => e.hasValueBet).length;
    if (confEl) {
      const avg = Math.round(events.reduce((s, e) => s + e.confidence, 0) / events.length);
      confEl.textContent = avg + '%';
    }
  }

  /* ══════════════════════════════════════════════════
     FETCH & REFRESH
     ══════════════════════════════════════════════════ */

  function showLoading() {
    const container = document.getElementById('eventsList');
    if (container) container.innerHTML = `
      <div style="text-align:center;padding:60px 20px">
        <div style="width:40px;height:40px;border:3px solid var(--border);border-top-color:var(--accent-cyan);border-radius:50%;animation:spin 0.8s linear infinite;margin:0 auto 16px"></div>
        <div style="font-size:14px;color:var(--text-muted)">Fetching live odds from ${19} sportsbooks…</div>
      </div>
      <style>@keyframes spin{to{transform:rotate(360deg)}}</style>`;
  }

  function showError(msg) {
    const container = document.getElementById('eventsList');
    if (container) container.innerHTML = `
      <div style="text-align:center;padding:60px 20px;color:var(--text-muted)">
        <div style="font-size:48px;margin-bottom:16px">⚠️</div>
        <div style="font-size:15px;font-weight:600;color:var(--accent-orange);margin-bottom:8px">Connection Error</div>
        <div style="font-size:13px;max-width:360px;margin:0 auto;line-height:1.6">${msg}</div>
        <button onclick="OddsEngine.refresh()" class="btn btn-ghost btn-sm" style="margin-top:16px"><i class="fa fa-rotate-right"></i> Retry</button>
      </div>`;
  }

  async function fetchOdds(sport) {
    const url = `${API_BASE}?action=odds&sport=${encodeURIComponent(sport)}`;
    const res  = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    if (data.error) throw new Error(data.message || data.error);
    return data;
  }

  async function loadEvents(sport) {
    showLoading();
    try {
      const raw    = await fetchOdds(SPORT_KEYS[sport] || 'soccer');
      const events = raw
        .map(analyseEvent)
        .filter(Boolean)
        .sort((a, b) => b.confidence - a.confidence); /* best confidence first */

      allEvents = events;
      isLive    = true;

      /* Update live indicator */
      updateLiveStatus(true, events.length);
      renderEvents(events);

    } catch (err) {
      console.warn('OddsEngine:', err.message);
      isLive = false;
      updateLiveStatus(false, 0);

      if (err.message.includes('API key') || err.message.includes('401')) {
        showError('API key not configured yet.<br><span style="color:var(--text-secondary)">Add your key to <code style="color:var(--accent-cyan)">api/config.php</code> and re-upload.</span>');
      } else {
        showError('Could not reach the odds server.<br><span style="color:var(--text-secondary)">' + err.message + '</span>');
      }
    }
  }

  function updateLiveStatus(live, count) {
    /* Update CRAWLERS LIVE badge if present */
    const badge = document.querySelector('.nav-actions .live-badge');
    if (badge) {
      badge.innerHTML = live
        ? `<span class="live-dot"></span> ${count} EVENTS LIVE`
        : `<span class="live-dot" style="background:var(--accent-orange)"></span> OFFLINE`;
    }
    /* Update scan progress text */
    const prog = document.getElementById('crawlerScanProgress');
    if (prog && live) prog.textContent = `${count} events loaded · refreshes in 5min`;
  }

  /* ══════════════════════════════════════════════════
     SPORT TAB SWITCHING
     ══════════════════════════════════════════════════ */

  function bindSportTabs() {
    const tabs = document.getElementById('sportTabs');
    if (!tabs) return;

    tabs.querySelectorAll('[data-sport]').forEach(btn => {
      btn.addEventListener('click', () => {
        tabs.querySelectorAll('[data-sport]').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        activeSport = btn.dataset.sport;
        clearInterval(refreshTimer);
        loadEvents(activeSport);
        refreshTimer = setInterval(() => loadEvents(activeSport), REFRESH_MS);
      });
    });
  }

  /* ══════════════════════════════════════════════════
     INIT
     ══════════════════════════════════════════════════ */

  function init() {
    const container = document.getElementById('eventsList');
    if (!container) {
      console.warn('OddsEngine: #eventsList not found, retrying in 500ms');
      setTimeout(init, 500);
      return;
    }
    console.log('OddsEngine: initialised — fetching live odds…');
    bindSportTabs();
    loadEvents(activeSport);
    refreshTimer = setInterval(() => loadEvents(activeSport), REFRESH_MS);

    /* Countdown timer in progress label */
    let remaining = REFRESH_MS / 1000;
    setInterval(() => {
      remaining--;
      if (remaining <= 0) remaining = REFRESH_MS / 1000;
      const pct = document.getElementById('crawlerProgressPct');
      const bar = document.getElementById('crawlerProgressBar');
      const lbl = document.getElementById('crawlerProgressLabel');
      const pctVal = Math.round(((REFRESH_MS / 1000 - remaining) / (REFRESH_MS / 1000)) * 100);
      if (pct) pct.textContent = pctVal + '%';
      if (bar) bar.style.width = pctVal + '%';
      if (lbl) lbl.textContent = isLive
        ? `Live data — next refresh in ${remaining}s`
        : 'Connecting to odds API…';
    }, 1000);
  }

  /* Fix variable name typo used in tab click handler */
  let activeSport = 'all';

  /* Script loads at bottom of body — wait a tick for all inline scripts to finish */
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => setTimeout(init, 300));
  } else {
    setTimeout(init, 300);
  }

  /* ══════════════════════════════════════════════════
     CLAUDE AI ANALYSIS
     ══════════════════════════════════════════════════ */

  /* Navigate to the dedicated full-screen analysis page */
  function openAnalysis(btn) {
    const params = new URLSearchParams({
      match:      btn.dataset.match      || '',
      home:       btn.dataset.home       || '',
      away:       btn.dataset.away       || '',
      sport:      btn.dataset.sport      || '',
      league:     btn.dataset.league     || '',
      confidence: btn.dataset.confidence || '',
      grade:      btn.dataset.grade      || '',
      edge:       btn.dataset.edge       || '',
      fair:       btn.dataset.fair       || '',
      odds:       btn.dataset.odds       || '',
      pick:       btn.dataset.pick       || '',
      books:      btn.dataset.books      || '',
      outcomes:   btn.dataset.outcomes   || '',
    });
    window.location.href = 'analysis.html?' + params.toString();
  }

  /* ══════════════════════════════════════════════════
     SAVE PICK
     ══════════════════════════════════════════════════ */

  async function savePick(btn) {
    /* Optimistically attempt the save — save-prediction.php returns 401 if not logged in.
       This avoids a redundant auth-check round-trip that can fail on mobile due to
       cookie/session timing, causing a false logout redirect. */

    /* Grab data from button attributes */
    const payload = {
      match_name:  decodeURIComponent(btn.dataset.match),
      sport:       decodeURIComponent(btn.dataset.sport),
      league:      decodeURIComponent(btn.dataset.league),
      prediction:  decodeURIComponent(btn.dataset.pick),
      odds:        parseFloat(btn.dataset.odds),
      confidence:  parseInt(btn.dataset.conf, 10),
    };

    /* Disable button while saving */
    btn.disabled   = true;
    btn.innerHTML  = '<i class="fa fa-spinner fa-spin"></i> Saving…';

    try {
      const res  = await fetch('api/save-prediction.php', {
        method:      'POST',
        credentials: 'same-origin',
        headers:     { 'Content-Type': 'application/json' },
        body:        JSON.stringify(payload),
      });

      /* 401 = not logged in — redirect to login */
      if (res.status === 401) {
        window.location.href = 'login.html';
        return;
      }

      const data = await res.json();

      if (data.success) {
        btn.innerHTML  = '<i class="fa fa-check"></i> Saved!';
        btn.style.background  = 'rgba(0,255,136,0.1)';
        btn.style.borderColor = 'rgba(0,255,136,0.35)';
        btn.style.color       = 'var(--accent-green)';
        showSaveToast('Pick saved! View it in <a href="my-predictions.html" style="color:var(--accent-cyan)">My Predictions</a>.', 'success');
      } else if (data.duplicate) {
        btn.innerHTML = '<i class="fa fa-check"></i> Already Saved';
        btn.style.color = 'var(--text-muted)';
        btn.disabled    = false;
        showSaveToast('Already in your predictions list.', 'info');
      } else {
        btn.disabled  = false;
        btn.innerHTML = '<i class="fa fa-bookmark"></i> Save This Pick';
        showSaveToast(data.message || 'Could not save pick.', 'error');
      }
    } catch (e) {
      btn.disabled  = false;
      btn.innerHTML = '<i class="fa fa-bookmark"></i> Save This Pick';
      showSaveToast('Network error. Please try again.', 'error');
    }
  }

  function showSaveToast(msg, type) {
    const existing = document.getElementById('savePickToast');
    if (existing) existing.remove();

    const colors = { success: 'var(--accent-green)', warn: 'var(--accent-yellow)', error: '#ff4757', info: 'var(--accent-cyan)' };
    const col    = colors[type] || colors.info;

    const el = document.createElement('div');
    el.id    = 'savePickToast';
    el.style.cssText = `position:fixed;bottom:24px;left:50%;transform:translateX(-50%);
      background:var(--bg-card);border:1px solid ${col};border-radius:10px;
      padding:12px 20px;font-size:13px;color:var(--text-primary);
      box-shadow:0 8px 30px rgba(0,0,0,0.4);z-index:9999;
      animation:fadeInUp 0.3s ease;max-width:90vw;text-align:center`;
    el.innerHTML = msg;
    document.body.appendChild(el);

    setTimeout(() => { if (el.parentNode) el.remove(); }, 4000);
  }

  /* Public API */
  window.OddsEngine = {
    refresh:          () => loadEvents(activeSport),
    getEvents:        () => allEvents,
    isLive:           () => isLive,
    savePick,
    openAnalysis,
  };

})();
