import './styles.css';

const app = document.getElementById('app');
const API = '/api';

const TAB_META = {
  today: { label: 'Today', icon: '✅' },
  goals: { label: 'Goals', icon: '🎯' },
  journal: { label: 'Journal', icon: '📝' },
  progress: { label: 'Progress', icon: '📈' },
  community: { label: 'Community', icon: '🌐' },
};

const CATEGORIES = ['health', 'finance', 'learning', 'social', 'mental', 'creativity'];

const state = {
  token: localStorage.getItem('mh_token') || '',
  user: null,
  dashboard: null,
  today: [],
  goals: [],
  journal: [],
  stats: null,
  report: null,
  achievements: null,
  challenges: [],
  leaderboard: [],
  water: null,
  mood: [],
  focusHistory: [],
  tab: 'today',
  notice: null,
  navOpen: false,
};

const $ = (s, p = document) => p.querySelector(s);
const $$ = (s, p = document) => [...p.querySelectorAll(s)];

async function api(path, opts = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (state.token) headers.Authorization = `Bearer ${state.token}`;

  const res = await fetch(`${API}${path}`, {
    ...opts,
    headers,
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  });

  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Request failed');
  return data;
}

function formatDate(value) {
  return new Date(value).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function getLevelPct() {
  if (!state.stats?.user) return 0;
  const inLevel = Number(state.stats.user.xp_in_level || 0);
  const forNext = Number(state.stats.user.xp_for_next || 100);
  if (forNext <= 0) return 0;
  return Math.min(100, Math.round((inLevel / forNext) * 100));
}

function pctToday() {
  if (!state.today.length) return 0;
  const done = state.today.filter((a) => a.is_completed).length;
  return Math.round((done / state.today.length) * 100);
}

function showNotice(message, type = 'ok') {
  state.notice = { message, type };
  renderApp();
}

async function loadAll() {
  const [dashboard, today, goals, journal, stats, report, achievements, challenges, leaderboard, water, mood, focusHistory] = await Promise.all([
    api('/dashboard'),
    api('/today'),
    api('/goals'),
    api('/journal'),
    api('/stats'),
    api('/report'),
    api('/achievements'),
    api('/challenges'),
    api('/leaderboard'),
    api('/water'),
    api('/mood'),
    api('/focus/history'),
  ]);

  Object.assign(state, {
    dashboard,
    user: dashboard.user,
    today,
    goals,
    journal,
    stats,
    report,
    achievements,
    challenges,
    leaderboard,
    water,
    mood,
    focusHistory,
  });
}

function logout() {
  localStorage.removeItem('mh_token');
  Object.assign(state, { token: '', user: null });
  renderAuth();
}

function renderAuth(mode = 'login', error = '') {
  app.innerHTML = `
    <section class="mhx-auth-v2">
      <div class="mhx-auth-glow"></div>
      <div class="mhx-auth-panel">
        <div class="mhx-auth-brand">
          <h1>⚡ MicroHabit</h1>
          <p>2-minute actions. Real-life compounding results.</p>
          <ul>
            <li>✅ Daily AI micro-actions</li>
            <li>🔥 XP, levels and streaks</li>
            <li>🧠 Progress insights and reports</li>
          </ul>
        </div>

        <div class="mhx-auth-card-v2">
          <div class="mhx-auth-switch">
            <button class="mhx-btn ${mode === 'login' ? 'primary' : ''}" data-mode="login">Login</button>
            <button class="mhx-btn ${mode === 'register' ? 'primary' : ''}" data-mode="register">Register</button>
          </div>

          ${error ? `<div class="mhx-msg err">${error}</div>` : ''}

          <form id="mhx-auth-form" class="mhx-auth-form-v2">
            ${mode === 'register' ? '<label>Name<input name="name" required /></label>' : ''}
            <label>Email<input type="email" name="email" required /></label>
            <label>Password<input type="password" name="password" minlength="6" required /></label>
            <button class="mhx-btn primary" type="submit">${mode === 'login' ? 'Sign In' : 'Create Account'}</button>
          </form>
        </div>
      </div>
    </section>
  `;

  $$('.mhx-auth-switch button').forEach((btn) => {
    btn.addEventListener('click', () => renderAuth(btn.dataset.mode));
  });

  $('#mhx-auth-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const payload = Object.fromEntries(new FormData(e.target).entries());

    try {
      const endpoint = mode === 'login' ? '/auth/login' : '/auth/register';
      const data = await api(endpoint, { method: 'POST', body: payload });
      state.token = data.token;
      localStorage.setItem('mh_token', data.token);
      await loadAll();
      renderApp();
    } catch (err) {
      renderAuth(mode, err.message);
    }
  });
}

