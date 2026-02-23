import './styles.css';

/* --- DOM helpers --- */
const app = document.getElementById('app');
const API = '/api';
const $ = (s, p = document) => p.querySelector(s);
const $$ = (s, p = document) => [...p.querySelectorAll(s)];

/* --- Tab metadata --- */
const TABS = {
  today:     { label: 'Today',     icon: '', color: '#f59e0b' },
  goals:     { label: 'Goals',     icon: '', color: '#8b5cf6' },
  journal:   { label: 'Journal',   icon: '', color: '#06b6d4' },
  progress:  { label: 'Progress',  icon: '', color: '#10b981' },
  community: { label: 'Community', icon: '', color: '#ec4899' },
};

const CATS = ['health','finance','learning','social','mental','creativity'];
const CAT_ICONS = { health:'', finance:'', learning:'', social:'', mental:'', creativity:'' };

/* --- App state --- */
const state = {
  token: localStorage.getItem('mh_token') || '',
  user: null, dashboard: null, today: [], goals: [],
  journal: [], stats: null, report: null, achievements: null,
  challenges: [], leaderboard: [], water: null, mood: [],
  focusHistory: [], tab: 'today', navOpen: false,
};

/* --- API wrapper --- */
async function api(path, opts = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (state.token) headers.Authorization = `Bearer ${state.token}`;
  const res = await fetch(`${API}${path}`, {
    ...opts, headers,
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Request failed');
  return data;
}

async function loadAll() {
  const results = await Promise.allSettled([
    api('/dashboard'), api('/today'), api('/goals'), api('/journal'),
    api('/stats'), api('/report'), api('/achievements'), api('/challenges'),
    api('/leaderboard'), api('/water'), api('/mood'), api('/focus/history'),
  ]);
  const [dashboard, today, goals, journal, stats, report, achievements, challenges, leaderboard, water, mood, focusHistory]
    = results.map(r => r.status === 'fulfilled' ? r.value : null);
  if (dashboard) Object.assign(state, {
    dashboard, user: dashboard.user,
    today: today||[], goals: goals||[], journal: journal||[],
    stats, report, achievements,
    challenges: challenges||[], leaderboard: leaderboard||[],
    water, mood: mood||[], focusHistory: focusHistory||[],
  });
}

/* --- Helpers --- */
const fmt = (v) => new Date(v).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
const pctToday = () => state.today.length ? Math.round((state.today.filter(a => a.is_completed).length / state.today.length) * 100) : 0;
const levelPct = () => {
  const s = state.stats?.user;
  if (!s) return 0;
  return Math.min(100, Math.round((Number(s.xp_in_level||0) / Math.max(1, Number(s.xp_for_next||100))) * 100));
};

/* --- Toast notification system --- */
function toast(msg, type = 'ok') {
  let rack = document.getElementById('mhv-toast-rack');
  if (!rack) {
    rack = document.createElement('div');
    rack.id = 'mhv-toast-rack';
    document.body.appendChild(rack);
  }
  const t = document.createElement('div');
  t.className = `mhv-toast mhv-toast-${type}`;
  const icon = type === 'ok' ? '' : type === 'xp' ? '' : '';
  t.innerHTML = `<span class="mhv-toast-icon">${icon}</span><span class="mhv-toast-msg">${msg}</span>`;
  rack.prepend(t);
  requestAnimationFrame(() => t.classList.add('show'));
  setTimeout(() => {
    t.classList.remove('show');
    setTimeout(() => t.remove(), 400);
  }, 3000);
}

/* --- Confetti burst --- */
function confetti(x, y) {
  const colors = ['#f59e0b','#10b981','#8b5cf6','#ec4899','#06b6d4','#f43f5e','#84cc16'];
  for (let i = 0; i < 28; i++) {
    const el = document.createElement('div');
    el.className = 'mhv-confetti-piece';
    const angle = (360 / 28) * i;
    const dist = 80 + Math.random() * 80;
    el.style.cssText = `
      left:${x}px; top:${y}px;
      background:${colors[i % colors.length]};
      --dx:${Math.cos(angle * Math.PI/180) * dist}px;
      --dy:${Math.sin(angle * Math.PI/180) * dist - 120}px;
      --r:${Math.random() * 540}deg;
      width:${6 + Math.random()*6}px;
      height:${6 + Math.random()*6}px;
      border-radius:${Math.random()>0.5?'50%':'2px'};
    `;
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 1400);
  }
}

/* --- XP floating pop --- */
function xpPop(x, y, xp) {
  const el = document.createElement('div');
  el.className = 'mhv-xp-pop';
  el.textContent = `+${xp} XP`;
  el.style.cssText = `left:${x}px; top:${y}px;`;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 1000);
}

