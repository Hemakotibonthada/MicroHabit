// ==================== MicroHabit Enhanced Frontend ====================
const API = '/api';
let token = localStorage.getItem('microhabit_token');
let currentPage = 'dashboard';
let dashboardData = null;
let focusInterval = null;
let focusSeconds = 0;
let focusRunning = false;
const $ = id => document.getElementById(id);
const TOAST_DURATION = 3000;
const CATEGORIES = ['health','finance','learning','social','mental','creativity'];
const CAT_ICONS = { health: '💪', finance: '💰', learning: '📚', social: '🤝', mental: '🧘', creativity: '🎨' };
const CAT_COLORS = { health: '#22c55e', finance: '#f59e0b', learning: '#3b82f6', social: '#ec4899', mental: '#8b5cf6', creativity: '#f97316' };

// ==================== UTILITIES ====================
async function request(path, options = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  try {
    const res = await fetch(`${API}${path}`, { ...options, headers: { ...headers, ...options.headers } });
    if (res.status === 401) { token = null; localStorage.removeItem('microhabit_token'); renderApp(); return null; }
    const data = await res.json();
    if (!res.ok && data.error) { showToast(data.error, 'error'); return null; }
    return data;
  } catch (e) { showToast('Network error', 'error'); return null; }
}

function setToken(t) { token = t; localStorage.setItem('microhabit_token', t); }
function isLoggedIn() { return !!token; }

function showToast(message, type = 'success') {
  const container = document.querySelector('.toast-container') || (() => { const d = document.createElement('div'); d.className = 'toast-container'; document.body.appendChild(d); return d; })();
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.innerHTML = `<span class="toast-icon">${type === 'success' ? '✓' : type === 'error' ? '✕' : 'ℹ'}</span><span>${message}</span>`;
  container.appendChild(toast);
  requestAnimationFrame(() => toast.classList.add('show'));
  setTimeout(() => { toast.classList.remove('show'); setTimeout(() => toast.remove(), 300); }, TOAST_DURATION);
}

function showModal(title, content, actions = '') {
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.innerHTML = `<div class="modal"><div class="modal-header"><h3>${title}</h3><button class="modal-close" onclick="this.closest('.modal-overlay').remove()">✕</button></div><div class="modal-body">${content}</div>${actions ? `<div class="modal-footer">${actions}</div>` : ''}</div>`;
  document.body.appendChild(overlay);
  requestAnimationFrame(() => overlay.classList.add('show'));
  overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); });
  return overlay;
}

function formatDate(d) { return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }); }
function formatDateShort(d) { return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }); }
function timeAgo(d) { const s = Math.floor((Date.now() - new Date(d)) / 1000); if (s < 60) return 'just now'; if (s < 3600) return Math.floor(s / 60) + 'm ago'; if (s < 86400) return Math.floor(s / 3600) + 'h ago'; return Math.floor(s / 86400) + 'd ago'; }
function progressBar(pct, color = '#f97316') { return `<div class="progress-bar"><div class="progress-fill" style="width:${Math.min(pct, 100)}%;background:${color}"></div></div>`; }
function catIcon(c) { return CAT_ICONS[c] || '⚡'; }
function catColor(c) { return CAT_COLORS[c] || '#f97316'; }

// ==================== APP RENDER ====================
function renderApp() {
  const app = document.getElementById('app');
  if (!isLoggedIn()) { app.innerHTML = renderAuth(); bindAuth(); }
  else { app.innerHTML = renderShell(); bindNav(); navigateTo(currentPage); }
}

// ==================== AUTH ====================
function renderAuth() {
  return `
  <div class="auth-container">
    <div class="auth-bg-shapes"><div class="shape shape-1"></div><div class="shape shape-2"></div><div class="shape shape-3"></div></div>
    <div class="auth-card">
      <div class="auth-logo">
        <div class="logo-icon">⚡</div>
        <h1>MicroHabit</h1>
        <p class="subtitle">2-Minute Life Compound Engine</p>
      </div>
      <div class="tabs">
        <button class="tab active" data-tab="login">Sign In</button>
        <button class="tab" data-tab="register">Create Account</button>
      </div>
      <form id="login-form">
        <div class="input-group"><span class="input-icon">📧</span><input type="email" id="l-email" placeholder="Email address" required /></div>
        <div class="input-group"><span class="input-icon">🔒</span><input type="password" id="l-pass" placeholder="Password" required /></div>
        <button type="submit" class="btn-primary btn-glow">Sign In →</button>
      </form>
      <form id="register-form" style="display:none">
        <div class="input-group"><span class="input-icon">👤</span><input type="text" id="r-name" placeholder="Full Name" required /></div>
        <div class="input-group"><span class="input-icon">📧</span><input type="email" id="r-email" placeholder="Email address" required /></div>
        <div class="input-group"><span class="input-icon">🔒</span><input type="password" id="r-pass" placeholder="Password (min 6 chars)" required minlength="6" /></div>
        <button type="submit" class="btn-primary btn-glow">Create Account →</button>
      </form>
      <div id="auth-error" class="error"></div>
      <div class="auth-features">
        <div class="auth-feature"><span>⚡</span>2-Min Habits</div>
        <div class="auth-feature"><span>🔥</span>Streaks</div>
        <div class="auth-feature"><span>🏆</span>Achievements</div>
        <div class="auth-feature"><span>🧠</span>AI Insights</div>
      </div>
    </div>
  </div>`;
}

function bindAuth() {
  document.querySelectorAll('.tab').forEach(tab => {
    tab.onclick = () => {
      document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      $('login-form').style.display = tab.dataset.tab === 'login' ? 'flex' : 'none';
      $('register-form').style.display = tab.dataset.tab === 'register' ? 'flex' : 'none';
    };
  });
  $('login-form').onsubmit = async (e) => {
    e.preventDefault();
    const btn = e.target.querySelector('button'); btn.disabled = true; btn.textContent = 'Signing in...';
    const data = await request('/auth/login', { method: 'POST', body: JSON.stringify({ email: $('l-email').value, password: $('l-pass').value }) });
    if (data?.token) { setToken(data.token); showToast('Welcome back! 🔥'); renderApp(); }
    else { btn.disabled = false; btn.textContent = 'Sign In →'; }
  };
  $('register-form').onsubmit = async (e) => {
    e.preventDefault();
    const btn = e.target.querySelector('button'); btn.disabled = true; btn.textContent = 'Creating...';
    const data = await request('/auth/register', { method: 'POST', body: JSON.stringify({ name: $('r-name').value, email: $('r-email').value, password: $('r-pass').value }) });
    if (data?.token) { setToken(data.token); showToast('Account created! Let\'s build habits ⚡'); renderApp(); }
    else { btn.disabled = false; btn.textContent = 'Create Account →'; }
  };
}

// ==================== SHELL & NAV ====================
function renderShell() {
  return `
  <div class="app-shell">
    <nav class="sidebar">
      <div class="sidebar-logo"><span>⚡</span><h2>MicroHabit</h2></div>
      <div class="nav-links">
        <a class="nav-link active" data-page="dashboard"><span class="nav-icon">🏠</span>Dashboard</a>
        <a class="nav-link" data-page="today"><span class="nav-icon">✅</span>Today</a>
        <a class="nav-link" data-page="goals"><span class="nav-icon">🎯</span>Goals</a>
        <a class="nav-link" data-page="journal"><span class="nav-icon">📝</span>Journal</a>
        <a class="nav-link" data-page="achievements"><span class="nav-icon">🏆</span>Achievements</a>
        <a class="nav-link" data-page="challenges"><span class="nav-icon">⚔️</span>Challenges</a>
        <a class="nav-link" data-page="focus"><span class="nav-icon">🎯</span>Focus Timer</a>
        <a class="nav-link" data-page="stats"><span class="nav-icon">📊</span>Statistics</a>
        <a class="nav-link" data-page="report"><span class="nav-icon">🧠</span>AI Report</a>
        <a class="nav-link" data-page="pods"><span class="nav-icon">👥</span>Pods</a>
        <a class="nav-link" data-page="leaderboard"><span class="nav-icon">🥇</span>Leaderboard</a>
        <a class="nav-link" data-page="settings"><span class="nav-icon">⚙️</span>Settings</a>
      </div>
      <div class="sidebar-footer">
        <button class="btn-logout" onclick="logout()">🚪 Sign Out</button>
      </div>
    </nav>
    <main class="main-content">
      <header class="top-bar">
        <button class="mobile-menu-btn" onclick="document.querySelector('.sidebar').classList.toggle('open')">☰</button>
        <div class="top-bar-right">
          <button class="notif-btn" onclick="showNotifications()">🔔<span id="notif-badge" class="badge hidden">0</span></button>
        </div>
      </header>
      <div id="page-content" class="page-content"></div>
    </main>
  </div>`;
}

function bindNav() {
  document.querySelectorAll('.nav-link').forEach(link => {
    link.onclick = (e) => {
      e.preventDefault();
      navigateTo(link.dataset.page);
      document.querySelector('.sidebar').classList.remove('open');
    };
  });
}

function navigateTo(page) {
  currentPage = page;
  document.querySelectorAll('.nav-link').forEach(l => l.classList.toggle('active', l.dataset.page === page));
  const content = $('page-content');
  content.innerHTML = '<div class="loading-spinner"><div class="spinner"></div></div>';
  const pages = { dashboard: loadDashboard, today: loadToday, goals: loadGoals, journal: loadJournal, achievements: loadAchievements, challenges: loadChallenges, focus: loadFocus, stats: loadStats, report: loadReport, pods: loadPods, leaderboard: loadLeaderboard, settings: loadSettings };
  (pages[page] || loadDashboard)();
}

function logout() { token = null; localStorage.removeItem('microhabit_token'); renderApp(); }