function renderShellStats() {
  const levelPct = getLevelPct();
  const completed = state.today.filter((a) => a.is_completed).length;
  const pending = state.today.filter((a) => !a.is_completed && !a.is_skipped).length;

  return `
    <section class="mhx-kpis">
      <article class="mhx-kpi">
        <div class="mhx-kpi-label">Today's Completion</div>
        <div class="mhx-kpi-value">${pctToday()}%</div>
        <div class="mhx-progress"><span style="width:${pctToday()}%"></span></div>
        <div class="mhx-kpi-sub">${completed}/${state.today.length} done</div>
      </article>

      <article class="mhx-kpi">
        <div class="mhx-kpi-label">Level Progress</div>
        <div class="mhx-kpi-value">Lv ${state.user.level || 1}</div>
        <div class="mhx-progress"><span style="width:${levelPct}%"></span></div>
        <div class="mhx-kpi-sub">${levelPct}% to next</div>
      </article>

      <article class="mhx-kpi">
        <div class="mhx-kpi-label">Current Streak</div>
        <div class="mhx-kpi-value">🔥 ${state.user.current_streak || 0}</div>
        <div class="mhx-kpi-sub">Longest ${state.user.longest_streak || 0} days</div>
      </article>

      <article class="mhx-kpi">
        <div class="mhx-kpi-label">Wellness Today</div>
        <div class="mhx-kpi-value">💧 ${state.water?.today?.glasses || 0}/${state.water?.today?.goal || 8}</div>
        <div class="mhx-kpi-sub">${pending} actions pending</div>
      </article>
    </section>
  `;
}

function renderTodayTab() {
  return `
    <section class="mhx-grid2">
      <article class="mhx-card">
        <div class="mhx-row">
          <h3>Today's Actions</h3>
          <div class="mhx-actions">
            <button class="mhx-btn" id="mhx-refresh-actions">Refresh</button>
            <button class="mhx-btn" id="mhx-add-custom">+ Custom</button>
          </div>
        </div>

        <div class="mhx-list mhx-list-lg">
          ${state.today.map((a) => `
            <div class="mhx-item mhx-action-item ${a.is_completed ? 'done' : ''}">
              <div class="mhx-row">
                <div class="mhx-action-head">
                  <span class="mhx-cat ${a.category}">${a.category}</span>
                  <strong>${a.action_text}</strong>
                </div>
                <span class="mhx-pill">${a.xp_earned || 0} XP</span>
              </div>
              <div class="mhx-actions">
                <button class="mhx-btn" data-complete="${a.id}" ${a.is_completed ? 'disabled' : ''}>${a.is_completed ? 'Completed' : 'Complete'}</button>
                <button class="mhx-btn" data-skip="${a.id}" ${a.is_completed || a.is_skipped ? 'disabled' : ''}>Skip</button>
              </div>
            </div>
          `).join('') || '<div class="mhx-muted">No actions yet. Try refresh.</div>'}
        </div>
      </article>

      <article class="mhx-card">
        <h3>Quick Wellness Log</h3>
        <form id="mhx-wellness-form" class="mhx-form-grid">
          <label>Water glasses<input type="number" min="1" max="20" name="glasses" value="1" /></label>
          <label>Mood (1-10)<input type="number" min="1" max="10" name="mood" value="7" /></label>
          <label>Focus mins<input type="number" min="5" max="180" name="focus" value="25" /></label>
          <button class="mhx-btn primary" type="submit">Log Wellness</button>
        </form>

        <hr class="mhx-sep"/>
        <div class="mhx-list">
          <div class="mhx-item mhx-row"><span>Unread Notifications</span><strong>${state.dashboard.unread_count || 0}</strong></div>
          <div class="mhx-item mhx-row"><span>Focus Sessions</span><strong>${state.focusHistory.length}</strong></div>
          <div class="mhx-item mhx-row"><span>Active Goals</span><strong>${state.goals.length}</strong></div>
        </div>
      </article>
    </section>
  `;
}