/* --- SVG progress ring --- */
function svgRing(pct, color = '#f59e0b', size = 58) {
  const r = (size - 10) / 2;
  const circ = 2 * Math.PI * r;
  const fill = (pct / 100) * circ;
  return `<svg class="mhv-ring" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" style="transform:rotate(-90deg)">
    <circle cx="${size/2}" cy="${size/2}" r="${r}" fill="none" stroke="rgba(255,255,255,0.07)" stroke-width="5"/>
    <circle cx="${size/2}" cy="${size/2}" r="${r}" fill="none" stroke="${color}" stroke-width="5"
      stroke-dasharray="${fill} ${circ}" stroke-linecap="round"
      style="filter:drop-shadow(0 0 4px ${color}80);transition:stroke-dasharray 1.2s cubic-bezier(.4,0,.2,1)"/>
  </svg>`;
}

/* ================================================================
   AUTH SCREEN
================================================================ */
function renderAuth(mode = 'login', error = '') {
  app.innerHTML = `
    <div class="mhv-auth">
      <div class="mhv-auth-bg">
        <div class="mhv-orb mhv-orb-1"></div>
        <div class="mhv-orb mhv-orb-2"></div>
        <div class="mhv-orb mhv-orb-3"></div>
        <div class="mhv-orb mhv-orb-4"></div>
        <div class="mhv-grid-overlay"></div>
      </div>

      <div class="mhv-auth-inner">
        <div class="mhv-auth-brand">
          <div class="mhv-brand-emblem">
            <span class="mhv-brand-pulse"></span>
            <span class="mhv-brand-bolt"></span>
          </div>
          <h1 class="mhv-brand-title">MicroHabit</h1>
          <p class="mhv-brand-tagline">2-minute actions.<br>Real-life compounding results.</p>

          <ul class="mhv-brand-features">
            <li><span class="mhv-feat-icon"></span><div><strong>Daily AI micro-actions</strong><small>Personalized for your goals</small></div></li>
            <li><span class="mhv-feat-icon"></span><div><strong>XP, levels & streaks</strong><small>Gamified habit building</small></div></li>
            <li><span class="mhv-feat-icon"></span><div><strong>AI progress reports</strong><small>Compound impact analysis</small></div></li>
            <li><span class="mhv-feat-icon"></span><div><strong>Community challenges</strong><small>Compete and grow together</small></div></li>
          </ul>

          <div class="mhv-brand-stats">
            <div class="mhv-brand-stat"><strong>10K+</strong><small>Habits tracked</small></div>
            <div class="mhv-brand-stat-div"></div>
            <div class="mhv-brand-stat"><strong>98%</strong><small>Satisfaction</small></div>
            <div class="mhv-brand-stat-div"></div>
            <div class="mhv-brand-stat"><strong>6</strong><small>Life categories</small></div>
          </div>
        </div>

        <div class="mhv-auth-card">
          <div class="mhv-auth-mode-tabs">
            <button class="mhv-auth-mode-btn ${mode==='login'?'active':''}" data-mode="login">Sign In</button>
            <button class="mhv-auth-mode-btn ${mode==='register'?'active':''}" data-mode="register">Register</button>
            <div class="mhv-auth-mode-slider ${mode==='register'?'right':''}"></div>
          </div>

          ${error ? `<div class="mhv-auth-error"><span></span> ${error}</div>` : ''}

          <form id="mhv-auth-form" class="mhv-auth-form">
            ${mode === 'register' ? `
              <div class="mhv-float-field">
                <input class="mhv-float-input" id="af-name" name="name" placeholder=" " required autocomplete="name"/>
                <label class="mhv-float-label" for="af-name">Full Name</label>
                <div class="mhv-float-line"></div>
              </div>` : ''}
            <div class="mhv-float-field">
              <input class="mhv-float-input" id="af-email" type="email" name="email" placeholder=" " required autocomplete="email"/>
              <label class="mhv-float-label" for="af-email">Email Address</label>
              <div class="mhv-float-line"></div>
            </div>
            <div class="mhv-float-field">
              <input class="mhv-float-input" id="af-pw" type="password" name="password" placeholder=" " minlength="6" required autocomplete="${mode==='login'?'current-password':'new-password'}"/>
              <label class="mhv-float-label" for="af-pw">Password</label>
              <div class="mhv-float-line"></div>
            </div>
            <button class="mhv-auth-submit" type="submit">
              <span class="mhv-submit-text">${mode === 'login' ? 'Sign In' : 'Create Account'}</span>
              <span class="mhv-submit-arrow"></span>
              <span class="mhv-submit-spinner"></span>
            </button>
          </form>
        </div>
      </div>
    </div>`;

  $$('.mhv-auth-mode-btn').forEach(b => b.addEventListener('click', () => renderAuth(b.dataset.mode)));

  $('#mhv-auth-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const submit = e.target.querySelector('.mhv-auth-submit');
    submit.classList.add('loading');
    const payload = Object.fromEntries(new FormData(e.target));
    try {
      const data = await api(mode === 'login' ? '/auth/login' : '/auth/register', { method: 'POST', body: payload });
      state.token = data.token;
      localStorage.setItem('mh_token', data.token);
      app.innerHTML = `<div class="mhv-splash"><div class="mhv-splash-logo"></div><div class="mhv-splash-text">Preparing your dashboard</div><div class="mhv-splash-bar"><div class="mhv-splash-progress"></div></div></div>`;
      await loadAll();
      renderApp();
    } catch (err) {
      submit.classList.remove('loading');
      renderAuth(mode, err.message);
    }
  });
}