// ==================== DASHBOARD ====================
async function loadDashboard() {
  const data = await request('/dashboard');
  if (!data) return;
  dashboardData = data;
  const u = data.user;
  const xpPct = u.xp_in_level && u.xp_for_next ? Math.round(u.xp_in_level / u.xp_for_next * 100) : 0;
  const completionPct = data.today.total > 0 ? Math.round(data.today.completed / data.today.total * 100) : 0;

  let weekChart = '';
  if (data.week_progress && data.week_progress.length > 0) {
    const maxVal = Math.max(...data.week_progress.map(d => d.total), 1);
    weekChart = data.week_progress.map(d => {
      const h = d.total > 0 ? Math.max(Math.round(d.completed / maxVal * 100), 8) : 8;
      const day = new Date(d.date).toLocaleDateString('en-US', { weekday: 'short' });
      return `<div class="bar-col"><div class="bar" style="height:${h}%;background:${d.completed === d.total && d.total > 0 ? '#22c55e' : '#f97316'}" title="${d.completed}/${d.total}"></div><span>${day}</span></div>`;
    }).join('');
  } else {
    weekChart = '<div class="empty-state-small">No activity this week yet</div>';
  }

  $('page-content').innerHTML = `
  <div class="page-header">
    <div>
      <h1>Welcome back, ${u.name || 'Explorer'}! 👋</h1>
      <p class="text-muted">Keep your streak alive — every 2 minutes count.</p>
    </div>
    <div class="streak-badge ${u.current_streak >= 7 ? 'streak-fire' : ''}">🔥 ${u.current_streak || 0} day streak</div>
  </div>

  ${data.quote ? `<div class="quote-card"><span class="quote-icon">💬</span><p>"${data.quote}"</p></div>` : ''}

  <div class="stats-grid">
    <div class="stat-card stat-orange">
      <div class="stat-icon">⚡</div>
      <div class="stat-value">${u.xp || 0}</div>
      <div class="stat-label">Total XP</div>
      <div class="xp-bar"><div class="xp-fill" style="width:${xpPct}%"></div></div>
      <div class="stat-sub">Level ${u.level || 1} • ${xpPct}% to next</div>
    </div>
    <div class="stat-card stat-green">
      <div class="stat-icon">✅</div>
      <div class="stat-value">${u.total_actions_completed || 0}</div>
      <div class="stat-label">Actions Completed</div>
    </div>
    <div class="stat-card stat-blue">
      <div class="stat-icon">🔥</div>
      <div class="stat-value">${u.current_streak || 0}</div>
      <div class="stat-label">Current Streak</div>
      <div class="stat-sub">Best: ${u.longest_streak || 0} days</div>
    </div>
    <div class="stat-card stat-purple">
      <div class="stat-icon">🎯</div>
      <div class="stat-value">${completionPct}%</div>
      <div class="stat-label">Today's Progress</div>
      ${progressBar(completionPct, '#8b5cf6')}
    </div>
  </div>

  <div class="grid-2">
    <div class="card">
      <div class="card-header"><h3>📅 Today's Actions</h3><a class="card-link" onclick="navigateTo('today')">View All →</a></div>
      <div class="card-body">
        ${data.today.actions.length === 0 ? '<div class="empty-state-small">No actions today. <a onclick="navigateTo(\'goals\')">Set up goals</a> first!</div>' :
          data.today.actions.slice(0, 5).map(a => `
            <div class="action-row ${a.is_completed ? 'completed' : ''} ${a.is_skipped ? 'skipped' : ''}">
              <span class="action-cat">${catIcon(a.category)}</span>
              <div class="action-info">
                <strong>${a.action_text || 'Micro action'}</strong>
                <small>${a.category} • ${a.difficulty || 'beginner'}</small>
              </div>
              ${a.is_completed ? '<span class="action-done">✓ Done</span>' : a.is_skipped ? '<span class="action-skip">⏭ Skipped</span>' : `<button class="btn-xs btn-complete" onclick="quickComplete(${a.id})">Complete</button>`}
            </div>
          `).join('')}
      </div>
    </div>
    <div class="card">
      <div class="card-header"><h3>📊 This Week</h3></div>
      <div class="card-body">
        <div class="week-chart">${weekChart}</div>
      </div>
    </div>
  </div>

  <div class="grid-2">
    <div class="card">
      <div class="card-header"><h3>🎯 Active Goals</h3><a class="card-link" onclick="navigateTo('goals')">Manage →</a></div>
      <div class="card-body">
        ${data.goals.length === 0 ? '<div class="empty-state-small">No goals yet. <a onclick="navigateTo(\'goals\')">Create your first goal!</a></div>' :
          data.goals.slice(0, 4).map(g => `
            <div class="goal-row">
              <span style="color:${g.color || catColor(g.category)}">${catIcon(g.category)}</span>
              <div class="goal-info"><strong>${g.title || g.name}</strong><small>${g.category}</small></div>
            </div>
          `).join('')}
      </div>
    </div>
    <div class="card">
      <div class="card-header"><h3>🔔 Notifications</h3></div>
      <div class="card-body">
        ${data.notifications.length === 0 ? '<div class="empty-state-small">All caught up! 🎉</div>' :
          data.notifications.slice(0, 4).map(n => `
            <div class="notif-row"><span>${n.type === 'level_up' ? '🎉' : n.type === 'achievement' ? '🏆' : n.type === 'streak' ? '🔥' : '📢'}</span><div><strong>${n.title || 'Notification'}</strong><small>${n.message}</small></div></div>
          `).join('')}
      </div>
    </div>
  </div>`;
}

async function quickComplete(id) {
  const data = await request(`/today/${id}/complete`, { method: 'POST', body: JSON.stringify({ mood_before: 5, mood_after: 7, duration_seconds: 120 }) });
  if (data) { showToast(`+${data.xp_earned || 10} XP earned! ⚡`); loadDashboard(); }
}

// ==================== TODAY ====================
async function loadToday() {
  const [actions, goals] = await Promise.all([request('/today'), request('/goals')]);
  if (!actions) return;
  const activeGoals = (goals || []).filter(g => g.is_active);

  $('page-content').innerHTML = `
  <div class="page-header">
    <div><h1>Today's Actions ✅</h1><p class="text-muted">${new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}</p></div>
    <div class="header-actions">
      <button class="btn-secondary" onclick="refreshActions()">🔄 Refresh Actions</button>
      <button class="btn-primary" onclick="showAddCustomAction()">+ Custom Action</button>
    </div>
  </div>

  ${actions.length === 0 ? `
    <div class="empty-state">
      <div class="empty-icon">🌅</div>
      <h3>No actions for today</h3>
      <p>${activeGoals.length === 0 ? 'Create goals first, then your daily actions will be generated!' : 'Click Refresh Actions to generate your micro-actions.'}</p>
      ${activeGoals.length === 0 ? '<button class="btn-primary" onclick="navigateTo(\'goals\')">Create Goals</button>' : '<button class="btn-primary" onclick="refreshActions()">Generate Actions</button>'}
    </div>
  ` : `
    <div class="today-summary">
      <div class="summary-stat"><span class="summary-num">${actions.filter(a => a.is_completed).length}</span><span class="summary-label">Completed</span></div>
      <div class="summary-stat"><span class="summary-num">${actions.filter(a => !a.is_completed && !a.is_skipped).length}</span><span class="summary-label">Remaining</span></div>
      <div class="summary-stat"><span class="summary-num">${actions.filter(a => a.is_skipped).length}</span><span class="summary-label">Skipped</span></div>
      <div class="summary-stat"><span class="summary-num">${actions.reduce((s, a) => s + (a.xp_earned || 0), 0)}</span><span class="summary-label">XP Earned</span></div>
    </div>
    <div class="actions-list">
      ${actions.map(a => `
        <div class="action-card ${a.is_completed ? 'action-completed' : ''} ${a.is_skipped ? 'action-skipped' : ''}" data-id="${a.id}">
          <div class="action-left">
            <div class="action-cat-badge" style="background:${catColor(a.category)}20;color:${catColor(a.category)}">${catIcon(a.category)} ${a.category}</div>
            <h3 class="action-title">${a.action_text || 'Micro action'}</h3>
            <div class="action-meta">
              <span class="action-difficulty ${a.difficulty || 'beginner'}">${a.difficulty || 'beginner'}</span>
              <span>⏱ ~2 min</span>
              ${a.chain_suggestion ? `<span class="chain-tag" title="Chain suggestion">🔗 ${a.chain_suggestion}</span>` : ''}
            </div>
          </div>
          <div class="action-right">
            ${a.is_completed ? `<div class="action-badge done">✓ Done<br><small>+${a.xp_earned || 10} XP</small></div>` :
              a.is_skipped ? '<div class="action-badge skip">⏭ Skipped</div>' : `
              <button class="btn-complete-lg" onclick="showCompleteModal(${a.id}, '${(a.action_text || '').replace(/'/g, "\\'")}')">✓ Complete</button>
              <button class="btn-skip" onclick="skipAction(${a.id})">Skip</button>
            `}
          </div>
        </div>
      `).join('')}
    </div>
  `}`;
}

function showCompleteModal(id, text) {
  showModal('Complete Action ✅', `
    <p class="modal-action-text">${text}</p>
    <div class="mood-section">
      <label>How did you feel before?</label>
      <div class="mood-selector" id="mood-before">
        ${[1,2,3,4,5,6,7,8,9,10].map(n => `<button class="mood-btn" data-val="${n}" onclick="selectMood(this,'mood-before')">${n <= 3 ? '😟' : n <= 5 ? '😐' : n <= 7 ? '🙂' : '😄'}<small>${n}</small></button>`).join('')}
      </div>
      <label>How do you feel after?</label>
      <div class="mood-selector" id="mood-after">
        ${[1,2,3,4,5,6,7,8,9,10].map(n => `<button class="mood-btn" data-val="${n}" onclick="selectMood(this,'mood-after')">${n <= 3 ? '😟' : n <= 5 ? '😐' : n <= 7 ? '🙂' : '😄'}<small>${n}</small></button>`).join('')}
      </div>
      <label>Energy level (1-10)</label>
      <input type="range" id="energy-slider" min="1" max="10" value="5" oninput="$('energy-val').textContent=this.value" />
      <span id="energy-val">5</span>
      <label>Notes (optional)</label>
      <textarea id="complete-notes" rows="2" placeholder="How did it go?"></textarea>
    </div>
  `, `<button class="btn-primary" onclick="completeAction(${id})">Complete & Earn XP ⚡</button>`);
}

function selectMood(btn, groupId) {
  document.querySelectorAll(`#${groupId} .mood-btn`).forEach(b => b.classList.remove('selected'));
  btn.classList.add('selected');
}

async function completeAction(id) {
  const moodBefore = document.querySelector('#mood-before .mood-btn.selected')?.dataset.val || 5;
  const moodAfter = document.querySelector('#mood-after .mood-btn.selected')?.dataset.val || 7;
  const energy = $('energy-slider')?.value || 5;
  const notes = $('complete-notes')?.value || '';
  const data = await request(`/today/${id}/complete`, { method: 'POST', body: JSON.stringify({ mood_before: parseInt(moodBefore), mood_after: parseInt(moodAfter), energy_level: parseInt(energy), notes, duration_seconds: 120 }) });
  if (data) {
    document.querySelector('.modal-overlay')?.remove();
    let msg = `+${data.xp_earned || 10} XP earned! ⚡`;
    if (data.streak_bonus) msg += ` (includes ${data.streak_bonus} streak bonus!)`;
    if (data.level_up) msg += ` 🎉 Level Up!`;
    showToast(msg);
    if (data.notifications?.length) data.notifications.forEach(n => showToast(n.message, 'info'));
    loadToday();
  }
}

async function skipAction(id) {
  await request(`/today/${id}/skip`, { method: 'POST' });
  showToast('Action skipped');
  loadToday();
}

async function refreshActions() {
  const data = await request('/today/refresh', { method: 'POST' });
  if (data) { showToast('Actions refreshed! 🔄'); loadToday(); }
}

function showAddCustomAction() {
  showModal('Add Custom Action', `
    <div class="input-group"><span class="input-icon">📝</span><input type="text" id="custom-text" placeholder="What's your micro-action?" required /></div>
    <div class="input-group">
      <span class="input-icon">📂</span>
      <select id="custom-cat">
        ${CATEGORIES.map(c => `<option value="${c}">${catIcon(c)} ${c}</option>`).join('')}
      </select>
    </div>
    <div class="input-group">
      <span class="input-icon">📊</span>
      <select id="custom-diff"><option value="beginner">Beginner</option><option value="intermediate">Intermediate</option><option value="advanced">Advanced</option></select>
    </div>
  `, `<button class="btn-primary" onclick="addCustomAction()">Add Action</button>`);
}

async function addCustomAction() {
  const text = $('custom-text')?.value;
  const cat = $('custom-cat')?.value;
  const diff = $('custom-diff')?.value;
  if (!text) { showToast('Enter action text', 'error'); return; }
  const data = await request('/today/add-custom', { method: 'POST', body: JSON.stringify({ action_text: text, category: cat, difficulty: diff }) });
  if (data) { document.querySelector('.modal-overlay')?.remove(); showToast('Custom action added! ✅'); loadToday(); }
}