function renderGoalsTab() {
  return `
    <section class="mhx-grid2">
      <article class="mhx-card">
        <h3>Create Goal</h3>
        <form id="mhx-goal-form" class="mhx-form-grid">
          <label>Category
            <select name="category">
              ${CATEGORIES.map((c) => `<option value="${c}">${c}</option>`).join('')}
            </select>
          </label>
          <label>Title<input name="title" required /></label>
          <label>Priority
            <select name="priority"><option>low</option><option selected>medium</option><option>high</option></select>
          </label>
          <label>Description<textarea name="description" rows="3"></textarea></label>
          <button class="mhx-btn primary" type="submit">Add Goal</button>
        </form>
      </article>

      <article class="mhx-card">
        <h3>Active Goals (${state.goals.length})</h3>
        <div class="mhx-list">
          ${state.goals.map((g) => `
            <div class="mhx-item">
              <div class="mhx-row"><strong>${g.title}</strong><span class="mhx-cat ${g.category}">${g.category}</span></div>
              <div class="mhx-muted">${g.description || 'No description yet.'}</div>
              <div class="mhx-progress"><span style="width:${g.completion_rate || 0}%"></span></div>
              <div class="mhx-muted">${g.completed_actions || 0}/${g.total_actions || 0} actions • ${g.completion_rate || 0}%</div>
            </div>
          `).join('') || '<div class="mhx-muted">No goals yet.</div>'}
        </div>
      </article>
    </section>
  `;
}

function renderJournalTab() {
  return `
    <section class="mhx-grid2">
      <article class="mhx-card">
        <h3>New Journal Entry</h3>
        <form id="mhx-journal-form" class="mhx-journal-form">
          <label>Category
            <select name="category"><option>general</option><option>mental</option><option>health</option><option>learning</option></select>
          </label>
          <label>Mood (1-10)<input type="number" name="mood" min="1" max="10" /></label>
          <label>Entry<textarea name="content" rows="6" placeholder="What happened today?" required></textarea></label>
          <button class="mhx-btn primary" type="submit">Save Entry</button>
        </form>
      </article>

      <article class="mhx-card">
        <h3>Recent Journal</h3>
        <div class="mhx-list">
          ${state.journal.slice(0, 10).map((j) => `
            <div class="mhx-item">
              <div class="mhx-row">
                <strong>${j.category}</strong>
                <span class="mhx-muted">${formatDate(j.created_at)}</span>
              </div>
              <p class="mhx-copy">${j.content}</p>
            </div>
          `).join('') || '<div class="mhx-muted">No journal entries yet.</div>'}
        </div>
      </article>
    </section>
  `;
}

function renderProgressTab() {
  const top = state.stats.by_category?.slice(0, 6) || [];
  const badges = state.achievements?.badges?.slice(0, 10) || [];

  return `
    <section class="mhx-grid2">
      <article class="mhx-card">
        <h3>Progress Insights</h3>
        <p class="mhx-muted">Total minutes ${state.stats.total_minutes} • XP ${state.stats.user.xp}</p>
        <div class="mhx-list">
          ${top.map((c) => `
            <div class="mhx-item">
              <div class="mhx-row"><span class="mhx-cat ${c.category}">${c.category}</span><strong>${c.completed}</strong></div>
            </div>
          `).join('') || '<div class="mhx-muted">No completion data yet.</div>'}
        </div>

        <hr class="mhx-sep"/>
        <h4>AI Compound Outlook</h4>
        <div class="mhx-insight">${state.report.summary || state.report.long_term_impact || 'Keep your streak alive and let compounding do the work.'}</div>
      </article>

      <article class="mhx-card">
        <h3>Achievements</h3>
        <div class="mhx-list">
          ${badges.map((b) => `
            <div class="mhx-item mhx-row">
              <span>${b.icon} ${b.name}</span>
              <span class="mhx-pill ${b.earned ? 'ok' : ''}">${b.earned ? 'Earned' : 'Locked'}</span>
            </div>
          `).join('') || '<div class="mhx-muted">No badge data.</div>'}
        </div>
      </article>
    </section>
  `;
}

