const express = require('express');
const bcrypt = require('bcryptjs');
const db = require('./database');
const { authMiddleware, generateToken } = require('./auth');
const { generateDailyAction, generateCompoundReport, generatePersonalizedAdvice, generateJournalPrompt, getDifficultyLevel, getRandomQuote, MICRO_ACTIONS_DB } = require('./ai');

const router = express.Router();
const CATEGORIES = ['health', 'finance', 'learning', 'social', 'mental', 'creativity'];
const LEVEL_XP = [0, 100, 250, 500, 1000, 2000, 3500, 5500, 8000, 12000, 20000];

function getLevel(xp) {
  for (let i = LEVEL_XP.length - 1; i >= 0; i--) {
    if (xp >= LEVEL_XP[i]) return { level: i + 1, xp_current: xp - LEVEL_XP[i], xp_needed: (LEVEL_XP[i + 1] || LEVEL_XP[i] * 2) - LEVEL_XP[i] };
  }
  return { level: 1, xp_current: xp, xp_needed: 100 };
}

const ACHIEVEMENTS = [
  { id: 'first_action', name: 'First Step', icon: '👣', desc: 'Complete your first micro-action', check: u => u.total_actions_completed >= 1 },
  { id: 'streak_3', name: 'On a Roll', icon: '🔥', desc: '3-day streak', check: u => u.longest_streak >= 3 },
  { id: 'streak_7', name: 'Week Warrior', icon: '⚡', desc: '7-day streak', check: u => u.longest_streak >= 7 },
  { id: 'streak_14', name: 'Fortnight Fighter', icon: '💪', desc: '14-day streak', check: u => u.longest_streak >= 14 },
  { id: 'streak_30', name: 'Monthly Master', icon: '🏆', desc: '30-day streak', check: u => u.longest_streak >= 30 },
  { id: 'actions_10', name: 'Getting Started', icon: '🌱', desc: 'Complete 10 actions', check: u => u.total_actions_completed >= 10 },
  { id: 'actions_50', name: 'Half Century', icon: '🌿', desc: 'Complete 50 actions', check: u => u.total_actions_completed >= 50 },
  { id: 'actions_100', name: 'Centurion', icon: '🌳', desc: 'Complete 100 actions', check: u => u.total_actions_completed >= 100 },
  { id: 'actions_500', name: 'Habit Legend', icon: '🏔️', desc: 'Complete 500 actions', check: u => u.total_actions_completed >= 500 },
  { id: 'level_3', name: 'Rising Star', icon: '⭐', desc: 'Reach level 3', check: u => (u.level || 1) >= 3 },
  { id: 'level_5', name: 'Expert', icon: '💎', desc: 'Reach level 5', check: u => (u.level || 1) >= 5 },
  { id: 'level_10', name: 'Grandmaster', icon: '👑', desc: 'Reach level 10', check: u => (u.level || 1) >= 10 },
  { id: 'all_cats', name: 'Renaissance', icon: '🎨', desc: 'Complete actions in all 6 categories', check: (u, cats) => cats >= 6 },
  { id: 'journal_5', name: 'Reflective', icon: '📝', desc: 'Write 5 journal entries', check: (u, _, journals) => journals >= 5 },
  { id: 'pod_member', name: 'Team Player', icon: '🤝', desc: 'Join an accountability pod', check: (u, _, __, pods) => pods >= 1 },
  { id: 'early_bird', name: 'Early Bird', icon: '🐦', desc: 'Complete an action before 8 AM', check: (u, _, __, ___, early) => early },
];