/* ================================================================
   KPI STRIP
================================================================ */
function renderKPIs() {
  const pct = pctToday();
  const lvl = state.user?.level || 1;
  const lp = levelPct();
  const streak = state.user?.current_streak || 0;
  const water = state.water?.today?.glasses || 0;
  const waterGoal = state.water?.today?.goal || 8;
  const done = state.today.filter(a => a.is_completed).length;

  const kpis = [
    { color:'#f59e0b', ring: pct, icon:'', val: `${pct}%`, label:'Today Done', sub:`${done}/${state.today.length} actions` },
    { color:'#8b5cf6', ring: lp,  icon:'', val: `Lv ${lvl}`, label:'Level', sub:`${lp}% to next` },
    { color:'#ef4444', ring: Math.min(100, (streak/30)*100), icon:'', val: streak, label:'Day Streak', sub:`Best: ${state.user?.longest_streak||0}` },
    { color:'#06b6d4', ring: Math.round((water/waterGoal)*100), icon:'', val: `${water}/${waterGoal}`, label:'Hydration', sub:`${state.focusHistory?.length||0} focus sessions` },
  ];

  return `<div class="mhv-kpis">
    ${kpis.map((k,i) => `
      <div class="mhv-kpi stagger-${i+1}" style="--kpi-color:${k.color}">
        <div class="mhv-kpi-ring-wrap">
          ${svgRing(k.ring, k.color)}
          <div class="mhv-kpi-ring-icon">${k.icon}</div>
        </div>
        <div class="mhv-kpi-body">
          <div class="mhv-kpi-val">${k.val}</div>
          <div class="mhv-kpi-label">${k.label}</div>
          <div class="mhv-kpi-sub">${k.sub}</div>
        </div>
      </div>`).join('')}
  </div>`;
}

/* ================================================================
   TODAY TAB
================================================================ */
function renderTodayTab() {
  return `
    <div class="mhv-grid2">
      <div class="mhv-card">
        <div class="mhv-card-head">
          <h3> Today's Actions</h3>
          <div class="mhv-btn-row">
            <button class="mhv-ghost-btn" id="mhv-refresh-actions"> Refresh</button>
            <button class="mhv-accent-btn" id="mhv-add-custom">+ Custom</button>
          </div>
        </div>
        <div class="mhv-action-list">
          ${state.today.length
            ? state.today.map((a, i) => actionCard(a, i)).join('')
            : '<div class="mhv-empty-state"><div class="mhv-empty-icon"></div><p>No actions yet<br><small>Hit Refresh to generate today\'s plan!</small></p></div>'}
        </div>
      </div>

      <div class="mhv-card">
        <div class="mhv-card-head"><h3> Quick Wellness</h3></div>
        <form id="mhv-wellness-form">
          <div class="mhv-wellness-grid">
            ${[['','w-glasses','number','glasses','Water Glasses','1','1','20'],
               ['','w-mood','number','mood','Mood (110)','7','1','10'],
               ['','w-focus','number','focus','Focus mins','25','5','480']].map(([ico,id,type,name,label,val,min,max]) => `
              <div class="mhv-wellness-row">
                <span class="mhv-wellness-icon">${ico}</span>
                <div class="mhv-float-field mhv-float-field-sm">
                  <input class="mhv-float-input" id="${id}" type="${type}" name="${name}" placeholder=" " value="${val}" min="${min}" max="${max}"/>
                  <label class="mhv-float-label" for="${id}">${label}</label>
                  <div class="mhv-float-line"></div>
                </div>
              </div>`).join('')}
          </div>
          <button class="mhv-primary-btn mhv-full-btn" type="submit"> Log Wellness</button>
        </form>

        <div class="mhv-mini-stats">
          ${[['',state.dashboard?.unread_count||0,'Unread'],['',state.focusHistory?.length||0,'Focus sessions'],['',state.goals?.length||0,'Goals'],['',state.journal?.length||0,'Journal']].map(([ic,v,l]) => `
            <div class="mhv-mini-stat">
              <span>${ic}</span>
              <strong>${v}</strong>
              <small>${l}</small>
            </div>`).join('')}
        </div>
      </div>
    </div>`;
}