// ==================== GOALS ====================
async function loadGoals() {
  const goals = await request('/goals');
  if (!goals) return;

  $('page-content').innerHTML = `
  <div class="page-header">
    <div><h1>Goals 🎯</h1><p class="text-muted">Your micro-habit goals across all categories</p></div>
    <button class="btn-primary" onclick="showCreateGoal()">+ New Goal</button>
  </div>

  ${goals.length === 0 ? `
    <div class="empty-state">
      <div class="empty-icon">🎯</div>
      <h3>No goals yet</h3>
      <p>Goals define what daily micro-actions get generated for you. Each goal maps to a category.</p>
      <button class="btn-primary" onclick="showCreateGoal()">Create Your First Goal</button>
    </div>
  ` : `
    <div class="goals-grid">
      ${goals.map(g => {
        const rate = g.completion_rate || 0;
        return `
        <div class="goal-card" style="border-left:4px solid ${g.color || catColor(g.category)}">
          <div class="goal-card-header">
            <span class="goal-cat" style="background:${catColor(g.category)}20;color:${catColor(g.category)}">${catIcon(g.category)} ${g.category}</span>
            <div class="goal-actions">
              <button class="btn-icon" onclick="editGoal(${g.id})" title="Edit">✏️</button>
              <button class="btn-icon" onclick="deleteGoal(${g.id})" title="Delete">🗑️</button>
            </div>
          </div>
          <h3>${g.title || g.name}</h3>
          ${g.description ? `<p class="goal-desc">${g.description}</p>` : ''}
          <div class="goal-stats">
            <div class="goal-stat"><strong>${g.total_actions || 0}</strong><small>Total</small></div>
            <div class="goal-stat"><strong>${g.completed_actions || 0}</strong><small>Done</small></div>
            <div class="goal-stat"><strong>${rate}%</strong><small>Rate</small></div>
          </div>
          ${progressBar(rate, g.color || catColor(g.category))}
          <div class="goal-footer">
            <small>Created ${formatDate(g.created_at)}</small>
            <span class="goal-status ${g.is_active ? 'active' : 'inactive'}">${g.is_active ? '● Active' : '○ Inactive'}</span>
          </div>
        </div>`;
      }).join('')}
    </div>
  `}`;
}

function showCreateGoal() {
  showModal('Create New Goal 🎯', `
    <div class="input-group"><span class="input-icon">📝</span><input type="text" id="goal-title" placeholder="Goal name (e.g. Daily Exercise)" required /></div>
    <div class="input-group"><span class="input-icon">📄</span><textarea id="goal-desc" rows="2" placeholder="Description (optional)"></textarea></div>
    <div class="input-group">
      <span class="input-icon">📂</span>
      <select id="goal-cat">${CATEGORIES.map(c => `<option value="${c}">${catIcon(c)} ${c}</option>`).join('')}</select>
    </div>
    <div class="input-group"><span class="input-icon">🎨</span><input type="color" id="goal-color" value="#f97316" /></div>
  `, `<button class="btn-primary" onclick="createGoal()">Create Goal</button>`);
}

async function createGoal() {
  const title = $('goal-title')?.value;
  const desc = $('goal-desc')?.value;
  const cat = $('goal-cat')?.value;
  const color = $('goal-color')?.value;
  if (!title) { showToast('Enter a goal name', 'error'); return; }
  const data = await request('/goals', { method: 'POST', body: JSON.stringify({ title, description: desc, category: cat, color }) });
  if (data) { document.querySelector('.modal-overlay')?.remove(); showToast('Goal created! 🎯'); loadGoals(); }
}

async function editGoal(id) {
  const goals = await request('/goals');
  const g = goals?.find(x => x.id === id);
  if (!g) return;
  showModal('Edit Goal ✏️', `
    <div class="input-group"><span class="input-icon">📝</span><input type="text" id="edit-goal-title" value="${g.title || g.name || ''}" required /></div>
    <div class="input-group"><span class="input-icon">📄</span><textarea id="edit-goal-desc" rows="2">${g.description || ''}</textarea></div>
    <div class="input-group">
      <span class="input-icon">📂</span>
      <select id="edit-goal-cat">${CATEGORIES.map(c => `<option value="${c}" ${c === g.category ? 'selected' : ''}>${catIcon(c)} ${c}</option>`).join('')}</select>
    </div>
    <div class="input-group"><span class="input-icon">🎨</span><input type="color" id="edit-goal-color" value="${g.color || '#f97316'}" /></div>
    <div class="input-group">
      <label class="toggle-label"><input type="checkbox" id="edit-goal-active" ${g.is_active ? 'checked' : ''} /> Active</label>
    </div>
  `, `<button class="btn-primary" onclick="saveGoal(${id})">Save Changes</button>`);
}

async function saveGoal(id) {
  const data = await request(`/goals/${id}`, { method: 'PUT', body: JSON.stringify({
    title: $('edit-goal-title')?.value,
    description: $('edit-goal-desc')?.value,
    category: $('edit-goal-cat')?.value,
    color: $('edit-goal-color')?.value,
    is_active: $('edit-goal-active')?.checked ? 1 : 0
  })});
  if (data) { document.querySelector('.modal-overlay')?.remove(); showToast('Goal updated! ✏️'); loadGoals(); }
}

async function deleteGoal(id) {
  if (!confirm('Delete this goal? Actions generated from it will remain.')) return;
  await request(`/goals/${id}`, { method: 'DELETE' });
  showToast('Goal deleted');
  loadGoals();
}

// ==================== JOURNAL ====================
async function loadJournal() {
  const entries = await request('/journal');
  if (!entries) return;

  $('page-content').innerHTML = `
  <div class="page-header">
    <div><h1>Journal 📝</h1><p class="text-muted">Reflect on your micro-habit journey</p></div>
    <div class="header-actions">
      <button class="btn-secondary" onclick="getJournalPrompt()">💡 AI Prompt</button>
      <button class="btn-primary" onclick="showNewJournal()">+ New Entry</button>
    </div>
  </div>

  ${entries.length === 0 ? `
    <div class="empty-state">
      <div class="empty-icon">📝</div>
      <h3>Your journal is empty</h3>
      <p>Writing about your habits helps you understand patterns and stay motivated.</p>
      <button class="btn-primary" onclick="showNewJournal()">Write First Entry</button>
    </div>
  ` : `
    <div class="journal-list">
      ${entries.map(e => `
        <div class="journal-card">
          <div class="journal-header">
            <span class="journal-cat" style="background:${catColor(e.category)}20;color:${catColor(e.category)}">${catIcon(e.category)} ${e.category}</span>
            ${e.mood ? `<span class="journal-mood">${e.mood <= 3 ? '😟' : e.mood <= 5 ? '😐' : e.mood <= 7 ? '🙂' : '😄'} ${e.mood}/10</span>` : ''}
            <span class="journal-date">${formatDate(e.created_at)}</span>
          </div>
          <p class="journal-content">${e.content}</p>
          ${e.tags && e.tags.length ? `<div class="journal-tags">${(Array.isArray(e.tags) ? e.tags : []).map(t => `<span class="tag">#${t}</span>`).join('')}</div>` : ''}
        </div>
      `).join('')}
    </div>
  `}`;
}

function showNewJournal() {
  showModal('New Journal Entry 📝', `
    <div class="input-group"><label>What's on your mind?</label><textarea id="journal-content" rows="5" placeholder="Reflect on your habits, progress, feelings..."></textarea></div>
    <div class="input-row">
      <div class="input-group">
        <label>Category</label>
        <select id="journal-cat">${CATEGORIES.map(c => `<option value="${c}">${catIcon(c)} ${c}</option>`).join('')}<option value="general">📌 General</option></select>
      </div>
      <div class="input-group">
        <label>Mood (1-10)</label>
        <input type="range" id="journal-mood" min="1" max="10" value="5" oninput="$('journal-mood-val').textContent=this.value" />
        <span id="journal-mood-val">5</span>
      </div>
    </div>
    <div class="input-group"><label>Tags (comma separated)</label><input type="text" id="journal-tags" placeholder="motivation, health, progress" /></div>
  `, `<button class="btn-primary" onclick="saveJournal()">Save Entry</button>`);
}

async function saveJournal() {
  const content = $('journal-content')?.value;
  if (!content) { showToast('Write something first!', 'error'); return; }
  const tags = ($('journal-tags')?.value || '').split(',').map(t => t.trim()).filter(Boolean);
  const data = await request('/journal', { method: 'POST', body: JSON.stringify({
    content,
    category: $('journal-cat')?.value || 'general',
    mood: parseInt($('journal-mood')?.value || 5),
    tags
  })});
  if (data) { document.querySelector('.modal-overlay')?.remove(); showToast('Journal entry saved! 📝'); loadJournal(); }
}

async function getJournalPrompt() {
  showToast('Getting AI prompt...', 'info');
  const data = await request('/journal/prompt?category=mental');
  if (data?.prompt) {
    showModal('AI Journal Prompt 💡', `
      <div class="ai-prompt-card">
        <p class="ai-prompt-text">${data.prompt}</p>
      </div>
      <textarea id="prompted-content" rows="5" placeholder="Start writing here..."></textarea>
    `, `<button class="btn-primary" onclick="savePromptedJournal()">Save Entry</button>`);
  }
}

async function savePromptedJournal() {
  const content = $('prompted-content')?.value;
  if (!content) { showToast('Write something!', 'error'); return; }
  await request('/journal', { method: 'POST', body: JSON.stringify({ content, category: 'mental', mood: 5 }) });
  document.querySelector('.modal-overlay')?.remove();
  showToast('Journal entry saved! 📝');
  loadJournal();
}

// ==================== ACHIEVEMENTS ====================
async function loadAchievements() {
  const data = await request('/achievements');
  if (!data) return;

  const earned = data.badges.filter(b => b.earned);
  const locked = data.badges.filter(b => !b.earned);

  $('page-content').innerHTML = `
  <div class="page-header">
    <div><h1>Achievements 🏆</h1><p class="text-muted">${data.total_earned} of ${data.total} badges earned</p></div>
    <div class="achievement-progress">${progressBar(Math.round(data.total_earned / data.total * 100), '#f59e0b')}<span>${Math.round(data.total_earned / data.total * 100)}%</span></div>
  </div>

  ${earned.length > 0 ? `
    <h2 class="section-title">🌟 Earned Badges</h2>
    <div class="badges-grid">
      ${earned.map(b => `
        <div class="badge-card earned">
          <div class="badge-icon">${b.icon}</div>
          <h4>${b.name}</h4>
          <p>${b.description}</p>
          <div class="badge-xp">+${b.xp} XP</div>
        </div>
      `).join('')}
    </div>
  ` : ''}

  <h2 class="section-title">🔒 Locked Badges</h2>
  <div class="badges-grid">
    ${locked.map(b => `
      <div class="badge-card locked">
        <div class="badge-icon locked-icon">${b.icon}</div>
        <h4>${b.name}</h4>
        <p>${b.description}</p>
        <div class="badge-xp">+${b.xp} XP</div>
      </div>
    `).join('')}
  </div>`;
}