// ==================== AUTH ====================
router.post('/auth/register', async (req, res) => {
  try {
    const { email, password, name, timezone } = req.body;
    if (!email || !password || !name) return res.status(400).json({ error: 'Required fields missing' });
    const existing = db.findOne('users', u => u.email === email);
    if (existing) return res.status(409).json({ error: 'Email exists' });
    const hash = await bcrypt.hash(password, 10);
    const result = db.insert('users', {
      email, password: hash, name, timezone: timezone || 'UTC',
      preferred_time: '09:00', is_premium: 0, current_streak: 0,
      longest_streak: 0, total_actions_completed: 0, level: 1, xp: 0,
      bio: '', avatar_color: '#f97316'
    });
    const token = generateToken(result.lastInsertRowid);
    res.json({ token, user: { id: result.lastInsertRowid, name } });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = db.findOne('users', u => u.email === email);
    if (!user || !(await bcrypt.compare(password, user.password))) return res.status(401).json({ error: 'Invalid credentials' });
    const token = generateToken(user.id);
    res.json({ token, user: { id: user.id, name: user.name } });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/auth/me', authMiddleware, (req, res) => {
  const user = db.findOne('users', u => u.id === req.userId);
  if (!user) return res.status(404).json({ error: 'User not found' });
  const { password, ...safe } = user;
  res.json({ ...safe, ...getLevel(safe.xp || 0) });
});

router.patch('/auth/profile', authMiddleware, (req, res) => {
  const { name, bio, timezone, preferred_time, avatar_color } = req.body;
  const updates = {};
  if (name) updates.name = name;
  if (bio !== undefined) updates.bio = bio;
  if (timezone) updates.timezone = timezone;
  if (preferred_time) updates.preferred_time = preferred_time;
  if (avatar_color) updates.avatar_color = avatar_color;
  db.update('users', u => u.id === req.userId, updates);
  res.json({ success: true });
});

// ==================== GOALS ====================
router.post('/goals', authMiddleware, (req, res) => {
  const { category, title, description, target_description, difficulty, color } = req.body;
  if (!category || !title) return res.status(400).json({ error: 'Category and title required' });
  const result = db.insert('goals', {
    user_id: req.userId, category, title, description: description || '',
    target_description: target_description || '', difficulty: difficulty || 'medium',
    color: color || '#f97316', is_active: 1, progress_score: 0
  });
  res.json({ id: result.lastInsertRowid });
});

router.get('/goals', authMiddleware, (req, res) => {
  const goals = db.findAll('goals', g => g.user_id === req.userId && g.is_active === 1);
  // Add completion stats
  const enriched = goals.map(g => {
    const total = db.count('daily_actions', a => a.user_id === req.userId && a.category === g.category);
    const completed = db.count('daily_actions', a => a.user_id === req.userId && a.category === g.category && a.is_completed === 1);
    return { ...g, total_actions: total, completed_actions: completed, completion_rate: total > 0 ? Math.round(completed / total * 100) : 0 };
  });
  res.json(enriched);
});

router.put('/goals/:id', authMiddleware, (req, res) => {
  const { title, description, target_description, difficulty, color } = req.body;
  db.update('goals', g => g.id === parseInt(req.params.id) && g.user_id === req.userId, { title, description, target_description, difficulty, color });
  res.json({ success: true });
});

router.delete('/goals/:id', authMiddleware, (req, res) => {
  db.update('goals', g => g.id === parseInt(req.params.id) && g.user_id === req.userId, { is_active: 0 });
  res.json({ success: true });
});

// ==================== DAILY ACTIONS ====================
router.get('/today', authMiddleware, async (req, res) => {
  try {
    const today = new Date().toISOString().split('T')[0];
    let actions = db.findAll('daily_actions', a => a.user_id === req.userId && a.date === today);

    if (actions.length === 0) {
      const goals = db.findAll('goals', g => g.user_id === req.userId && g.is_active === 1);
      const user = db.findOne('users', u => u.id === req.userId);
      const difficulty = getDifficultyLevel(user?.total_actions_completed || 0);
      const history = db.findAll('daily_actions', a => a.user_id === req.userId).sort((a, b) => b.date.localeCompare(a.date)).slice(0, 20);

      if (goals.length === 0) {
        for (const cat of ['health', 'mental', 'learning']) {
          const generated = await generateDailyAction(cat, difficulty, history, '');
          db.insert('daily_actions', { user_id: req.userId, goal_id: null, category: cat, action_text: generated.action, duration_seconds: generated.duration_seconds, difficulty, xp_earned: generated.xp, is_completed: 0, completed_at: null, skipped: 0, ai_generated: 1, date: today, chain_suggestion: generated.chain_suggestion || '' });
        }
      } else {
        for (const goal of goals) {
          const generated = await generateDailyAction(goal.category, difficulty, history, goal.target_description);
          db.insert('daily_actions', { user_id: req.userId, goal_id: goal.id, category: goal.category, action_text: generated.action, duration_seconds: generated.duration_seconds, difficulty, xp_earned: generated.xp, is_completed: 0, completed_at: null, skipped: 0, ai_generated: 1, date: today, chain_suggestion: generated.chain_suggestion || '' });
        }
      }
      actions = db.findAll('daily_actions', a => a.user_id === req.userId && a.date === today);
    }

    const user = db.findOne('users', u => u.id === req.userId);
    const levelInfo = getLevel(user?.xp || 0);
    const quote = getRandomQuote();
    res.json({ actions, streak: user?.current_streak || 0, total_completed: user?.total_actions_completed || 0, quote, ...levelInfo });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/today/:actionId/complete', authMiddleware, (req, res) => {
  try {
    const { notes, mood_before, mood_after, difficulty_felt, energy_level } = req.body;
    const actionId = parseInt(req.params.actionId);
    const action = db.findOne('daily_actions', a => a.id === actionId && a.user_id === req.userId);
    if (!action) return res.status(404).json({ error: 'Action not found' });
    if (action.is_completed) return res.status(400).json({ error: 'Already completed' });

    const today = new Date().toISOString().split('T')[0];
    const now = new Date().toISOString();
    db.update('daily_actions', a => a.id === actionId, { is_completed: 1, completed_at: now });
    db.insert('completion_log', { user_id: req.userId, action_id: actionId, notes: notes || '', mood_before: mood_before || null, mood_after: mood_after || null, difficulty_felt: difficulty_felt || '', energy_level: energy_level || null });

    const user = db.findOne('users', u => u.id === req.userId);
    // Streak bonus XP
    let bonusXp = 0;
    const streak = user.current_streak || 0;
    if (streak >= 7) bonusXp = 10;
    if (streak >= 14) bonusXp = 20;
    if (streak >= 30) bonusXp = 50;

    const newXp = (user.xp || 0) + action.xp_earned + bonusXp;
    const newTotal = (user.total_actions_completed || 0) + 1;

    const streakEntry = db.findOne('streaks', s => s.user_id === req.userId && s.date === today);
    let currentStreak = user.current_streak || 0;
    let longestStreak = user.longest_streak || 0;

    if (streakEntry) {
      db.update('streaks', s => s.id === streakEntry.id, { actions_completed: streakEntry.actions_completed + 1 });
    } else {
      const totalToday = db.count('daily_actions', a => a.user_id === req.userId && a.date === today);
      db.insert('streaks', { user_id: req.userId, date: today, actions_completed: 1, total_actions: totalToday });
      const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
      const hadYesterday = db.findOne('streaks', s => s.user_id === req.userId && s.date === yesterday && s.actions_completed > 0);
      currentStreak = hadYesterday ? currentStreak + 1 : 1;
      if (currentStreak > longestStreak) longestStreak = currentStreak;
    }

    const newLevel = getLevel(newXp).level;
    const levelUp = newLevel > (user.level || 1);
    db.update('users', u => u.id === req.userId, { xp: newXp, total_actions_completed: newTotal, current_streak: currentStreak, longest_streak: longestStreak, level: newLevel });

    if (levelUp) db.insert('notifications', { user_id: req.userId, type: 'level_up', message: `🎉 Level up! You're now level ${newLevel}!`, is_read: 0 });

    const levelInfo = getLevel(newXp);
    res.json({ success: true, xp_earned: action.xp_earned, bonus_xp: bonusXp, streak: currentStreak, total_completed: newTotal, level_up: levelUp, ...levelInfo });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/today/:actionId/skip', authMiddleware, (req, res) => {
  const { reason } = req.body;
  const actionId = parseInt(req.params.actionId);
  db.update('daily_actions', a => a.id === actionId && a.user_id === req.userId, { skipped: 1, skip_reason: reason || '' });
  res.json({ success: true });
});

router.post('/today/refresh', authMiddleware, async (req, res) => {
  try {
    const { category } = req.body;
    const today = new Date().toISOString().split('T')[0];
    const user = db.findOne('users', u => u.id === req.userId);
    const difficulty = getDifficultyLevel(user?.total_actions_completed || 0);
    const history = db.findAll('daily_actions', a => a.user_id === req.userId).sort((a, b) => b.date.localeCompare(a.date)).slice(0, 20);
    const goal = db.findOne('goals', g => g.user_id === req.userId && g.category === category && g.is_active === 1);
    const generated = await generateDailyAction(category, difficulty, history, goal?.target_description || '');
    db.delete('daily_actions', a => a.user_id === req.userId && a.date === today && a.category === category && a.is_completed === 0);
    db.insert('daily_actions', { user_id: req.userId, goal_id: goal?.id || null, category, action_text: generated.action, duration_seconds: generated.duration_seconds, difficulty, xp_earned: generated.xp, is_completed: 0, completed_at: null, skipped: 0, ai_generated: 1, date: today, chain_suggestion: generated.chain_suggestion || '' });
    res.json(generated);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/today/add-custom', authMiddleware, (req, res) => {
  const { category, action_text, xp } = req.body;
  const today = new Date().toISOString().split('T')[0];
  const result = db.insert('daily_actions', { user_id: req.userId, goal_id: null, category: category || 'mental', action_text, duration_seconds: 120, difficulty: 'custom', xp_earned: xp || 15, is_completed: 0, completed_at: null, skipped: 0, ai_generated: 0, date: today, chain_suggestion: '' });
  res.json({ id: result.lastInsertRowid });
});

// ==================== HISTORY & STATS ====================
router.get('/history', authMiddleware, (req, res) => {
  const { days } = req.query;
  const limit = parseInt(days) || 30;
  const actions = db.findAll('daily_actions', a => a.user_id === req.userId && a.is_completed === 1).sort((a, b) => new Date(b.completed_at) - new Date(a.completed_at)).slice(0, limit * 5);
  const streaks = db.findAll('streaks', s => s.user_id === req.userId).sort((a, b) => b.date.localeCompare(a.date)).slice(0, limit);
  res.json({ actions, streaks });
});

router.get('/stats', authMiddleware, (req, res) => {
  const user = db.findOne('users', u => u.id === req.userId);
  if (!user) return res.status(404).json({ error: 'User not found' });

  const completedActions = db.findAll('daily_actions', a => a.user_id === req.userId && a.is_completed === 1);
  const byCategoryMap = {};
  for (const a of completedActions) { byCategoryMap[a.category] = (byCategoryMap[a.category] || 0) + 1; }
  const byCategory = Object.entries(byCategoryMap).map(([category, count]) => ({ category, count }));

  const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000).toISOString().split('T')[0];
  const recentActions = db.findAll('daily_actions', a => a.user_id === req.userId && a.date >= thirtyDaysAgo);
  const byDateMap = {};
  for (const a of recentActions) {
    if (!byDateMap[a.date]) byDateMap[a.date] = { date: a.date, total: 0, completed: 0 };
    byDateMap[a.date].total++;
    if (a.is_completed) byDateMap[a.date].completed++;
  }
  const last30 = Object.values(byDateMap).sort((a, b) => a.date.localeCompare(b.date));

  const logs = db.findAll('completion_log', l => l.user_id === req.userId);
  const moodBefore = logs.filter(l => l.mood_before != null);
  const moodAfter = logs.filter(l => l.mood_after != null);
  const moodData = { avg_mood_before: moodBefore.length ? +(moodBefore.reduce((s, l) => s + l.mood_before, 0) / moodBefore.length).toFixed(1) : null, avg_mood_after: moodAfter.length ? +(moodAfter.reduce((s, l) => s + l.mood_after, 0) / moodAfter.length).toFixed(1) : null, total_entries: logs.length };

  // Energy level stats
  const energyLogs = logs.filter(l => l.energy_level != null);
  const avgEnergy = energyLogs.length ? +(energyLogs.reduce((s, l) => s + l.energy_level, 0) / energyLogs.length).toFixed(1) : null;

  // Best streak time
  const completionTimes = completedActions.filter(a => a.completed_at).map(a => new Date(a.completed_at).getHours());
  const hourCounts = {};
  for (const h of completionTimes) { hourCounts[h] = (hourCounts[h] || 0) + 1; }
  const bestHour = Object.entries(hourCounts).sort((a, b) => b[1] - a[1])[0];

  const totalMinutes = completedActions.length * 2;
  const levelInfo = getLevel(user.xp || 0);
  const { password, ...safeUser } = user;

  res.json({ user: { ...safeUser, ...levelInfo }, by_category: byCategory, daily_progress: last30, mood: moodData, avg_energy: avgEnergy, best_hour: bestHour ? parseInt(bestHour[0]) : null, total_minutes: totalMinutes, total_xp_earned: completedActions.reduce((s, a) => s + (a.xp_earned || 0), 0) });
});

// ==================== COMPOUND REPORT ====================
router.get('/report', authMiddleware, async (req, res) => {
  try {
    const user = db.findOne('users', u => u.id === req.userId);
    if (!user) return res.status(404).json({ error: 'User not found' });
    const completedActions = db.findAll('daily_actions', a => a.user_id === req.userId && a.is_completed === 1);
    const byCategoryMap = {};
    for (const a of completedActions) { byCategoryMap[a.category] = (byCategoryMap[a.category] || 0) + 1; }
    const byCategory = Object.entries(byCategoryMap).map(([c, n]) => ({ category: c, count: n })).sort((a, b) => b.count - a.count);
    const uniqueDates = new Set(db.findAll('streaks', s => s.user_id === req.userId).map(s => s.date));
    const userData = { total_completed: user.total_actions_completed || 0, current_streak: user.current_streak || 0, longest_streak: user.longest_streak || 0, days_active: uniqueDates.size, xp: user.xp || 0, level: user.level || 1, top_category: byCategory[0]?.category || 'none', categories: byCategory, member_since: user.created_at };
    const report = await generateCompoundReport(userData);
    db.insert('compound_reports', { user_id: req.userId, period: 'monthly', report_data: JSON.stringify(userData), ai_insights: JSON.stringify(report) });
    res.json(report);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/advice/:category', authMiddleware, async (req, res) => {
  const user = db.findOne('users', u => u.id === req.userId);
  const total = db.count('daily_actions', a => a.user_id === req.userId && a.category === req.params.category);
  const completed = db.count('daily_actions', a => a.user_id === req.userId && a.category === req.params.category && a.is_completed === 1);
  const rate = total > 0 ? Math.round(completed / total * 100) : 0;
  const advice = await generatePersonalizedAdvice(req.params.category, user?.current_streak || 0, rate);
  res.json(advice);
});

// ==================== JOURNAL ====================
router.get('/journal', authMiddleware, (req, res) => {
  const entries = db.findAll('journal_entries', j => j.user_id === req.userId).sort((a, b) => new Date(b.created_at) - new Date(a.created_at)).slice(0, 50);
  res.json(entries);
});

router.post('/journal', authMiddleware, (req, res) => {
  const { content, mood, category, tags } = req.body;
  const result = db.insert('journal_entries', { user_id: req.userId, content, mood: mood || null, category: category || 'general', tags: tags || [] });
  res.json({ id: result.lastInsertRowid });
});

router.get('/journal/prompt', authMiddleware, async (req, res) => {
  const { category } = req.query;
  const prompt = await generateJournalPrompt(category || 'mental');
  res.json({ prompt });
});

// ==================== ACHIEVEMENTS ====================
router.get('/achievements', authMiddleware, (req, res) => {
  const user = db.findOne('users', u => u.id === req.userId);
  if (!user) return res.status(404).json({ error: 'User not found' });
  const catCount = new Set(db.findAll('daily_actions', a => a.user_id === req.userId && a.is_completed === 1).map(a => a.category)).size;
  const journalCount = db.count('journal_entries', j => j.user_id === req.userId);
  const podCount = db.count('pod_members', pm => pm.user_id === req.userId);
  const earlyBird = db.findAll('daily_actions', a => a.user_id === req.userId && a.is_completed === 1 && a.completed_at).some(a => new Date(a.completed_at).getHours() < 8);

  const badges = ACHIEVEMENTS.map(a => ({ ...a, earned: a.check(user, catCount, journalCount, podCount, earlyBird), check: undefined }));
  const totalEarned = badges.filter(b => b.earned).length;
  res.json({ badges, total: badges.length, total_earned: totalEarned });
});

// ==================== CHALLENGES ====================
router.get('/challenges', authMiddleware, (req, res) => {
  let challenges = db.findAll('challenges');
  if (challenges.length === 0) {
    const defaults = [
      { title: '7-Day Health Sprint', description: 'Complete a health action every day for 7 days', category: 'health', duration_days: 7, xp_reward: 200, type: 'weekly' },
      { title: '5-Day Learning Quest', description: 'Complete a learning action every day for 5 days', category: 'learning', duration_days: 5, xp_reward: 150, type: 'weekly' },
      { title: 'Social Butterfly', description: 'Complete 10 social actions this month', category: 'social', duration_days: 30, xp_reward: 300, type: 'monthly' },
      { title: 'Mindfulness Month', description: 'Complete 20 mental health actions this month', category: 'mental', duration_days: 30, xp_reward: 500, type: 'monthly' },
      { title: 'All-Rounder', description: 'Complete actions in every category this week', category: 'all', duration_days: 7, xp_reward: 250, type: 'weekly' },
      { title: 'Creative Streak', description: 'Complete 5 creativity actions in a row', category: 'creativity', duration_days: 14, xp_reward: 200, type: 'weekly' },
    ];
    for (const c of defaults) db.insert('challenges', { ...c, is_active: 1, participants: 0 });
    challenges = db.findAll('challenges');
  }
  const enriched = challenges.map(c => {
    const joined = db.findOne('challenge_participants', cp => cp.challenge_id === c.id && cp.user_id === req.userId);
    return { ...c, joined: !!joined, progress: joined?.progress || 0, completed: joined?.completed || false };
  });
  res.json(enriched);
});

router.post('/challenges/:id/join', authMiddleware, (req, res) => {
  const cid = parseInt(req.params.id);
  const existing = db.findOne('challenge_participants', cp => cp.challenge_id === cid && cp.user_id === req.userId);
  if (existing) return res.status(400).json({ error: 'Already joined' });
  db.insert('challenge_participants', { challenge_id: cid, user_id: req.userId, progress: 0, completed: false, joined_at: new Date().toISOString() });
  const challenge = db.findOne('challenges', c => c.id === cid);
  if (challenge) db.update('challenges', c => c.id === cid, { participants: (challenge.participants || 0) + 1 });
  res.json({ success: true });
});

// ==================== FOCUS TIMER ====================
router.post('/focus', authMiddleware, (req, res) => {
  const { duration_minutes, category, notes } = req.body;
  const result = db.insert('focus_sessions', { user_id: req.userId, duration_minutes: duration_minutes || 5, category: category || 'mental', notes: notes || '', completed_at: new Date().toISOString() });
  // Award XP
  const xp = Math.min((duration_minutes || 5) * 5, 50);
  const user = db.findOne('users', u => u.id === req.userId);
  db.update('users', u => u.id === req.userId, { xp: (user.xp || 0) + xp });
  res.json({ id: result.lastInsertRowid, xp_earned: xp });
});

router.get('/focus/history', authMiddleware, (req, res) => {
  const sessions = db.findAll('focus_sessions', f => f.user_id === req.userId).sort((a, b) => new Date(b.completed_at) - new Date(a.completed_at)).slice(0, 30);
  const totalMinutes = sessions.reduce((s, f) => s + (f.duration_minutes || 0), 0);
  res.json({ sessions, total_minutes: totalMinutes, total_sessions: sessions.length });
});

// ==================== NOTIFICATIONS ====================
router.get('/notifications', authMiddleware, (req, res) => {
  const notifs = db.findAll('notifications', n => n.user_id === req.userId).sort((a, b) => new Date(b.created_at) - new Date(a.created_at)).slice(0, 20);
  res.json(notifs);
});

router.patch('/notifications/read', authMiddleware, (req, res) => {
  const unread = db.findAll('notifications', n => n.user_id === req.userId && !n.is_read);
  for (const n of unread) db.update('notifications', x => x.id === n.id, { is_read: 1 });
  res.json({ success: true });
});

// ==================== PODS ====================
router.get('/pods', authMiddleware, (req, res) => {
  const pods = db.findAll('pods').sort((a, b) => new Date(b.created_at) - new Date(a.created_at)).slice(0, 20).map(p => {
    const memberCount = db.count('pod_members', pm => pm.pod_id === p.id);
    const isMember = db.findOne('pod_members', pm => pm.pod_id === p.id && pm.user_id === req.userId) ? 1 : 0;
    return { ...p, member_count: memberCount, is_member: isMember };
  });
  res.json(pods);
});

router.post('/pods', authMiddleware, (req, res) => {
  const { name, goal_category, description } = req.body;
  const result = db.insert('pods', { name, goal_category, description: description || '', max_members: 5, current_members: 1 });
  db.insert('pod_members', { pod_id: result.lastInsertRowid, user_id: req.userId });
  res.json({ id: result.lastInsertRowid });
});

router.post('/pods/:id/join', authMiddleware, (req, res) => {
  const podId = parseInt(req.params.id);
  const pod = db.findOne('pods', p => p.id === podId);
  if (!pod) return res.status(404).json({ error: 'Pod not found' });
  if ((pod.current_members || 0) >= pod.max_members) return res.status(400).json({ error: 'Pod is full' });
  const existing = db.findOne('pod_members', pm => pm.pod_id === podId && pm.user_id === req.userId);
  if (existing) return res.status(400).json({ error: 'Already a member' });
  db.insert('pod_members', { pod_id: podId, user_id: req.userId });
  db.update('pods', p => p.id === podId, { current_members: (pod.current_members || 0) + 1 });
  res.json({ success: true });
});

router.get('/pods/:id/messages', authMiddleware, (req, res) => {
  const podId = parseInt(req.params.id);
  const messages = db.findAll('pod_messages', m => m.pod_id === podId).sort((a, b) => new Date(b.created_at) - new Date(a.created_at)).slice(0, 50).map(m => { const user = db.findOne('users', u => u.id === m.user_id); return { ...m, name: user?.name || '' }; }).reverse();
  res.json(messages);
});

router.post('/pods/:id/messages', authMiddleware, (req, res) => {
  const { content } = req.body;
  db.insert('pod_messages', { pod_id: parseInt(req.params.id), user_id: req.userId, content });
  res.json({ success: true });
});

// ==================== LEADERBOARD ====================
router.get('/leaderboard', authMiddleware, (req, res) => {
  const users = db.findAll('users').map(u => ({ id: u.id, name: u.name, xp: u.xp || 0, level: u.level || 1, current_streak: u.current_streak || 0, total_actions_completed: u.total_actions_completed || 0, avatar_color: u.avatar_color || '#f97316' })).sort((a, b) => b.xp - a.xp).slice(0, 20);
  res.json(users);
});

// ==================== EXPORT & FEEDBACK ====================
router.get('/export', authMiddleware, (req, res) => {
  const user = db.findOne('users', u => u.id === req.userId);
  const { password, ...safeUser } = user;
  const goals = db.findAll('goals', g => g.user_id === req.userId);
  const actions = db.findAll('daily_actions', a => a.user_id === req.userId);
  const journal = db.findAll('journal_entries', j => j.user_id === req.userId);
  const focus = db.findAll('focus_sessions', f => f.user_id === req.userId);
  res.json({ user: safeUser, goals, actions, journal, focus, exported_at: new Date().toISOString() });
});

router.post('/feedback', authMiddleware, (req, res) => {
  const { type, message } = req.body;
  db.insert('feedback', { user_id: req.userId, type: type || 'general', message });
  res.json({ success: true });
});

// ==================== DASHBOARD ====================
router.get('/dashboard', authMiddleware, (req, res) => {
  const user = db.findOne('users', u => u.id === req.userId);
  if (!user) return res.status(404).json({ error: 'User not found' });
  const levelInfo = getLevel(user.xp || 0);
  const today = new Date().toISOString().split('T')[0];
  const todayActions = db.findAll('daily_actions', a => a.user_id === req.userId && a.date === today);
  const completedToday = todayActions.filter(a => a.is_completed).length;
  const goals = db.findAll('goals', g => g.user_id === req.userId && g.is_active === 1);

  const sevenDaysAgo = new Date(Date.now() - 7 * 86400000).toISOString().split('T')[0];
  const weekActions = db.findAll('daily_actions', a => a.user_id === req.userId && a.date >= sevenDaysAgo);
  const weekMap = {};
  for (const a of weekActions) { if (!weekMap[a.date]) weekMap[a.date] = { date: a.date, completed: 0, total: 0 }; weekMap[a.date].total++; if (a.is_completed) weekMap[a.date].completed++; }
  const weekProgress = Object.values(weekMap).sort((a, b) => a.date.localeCompare(b.date));

  const notifications = db.findAll('notifications', n => n.user_id === req.userId && !n.is_read).slice(0, 5);
  const quote = getRandomQuote();

  res.json({
    user: { id: user.id, name: user.name, current_streak: user.current_streak || 0, longest_streak: user.longest_streak || 0, total_actions_completed: user.total_actions_completed || 0, xp: user.xp || 0, level: user.level || 1, avatar_color: user.avatar_color, ...levelInfo },
    today: { actions: todayActions, completed: completedToday, total: todayActions.length },
    goals, week_progress: weekProgress, notifications, quote
  });
});

router.get('/categories', (req, res) => res.json(CATEGORIES));
module.exports = router;