function renderCommunityTab() {
  return `
    <section class="mhx-grid2">
      <article class="mhx-card">
        <h3>Challenges</h3>
        <div class="mhx-list">
          ${state.challenges.slice(0, 12).map((c) => `
            <div class="mhx-item">
              <div class="mhx-row"><strong>${c.icon || '🏁'} ${c.title}</strong><span class="mhx-pill">${c.xp_reward} XP</span></div>
              <div class="mhx-muted">${c.description}</div>
              <button class="mhx-btn" data-join="${c.id}" ${c.joined ? 'disabled' : ''}>${c.joined ? 'Joined' : 'Join challenge'}</button>
            </div>
          `).join('')}
        </div>
      </article>

      <article class="mhx-card">
        <h3>Leaderboard</h3>
        <div class="mhx-list">
          ${state.leaderboard.slice(0, 10).map((u, i) => `
            <div class="mhx-item mhx-row">
              <span>#${i + 1} ${u.name}</span>
              <strong>${u.total_actions_completed || 0} actions</strong>
            </div>
          `).join('')}
        </div>
      </article>
    </section>
  `;
}

function renderTab() {
  if (state.tab === 'goals') return renderGoalsTab();
  if (state.tab === 'journal') return renderJournalTab();
  if (state.tab === 'progress') return renderProgressTab();
  if (state.tab === 'community') return renderCommunityTab();
  return renderTodayTab();
}

function renderApp() {
  app.innerHTML = `
    <main class="mhx-app">
      <aside class="mhx-side ${state.navOpen ? 'open' : ''}">
        <div class="mhx-side-head">
          <h2>⚡ MicroHabit</h2>
          <button class="mhx-btn mhx-side-close" id="mhx-close-nav">✕</button>
        </div>

        <div class="mhx-user">
          <div class="mhx-avatar">${(state.user.name || 'U').slice(0, 1).toUpperCase()}</div>
          <div>
            <div class="mhx-user-name">${state.user.name}</div>
            <div class="mhx-muted">Level ${state.user.level || 1} • ${state.user.xp || 0} XP</div>
          </div>
        </div>

        <nav class="mhx-side-nav">
          ${Object.entries(TAB_META).map(([key, meta]) => `
            <button class="mhx-nav-item ${state.tab === key ? 'active' : ''}" data-tab="${key}">
              <span>${meta.icon}</span>
              <span>${meta.label}</span>
            </button>
          `).join('')}
        </nav>

        <button class="mhx-btn mhx-logout" id="mhx-logout">Logout</button>
      </aside>

      <section class="mhx-main">
        <header class="mhx-topbar">
          <div class="mhx-top-left">
            <button class="mhx-btn" id="mhx-open-nav">☰</button>
            <div>
              <h1>${TAB_META[state.tab].icon} ${TAB_META[state.tab].label}</h1>
              <p>${state.dashboard.quote || 'Small actions. Big trajectory.'}</p>
            </div>
          </div>
          <button class="mhx-btn" id="mhx-reload">Reload</button>
        </header>

        ${state.notice ? `<div class="mhx-msg ${state.notice.type === 'err' ? 'err' : 'ok'}">${state.notice.message}</div>` : ''}
        ${renderShellStats()}
        ${renderTab()}
      </section>
    </main>
  `;

  $('#mhx-open-nav').addEventListener('click', () => {
    state.navOpen = true;
    renderApp();
  });

  const closeNav = $('#mhx-close-nav');
  if (closeNav) {
    closeNav.addEventListener('click', () => {
      state.navOpen = false;
      renderApp();
    });
  }

  $('#mhx-logout').addEventListener('click', logout);

  $('#mhx-reload').addEventListener('click', async () => {
    await loadAll();
    showNotice('Dashboard refreshed.');
  });

  $$('.mhx-nav-item').forEach((btn) => btn.addEventListener('click', () => {
    state.tab = btn.dataset.tab;
    state.navOpen = false;
    renderApp();
  }));

  bindActions();
}