function actionCard(a, i) {
  const done = a.is_completed, skip = a.is_skipped;
  return `
    <div class="mhv-action-card ${done?'done':skip?'skipped':''} stagger-${Math.min(i+1,10)}" data-action-id="${a.id}">
      <div class="mhv-action-header">
        <span class="mhv-cat-tag mhv-cat-${a.category}">${CAT_ICONS[a.category]||''} ${a.category}</span>
        <span class="mhv-xp-tag"> ${a.xp_earned||a.xp||0} XP</span>
        ${done ? '<span class="mhv-done-stamp"></span>' : ''}
      </div>
      <p class="mhv-action-text">${a.action_text}</p>
      <div class="mhv-action-footer">
        <button class="mhv-complete-btn" data-complete="${a.id}" ${done||skip?'disabled':''}>
          ${done ? ' Completed' : ' Complete'}
        </button>
        <button class="mhv-skip-btn" data-skip="${a.id}" ${done||skip?'disabled':''}>
          ${skip ? 'Skipped' : ' Skip'}
        </button>
      </div>
      ${done ? '<div class="mhv-completion-bar"></div>' : ''}
    </div>`;
}

/* ================================================================
   GOALS TAB
================================================================ */
function renderGoalsTab() {
  return `
    <div class="mhv-grid2">
      <div class="mhv-card">
        <div class="mhv-card-head"><h3> Create Goal</h3></div>
        <form id="mhv-goal-form" class="mhv-form-stack">
          <div class="mhv-form-row">
            <div class="mhv-float-field">
              <select class="mhv-float-input" id="gf-cat" name="category">
                ${CATS.map(c=>`<option value="${c}">${CAT_ICONS[c]} ${c[0].toUpperCase()+c.slice(1)}</option>`).join('')}
              </select>
              <label class="mhv-float-label mhv-float-label-sel" for="gf-cat">Category</label>
              <div class="mhv-float-line"></div>
            </div>
            <div class="mhv-float-field">
              <select class="mhv-float-input" id="gf-prio" name="priority">
                <option value="low"> Low</option>
                <option value="medium" selected> Medium</option>
                <option value="high"> High</option>
              </select>
              <label class="mhv-float-label mhv-float-label-sel" for="gf-prio">Priority</label>
              <div class="mhv-float-line"></div>
            </div>
          </div>
          <div class="mhv-float-field">
            <input class="mhv-float-input" id="gf-title" name="title" placeholder=" " required/>
            <label class="mhv-float-label" for="gf-title">Goal Title</label>
            <div class="mhv-float-line"></div>
          </div>
          <div class="mhv-float-field">
            <textarea class="mhv-float-input mhv-float-textarea" id="gf-desc" name="description" placeholder=" " rows="3"></textarea>
            <label class="mhv-float-label" for="gf-desc">Description (optional)</label>
            <div class="mhv-float-line"></div>
          </div>
          <button class="mhv-primary-btn" type="submit">+ Add Goal</button>
        </form>
      </div>

      <div class="mhv-card">
        <div class="mhv-card-head">
          <h3> Active Goals</h3>
          <span class="mhv-count-badge">${state.goals.length}</span>
        </div>
        <div class="mhv-goal-list">
          ${state.goals.length ? state.goals.map((g, i) => `
            <div class="mhv-goal-card stagger-${Math.min(i+1,10)}">
              <div class="mhv-goal-tags">
                <span class="mhv-cat-tag mhv-cat-${g.category}">${CAT_ICONS[g.category]||''} ${g.category}</span>
                <span class="mhv-prio-tag mhv-prio-${g.priority}">${g.priority}</span>
              </div>
              <div class="mhv-goal-title">${g.title}</div>
              ${g.description ? `<div class="mhv-goal-desc">${g.description}</div>` : ''}
              <div class="mhv-prog-wrap">
                <div class="mhv-prog-track"><div class="mhv-prog-fill mhv-prog-cat-${g.category}" style="width:${g.completion_rate||0}%"></div></div>
                <span class="mhv-prog-label">${g.completion_rate||0}%</span>
              </div>
              <div class="mhv-goal-meta">${g.completed_actions||0}/${g.total_actions||0} actions completed</div>
            </div>`).join('')
            : '<div class="mhv-empty-state"><div class="mhv-empty-icon"></div><p>No goals yet<br><small>Create your first goal!</small></p></div>'}
        </div>
      </div>
    </div>`;
}