// ==================== CHALLENGES ====================
async function loadChallenges() {
  const challenges = await request('/challenges');
  if (!challenges) return;

  $('page-content').innerHTML = `
  <div class="page-header">
    <div><h1>Challenges ⚔️</h1><p class="text-muted">Push your limits with community challenges</p></div>
  </div>

  <div class="challenges-grid">
    ${challenges.map(c => `
      <div class="challenge-card ${c.joined ? 'challenge-joined' : ''} ${c.completed ? 'challenge-completed' : ''}">
        <div class="challenge-type">${c.type === 'weekly' ? '📅 Weekly' : '📆 Monthly'}</div>
        <h3>${c.title}</h3>
        <p>${c.description}</p>
        <div class="challenge-meta">
          <span style="background:${catColor(c.category)}20;color:${catColor(c.category)}">${catIcon(c.category)} ${c.category === 'all' ? 'All Categories' : c.category}</span>
          <span>🏅 ${c.xp_reward} XP</span>
          <span>📅 ${c.duration_days} days</span>
          <span>👥 ${c.participants || 0} joined</span>
        </div>
        ${c.joined ? `
          <div class="challenge-progress">
            ${progressBar(c.progress || 0, c.completed ? '#22c55e' : '#f97316')}
            <span>${c.completed ? '✅ Completed!' : `${c.progress || 0}% progress`}</span>
          </div>
        ` : `<button class="btn-primary btn-sm" onclick="joinChallenge(${c.id})">Join Challenge</button>`}
      </div>
    `).join('')}
  </div>`;
}

async function joinChallenge(id) {
  const data = await request(`/challenges/${id}/join`, { method: 'POST' });
  if (data) { showToast('Challenge joined! Good luck! ⚔️'); loadChallenges(); }
}

// ==================== FOCUS TIMER ====================
async function loadFocus() {
  const history = await request('/focus/history');

  $('page-content').innerHTML = `
  <div class="page-header">
    <div><h1>Focus Timer 🎯</h1><p class="text-muted">Deep work sessions to complement your micro-habits</p></div>
  </div>

  <div class="focus-container">
    <div class="focus-timer-card">
      <div class="focus-display">
        <div class="focus-time" id="focus-time">00:00</div>
        <div class="focus-minutes" id="focus-label">Set duration and start</div>
      </div>
      <div class="focus-controls">
        <div class="input-row">
          <div class="input-group">
            <label>Duration (min)</label>
            <select id="focus-duration">
              <option value="2">2 min</option><option value="5" selected>5 min</option><option value="10">10 min</option><option value="15">15 min</option><option value="25">25 min</option><option value="30">30 min</option>
            </select>
          </div>
          <div class="input-group">
            <label>Category</label>
            <select id="focus-cat">${CATEGORIES.map(c => `<option value="${c}">${catIcon(c)} ${c}</option>`).join('')}</select>
          </div>
        </div>
        <div class="focus-btns">
          <button class="btn-primary btn-lg" id="focus-start-btn" onclick="startFocus()">▶ Start Focus</button>
          <button class="btn-secondary btn-lg" id="focus-stop-btn" onclick="stopFocus()" style="display:none">⏹ Stop</button>
        </div>
      </div>
    </div>

    <div class="card">
      <div class="card-header"><h3>📊 Focus History</h3></div>
      <div class="card-body">
        ${history ? `
          <div class="focus-summary">
            <div class="summary-stat"><span class="summary-num">${history.total_sessions}</span><span class="summary-label">Total Sessions</span></div>
            <div class="summary-stat"><span class="summary-num">${history.total_minutes}</span><span class="summary-label">Total Minutes</span></div>
          </div>
          ${history.sessions.length > 0 ? `
            <div class="focus-history-list">
              ${history.sessions.slice(0, 10).map(s => `
                <div class="focus-row">
                  <span>${catIcon(s.category)} ${s.category}</span>
                  <span>${s.duration_minutes} min</span>
                  <span>${formatDate(s.completed_at)}</span>
                  ${s.notes ? `<span class="focus-notes">${s.notes}</span>` : ''}
                </div>
              `).join('')}
            </div>
          ` : '<div class="empty-state-small">No sessions yet</div>'}
        ` : ''}
      </div>
    </div>
  </div>`;
}

function startFocus() {
  const dur = parseInt($('focus-duration')?.value || 5);
  focusSeconds = dur * 60;
  focusRunning = true;
  $('focus-start-btn').style.display = 'none';
  $('focus-stop-btn').style.display = 'block';
  $('focus-label').textContent = `${dur} minute focus session`;
  updateFocusDisplay();
  focusInterval = setInterval(() => {
    if (focusSeconds <= 0) { finishFocus(); return; }
    focusSeconds--;
    updateFocusDisplay();
  }, 1000);
}