function bindActions() {
  const completeBtns = $$('[data-complete]');
  completeBtns.forEach((button) => button.addEventListener('click', async () => {
    try {
      await api(`/today/${button.dataset.complete}/complete`, {
        method: 'POST',
        body: { mood_before: 6, mood_after: 8 },
      });
      await loadAll();
      showNotice('Action completed. XP awarded.');
    } catch (err) {
      showNotice(err.message, 'err');
    }
  }));

  const skipBtns = $$('[data-skip]');
  skipBtns.forEach((button) => button.addEventListener('click', async () => {
    try {
      await api(`/today/${button.dataset.skip}/skip`, {
        method: 'POST',
        body: { reason: 'Skipped from app UI' },
      });
      await loadAll();
      showNotice('Action skipped.');
    } catch (err) {
      showNotice(err.message, 'err');
    }
  }));

  const refreshBtn = $('#mhx-refresh-actions');
  if (refreshBtn) {
    refreshBtn.addEventListener('click', async () => {
      try {
        await api('/today/refresh', { method: 'POST', body: {} });
        await loadAll();
        showNotice('Today actions refreshed.');
      } catch (err) {
        showNotice(err.message, 'err');
      }
    });
  }

  const customBtn = $('#mhx-add-custom');
  if (customBtn) {
    customBtn.addEventListener('click', async () => {
      const text = prompt('Enter your custom 2-minute action');
      if (!text) return;

      try {
        await api('/today/add-custom', {
          method: 'POST',
          body: { category: 'mental', action_text: text, xp: 15 },
        });
        await loadAll();
        showNotice('Custom action added.');
      } catch (err) {
        showNotice(err.message, 'err');
      }
    });
  }

  const goalForm = $('#mhx-goal-form');
  if (goalForm) {
    goalForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const payload = Object.fromEntries(new FormData(e.target).entries());
      try {
        await api('/goals', { method: 'POST', body: payload });
        await loadAll();
        showNotice('Goal created successfully.');
      } catch (err) {
        showNotice(err.message, 'err');
      }
    });
  }

  const journalForm = $('#mhx-journal-form');
  if (journalForm) {
    journalForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const payload = Object.fromEntries(new FormData(e.target).entries());
      payload.mood = payload.mood ? Number(payload.mood) : null;

      try {
        await api('/journal', { method: 'POST', body: payload });
        await loadAll();
        showNotice('Journal entry saved.');
      } catch (err) {
        showNotice(err.message, 'err');
      }
    });
  }

  const wellnessForm = $('#mhx-wellness-form');
  if (wellnessForm) {
    wellnessForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const payload = Object.fromEntries(new FormData(e.target).entries());

      try {
        await api('/water', { method: 'POST', body: { glasses: Number(payload.glasses), goal: 8 } });
        await api('/mood', { method: 'POST', body: { mood: Number(payload.mood), notes: 'Logged from dashboard' } });
        await api('/focus', {
          method: 'POST',
          body: { duration_minutes: Number(payload.focus), category: 'focus', notes: '' },
        });
        await loadAll();
        showNotice('Wellness metrics logged.');
      } catch (err) {
        showNotice(err.message, 'err');
      }
    });
  }

  $$('[data-join]').forEach((button) => button.addEventListener('click', async () => {
    try {
      await api(`/challenges/${button.dataset.join}/join`, { method: 'POST', body: {} });
      await loadAll();
      showNotice('Joined challenge.');
    } catch (err) {
      showNotice(err.message, 'err');
    }
  }));
}

async function init() {
  if (!state.token) return renderAuth();
  try {
    await loadAll();
    renderApp();
  } catch {
    logout();
  }
}

init();