/* ================================================================
   JOURNAL TAB
================================================================ */
function renderJournalTab() {
  return `
    <div class="mhv-grid2">
      <div class="mhv-card">
        <div class="mhv-card-head"><h3> New Entry</h3></div>
        <form id="mhv-journal-form" class="mhv-form-stack">
          <div class="mhv-form-row">
            <div class="mhv-float-field">
              <select class="mhv-float-input" id="jf-cat" name="category">
                <option>general</option><option>mental</option><option>health</option><option>learning</option>
              </select>
              <label class="mhv-float-label mhv-float-label-sel" for="jf-cat">Category</label>
              <div class="mhv-float-line"></div>
            </div>
            <div class="mhv-float-field">
              <input class="mhv-float-input" id="jf-mood" type="number" name="mood" min="1" max="10" placeholder=" "/>
              <label class="mhv-float-label" for="jf-mood">Mood (110)</label>
              <div class="mhv-float-line"></div>
            </div>
          </div>
          <div class="mhv-float-field">
            <textarea class="mhv-float-input mhv-float-textarea mhv-float-textarea-lg" id="jf-content" name="content" placeholder=" " rows="7" required></textarea>
            <label class="mhv-float-label" for="jf-content">What happened today?</label>
            <div class="mhv-float-line"></div>
          </div>
          <button class="mhv-primary-btn" type="submit"> Save Entry</button>
        </form>
      </div>

      <div class="mhv-card">
        <div class="mhv-card-head"><h3> Recent Journal</h3></div>
        <div class="mhv-journal-list">
          ${state.journal.length ? state.journal.slice(0,10).map((j, i) => `
            <div class="mhv-journal-card stagger-${Math.min(i+1,10)}">
              <div class="mhv-journal-meta">
                <span class="mhv-cat-tag mhv-cat-${j.category||'mental'}">${j.category||'general'}</span>
                ${j.mood ? `<span class="mhv-mood-tag"> ${j.mood}/10</span>` : ''}
                <span class="mhv-journal-date">${fmt(j.created_at)}</span>
              </div>
              <p class="mhv-journal-content">${j.content}</p>
            </div>`).join('')
            : '<div class="mhv-empty-state"><div class="mhv-empty-icon"></div><p>Start journaling<br><small>5 minutes a day changes everything</small></p></div>'}
        </div>
      </div>
    </div>`;
}

/* ================================================================
   PROGRESS TAB
================================================================ */
function renderProgressTab() {
  const top = state.stats?.by_category?.slice(0,6) || [];
  const badges = state.achievements?.badges?.slice(0,12) || [];
  const xp = state.stats?.user?.xp || 0;
  const mins = state.stats?.total_minutes || 0;
  const total = state.stats?.total_completions || 0;

  return `
    <div class="mhv-grid2">
      <div class="mhv-card">
        <div class="mhv-card-head"><h3> Progress Insights</h3></div>
        <div class="mhv-xp-overview">
          <div class="mhv-xp-stat"><span></span><strong>${xp.toLocaleString()}</strong><small>Total XP</small></div>
          <div class="mhv-xp-stat"><span></span><strong>${mins}</strong><small>Minutes</small></div>
          <div class="mhv-xp-stat"><span></span><strong>${total}</strong><small>Completed</small></div>
        </div>

        <div class="mhv-cat-bars">
          ${top.map((c, i) => {
            const pct = Math.min(100, c.completed * 5);
            return `<div class="mhv-cat-bar stagger-${Math.min(i+1,6)}">
              <div class="mhv-cat-bar-head">
                <span class="mhv-cat-tag mhv-cat-${c.category}">${CAT_ICONS[c.category]||''} ${c.category}</span>
                <strong>${c.completed}</strong>
              </div>
              <div class="mhv-prog-track"><div class="mhv-prog-fill mhv-prog-cat-${c.category}" style="width:${pct}%"></div></div>
            </div>`;
          }).join('') || '<div class="mhv-empty-state"><div class="mhv-empty-icon"></div><p>Complete actions to see stats!</p></div>'}
        </div>

        <div class="mhv-ai-box">
          <div class="mhv-ai-header"><span class="mhv-ai-icon"></span> AI Compound Outlook</div>
          <p class="mhv-ai-text">${state.report?.summary || state.report?.long_term_impact || 'Keep your streak alive and let compounding do the work. Every 2-minute action creates unstoppable momentum.'}</p>
        </div>
      </div>

      <div class="mhv-card">
        <div class="mhv-card-head"><h3> Achievements</h3></div>
        <div class="mhv-badge-grid">
          ${badges.length ? badges.map((b, i) => `
            <div class="mhv-badge-card ${b.earned?'mhv-badge-earned':'mhv-badge-locked'} stagger-${Math.min(i+1,10)}">
              <div class="mhv-badge-emoji">${b.icon||''}</div>
              <div class="mhv-badge-name">${b.name}</div>
              <div class="mhv-badge-status">${b.earned ? ' Earned' : ' Locked'}</div>
            </div>`).join('')
            : '<div class="mhv-empty-state"><div class="mhv-empty-icon"></div><p>Complete habits to earn badges!</p></div>'}
        </div>
      </div>
    </div>`;
}