function updateFocusDisplay() {
  const m = Math.floor(focusSeconds / 60);
  const s = focusSeconds % 60;
  if ($('focus-time')) $('focus-time').textContent = `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function stopFocus() {
  clearInterval(focusInterval);
  focusRunning = false;
  if ($('focus-start-btn')) $('focus-start-btn').style.display = 'block';
  if ($('focus-stop-btn')) $('focus-stop-btn').style.display = 'none';
  if ($('focus-time')) $('focus-time').textContent = '00:00';
  if ($('focus-label')) $('focus-label').textContent = 'Session cancelled';
}

async function finishFocus() {
  clearInterval(focusInterval);
  focusRunning = false;
  const dur = parseInt($('focus-duration')?.value || 5);
  const cat = $('focus-cat')?.value || 'mental';
  const notes = prompt('Any notes about your focus session?') || '';
  const data = await request('/focus', { method: 'POST', body: JSON.stringify({ duration_minutes: dur, category: cat, notes }) });
  if (data) {
    showToast(`Focus session complete! +${data.xp_earned} XP 🎯`);
    loadFocus();
  }
}

// ==================== STATS ====================
async function loadStats() {
  const data = await request('/stats');
  if (!data) return;

  const bestHourLabel = data.best_hour != null ? `${data.best_hour}:00` : 'N/A';
  const catCards = (data.by_category || []).map(c => `
    <div class="cat-stat-card">
      <div class="cat-stat-icon" style="background:${catColor(c.category)}20;color:${catColor(c.category)}">${catIcon(c.category)}</div>
      <div class="cat-stat-info">
        <strong>${c.category}</strong>
        <span>${c.completed} completed</span>
      </div>
    </div>
  `).join('');

  let dailyChart = '';
  if (data.daily_progress?.length > 0) {
    const maxD = Math.max(...data.daily_progress.map(d => d.total), 1);
    dailyChart = data.daily_progress.map(d => {
      const h = d.total > 0 ? Math.max(Math.round(d.completed / maxD * 100), 5) : 5;
      return `<div class="bar-col-sm"><div class="bar" style="height:${h}%;background:${d.completed === d.total && d.total > 0 ? '#22c55e' : '#f97316'}" title="${d.date}: ${d.completed}/${d.total}"></div></div>`;
    }).join('');
  }

  $('page-content').innerHTML = `
  <div class="page-header">
    <div><h1>Statistics 📊</h1><p class="text-muted">Your micro-habit analytics</p></div>
  </div>

  <div class="stats-grid">
    <div class="stat-card stat-orange"><div class="stat-icon">⏱</div><div class="stat-value">${data.total_minutes || 0}</div><div class="stat-label">Total Minutes</div></div>
    <div class="stat-card stat-green"><div class="stat-icon">⚡</div><div class="stat-value">${data.total_xp_earned || 0}</div><div class="stat-label">Total XP Earned</div></div>
    <div class="stat-card stat-blue"><div class="stat-icon">🎯</div><div class="stat-value">${data.user?.total_actions_completed || 0}</div><div class="stat-label">Actions Completed</div></div>
    <div class="stat-card stat-purple"><div class="stat-icon">⏰</div><div class="stat-value">${bestHourLabel}</div><div class="stat-label">Best Hour</div></div>
  </div>

  <div class="grid-2">
    <div class="card">
      <div class="card-header"><h3>📂 By Category</h3></div>
      <div class="card-body">${catCards || '<div class="empty-state-small">No data yet</div>'}</div>
    </div>
    <div class="card">
      <div class="card-header"><h3>😊 Mood Impact</h3></div>
      <div class="card-body">
        ${data.mood ? `
          <div class="mood-impact">
            <div class="mood-stat"><strong>Before</strong><span class="mood-val">${data.mood.avg_mood_before ?? 'N/A'}</span></div>
            <span class="mood-arrow">→</span>
            <div class="mood-stat"><strong>After</strong><span class="mood-val">${data.mood.avg_mood_after ?? 'N/A'}</span></div>
          </div>
          ${data.mood.avg_mood_before && data.mood.avg_mood_after ? `<div class="mood-delta ${data.mood.avg_mood_after > data.mood.avg_mood_before ? 'positive' : 'negative'}">Mood change: ${data.mood.avg_mood_after > data.mood.avg_mood_before ? '+' : ''}${(data.mood.avg_mood_after - data.mood.avg_mood_before).toFixed(1)}</div>` : ''}
          <div class="text-muted">${data.mood.total_entries} mood entries recorded</div>
        ` : '<div class="empty-state-small">Complete actions with mood tracking to see data</div>'}
      </div>
    </div>
  </div>

  ${dailyChart ? `
  <div class="card">
    <div class="card-header"><h3>📅 30-Day Progress</h3></div>
    <div class="card-body"><div class="daily-chart">${dailyChart}</div></div>
  </div>
  ` : ''}

  ${data.avg_energy ? `
  <div class="card">
    <div class="card-header"><h3>⚡ Average Energy Level</h3></div>
    <div class="card-body">
      <div class="energy-display">
        <div class="energy-bar-big">${progressBar(data.avg_energy * 10, '#f59e0b')}</div>
        <span class="energy-val-big">${data.avg_energy}/10</span>
      </div>
    </div>
  </div>
  ` : ''}`;
}

// ==================== AI REPORT ====================
async function loadReport() {
  $('page-content').innerHTML = `
  <div class="page-header">
    <div><h1>AI Compound Report 🧠</h1><p class="text-muted">AI-powered insights into your habit compound effect</p></div>
  </div>

  <div class="report-intro">
    <div class="report-icon">🧠</div>
    <h3>Get Your Personalized Report</h3>
    <p>Our AI analyzes your habit data to give you insights about your compound growth, personality type, and projected impact.</p>
    <button class="btn-primary btn-lg" onclick="generateReport()">🔮 Generate Report</button>
  </div>

  <div class="grid-2" style="margin-top:2rem">
    <div class="card">
      <div class="card-header"><h3>💡 Category Advice</h3></div>
      <div class="card-body">
        <p>Get AI-powered advice for any category:</p>
        <div class="advice-btns">
          ${CATEGORIES.map(c => `<button class="btn-cat" style="background:${catColor(c)}20;color:${catColor(c)}" onclick="getAdvice('${c}')">${catIcon(c)} ${c}</button>`).join('')}
        </div>
        <div id="advice-result"></div>
      </div>
    </div>
    <div class="card" id="report-result-card" style="display:none">
      <div class="card-header"><h3>📊 Your Report</h3></div>
      <div class="card-body" id="report-result"></div>
    </div>
  </div>`;
}

async function generateReport() {
  showToast('Generating your AI report...', 'info');
  const data = await request('/report');
  if (!data) return;
  const card = $('report-result-card');
  if (card) card.style.display = 'block';
  $('report-result').innerHTML = `
    <div class="report-content">
      ${data.personality_type ? `<div class="report-item"><strong>🧬 Personality Type:</strong> ${data.personality_type}</div>` : ''}
      ${data.compound_score ? `<div class="report-item"><strong>📈 Compound Score:</strong> ${data.compound_score}/100</div>` : ''}
      ${data.weekly_consistency ? `<div class="report-item"><strong>📅 Weekly Consistency:</strong> ${data.weekly_consistency}%</div>` : ''}
      ${data.projected_90_day ? `<div class="report-item"><strong>🔮 90-Day Projection:</strong> ${data.projected_90_day}</div>` : ''}
      ${data.insight ? `<div class="report-insight"><strong>💬 AI Insight:</strong><p>${data.insight}</p></div>` : ''}
      ${data.recommendation ? `<div class="report-insight"><strong>🎯 Recommendation:</strong><p>${data.recommendation}</p></div>` : ''}
      ${data.strength ? `<div class="report-item"><strong>💪 Strength:</strong> ${data.strength}</div>` : ''}
      ${data.area_to_improve ? `<div class="report-item"><strong>🔧 Improve:</strong> ${data.area_to_improve}</div>` : ''}
    </div>
  `;
}

async function getAdvice(category) {
  $('advice-result').innerHTML = '<div class="loading-spinner"><div class="spinner"></div></div>';
  const data = await request(`/advice/${category}`);
  if (!data) { $('advice-result').innerHTML = ''; return; }
  $('advice-result').innerHTML = `
    <div class="advice-content">
      ${data.tip ? `<div class="advice-item"><strong>💡 Tip:</strong> ${data.tip}</div>` : ''}
      ${data.habit_stack ? `<div class="advice-item"><strong>📚 Habit Stack:</strong> ${data.habit_stack}</div>` : ''}
      ${data.reward_idea ? `<div class="advice-item"><strong>🎁 Reward Idea:</strong> ${data.reward_idea}</div>` : ''}
      ${data.next_step ? `<div class="advice-item"><strong>👣 Next Step:</strong> ${data.next_step}</div>` : ''}
    </div>
  `;
}

// ==================== PODS ====================
async function loadPods() {
  const pods = await request('/pods');
  if (!pods) return;

  $('page-content').innerHTML = `
  <div class="page-header">
    <div><h1>Accountability Pods 👥</h1><p class="text-muted">Team up with others for accountability</p></div>
    <button class="btn-primary" onclick="showCreatePod()">+ Create Pod</button>
  </div>

  ${pods.length === 0 ? `
    <div class="empty-state">
      <div class="empty-icon">👥</div>
      <h3>No pods yet</h3>
      <p>Create or join a pod to stay accountable with friends!</p>
      <button class="btn-primary" onclick="showCreatePod()">Create First Pod</button>
    </div>
  ` : `
    <div class="pods-grid">
      ${pods.map(p => `
        <div class="pod-card ${p.is_member ? 'pod-member' : ''}">
          <div class="pod-header">
            <span class="pod-cat" style="background:${catColor(p.goal_category)}20;color:${catColor(p.goal_category)}">${catIcon(p.goal_category)} ${p.goal_category}</span>
            <span class="pod-members">👥 ${p.member_count || p.current_members || 0}/${p.max_members || 5}</span>
          </div>
          <h3>${p.name}</h3>
          ${p.description ? `<p class="pod-desc">${p.description}</p>` : ''}
          <div class="pod-actions">
            ${p.is_member ? `<button class="btn-secondary btn-sm" onclick="openPodChat(${p.id}, '${p.name.replace(/'/g, "\\'")}')">💬 Chat</button>` :
              `<button class="btn-primary btn-sm" onclick="joinPod(${p.id})">Join Pod</button>`}
          </div>
        </div>
      `).join('')}
    </div>
  `}`;
}

function showCreatePod() {
  showModal('Create Pod 👥', `
    <div class="input-group"><span class="input-icon">📝</span><input type="text" id="pod-name" placeholder="Pod name" required /></div>
    <div class="input-group"><span class="input-icon">📄</span><textarea id="pod-desc" rows="2" placeholder="Description"></textarea></div>
    <div class="input-group">
      <span class="input-icon">📂</span>
      <select id="pod-cat">${CATEGORIES.map(c => `<option value="${c}">${catIcon(c)} ${c}</option>`).join('')}</select>
    </div>
  `, `<button class="btn-primary" onclick="createPod()">Create Pod</button>`);
}

async function createPod() {
  const name = $('pod-name')?.value;
  if (!name) { showToast('Enter a pod name', 'error'); return; }
  const data = await request('/pods', { method: 'POST', body: JSON.stringify({ name, description: $('pod-desc')?.value, goal_category: $('pod-cat')?.value }) });
  if (data) { document.querySelector('.modal-overlay')?.remove(); showToast('Pod created! 👥'); loadPods(); }
}

async function joinPod(id) {
  const data = await request(`/pods/${id}/join`, { method: 'POST' });
  if (data) { showToast('Joined pod! 👥'); loadPods(); }
}

async function openPodChat(podId, podName) {
  const messages = await request(`/pods/${podId}/messages`);
  showModal(`💬 ${podName}`, `
    <div class="chat-messages" id="chat-msgs">
      ${(messages || []).length === 0 ? '<div class="empty-state-small">No messages yet. Start the conversation!</div>' :
        (messages || []).map(m => `
          <div class="chat-msg">
            <strong>${m.name || 'User'}</strong>
            <p>${m.content}</p>
            <small>${timeAgo(m.created_at)}</small>
          </div>
        `).join('')}
    </div>
    <div class="chat-input-row">
      <input type="text" id="chat-input" placeholder="Type a message..." onkeypress="if(event.key==='Enter')sendPodMsg(${podId})" />
      <button class="btn-primary" onclick="sendPodMsg(${podId})">Send</button>
    </div>
  `);
  const chatMsgs = $('chat-msgs');
  if (chatMsgs) chatMsgs.scrollTop = chatMsgs.scrollHeight;
}

async function sendPodMsg(podId) {
  const input = $('chat-input');
  if (!input?.value) return;
  await request(`/pods/${podId}/messages`, { method: 'POST', body: JSON.stringify({ content: input.value }) });
  input.value = '';
  const messages = await request(`/pods/${podId}/messages`);
  const msgs = $('chat-msgs');
  if (msgs) {
    msgs.innerHTML = (messages || []).map(m => `<div class="chat-msg"><strong>${m.name || 'User'}</strong><p>${m.content}</p><small>${timeAgo(m.created_at)}</small></div>`).join('');
    msgs.scrollTop = msgs.scrollHeight;
  }
}

// ==================== LEADERBOARD ====================
async function loadLeaderboard() {
  const users = await request('/leaderboard');
  if (!users) return;

  $('page-content').innerHTML = `
  <div class="page-header">
    <div><h1>Leaderboard 🥇</h1><p class="text-muted">Top habit builders in the community</p></div>
  </div>

  <div class="leaderboard-table">
    <div class="lb-header">
      <span>#</span><span>User</span><span>Level</span><span>XP</span><span>Streak</span><span>Actions</span>
    </div>
    ${users.map((u, i) => `
      <div class="lb-row ${i < 3 ? 'lb-top' : ''}">
        <span class="lb-rank">${i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : i + 1}</span>
        <span class="lb-user"><span class="lb-avatar" style="background:${u.avatar_color || '#f97316'}">${(u.name || 'U')[0].toUpperCase()}</span>${u.name || 'User'}</span>
        <span class="lb-level">Lv.${u.level}</span>
        <span class="lb-xp">${u.xp} XP</span>
        <span class="lb-streak">🔥 ${u.current_streak}</span>
        <span class="lb-actions">${u.total_actions_completed}</span>
      </div>
    `).join('')}
  </div>`;
}

// ==================== SETTINGS ====================
async function loadSettings() {
  const [userData, history] = await Promise.all([request('/dashboard'), request('/focus/history')]);
  const u = userData?.user;
  if (!u) return;

  $('page-content').innerHTML = `
  <div class="page-header">
    <div><h1>Settings ⚙️</h1><p class="text-muted">Manage your profile and preferences</p></div>
  </div>

  <div class="grid-2">
    <div class="card">
      <div class="card-header"><h3>👤 Profile</h3></div>
      <div class="card-body">
        <div class="profile-avatar" style="background:${u.avatar_color || '#f97316'}">${(u.name || 'U')[0].toUpperCase()}</div>
        <div class="input-group"><label>Name</label><input type="text" id="s-name" value="${u.name || ''}" /></div>
        <div class="input-group"><label>Bio</label><textarea id="s-bio" rows="2">${u.bio || ''}</textarea></div>
        <div class="input-group"><label>Timezone</label><input type="text" id="s-tz" value="${u.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone}" /></div>
        <div class="input-group"><label>Preferred Time</label>
          <select id="s-time">
            <option value="morning" ${u.preferred_time === 'morning' ? 'selected' : ''}>🌅 Morning</option>
            <option value="afternoon" ${u.preferred_time === 'afternoon' ? 'selected' : ''}>☀️ Afternoon</option>
            <option value="evening" ${u.preferred_time === 'evening' ? 'selected' : ''}>🌙 Evening</option>
          </select>
        </div>
        <div class="input-group"><label>Avatar Color</label><input type="color" id="s-color" value="${u.avatar_color || '#f97316'}" /></div>
        <button class="btn-primary" onclick="saveProfile()">Save Profile</button>
      </div>
    </div>

    <div class="card">
      <div class="card-header"><h3>📊 Account Stats</h3></div>
      <div class="card-body">
        <div class="settings-stat"><span>Level</span><strong>${u.level || 1}</strong></div>
        <div class="settings-stat"><span>Total XP</span><strong>${u.xp || 0}</strong></div>
        <div class="settings-stat"><span>Current Streak</span><strong>${u.current_streak || 0} days</strong></div>
        <div class="settings-stat"><span>Longest Streak</span><strong>${u.longest_streak || 0} days</strong></div>
        <div class="settings-stat"><span>Actions Completed</span><strong>${u.total_actions_completed || 0}</strong></div>
        <div class="settings-stat"><span>Focus Sessions</span><strong>${history?.total_sessions || 0}</strong></div>
        <div class="settings-stat"><span>Member Since</span><strong>${u.created_at ? formatDate(u.created_at) : 'N/A'}</strong></div>
      </div>
    </div>
  </div>

  <div class="grid-2" style="margin-top:1rem">
    <div class="card">
      <div class="card-header"><h3>📤 Export Data</h3></div>
      <div class="card-body">
        <p>Download all your data as JSON.</p>
        <button class="btn-secondary" onclick="exportData()">📥 Export All Data</button>
      </div>
    </div>
    <div class="card">
      <div class="card-header"><h3>💬 Feedback</h3></div>
      <div class="card-body">
        <select id="fb-type"><option value="general">General</option><option value="bug">Bug Report</option><option value="feature">Feature Request</option><option value="praise">Praise</option></select>
        <textarea id="fb-msg" rows="3" placeholder="Share your feedback..."></textarea>
        <button class="btn-primary" onclick="sendFeedback()" style="margin-top:0.5rem">Send Feedback</button>
      </div>
    </div>
  </div>`;
}

async function saveProfile() {
  const data = await request('/auth/profile', { method: 'PATCH', body: JSON.stringify({
    name: $('s-name')?.value,
    bio: $('s-bio')?.value,
    timezone: $('s-tz')?.value,
    preferred_time: $('s-time')?.value,
    avatar_color: $('s-color')?.value
  })});
  if (data) showToast('Profile updated! 👤');
}

async function exportData() {
  const data = await request('/export');
  if (!data) return;
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `microhabit_export_${new Date().toISOString().split('T')[0]}.json`;
  a.click();
  showToast('Data exported! 📤');
}

async function sendFeedback() {
  const msg = $('fb-msg')?.value;
  if (!msg) { showToast('Write some feedback!', 'error'); return; }
  await request('/feedback', { method: 'POST', body: JSON.stringify({ type: $('fb-type')?.value, message: msg }) });
  $('fb-msg').value = '';
  showToast('Feedback sent! Thanks! 💬');
}

// ==================== NOTIFICATIONS ====================
async function showNotifications() {
  const notifs = await request('/notifications');
  showModal('🔔 Notifications', `
    ${!notifs || notifs.length === 0 ? '<div class="empty-state-small">No notifications</div>' :
      notifs.map(n => `
        <div class="notif-item ${n.is_read ? '' : 'unread'}">
          <span class="notif-icon">${n.type === 'level_up' ? '🎉' : n.type === 'achievement' ? '🏆' : n.type === 'streak' ? '🔥' : '📢'}</span>
          <div class="notif-body">
            <strong>${n.title || 'Notification'}</strong>
            <p>${n.message}</p>
            <small>${timeAgo(n.created_at)}</small>
          </div>
        </div>
      `).join('')}
  `, notifs?.length ? `<button class="btn-secondary" onclick="markAllRead()">Mark All Read</button>` : '');
}

async function markAllRead() {
  await request('/notifications/read', { method: 'PATCH' });
  const badge = $('notif-badge');
  if (badge) { badge.textContent = '0'; badge.classList.add('hidden'); }
  document.querySelector('.modal-overlay')?.remove();
  showToast('All notifications marked read');
}

// ==================== INIT ====================
renderApp();

// ==================== STYLES ====================
const style = document.createElement('style');
style.textContent = `
/* ==================== RESET & BASE ==================== */
*{margin:0;padding:0;box-sizing:border-box}
:root{--bg:#0a0a0f;--bg2:#12121a;--bg3:#1a1a2e;--bg4:#252540;--text:#e4e4e7;--text2:#a1a1aa;--orange:#f97316;--green:#22c55e;--blue:#3b82f6;--purple:#8b5cf6;--pink:#ec4899;--yellow:#f59e0b;--red:#ef4444;--radius:12px;--shadow:0 4px 24px rgba(0,0,0,0.3)}
body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:var(--bg);color:var(--text);min-height:100vh;overflow-x:hidden}
a{color:var(--orange);cursor:pointer;text-decoration:none}
a:hover{text-decoration:underline}
button{cursor:pointer;border:none;font-family:inherit;font-size:inherit}
input,select,textarea{background:var(--bg3);border:1px solid var(--bg4);color:var(--text);padding:0.65rem 0.85rem;border-radius:8px;font-family:inherit;font-size:0.95rem;width:100%;outline:none;transition:border 0.2s}
input:focus,select:focus,textarea:focus{border-color:var(--orange)}
select{appearance:auto}

/* ==================== TOAST ==================== */
.toast-container{position:fixed;top:1rem;right:1rem;z-index:9999;display:flex;flex-direction:column;gap:0.5rem}
.toast{display:flex;align-items:center;gap:0.5rem;padding:0.75rem 1.25rem;border-radius:10px;background:var(--bg3);color:var(--text);box-shadow:var(--shadow);transform:translateX(120%);transition:transform 0.3s ease;font-size:0.9rem;max-width:360px}
.toast.show{transform:translateX(0)}
.toast-success{border-left:4px solid var(--green)}
.toast-error{border-left:4px solid var(--red)}
.toast-info{border-left:4px solid var(--blue)}
.toast-icon{font-size:1.1rem}

/* ==================== MODAL ==================== */
.modal-overlay{position:fixed;inset:0;background:rgba(0,0,0,0.7);z-index:1000;display:flex;align-items:center;justify-content:center;opacity:0;transition:opacity 0.2s}
.modal-overlay.show{opacity:1}
.modal{background:var(--bg2);border:1px solid var(--bg4);border-radius:16px;max-width:520px;width:95%;max-height:85vh;overflow-y:auto;padding:1.5rem}
.modal-header{display:flex;justify-content:space-between;align-items:center;margin-bottom:1rem}
.modal-header h3{font-size:1.2rem}
.modal-close{background:none;color:var(--text2);font-size:1.2rem;padding:0.25rem 0.5rem;border-radius:6px}
.modal-close:hover{background:var(--bg4);color:var(--text)}
.modal-body{margin-bottom:1rem}
.modal-footer{display:flex;gap:0.5rem;justify-content:flex-end}

/* ==================== AUTH ==================== */
.auth-container{min-height:100vh;display:flex;align-items:center;justify-content:center;position:relative;overflow:hidden;padding:1rem}
.auth-bg-shapes{position:absolute;inset:0;pointer-events:none}
.shape{position:absolute;border-radius:50%;opacity:0.08}
.shape-1{width:400px;height:400px;background:var(--orange);top:-100px;right:-100px;animation:float 8s ease-in-out infinite}
.shape-2{width:300px;height:300px;background:var(--purple);bottom:-50px;left:-50px;animation:float 10s ease-in-out infinite reverse}
.shape-3{width:200px;height:200px;background:var(--blue);top:40%;left:60%;animation:float 12s ease-in-out infinite}
@keyframes float{0%,100%{transform:translateY(0)rotate(0deg)}50%{transform:translateY(-30px)rotate(5deg)}}
.auth-card{background:var(--bg2);border:1px solid var(--bg4);border-radius:20px;padding:2.5rem;max-width:420px;width:100%;position:relative;z-index:1;box-shadow:var(--shadow)}
.auth-logo{text-align:center;margin-bottom:2rem}
.logo-icon{font-size:3rem;margin-bottom:0.5rem;animation:pulse 2s ease-in-out infinite}
@keyframes pulse{0%,100%{transform:scale(1)}50%{transform:scale(1.1)}}
.auth-logo h1{font-size:1.8rem;font-weight:700;background:linear-gradient(135deg,var(--orange),var(--yellow));-webkit-background-clip:text;-webkit-text-fill-color:transparent}
.subtitle{color:var(--text2);font-size:0.9rem;margin-top:0.25rem}
.tabs{display:flex;gap:0;margin-bottom:1.5rem;background:var(--bg3);border-radius:10px;padding:4px}
.tab{flex:1;padding:0.6rem;background:none;color:var(--text2);border-radius:8px;font-weight:500;transition:all 0.2s}
.tab.active{background:var(--orange);color:#fff}
form{display:flex;flex-direction:column;gap:1rem}
.input-group{position:relative;display:flex;align-items:center;gap:0.5rem}
.input-icon{font-size:1.1rem;position:absolute;left:0.75rem;pointer-events:none}
.input-group input,.input-group select,.input-group textarea{padding-left:2.5rem}
.input-group label + input,.input-group label + select,.input-group label + textarea{padding-left:0.85rem}
.input-row{display:flex;gap:1rem}
.input-row .input-group{flex:1}
.btn-primary{background:linear-gradient(135deg,var(--orange),#ea580c);color:#fff;padding:0.75rem 1.5rem;border-radius:10px;font-weight:600;transition:all 0.2s;text-align:center}
.btn-primary:hover{transform:translateY(-1px);box-shadow:0 4px 16px rgba(249,115,22,0.4)}
.btn-glow{animation:glow 3s ease-in-out infinite}
@keyframes glow{0%,100%{box-shadow:0 0 5px rgba(249,115,22,0.3)}50%{box-shadow:0 0 20px rgba(249,115,22,0.5)}}
.btn-secondary{background:var(--bg4);color:var(--text);padding:0.65rem 1.25rem;border-radius:10px;font-weight:500;transition:all 0.2s}
.btn-secondary:hover{background:var(--bg3)}
.btn-sm{padding:0.4rem 0.85rem;font-size:0.85rem}
.btn-lg{padding:0.85rem 1.75rem;font-size:1.05rem}
.btn-xs{padding:0.25rem 0.6rem;font-size:0.8rem;border-radius:6px;background:var(--green);color:#fff}
.btn-complete{background:var(--green)!important;color:#fff}
.btn-complete-lg{background:var(--green);color:#fff;padding:0.6rem 1.5rem;border-radius:10px;font-weight:600;transition:all 0.2s}
.btn-complete-lg:hover{transform:scale(1.05)}
.btn-skip{background:var(--bg4);color:var(--text2);padding:0.5rem 1rem;border-radius:8px;font-size:0.85rem}
.btn-icon{background:none;color:var(--text2);padding:0.25rem;font-size:1rem;border-radius:6px}
.btn-icon:hover{background:var(--bg4)}
.btn-cat{padding:0.5rem 1rem;border-radius:8px;font-weight:500;border:1px solid transparent;transition:all 0.2s}
.btn-cat:hover{transform:translateY(-1px)}
.error{color:var(--red);font-size:0.85rem;margin-top:0.5rem}
.auth-features{display:grid;grid-template-columns:1fr 1fr;gap:0.5rem;margin-top:1.5rem}
.auth-feature{display:flex;align-items:center;gap:0.5rem;font-size:0.85rem;color:var(--text2);padding:0.5rem;background:var(--bg3);border-radius:8px}

/* ==================== SHELL ==================== */
.app-shell{display:flex;min-height:100vh}
.sidebar{width:240px;background:var(--bg2);border-right:1px solid var(--bg4);display:flex;flex-direction:column;position:fixed;top:0;left:0;bottom:0;z-index:100;transition:transform 0.3s}
.sidebar-logo{display:flex;align-items:center;gap:0.75rem;padding:1.25rem 1rem;border-bottom:1px solid var(--bg4)}
.sidebar-logo span{font-size:1.5rem}
.sidebar-logo h2{font-size:1.1rem;font-weight:700;background:linear-gradient(135deg,var(--orange),var(--yellow));-webkit-background-clip:text;-webkit-text-fill-color:transparent}
.nav-links{flex:1;padding:0.75rem 0.5rem;overflow-y:auto;display:flex;flex-direction:column;gap:2px}
.nav-link{display:flex;align-items:center;gap:0.75rem;padding:0.6rem 0.85rem;border-radius:10px;color:var(--text2);font-size:0.9rem;font-weight:500;transition:all 0.15s;text-decoration:none}
.nav-link:hover{background:var(--bg3);color:var(--text);text-decoration:none}
.nav-link.active{background:linear-gradient(135deg,rgba(249,115,22,0.15),rgba(249,115,22,0.05));color:var(--orange);font-weight:600}
.nav-icon{font-size:1.1rem;width:1.5rem;text-align:center}
.sidebar-footer{padding:1rem;border-top:1px solid var(--bg4)}
.btn-logout{background:none;color:var(--text2);font-size:0.85rem;padding:0.5rem 0.75rem;border-radius:8px;width:100%;text-align:left}
.btn-logout:hover{background:var(--bg3);color:var(--red)}
.main-content{flex:1;margin-left:240px;min-height:100vh}
.top-bar{display:flex;justify-content:flex-end;align-items:center;padding:0.75rem 2rem;border-bottom:1px solid var(--bg4);background:var(--bg2);position:sticky;top:0;z-index:50}
.top-bar-right{display:flex;align-items:center;gap:1rem}
.notif-btn{background:none;color:var(--text);font-size:1.1rem;position:relative;padding:0.5rem}
.badge{position:absolute;top:0;right:0;background:var(--red);color:#fff;font-size:0.65rem;padding:0.1rem 0.35rem;border-radius:10px;font-weight:700}
.badge.hidden{display:none}
.mobile-menu-btn{display:none;background:none;color:var(--text);font-size:1.3rem;padding:0.5rem}
.page-content{padding:2rem;max-width:1200px;margin:0 auto}

/* ==================== PAGE HEADER ==================== */
.page-header{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:2rem;flex-wrap:wrap;gap:1rem}
.page-header h1{font-size:1.6rem;font-weight:700}
.text-muted{color:var(--text2);font-size:0.9rem}
.header-actions{display:flex;gap:0.5rem}
.streak-badge{display:flex;align-items:center;gap:0.5rem;background:var(--bg3);border:1px solid var(--bg4);padding:0.5rem 1rem;border-radius:10px;font-weight:600;font-size:1rem}
.streak-fire{background:linear-gradient(135deg,rgba(249,115,22,0.2),rgba(239,68,68,0.1));border-color:var(--orange);animation:glow 3s ease-in-out infinite}

/* ==================== QUOTE ==================== */
.quote-card{background:linear-gradient(135deg,var(--bg3),var(--bg2));border:1px solid var(--bg4);border-radius:14px;padding:1.25rem 1.5rem;margin-bottom:1.5rem;display:flex;align-items:center;gap:1rem}
.quote-icon{font-size:1.5rem}
.quote-card p{color:var(--text2);font-style:italic;font-size:0.95rem}

/* ==================== STATS GRID ==================== */
.stats-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:1rem;margin-bottom:2rem}
.stat-card{background:var(--bg2);border:1px solid var(--bg4);border-radius:14px;padding:1.25rem;position:relative;overflow:hidden;transition:transform 0.2s}
.stat-card:hover{transform:translateY(-2px)}
.stat-icon{font-size:1.5rem;margin-bottom:0.5rem}
.stat-value{font-size:1.8rem;font-weight:700;margin-bottom:0.25rem}
.stat-label{color:var(--text2);font-size:0.85rem}
.stat-sub{color:var(--text2);font-size:0.75rem;margin-top:0.5rem}
.stat-orange .stat-value{color:var(--orange)}
.stat-green .stat-value{color:var(--green)}
.stat-blue .stat-value{color:var(--blue)}
.stat-purple .stat-value{color:var(--purple)}
.xp-bar{height:6px;background:var(--bg4);border-radius:3px;margin-top:0.5rem;overflow:hidden}
.xp-fill{height:100%;background:linear-gradient(90deg,var(--orange),var(--yellow));border-radius:3px;transition:width 0.5s ease}

/* ==================== PROGRESS BAR ==================== */
.progress-bar{height:6px;background:var(--bg4);border-radius:3px;overflow:hidden;margin-top:0.5rem}
.progress-fill{height:100%;border-radius:3px;transition:width 0.5s ease}

/* ==================== CARDS ==================== */
.card{background:var(--bg2);border:1px solid var(--bg4);border-radius:14px;overflow:hidden}
.card-header{display:flex;justify-content:space-between;align-items:center;padding:1rem 1.25rem;border-bottom:1px solid var(--bg4)}
.card-header h3{font-size:1rem;font-weight:600}
.card-link{color:var(--orange);font-size:0.85rem;font-weight:500;cursor:pointer}
.card-body{padding:1.25rem}
.grid-2{display:grid;grid-template-columns:1fr 1fr;gap:1rem;margin-bottom:1.5rem}

/* ==================== WEEK CHART ==================== */
.week-chart{display:flex;align-items:flex-end;gap:0.5rem;height:120px;padding-top:1rem}
.bar-col{display:flex;flex-direction:column;align-items:center;flex:1;gap:0.25rem;height:100%}
.bar-col .bar{width:100%;border-radius:4px 4px 0 0;min-height:4px;transition:height 0.3s ease}
.bar-col span{font-size:0.7rem;color:var(--text2)}
.daily-chart{display:flex;align-items:flex-end;gap:3px;height:100px;overflow-x:auto}
.bar-col-sm{display:flex;flex-direction:column;align-items:center;min-width:10px;flex:1;height:100%}
.bar-col-sm .bar{width:100%;border-radius:2px 2px 0 0;min-height:2px;transition:height 0.3s ease}

/* ==================== ACTION ROWS ==================== */
.action-row{display:flex;align-items:center;gap:0.75rem;padding:0.6rem 0;border-bottom:1px solid var(--bg3)}
.action-row:last-child{border-bottom:none}
.action-row.completed{opacity:0.6}
.action-row.skipped{opacity:0.4}
.action-cat{font-size:1.2rem}
.action-info{flex:1}
.action-info strong{font-size:0.9rem;display:block}
.action-info small{color:var(--text2);font-size:0.75rem}
.action-done{color:var(--green);font-size:0.8rem;font-weight:600}
.action-skip{color:var(--text2);font-size:0.8rem}

/* ==================== TODAY ACTIONS ==================== */
.today-summary{display:flex;gap:1.5rem;margin-bottom:1.5rem;padding:1rem;background:var(--bg2);border:1px solid var(--bg4);border-radius:14px;flex-wrap:wrap}
.summary-stat{display:flex;flex-direction:column;align-items:center;gap:0.25rem}
.summary-num{font-size:1.5rem;font-weight:700;color:var(--orange)}
.summary-label{font-size:0.75rem;color:var(--text2)}
.actions-list{display:flex;flex-direction:column;gap:0.75rem}
.action-card{display:flex;justify-content:space-between;align-items:center;padding:1.25rem;background:var(--bg2);border:1px solid var(--bg4);border-radius:14px;transition:all 0.2s}
.action-card:hover{border-color:var(--orange)}
.action-completed{opacity:0.7;border-left:4px solid var(--green)}
.action-skipped{opacity:0.5;border-left:4px solid var(--text2)}
.action-left{flex:1}
.action-cat-badge{display:inline-flex;align-items:center;gap:0.25rem;padding:0.2rem 0.6rem;border-radius:6px;font-size:0.75rem;font-weight:600;margin-bottom:0.5rem}
.action-title{font-size:1rem;font-weight:600;margin-bottom:0.25rem}
.action-meta{display:flex;gap:0.75rem;font-size:0.8rem;color:var(--text2);flex-wrap:wrap}
.action-difficulty{padding:0.15rem 0.5rem;border-radius:4px;font-size:0.7rem;font-weight:600;text-transform:uppercase}
.action-difficulty.beginner{background:rgba(34,197,94,0.15);color:var(--green)}
.action-difficulty.intermediate{background:rgba(59,130,246,0.15);color:var(--blue)}
.action-difficulty.advanced{background:rgba(239,68,68,0.15);color:var(--red)}
.chain-tag{background:var(--bg4);padding:0.15rem 0.5rem;border-radius:4px;font-size:0.7rem}
.action-right{display:flex;flex-direction:column;align-items:flex-end;gap:0.5rem}
.action-badge{text-align:center;font-size:0.85rem;font-weight:600;padding:0.5rem 0.75rem;border-radius:8px}
.action-badge.done{color:var(--green);background:rgba(34,197,94,0.1)}
.action-badge.skip{color:var(--text2);background:var(--bg3)}

/* ==================== MOOD SELECTOR ==================== */
.mood-section{display:flex;flex-direction:column;gap:0.75rem}
.mood-section label{font-size:0.85rem;font-weight:500;color:var(--text2)}
.mood-selector{display:flex;gap:0.25rem;flex-wrap:wrap}
.mood-btn{display:flex;flex-direction:column;align-items:center;padding:0.35rem;background:var(--bg3);border:2px solid transparent;border-radius:8px;font-size:0.85rem;transition:all 0.15s;min-width:38px}
.mood-btn small{font-size:0.6rem;color:var(--text2)}
.mood-btn:hover{border-color:var(--orange)}
.mood-btn.selected{border-color:var(--orange);background:rgba(249,115,22,0.15)}
.modal-action-text{font-weight:600;margin-bottom:1rem;padding:0.75rem;background:var(--bg3);border-radius:8px}

/* ==================== GOALS ==================== */
.goals-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:1rem}
.goal-card{background:var(--bg2);border:1px solid var(--bg4);border-radius:14px;padding:1.25rem;transition:all 0.2s}
.goal-card:hover{transform:translateY(-2px);box-shadow:var(--shadow)}
.goal-card-header{display:flex;justify-content:space-between;align-items:center;margin-bottom:0.75rem}
.goal-cat{display:inline-flex;align-items:center;gap:0.25rem;padding:0.2rem 0.6rem;border-radius:6px;font-size:0.75rem;font-weight:600}
.goal-actions{display:flex;gap:0.25rem}
.goal-card h3{font-size:1rem;font-weight:600;margin-bottom:0.25rem}
.goal-desc{color:var(--text2);font-size:0.85rem;margin-bottom:0.75rem}
.goal-stats{display:flex;gap:1rem;margin:0.75rem 0}
.goal-stat{text-align:center}
.goal-stat strong{display:block;font-size:1rem;color:var(--orange)}
.goal-stat small{font-size:0.7rem;color:var(--text2)}
.goal-footer{display:flex;justify-content:space-between;align-items:center;margin-top:0.75rem}
.goal-footer small{color:var(--text2);font-size:0.75rem}
.goal-status{font-size:0.75rem;font-weight:600}
.goal-status.active{color:var(--green)}
.goal-status.inactive{color:var(--text2)}
.goal-row{display:flex;align-items:center;gap:0.75rem;padding:0.5rem 0;border-bottom:1px solid var(--bg3)}
.goal-row:last-child{border-bottom:none}
.goal-info{flex:1}
.goal-info strong{font-size:0.9rem;display:block}
.goal-info small{color:var(--text2);font-size:0.75rem}
.toggle-label{display:flex;align-items:center;gap:0.5rem;font-size:0.9rem;cursor:pointer;color:var(--text)}
.toggle-label input{width:auto}

/* ==================== JOURNAL ==================== */
.journal-list{display:flex;flex-direction:column;gap:1rem}
.journal-card{background:var(--bg2);border:1px solid var(--bg4);border-radius:14px;padding:1.25rem;transition:all 0.2s}
.journal-card:hover{border-color:var(--bg4);transform:translateY(-1px)}
.journal-header{display:flex;gap:0.75rem;align-items:center;margin-bottom:0.75rem;flex-wrap:wrap}
.journal-cat{padding:0.2rem 0.6rem;border-radius:6px;font-size:0.75rem;font-weight:600}
.journal-mood{font-size:0.85rem}
.journal-date{color:var(--text2);font-size:0.8rem;margin-left:auto}
.journal-content{font-size:0.95rem;line-height:1.6;color:var(--text)}
.journal-tags{display:flex;gap:0.5rem;margin-top:0.75rem;flex-wrap:wrap}
.tag{background:var(--bg4);color:var(--text2);padding:0.2rem 0.5rem;border-radius:4px;font-size:0.75rem}
.ai-prompt-card{background:linear-gradient(135deg,rgba(139,92,246,0.1),rgba(249,115,22,0.1));border:1px solid var(--bg4);border-radius:12px;padding:1.25rem;margin-bottom:1rem}
.ai-prompt-text{font-style:italic;font-size:1rem;line-height:1.5}

/* ==================== ACHIEVEMENTS ==================== */
.section-title{font-size:1.1rem;font-weight:600;margin:1.5rem 0 1rem;display:flex;align-items:center;gap:0.5rem}
.achievement-progress{display:flex;align-items:center;gap:0.75rem;min-width:200px}
.achievement-progress span{font-size:0.85rem;font-weight:600;color:var(--yellow)}
.badges-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(180px,1fr));gap:1rem;margin-bottom:2rem}
.badge-card{background:var(--bg2);border:1px solid var(--bg4);border-radius:14px;padding:1.25rem;text-align:center;transition:all 0.2s}
.badge-card:hover{transform:translateY(-2px)}
.badge-card.earned{border-color:var(--yellow);background:linear-gradient(135deg,var(--bg2),rgba(245,158,11,0.05))}
.badge-card.locked{opacity:0.5}
.badge-icon{font-size:2rem;margin-bottom:0.5rem}
.locked-icon{filter:grayscale(1)}
.badge-card h4{font-size:0.9rem;margin-bottom:0.25rem}
.badge-card p{color:var(--text2);font-size:0.75rem;margin-bottom:0.5rem}
.badge-xp{color:var(--yellow);font-size:0.75rem;font-weight:600}

/* ==================== CHALLENGES ==================== */
.challenges-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:1rem}
.challenge-card{background:var(--bg2);border:1px solid var(--bg4);border-radius:14px;padding:1.25rem;transition:all 0.2s}
.challenge-card:hover{transform:translateY(-2px)}
.challenge-joined{border-color:var(--orange)}
.challenge-completed{border-color:var(--green)}
.challenge-type{font-size:0.75rem;font-weight:600;color:var(--text2);margin-bottom:0.5rem}
.challenge-card h3{font-size:1rem;margin-bottom:0.5rem}
.challenge-card p{font-size:0.85rem;color:var(--text2);margin-bottom:0.75rem}
.challenge-meta{display:flex;flex-wrap:wrap;gap:0.5rem;margin-bottom:0.75rem}
.challenge-meta span{font-size:0.75rem;padding:0.2rem 0.5rem;border-radius:4px;background:var(--bg3)}
.challenge-progress{margin-top:0.75rem}
.challenge-progress span{font-size:0.8rem;color:var(--text2);display:block;margin-top:0.25rem}

/* ==================== FOCUS TIMER ==================== */
.focus-container{display:flex;flex-direction:column;gap:1.5rem}
.focus-timer-card{background:linear-gradient(135deg,var(--bg2),var(--bg3));border:1px solid var(--bg4);border-radius:20px;padding:2.5rem;text-align:center}
.focus-display{margin-bottom:2rem}
.focus-time{font-size:4rem;font-weight:700;font-family:'SF Mono',monospace;letter-spacing:0.05em;background:linear-gradient(135deg,var(--orange),var(--yellow));-webkit-background-clip:text;-webkit-text-fill-color:transparent}
.focus-minutes{color:var(--text2);font-size:0.9rem;margin-top:0.5rem}
.focus-controls{max-width:400px;margin:0 auto}
.focus-btns{display:flex;gap:1rem;justify-content:center;margin-top:1.5rem}
.focus-summary{display:flex;gap:2rem;justify-content:center;margin-bottom:1.5rem}
.focus-history-list{display:flex;flex-direction:column;gap:0.5rem}
.focus-row{display:flex;justify-content:space-between;align-items:center;padding:0.5rem 0;border-bottom:1px solid var(--bg3);font-size:0.85rem}
.focus-row:last-child{border-bottom:none}
.focus-notes{color:var(--text2);font-size:0.8rem}

/* ==================== STATS ==================== */
.cat-stat-card{display:flex;align-items:center;gap:0.75rem;padding:0.75rem;border-bottom:1px solid var(--bg3)}
.cat-stat-card:last-child{border-bottom:none}
.cat-stat-icon{width:36px;height:36px;border-radius:8px;display:flex;align-items:center;justify-content:center;font-size:1.2rem}
.cat-stat-info{flex:1}
.cat-stat-info strong{display:block;font-size:0.9rem;text-transform:capitalize}
.cat-stat-info span{font-size:0.8rem;color:var(--text2)}
.mood-impact{display:flex;align-items:center;justify-content:center;gap:1.5rem;padding:1rem;margin-bottom:1rem}
.mood-stat{text-align:center}
.mood-stat strong{display:block;font-size:0.75rem;color:var(--text2);margin-bottom:0.25rem}
.mood-val{font-size:1.8rem;font-weight:700}
.mood-arrow{font-size:1.5rem;color:var(--text2)}
.mood-delta{text-align:center;font-weight:600;font-size:0.9rem;padding:0.5rem;border-radius:8px}
.mood-delta.positive{color:var(--green);background:rgba(34,197,94,0.1)}
.mood-delta.negative{color:var(--red);background:rgba(239,68,68,0.1)}
.energy-display{display:flex;align-items:center;gap:1rem}
.energy-bar-big{flex:1}
.energy-val-big{font-size:1.2rem;font-weight:700;color:var(--yellow)}

/* ==================== AI REPORT ==================== */
.report-intro{text-align:center;padding:3rem 2rem;background:linear-gradient(135deg,var(--bg2),var(--bg3));border:1px solid var(--bg4);border-radius:20px}
.report-icon{font-size:3rem;margin-bottom:1rem}
.report-intro h3{font-size:1.3rem;margin-bottom:0.5rem}
.report-intro p{color:var(--text2);max-width:500px;margin:0 auto 1.5rem}
.report-content{display:flex;flex-direction:column;gap:0.75rem}
.report-item{padding:0.75rem;background:var(--bg3);border-radius:8px;font-size:0.9rem}
.report-item strong{color:var(--orange)}
.report-insight{padding:1rem;background:linear-gradient(135deg,rgba(139,92,246,0.05),rgba(249,115,22,0.05));border:1px solid var(--bg4);border-radius:10px}
.report-insight strong{color:var(--orange);display:block;margin-bottom:0.5rem}
.report-insight p{color:var(--text2);line-height:1.5;font-size:0.9rem}
.advice-btns{display:flex;flex-wrap:wrap;gap:0.5rem;margin:0.75rem 0}
.advice-content{display:flex;flex-direction:column;gap:0.5rem;margin-top:1rem}
.advice-item{padding:0.75rem;background:var(--bg3);border-radius:8px;font-size:0.85rem}
.advice-item strong{color:var(--orange)}

/* ==================== PODS ==================== */
.pods-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:1rem}
.pod-card{background:var(--bg2);border:1px solid var(--bg4);border-radius:14px;padding:1.25rem;transition:all 0.2s}
.pod-card:hover{transform:translateY(-2px)}
.pod-member{border-color:var(--orange)}
.pod-header{display:flex;justify-content:space-between;align-items:center;margin-bottom:0.75rem}
.pod-cat{padding:0.2rem 0.6rem;border-radius:6px;font-size:0.75rem;font-weight:600}
.pod-members{font-size:0.8rem;color:var(--text2)}
.pod-desc{color:var(--text2);font-size:0.85rem;margin-bottom:0.75rem}
.pod-actions{display:flex;gap:0.5rem}
.chat-messages{max-height:300px;overflow-y:auto;margin-bottom:1rem;display:flex;flex-direction:column;gap:0.5rem}
.chat-msg{background:var(--bg3);padding:0.75rem;border-radius:10px}
.chat-msg strong{font-size:0.85rem;color:var(--orange)}
.chat-msg p{font-size:0.9rem;margin:0.25rem 0}
.chat-msg small{color:var(--text2);font-size:0.75rem}
.chat-input-row{display:flex;gap:0.5rem}
.chat-input-row input{flex:1}

/* ==================== LEADERBOARD ==================== */
.leaderboard-table{background:var(--bg2);border:1px solid var(--bg4);border-radius:14px;overflow:hidden}
.lb-header{display:grid;grid-template-columns:50px 1fr 70px 80px 80px 80px;padding:0.75rem 1rem;background:var(--bg3);font-size:0.75rem;font-weight:600;color:var(--text2);text-transform:uppercase}
.lb-row{display:grid;grid-template-columns:50px 1fr 70px 80px 80px 80px;padding:0.75rem 1rem;border-bottom:1px solid var(--bg3);align-items:center;font-size:0.85rem;transition:background 0.15s}
.lb-row:hover{background:var(--bg3)}
.lb-row:last-child{border-bottom:none}
.lb-top{background:rgba(249,115,22,0.03)}
.lb-rank{font-size:1rem;text-align:center}
.lb-user{display:flex;align-items:center;gap:0.5rem;font-weight:500}
.lb-avatar{width:28px;height:28px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:0.75rem;font-weight:700;color:#fff;flex-shrink:0}
.lb-xp{font-weight:600;color:var(--orange)}
.lb-streak{font-size:0.8rem}

/* ==================== SETTINGS ==================== */
.profile-avatar{width:64px;height:64px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:1.5rem;font-weight:700;color:#fff;margin:0 auto 1rem}
.settings-stat{display:flex;justify-content:space-between;padding:0.5rem 0;border-bottom:1px solid var(--bg3);font-size:0.9rem}
.settings-stat:last-child{border-bottom:none}
.settings-stat span{color:var(--text2)}

/* ==================== NOTIFICATIONS ==================== */
.notif-row{display:flex;align-items:flex-start;gap:0.5rem;padding:0.5rem 0;border-bottom:1px solid var(--bg3)}
.notif-row:last-child{border-bottom:none}
.notif-row div{flex:1}
.notif-row strong{font-size:0.85rem;display:block}
.notif-row small{color:var(--text2);font-size:0.75rem}
.notif-item{display:flex;gap:0.75rem;padding:0.75rem;border-bottom:1px solid var(--bg3);border-radius:8px}
.notif-item:last-child{border-bottom:none}
.notif-item.unread{background:rgba(249,115,22,0.05)}
.notif-icon{font-size:1.2rem;margin-top:0.1rem}
.notif-body{flex:1}
.notif-body strong{font-size:0.9rem;display:block;margin-bottom:0.15rem}
.notif-body p{font-size:0.85rem;color:var(--text2);margin-bottom:0.15rem}
.notif-body small{color:var(--text2);font-size:0.75rem}

/* ==================== EMPTY & LOADING ==================== */
.empty-state{text-align:center;padding:4rem 2rem;background:var(--bg2);border:1px solid var(--bg4);border-radius:14px}
.empty-icon{font-size:3rem;margin-bottom:1rem}
.empty-state h3{font-size:1.1rem;margin-bottom:0.5rem}
.empty-state p{color:var(--text2);margin-bottom:1rem;max-width:400px;margin-inline:auto}
.empty-state-small{padding:1.5rem;text-align:center;color:var(--text2);font-size:0.9rem}
.loading-spinner{display:flex;justify-content:center;padding:3rem}
.spinner{width:36px;height:36px;border:3px solid var(--bg4);border-top:3px solid var(--orange);border-radius:50%;animation:spin 0.8s linear infinite}
@keyframes spin{to{transform:rotate(360deg)}}

/* ==================== RESPONSIVE ==================== */
@media(max-width:768px){
  .sidebar{transform:translateX(-100%)}
  .sidebar.open{transform:translateX(0)}
  .main-content{margin-left:0}
  .mobile-menu-btn{display:block}
  .grid-2{grid-template-columns:1fr}
  .stats-grid{grid-template-columns:repeat(2,1fr)}
  .page-content{padding:1rem}
  .page-header{flex-direction:column}
  .header-actions{width:100%}
  .focus-time{font-size:2.5rem}
  .lb-header,.lb-row{grid-template-columns:40px 1fr 60px 70px;font-size:0.8rem}
  .lb-streak,.lb-actions{display:none}
  .badges-grid{grid-template-columns:repeat(2,1fr)}
  .today-summary{gap:1rem}
  .mood-selector{gap:0.15rem}
  .mood-btn{min-width:30px;padding:0.25rem}
}
@media(max-width:480px){
  .stats-grid{grid-template-columns:1fr}
  .auth-card{padding:1.5rem}
  .badges-grid{grid-template-columns:1fr 1fr}
  .goals-grid,.challenges-grid,.pods-grid{grid-template-columns:1fr}
}
`;
document.head.appendChild(style);