/* ================================================================
   COMMUNITY TAB
================================================================ */
function renderCommunityTab() {
  return `
    <div class="mhv-grid2">
      <div class="mhv-card">
        <div class="mhv-card-head"><h3> Challenges</h3></div>
        <div class="mhv-challenge-list">
          ${state.challenges.slice(0,12).map((c, i) => `
            <div class="mhv-challenge-card stagger-${Math.min(i+1,10)}">
              <div class="mhv-challenge-inner">
                <div class="mhv-challenge-icon">${c.icon||''}</div>
                <div class="mhv-challenge-info">
                  <div class="mhv-challenge-title">${c.title}</div>
                  <div class="mhv-challenge-desc">${c.description}</div>
                </div>
                <span class="mhv-xp-tag"> ${c.xp_reward}</span>
              </div>
              <button class="mhv-${c.joined?'ghost':'accent'}-btn mhv-btn-sm" data-join="${c.id}" ${c.joined?'disabled':''}>
                ${c.joined ? ' Joined' : '+ Join'}
              </button>
            </div>`).join('')
            || '<div class="mhv-empty-state"><div class="mhv-empty-icon"></div><p>No challenges available yet!</p></div>'}
        </div>
      </div>

      <div class="mhv-card">
        <div class="mhv-card-head"><h3> Leaderboard</h3></div>
        <div class="mhv-leaderboard">
          ${state.leaderboard.slice(0,10).map((u, i) => `
            <div class="mhv-lb-row ${i<3?'mhv-lb-podium':''} stagger-${Math.min(i+1,10)}">
              <div class="mhv-lb-medal">${i===0?'':i===1?'':i===2?'':`#${i+1}`}</div>
              <div class="mhv-lb-avatar">${(u.name||'?')[0].toUpperCase()}</div>
              <div class="mhv-lb-name">${u.name}</div>
              <div class="mhv-lb-score">${(u.total_actions_completed||0).toLocaleString()}<small>actions</small></div>
            </div>`).join('')
            || '<div class="mhv-empty-state"><div class="mhv-empty-icon"></div><p>Be the first on the board!</p></div>'}
        </div>
      </div>
    </div>`;
}

/* ================================================================
   MAIN APP SHELL
================================================================ */
function renderApp() {
  const tab = TABS[state.tab];
  const avatar = (state.user?.name || 'U')[0].toUpperCase();
  const pendingCount = state.today.filter(a => !a.is_completed && !a.is_skipped).length;

  app.innerHTML = `
    <div class="mhv-shell ${state.navOpen ? 'nav-open' : ''}">
      <div class="mhv-overlay" id="mhv-overlay"></div>

      <!--  Sidebar  -->
      <aside class="mhv-sidebar">
        <div class="mhv-sb-logo">
          <div class="mhv-sb-bolt"><span class="mhv-bolt-pulse"></span></div>
          <span class="mhv-sb-brand">MicroHabit</span>
          <button class="mhv-sb-close" id="mhv-close-nav" title="Close"></button>
        </div>

        <div class="mhv-sb-user">
          <div class="mhv-sb-avatar">${avatar}<div class="mhv-sb-avatar-ring"></div></div>
          <div class="mhv-sb-user-info">
            <div class="mhv-sb-name">${state.user?.name || 'User'}</div>
            <div class="mhv-sb-level">Lv ${state.user?.level||1}  ${(state.user?.xp||0).toLocaleString()} XP</div>
          </div>
        </div>

        <div class="mhv-sb-xp">
          <div class="mhv-sb-xp-bar"><div class="mhv-sb-xp-fill" style="width:${levelPct()}%"></div></div>
          <span class="mhv-sb-xp-label">${levelPct()}% to Level ${(state.user?.level||1)+1}</span>
        </div>

        <nav class="mhv-sb-nav">
          ${Object.entries(TABS).map(([key, t]) => {
            const hasBadge = key === 'today' && pendingCount > 0;
            return `<button class="mhv-sb-nav-btn ${state.tab===key?'active':''}" data-tab="${key}" style="--tc:${t.color}">
              <span class="mhv-sb-nav-icon">${t.icon}</span>
              <span class="mhv-sb-nav-label">${t.label}</span>
              ${hasBadge ? `<span class="mhv-sb-nav-badge">${pendingCount}</span>` : ''}
              <span class="mhv-sb-nav-arrow"></span>
            </button>`;
          }).join('')}
        </nav>

        <div class="mhv-sb-footer">
          <div class="mhv-sb-streak"><span></span> ${state.user?.current_streak||0} day streak</div>
          <button class="mhv-sb-logout" id="mhv-logout">Logout </button>
        </div>
      </aside>

      <!--  Main  -->
      <main class="mhv-content">
        <header class="mhv-header">
          <div class="mhv-header-left">
            <button class="mhv-menu-btn" id="mhv-open-nav" title="Menu">
              <span></span><span></span><span></span>
            </button>
            <div class="mhv-header-title">
              <div class="mhv-header-icon" style="color:${tab.color}">${tab.icon}</div>
              <div>
                <h1>${tab.label}</h1>
                <p class="mhv-header-quote">"${state.dashboard?.quote || 'Small actions. Big trajectory.'}"</p>
              </div>
            </div>
          </div>
          <div class="mhv-header-right">
            <div class="mhv-streak-pill"><span></span>${state.user?.current_streak||0}</div>
            <div class="mhv-xp-pill"><span></span>${(state.user?.xp||0).toLocaleString()}</div>
            <button class="mhv-refresh-btn" id="mhv-reload" title="Reload"></button>
          </div>
        </header>

        <div class="mhv-body">
          ${renderKPIs()}
          <div class="mhv-tab-pane" id="mhv-tab-pane">
            ${renderTabContent()}
          </div>
        </div>
      </main>
    </div>`;

  bindShell();
  bindTabActions();
}

function renderTabContent() {
  if (state.tab === 'goals')     return renderGoalsTab();
  if (state.tab === 'journal')   return renderJournalTab();
  if (state.tab === 'progress')  return renderProgressTab();
  if (state.tab === 'community') return renderCommunityTab();
  return renderTodayTab();
}

/* ================================================================
   EVENT BINDINGS
================================================================ */
function bindShell() {
  $('#mhv-open-nav')?.addEventListener('click', () => { state.navOpen = true; renderApp(); });
  $('#mhv-close-nav')?.addEventListener('click', () => { state.navOpen = false; renderApp(); });
  $('#mhv-overlay')?.addEventListener('click', () => { state.navOpen = false; renderApp(); });

  $('#mhv-logout')?.addEventListener('click', () => {
    localStorage.removeItem('mh_token');
    Object.assign(state, { token: '', user: null });
    renderAuth();
  });

  $('#mhv-reload')?.addEventListener('click', async () => {
    const btn = $('#mhv-reload');
    if (!btn) return;
    btn.classList.add('mhv-spin');
    try {
      await loadAll();
      renderApp();
      toast('Dashboard refreshed!');
    } finally {
      btn.classList.remove('mhv-spin');
    }
  });

  $$('.mhv-sb-nav-btn').forEach(btn => btn.addEventListener('click', () => {
    state.tab = btn.dataset.tab;
    state.navOpen = false;
    renderApp();
  }));
}

function bindTabActions() {
  /* Complete */
  $$('[data-complete]').forEach(btn => btn.addEventListener('click', async (e) => {
    const id = btn.dataset.complete;
    const rect = btn.getBoundingClientRect();
    btn.disabled = true;
    btn.textContent = '';
    try {
      await api(`/today/${id}/complete`, { method: 'POST', body: { mood_before: 6, mood_after: 8 } });
      const card = btn.closest('[data-action-id]');
      const xp = parseInt(card?.querySelector('.mhv-xp-tag')?.textContent || '10') || 10;
      confetti(rect.left + rect.width / 2, rect.top);
      xpPop(rect.left, rect.top - 30, xp);
      toast(`Action completed! +${xp} XP `, 'xp');
      await loadAll();
      renderApp();
    } catch (err) {
      toast(err.message, 'err');
      btn.disabled = false;
      btn.textContent = ' Complete';
    }
  }));

  /* Skip */
  $$('[data-skip]').forEach(btn => btn.addEventListener('click', async () => {
    btn.disabled = true; btn.textContent = '';
    try {
      await api(`/today/${btn.dataset.skip}/skip`, { method: 'POST', body: { reason: 'Skipped from app' } });
      toast('Action skipped.');
      await loadAll();
      renderApp();
    } catch (err) {
      toast(err.message, 'err');
    }
  }));

  /* Refresh actions */
  $('#mhv-refresh-actions')?.addEventListener('click', async () => {
    const btn = $('#mhv-refresh-actions');
    btn.textContent = ' Refreshing';
    btn.disabled = true;
    try {
      await api('/today/refresh', { method: 'POST', body: {} });
      await loadAll();
      renderApp();
      toast('New actions generated!');
    } catch (err) {
      toast(err.message, 'err');
      btn.textContent = ' Refresh';
      btn.disabled = false;
    }
  });

  /* Custom action */
  $('#mhv-add-custom')?.addEventListener('click', async () => {
    const text = prompt('Enter your 2-minute custom action:');
    if (!text?.trim()) return;
    try {
      await api('/today/add-custom', { method: 'POST', body: { category: 'mental', action_text: text.trim(), xp: 15 } });
      await loadAll();
      renderApp();
      toast('Custom action added!');
    } catch (err) {
      toast(err.message, 'err');
    }
  });

  /* Goal form */
  $('#mhv-goal-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = e.target.querySelector('button[type=submit]');
    const orig = btn.textContent;
    btn.textContent = 'Adding'; btn.disabled = true;
    try {
      await api('/goals', { method: 'POST', body: Object.fromEntries(new FormData(e.target)) });
      await loadAll();
      renderApp();
      toast('Goal created! ');
    } catch (err) {
      toast(err.message, 'err');
      btn.textContent = orig; btn.disabled = false;
    }
  });

  /* Journal form */
  $('#mhv-journal-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = e.target.querySelector('button[type=submit]');
    const orig = btn.textContent;
    btn.textContent = 'Saving'; btn.disabled = true;
    const payload = Object.fromEntries(new FormData(e.target));
    if (payload.mood) payload.mood = Number(payload.mood);
    try {
      await api('/journal', { method: 'POST', body: payload });
      await loadAll();
      renderApp();
      toast('Journal entry saved ');
    } catch (err) {
      toast(err.message, 'err');
      btn.textContent = orig; btn.disabled = false;
    }
  });

  /* Wellness form */
  $('#mhv-wellness-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = e.target.querySelector('button[type=submit]');
    const orig = btn.textContent;
    btn.textContent = 'Logging'; btn.disabled = true;
    const p = Object.fromEntries(new FormData(e.target));
    try {
      await Promise.all([
        api('/water', { method: 'POST', body: { glasses: Number(p.glasses), goal: 8 } }),
        api('/mood',  { method: 'POST', body: { mood: Number(p.mood), notes: 'Logged from dashboard' } }),
        api('/focus', { method: 'POST', body: { duration_minutes: Number(p.focus), category: 'focus', notes: '' } }),
      ]);
      await loadAll();
      renderApp();
      toast('Wellness logged! ');
    } catch (err) {
      toast(err.message, 'err');
      btn.textContent = orig; btn.disabled = false;
    }
  });

  /* Join challenge */
  $$('[data-join]').forEach(btn => btn.addEventListener('click', async () => {
    btn.disabled = true; btn.textContent = '';
    try {
      await api(`/challenges/${btn.dataset.join}/join`, { method: 'POST', body: {} });
      await loadAll();
      renderApp();
      toast('Challenge joined! ');
    } catch (err) {
      toast(err.message, 'err');
    }
  }));
}

/* ================================================================
   INIT
================================================================ */
async function init() {
  if (!state.token) return renderAuth();
  app.innerHTML = `
    <div class="mhv-splash">
      <div class="mhv-splash-bolt"></div>
      <div class="mhv-splash-label">Loading MicroHabit</div>
      <div class="mhv-splash-bar"><div class="mhv-splash-progress"></div></div>
    </div>`;
  try {
    await loadAll();
    renderApp();
  } catch {
    localStorage.removeItem('mh_token');
    renderAuth();
  }
}

init();
