const express = require('express');
const bcrypt = require('bcryptjs');
const db = require('./database');
const { authMiddleware, generateToken } = require('./auth');
const { generateDailyAction, generateCompoundReport, generatePersonalizedAdvice, generateJournalPrompt, getDifficultyLevel, getRandomQuote, MICRO_ACTIONS_DB } = require('./ai');

const router = express.Router();
const CATEGORIES = ['health', 'finance', 'learning', 'social', 'mental', 'creativity'];
const LEVEL_XP = [0, 100, 250, 500, 1000, 2000, 3500, 5500, 8000, 12000, 20000, 30000, 45000, 65000, 100000];

function getLevel(xp) {
  for (let i = LEVEL_XP.length - 1; i >= 0; i--) {
    if (xp >= LEVEL_XP[i]) return { level: i + 1, xp_in_level: xp - LEVEL_XP[i], xp_for_next: (LEVEL_XP[i + 1] || LEVEL_XP[i] * 2) - LEVEL_XP[i] };
  }
  return { level: 1, xp_in_level: xp, xp_for_next: 100 };
}

const ACHIEVEMENTS = [
  { id: 'first_action', name: 'First Step', icon: '👣', desc: 'Complete your first micro-action', xp: 10, check: u => u.total_actions_completed >= 1 },
  { id: 'streak_3', name: 'On a Roll', icon: '🔥', desc: '3-day streak', xp: 30, check: u => u.longest_streak >= 3 },
  { id: 'streak_7', name: 'Week Warrior', icon: '⚡', desc: '7-day streak', xp: 70, check: u => u.longest_streak >= 7 },
  { id: 'streak_14', name: 'Fortnight Fighter', icon: '💪', desc: '14-day streak', xp: 140, check: u => u.longest_streak >= 14 },
  { id: 'streak_30', name: 'Monthly Master', icon: '🏆', desc: '30-day streak', xp: 300, check: u => u.longest_streak >= 30 },
  { id: 'streak_60', name: 'Double Master', icon: '💎', desc: '60-day streak', xp: 600, check: u => u.longest_streak >= 60 },
  { id: 'streak_100', name: 'Century Streak', icon: '👑', desc: '100-day streak', xp: 1000, check: u => u.longest_streak >= 100 },
  { id: 'actions_10', name: 'Getting Started', icon: '🌱', desc: 'Complete 10 actions', xp: 20, check: u => u.total_actions_completed >= 10 },
  { id: 'actions_25', name: 'Quarter Century', icon: '🌿', desc: 'Complete 25 actions', xp: 50, check: u => u.total_actions_completed >= 25 },
  { id: 'actions_50', name: 'Half Century', icon: '🌿', desc: 'Complete 50 actions', xp: 100, check: u => u.total_actions_completed >= 50 },
  { id: 'actions_100', name: 'Centurion', icon: '🌳', desc: 'Complete 100 actions', xp: 200, check: u => u.total_actions_completed >= 100 },
  { id: 'actions_500', name: 'Habit Legend', icon: '🏔️', desc: 'Complete 500 actions', xp: 1000, check: u => u.total_actions_completed >= 500 },
  { id: 'actions_1000', name: 'Habit God', icon: '⭐', desc: 'Complete 1000 actions', xp: 2000, check: u => u.total_actions_completed >= 1000 },
  { id: 'level_3', name: 'Rising Star', icon: '⭐', desc: 'Reach level 3', xp: 50, check: u => (u.level || 1) >= 3 },
  { id: 'level_5', name: 'Expert', icon: '💎', desc: 'Reach level 5', xp: 100, check: u => (u.level || 1) >= 5 },
  { id: 'level_10', name: 'Grandmaster', icon: '👑', desc: 'Reach level 10', xp: 500, check: u => (u.level || 1) >= 10 },
  { id: 'all_cats', name: 'Renaissance', icon: '🎨', desc: 'Complete actions in all 6 categories', xp: 150, check: (u, cats) => cats >= 6 },
  { id: 'journal_5', name: 'Reflective', icon: '📝', desc: 'Write 5 journal entries', xp: 50, check: (u, _, journals) => journals >= 5 },
  { id: 'journal_20', name: 'Deep Thinker', icon: '🧠', desc: 'Write 20 journal entries', xp: 200, check: (u, _, journals) => journals >= 20 },
  { id: 'pod_member', name: 'Team Player', icon: '🤝', desc: 'Join an accountability pod', xp: 50, check: (u, _, __, pods) => pods >= 1 },
  { id: 'early_bird', name: 'Early Bird', icon: '🐦', desc: 'Complete action before 8 AM', xp: 50, check: (u, _, __, ___, early) => early },
  { id: 'night_owl', name: 'Night Owl', icon: '🦉', desc: 'Complete action after 10 PM', xp: 50, check: (u, _, __, ___, ____, night) => night },
  { id: 'xp_1000', name: 'XP Hunter', icon: '💫', desc: 'Earn 1000 total XP', xp: 100, check: u => (u.xp || 0) >= 1000 },
  { id: 'xp_5000', name: 'XP Master', icon: '🌠', desc: 'Earn 5000 total XP', xp: 500, check: u => (u.xp || 0) >= 5000 },
  { id: 'focus_10', name: 'Focused Mind', icon: '🎯', desc: '10 focus sessions', xp: 100, check: (u, _, __, ___, ____, _____, ______, focus) => focus >= 10 },
  { id: 'water_7', name: 'Hydration Hero', icon: '💧', desc: 'Track water 7 days', xp: 70, check: (u, _, __, ___, ____, _____, ______, _______, water) => water >= 7 },
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
      bio: '', avatar_color: '#f97316', total_focus_minutes: 0,
      coins: 100, gems: 5, titles: ['Beginner'], active_title: 'Beginner',
      theme: 'dark', sound_enabled: true, notification_enabled: true,
      profile_visibility: 'public'
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
    db.update('users', u => u.id === user.id, { last_login: new Date().toISOString() });
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
  const allowed = ['name','bio','timezone','preferred_time','avatar_color','theme','sound_enabled','notification_enabled','profile_visibility','active_title','preferred_categories'];
  const updates = {};
  for (const key of allowed) { if (req.body[key] !== undefined) updates[key] = req.body[key]; }
  db.update('users', u => u.id === req.userId, updates);
  res.json({ success: true });
});

// ==================== GOALS ====================
router.post('/goals', authMiddleware, (req, res) => {
  const { category, title, description, target_description, difficulty, color, priority } = req.body;
  if (!category || !title) return res.status(400).json({ error: 'Category and title required' });
  const result = db.insert('goals', { user_id: req.userId, category, title, description: description || '', target_description: target_description || '', difficulty: difficulty || 'medium', color: color || '#f97316', is_active: 1, progress_score: 0, priority: priority || 'medium' });
  res.json({ id: result.lastInsertRowid });
});

router.get('/goals', authMiddleware, (req, res) => {
  const goals = db.findAll('goals', g => g.user_id === req.userId && g.is_active === 1);
  const enriched = goals.map(g => {
    const total = db.count('daily_actions', a => a.user_id === req.userId && a.category === g.category);
    const completed = db.count('daily_actions', a => a.user_id === req.userId && a.category === g.category && a.is_completed === 1);
    return { ...g, total_actions: total, completed_actions: completed, completion_rate: total > 0 ? Math.round(completed / total * 100) : 0 };
  });
  res.json(enriched);
});

router.put('/goals/:id', authMiddleware, (req, res) => {
  const { title, description, target_description, difficulty, color, is_active, priority } = req.body;
  const updates = {};
  if (title) updates.title = title; if (description !== undefined) updates.description = description;
  if (target_description) updates.target_description = target_description; if (difficulty) updates.difficulty = difficulty;
  if (color) updates.color = color; if (is_active !== undefined) updates.is_active = is_active;
  if (priority) updates.priority = priority;
  db.update('goals', g => g.id === parseInt(req.params.id) && g.user_id === req.userId, updates);
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
          db.insert('daily_actions', { user_id: req.userId, goal_id: null, category: cat, action_text: generated.action, duration_seconds: generated.duration_seconds, difficulty, xp_earned: generated.xp, is_completed: 0, completed_at: null, is_skipped: 0, ai_generated: 1, date: today, chain_suggestion: generated.chain_suggestion || '', priority: 'medium' });
        }
      } else {
        for (const goal of goals) {
          const generated = await generateDailyAction(goal.category, difficulty, history, goal.target_description);
          db.insert('daily_actions', { user_id: req.userId, goal_id: goal.id, category: goal.category, action_text: generated.action, duration_seconds: generated.duration_seconds, difficulty, xp_earned: generated.xp, is_completed: 0, completed_at: null, is_skipped: 0, ai_generated: 1, date: today, chain_suggestion: generated.chain_suggestion || '', priority: goal.priority || 'medium' });
        }
      }
      actions = db.findAll('daily_actions', a => a.user_id === req.userId && a.date === today);
    }
    res.json(actions);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/today/:actionId/complete', authMiddleware, (req, res) => {
  try {
    const { notes, mood_before, mood_after, difficulty_felt, energy_level, duration_seconds } = req.body;
    const actionId = parseInt(req.params.actionId);
    const action = db.findOne('daily_actions', a => a.id === actionId && a.user_id === req.userId);
    if (!action) return res.status(404).json({ error: 'Action not found' });
    if (action.is_completed) return res.status(400).json({ error: 'Already completed' });
    const today = new Date().toISOString().split('T')[0];
    const now = new Date().toISOString();
    db.update('daily_actions', a => a.id === actionId, { is_completed: 1, completed_at: now });
    db.insert('completion_log', { user_id: req.userId, action_id: actionId, notes: notes || '', mood_before: mood_before || null, mood_after: mood_after || null, difficulty_felt: difficulty_felt || '', energy_level: energy_level || null });
    const user = db.findOne('users', u => u.id === req.userId);
    let bonusXp = 0;
    const streak = user.current_streak || 0;
    if (streak >= 7) bonusXp = 10; if (streak >= 14) bonusXp = 20; if (streak >= 30) bonusXp = 50; if (streak >= 60) bonusXp = 100;
    const totalXpEarned = (action.xp_earned || 10) + bonusXp;
    const newXp = (user.xp || 0) + totalXpEarned;
    const newTotal = (user.total_actions_completed || 0) + 1;
    const newCoins = (user.coins || 0) + Math.floor(totalXpEarned / 2);
    const streakEntry = db.findOne('streaks', s => s.user_id === req.userId && s.date === today);
    let currentStreak = user.current_streak || 0;
    let longestStreak = user.longest_streak || 0;
    if (streakEntry) { db.update('streaks', s => s.id === streakEntry.id, { actions_completed: streakEntry.actions_completed + 1 }); }
    else {
      const totalToday = db.count('daily_actions', a => a.user_id === req.userId && a.date === today);
      db.insert('streaks', { user_id: req.userId, date: today, actions_completed: 1, total_actions: totalToday });
      const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
      const hadYesterday = db.findOne('streaks', s => s.user_id === req.userId && s.date === yesterday && s.actions_completed > 0);
      currentStreak = hadYesterday ? currentStreak + 1 : 1;
      if (currentStreak > longestStreak) longestStreak = currentStreak;
    }
    const newLevel = getLevel(newXp).level;
    const levelUp = newLevel > (user.level || 1);
    db.update('users', u => u.id === req.userId, { xp: newXp, total_actions_completed: newTotal, current_streak: currentStreak, longest_streak: longestStreak, level: newLevel, coins: newCoins });
    const notifications = [];
    if (levelUp) { db.insert('notifications', { user_id: req.userId, type: 'level_up', title: 'Level Up!', message: `🎉 You're now level ${newLevel}!`, is_read: 0 }); notifications.push({ type: 'level_up', message: `🎉 Level ${newLevel}!` }); }
    if ([3,7,14,30,60,100].includes(currentStreak)) { db.insert('notifications', { user_id: req.userId, type: 'streak', title: 'Streak!', message: `🔥 ${currentStreak}-day streak!`, is_read: 0 }); notifications.push({ type: 'streak', message: `🔥 ${currentStreak}-day streak!` }); }
    res.json({ success: true, xp_earned: totalXpEarned, streak_bonus: bonusXp, coins_earned: Math.floor(totalXpEarned / 2), streak: currentStreak, total_completed: newTotal, level_up: levelUp, notifications, ...getLevel(newXp) });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/today/:actionId/skip', authMiddleware, (req, res) => {
  db.update('daily_actions', a => a.id === parseInt(req.params.actionId) && a.user_id === req.userId, { is_skipped: 1, skip_reason: req.body.reason || '' });
  res.json({ success: true });
});

router.post('/today/refresh', authMiddleware, async (req, res) => {
  try {
    const today = new Date().toISOString().split('T')[0];
    const user = db.findOne('users', u => u.id === req.userId);
    const difficulty = getDifficultyLevel(user?.total_actions_completed || 0);
    const history = db.findAll('daily_actions', a => a.user_id === req.userId).sort((a, b) => b.date.localeCompare(a.date)).slice(0, 20);
    const goals = db.findAll('goals', g => g.user_id === req.userId && g.is_active === 1);
    db.delete('daily_actions', a => a.user_id === req.userId && a.date === today && !a.is_completed && !a.is_skipped);
    const cats = goals.length ? goals.map(g => g.category) : ['health', 'mental', 'learning'];
    for (const cat of cats) {
      const goal = goals.find(g => g.category === cat);
      const generated = await generateDailyAction(cat, difficulty, history, goal?.target_description || '');
      db.insert('daily_actions', { user_id: req.userId, goal_id: goal?.id || null, category: cat, action_text: generated.action, duration_seconds: generated.duration_seconds, difficulty, xp_earned: generated.xp, is_completed: 0, completed_at: null, is_skipped: 0, ai_generated: 1, date: today, chain_suggestion: generated.chain_suggestion || '', priority: 'medium' });
    }
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/today/add-custom', authMiddleware, (req, res) => {
  const { category, action_text, xp, difficulty } = req.body;
  const today = new Date().toISOString().split('T')[0];
  const result = db.insert('daily_actions', { user_id: req.userId, goal_id: null, category: category || 'mental', action_text, duration_seconds: 120, difficulty: difficulty || 'custom', xp_earned: xp || 15, is_completed: 0, completed_at: null, is_skipped: 0, ai_generated: 0, date: today, chain_suggestion: '', priority: 'medium' });
  res.json({ id: result.lastInsertRowid });
});

// ==================== HISTORY & STATS ====================
router.get('/history', authMiddleware, (req, res) => {
  const limit = parseInt(req.query.days) || 30;
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
  const byCategory = Object.entries(byCategoryMap).map(([category, count]) => ({ category, completed: count }));
  const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000).toISOString().split('T')[0];
  const recentActions = db.findAll('daily_actions', a => a.user_id === req.userId && a.date >= thirtyDaysAgo);
  const byDateMap = {};
  for (const a of recentActions) { if (!byDateMap[a.date]) byDateMap[a.date] = { date: a.date, total: 0, completed: 0 }; byDateMap[a.date].total++; if (a.is_completed) byDateMap[a.date].completed++; }
  const last30 = Object.values(byDateMap).sort((a, b) => a.date.localeCompare(b.date));
  const logs = db.findAll('completion_log', l => l.user_id === req.userId);
  const moodBefore = logs.filter(l => l.mood_before != null);
  const moodAfter = logs.filter(l => l.mood_after != null);
  const moodData = { avg_mood_before: moodBefore.length ? +(moodBefore.reduce((s, l) => s + l.mood_before, 0) / moodBefore.length).toFixed(1) : null, avg_mood_after: moodAfter.length ? +(moodAfter.reduce((s, l) => s + l.mood_after, 0) / moodAfter.length).toFixed(1) : null, total_entries: logs.length };
  const energyLogs = logs.filter(l => l.energy_level != null);
  const avgEnergy = energyLogs.length ? +(energyLogs.reduce((s, l) => s + l.energy_level, 0) / energyLogs.length).toFixed(1) : null;
  const completionTimes = completedActions.filter(a => a.completed_at).map(a => new Date(a.completed_at).getHours());
  const hourCounts = {};
  for (const h of completionTimes) hourCounts[h] = (hourCounts[h] || 0) + 1;
  const bestHour = Object.entries(hourCounts).sort((a, b) => b[1] - a[1])[0];
  const hourlyDistribution = Object.entries(hourCounts).map(([hour, count]) => ({ hour: parseInt(hour), count })).sort((a, b) => a.hour - b.hour);
  const totalMinutes = completedActions.length * 2;
  const levelInfo = getLevel(user.xp || 0);
  const { password, ...safeUser } = user;
  const allStreaks = db.findAll('streaks', s => s.user_id === req.userId);
  const heatmapData = allStreaks.map(s => ({ date: s.date, count: s.actions_completed || 0 }));
  const focusSessions = db.findAll('focus_sessions', f => f.user_id === req.userId);
  res.json({ user: { ...safeUser, ...levelInfo }, by_category: byCategory, daily_progress: last30, mood: moodData, avg_energy: avgEnergy, best_hour: bestHour ? parseInt(bestHour[0]) : null, total_minutes: totalMinutes, total_xp_earned: completedActions.reduce((s, a) => s + (a.xp_earned || 0), 0), hourly_distribution: hourlyDistribution, heatmap: heatmapData, total_focus_minutes: focusSessions.reduce((s, f) => s + (f.duration_minutes || 0), 0), total_focus_sessions: focusSessions.length });
});

// ==================== COMPOUND REPORT ====================
router.get('/report', authMiddleware, async (req, res) => {
  try {
    const user = db.findOne('users', u => u.id === req.userId);
    if (!user) return res.status(404).json({ error: 'User not found' });
    const completedActions = db.findAll('daily_actions', a => a.user_id === req.userId && a.is_completed === 1);
    const byCategoryMap = {};
    for (const a of completedActions) byCategoryMap[a.category] = (byCategoryMap[a.category] || 0) + 1;
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
  res.json(db.findAll('journal_entries', j => j.user_id === req.userId).sort((a, b) => new Date(b.created_at) - new Date(a.created_at)).slice(0, 100));
});

router.post('/journal', authMiddleware, (req, res) => {
  const { content, mood, category, tags, energy_level, gratitude_items } = req.body;
  const result = db.insert('journal_entries', { user_id: req.userId, content, mood: mood || null, category: category || 'general', tags: tags || [], energy_level: energy_level || null, gratitude_items: gratitude_items || [], word_count: content ? content.split(/\s+/).length : 0 });
  res.json({ id: result.lastInsertRowid });
});

router.delete('/journal/:id', authMiddleware, (req, res) => {
  db.delete('journal_entries', j => j.id === parseInt(req.params.id) && j.user_id === req.userId);
  res.json({ success: true });
});

router.get('/journal/prompt', authMiddleware, async (req, res) => {
  const prompt = await generateJournalPrompt(req.query.category || 'mental');
  res.json({ prompt });
});

// ==================== ACHIEVEMENTS ====================
router.get('/achievements', authMiddleware, (req, res) => {
  const user = db.findOne('users', u => u.id === req.userId);
  if (!user) return res.status(404).json({ error: 'User not found' });
  const catCount = new Set(db.findAll('daily_actions', a => a.user_id === req.userId && a.is_completed === 1).map(a => a.category)).size;
  const journalCount = db.count('journal_entries', j => j.user_id === req.userId);
  const podCount = db.count('pod_members', pm => pm.user_id === req.userId);
  const completedActions = db.findAll('daily_actions', a => a.user_id === req.userId && a.is_completed === 1 && a.completed_at);
  const earlyBird = completedActions.some(a => new Date(a.completed_at).getHours() < 8);
  const nightOwl = completedActions.some(a => new Date(a.completed_at).getHours() >= 22);
  const focusSessions = db.count('focus_sessions', f => f.user_id === req.userId);
  const waterDays = db.count('water_tracking', w => w.user_id === req.userId);
  const badges = ACHIEVEMENTS.map(a => ({ ...a, earned: a.check(user, catCount, journalCount, podCount, earlyBird, nightOwl, focusSessions, focusSessions, waterDays), check: undefined, description: a.desc }));
  res.json({ badges, total: badges.length, total_earned: badges.filter(b => b.earned).length });
});

// ==================== CHALLENGES ====================
router.get('/challenges', authMiddleware, (req, res) => {
  let challenges = db.findAll('challenges');
  if (challenges.length === 0) {
    const defaults = [
      { title: '7-Day Health Sprint', description: 'Complete a health action every day for 7 days', category: 'health', duration_days: 7, xp_reward: 200, type: 'weekly', icon: '💪' },
      { title: '5-Day Learning Quest', description: 'Complete a learning action every day for 5 days', category: 'learning', duration_days: 5, xp_reward: 150, type: 'weekly', icon: '📚' },
      { title: 'Social Butterfly', description: 'Complete 10 social actions this month', category: 'social', duration_days: 30, xp_reward: 300, type: 'monthly', icon: '🦋' },
      { title: 'Mindfulness Month', description: 'Complete 20 mental health actions this month', category: 'mental', duration_days: 30, xp_reward: 500, type: 'monthly', icon: '🧘' },
      { title: 'All-Rounder', description: 'Complete actions in every category this week', category: 'all', duration_days: 7, xp_reward: 250, type: 'weekly', icon: '🌈' },
      { title: 'Creative Streak', description: 'Complete 5 creativity actions', category: 'creativity', duration_days: 14, xp_reward: 200, type: 'weekly', icon: '🎨' },
      { title: 'Finance Master', description: 'Complete 15 finance actions this month', category: 'finance', duration_days: 30, xp_reward: 400, type: 'monthly', icon: '💰' },
      { title: 'Iron Streak', description: 'Maintain a 14-day streak', category: 'all', duration_days: 14, xp_reward: 600, type: 'monthly', icon: '⚡' },
      { title: 'Journal Journey', description: 'Write 10 journal entries', category: 'mental', duration_days: 14, xp_reward: 350, type: 'weekly', icon: '📝' },
      { title: 'Focus Champion', description: 'Complete 20 focus sessions', category: 'all', duration_days: 30, xp_reward: 500, type: 'monthly', icon: '🏆' },
      { title: 'Morning Routine', description: 'Complete 5 actions before 9 AM', category: 'health', duration_days: 7, xp_reward: 250, type: 'weekly', icon: '🌅' },
      { title: 'Wellness Week', description: 'Track water, mood, and sleep daily', category: 'health', duration_days: 7, xp_reward: 300, type: 'weekly', icon: '🌿' },
    ];
    for (const c of defaults) db.insert('challenges', { ...c, is_active: 1, participants: 0 });
    challenges = db.findAll('challenges');
  }
  res.json(challenges.map(c => {
    const joined = db.findOne('challenge_participants', cp => cp.challenge_id === c.id && cp.user_id === req.userId);
    return { ...c, joined: !!joined, progress: joined?.progress || 0, completed: joined?.completed || false };
  }));
});

router.post('/challenges/:id/join', authMiddleware, (req, res) => {
  const cid = parseInt(req.params.id);
  if (db.findOne('challenge_participants', cp => cp.challenge_id === cid && cp.user_id === req.userId)) return res.status(400).json({ error: 'Already joined' });
  db.insert('challenge_participants', { challenge_id: cid, user_id: req.userId, progress: 0, completed: false, joined_at: new Date().toISOString() });
  const c = db.findOne('challenges', c => c.id === cid);
  if (c) db.update('challenges', c => c.id === cid, { participants: (c.participants || 0) + 1 });
  res.json({ success: true });
});

// ==================== FOCUS TIMER ====================
router.post('/focus', authMiddleware, (req, res) => {
  const { duration_minutes, category, notes, type } = req.body;
  const result = db.insert('focus_sessions', { user_id: req.userId, duration_minutes: duration_minutes || 5, category: category || 'mental', notes: notes || '', type: type || 'focus', completed_at: new Date().toISOString() });
  const xp = Math.min((duration_minutes || 5) * 5, 100);
  const user = db.findOne('users', u => u.id === req.userId);
  db.update('users', u => u.id === req.userId, { xp: (user.xp || 0) + xp, total_focus_minutes: (user.total_focus_minutes || 0) + (duration_minutes || 5), coins: (user.coins || 0) + Math.floor(xp / 3) });
  res.json({ id: result.lastInsertRowid, xp_earned: xp, coins_earned: Math.floor(xp / 3) });
});

router.get('/focus/history', authMiddleware, (req, res) => {
  const sessions = db.findAll('focus_sessions', f => f.user_id === req.userId).sort((a, b) => new Date(b.completed_at) - new Date(a.completed_at)).slice(0, 50);
  res.json({ sessions, total_minutes: sessions.reduce((s, f) => s + (f.duration_minutes || 0), 0), total_sessions: sessions.length });
});

// ==================== NOTIFICATIONS ====================
router.get('/notifications', authMiddleware, (req, res) => {
  res.json(db.findAll('notifications', n => n.user_id === req.userId).sort((a, b) => new Date(b.created_at) - new Date(a.created_at)).slice(0, 50));
});

router.patch('/notifications/read', authMiddleware, (req, res) => {
  db.findAll('notifications', n => n.user_id === req.userId && !n.is_read).forEach(n => db.update('notifications', x => x.id === n.id, { is_read: 1 }));
  res.json({ success: true });
});

router.get('/notifications/unread-count', authMiddleware, (req, res) => {
  res.json({ count: db.count('notifications', n => n.user_id === req.userId && !n.is_read) });
});

// ==================== PODS ====================
router.get('/pods', authMiddleware, (req, res) => {
  res.json(db.findAll('pods').sort((a, b) => new Date(b.created_at) - new Date(a.created_at)).slice(0, 30).map(p => ({
    ...p, member_count: db.count('pod_members', pm => pm.pod_id === p.id),
    is_member: db.findOne('pod_members', pm => pm.pod_id === p.id && pm.user_id === req.userId) ? 1 : 0
  })));
});

router.post('/pods', authMiddleware, (req, res) => {
  const { name, goal_category, description } = req.body;
  const result = db.insert('pods', { name, goal_category, description: description || '', max_members: 5, current_members: 1 });
  db.insert('pod_members', { pod_id: result.lastInsertRowid, user_id: req.userId, role: 'admin' });
  res.json({ id: result.lastInsertRowid });
});

router.post('/pods/:id/join', authMiddleware, (req, res) => {
  const podId = parseInt(req.params.id);
  const pod = db.findOne('pods', p => p.id === podId);
  if (!pod) return res.status(404).json({ error: 'Pod not found' });
  if ((pod.current_members || 0) >= pod.max_members) return res.status(400).json({ error: 'Pod is full' });
  if (db.findOne('pod_members', pm => pm.pod_id === podId && pm.user_id === req.userId)) return res.status(400).json({ error: 'Already a member' });
  db.insert('pod_members', { pod_id: podId, user_id: req.userId, role: 'member' });
  db.update('pods', p => p.id === podId, { current_members: (pod.current_members || 0) + 1 });
  res.json({ success: true });
});

router.get('/pods/:id/messages', authMiddleware, (req, res) => {
  const podId = parseInt(req.params.id);
  res.json(db.findAll('pod_messages', m => m.pod_id === podId).sort((a, b) => new Date(b.created_at) - new Date(a.created_at)).slice(0, 100).map(m => { const u = db.findOne('users', u => u.id === m.user_id); return { ...m, name: u?.name || '', avatar_color: u?.avatar_color || '#f97316' }; }).reverse());
});

router.post('/pods/:id/messages', authMiddleware, (req, res) => {
  db.insert('pod_messages', { pod_id: parseInt(req.params.id), user_id: req.userId, content: req.body.content });
  res.json({ success: true });
});

// ==================== LEADERBOARD ====================
router.get('/leaderboard', authMiddleware, (req, res) => {
  let users = db.findAll('users').map(u => ({ id: u.id, name: u.name, xp: u.xp || 0, level: u.level || 1, current_streak: u.current_streak || 0, total_actions_completed: u.total_actions_completed || 0, avatar_color: u.avatar_color || '#f97316', active_title: u.active_title || '' }));
  const sort = req.query.sort;
  if (sort === 'streak') users.sort((a, b) => b.current_streak - a.current_streak);
  else if (sort === 'actions') users.sort((a, b) => b.total_actions_completed - a.total_actions_completed);
  else users.sort((a, b) => b.xp - a.xp);
  res.json(users.slice(0, 50));
});

// ==================== WATER TRACKING ====================
router.post('/water', authMiddleware, (req, res) => {
  const trackDate = req.body.date || new Date().toISOString().split('T')[0];
  const existing = db.findOne('water_tracking', w => w.user_id === req.userId && w.date === trackDate);
  if (existing) db.update('water_tracking', w => w.id === existing.id, { glasses: (existing.glasses || 0) + (req.body.glasses || 1) });
  else db.insert('water_tracking', { user_id: req.userId, date: trackDate, glasses: req.body.glasses || 1, goal: 8 });
  const updated = db.findOne('water_tracking', w => w.user_id === req.userId && w.date === trackDate);
  res.json(updated);
});

router.get('/water', authMiddleware, (req, res) => {
  const today = new Date().toISOString().split('T')[0];
  res.json({ today: db.findOne('water_tracking', w => w.user_id === req.userId && w.date === today) || { glasses: 0, goal: 8 }, history: db.findAll('water_tracking', w => w.user_id === req.userId).sort((a, b) => b.date.localeCompare(a.date)).slice(0, 30) });
});

// ==================== SLEEP TRACKING ====================
router.post('/sleep', authMiddleware, (req, res) => {
  const { hours, quality, bedtime, wake_time, notes } = req.body;
  const trackDate = req.body.date || new Date().toISOString().split('T')[0];
  const existing = db.findOne('sleep_tracking', s => s.user_id === req.userId && s.date === trackDate);
  if (existing) db.update('sleep_tracking', s => s.id === existing.id, { hours, quality, bedtime, wake_time, notes });
  else db.insert('sleep_tracking', { user_id: req.userId, date: trackDate, hours: hours || 0, quality: quality || 5, bedtime: bedtime || '', wake_time: wake_time || '', notes: notes || '' });
  res.json({ success: true });
});

router.get('/sleep', authMiddleware, (req, res) => {
  const history = db.findAll('sleep_tracking', s => s.user_id === req.userId).sort((a, b) => b.date.localeCompare(a.date)).slice(0, 30);
  res.json({ history, avg_hours: history.length ? +(history.reduce((s, e) => s + (e.hours || 0), 0) / history.length).toFixed(1) : 0, avg_quality: history.length ? +(history.reduce((s, e) => s + (e.quality || 0), 0) / history.length).toFixed(1) : 0 });
});

// ==================== MOOD TRACKING ====================
router.post('/mood', authMiddleware, (req, res) => {
  const { mood, energy, stress, notes, activities } = req.body;
  const result = db.insert('mood_tracking', { user_id: req.userId, date: req.body.date || new Date().toISOString().split('T')[0], time: new Date().toISOString(), mood: mood || 5, energy: energy || 5, stress: stress || 5, notes: notes || '', activities: activities || [] });
  res.json({ id: result.lastInsertRowid });
});

router.get('/mood', authMiddleware, (req, res) => {
  const entries = db.findAll('mood_tracking', m => m.user_id === req.userId).sort((a, b) => new Date(b.time) - new Date(a.time)).slice(0, 100);
  res.json({ entries, avg_mood: entries.length ? +(entries.reduce((s, e) => s + e.mood, 0) / entries.length).toFixed(1) : 5, avg_energy: entries.length ? +(entries.reduce((s, e) => s + e.energy, 0) / entries.length).toFixed(1) : 5, avg_stress: entries.length ? +(entries.reduce((s, e) => s + e.stress, 0) / entries.length).toFixed(1) : 5 });
});

// ==================== HABITS ====================
router.get('/habits', authMiddleware, (req, res) => {
  const habits = db.findAll('habits', h => h.user_id === req.userId && h.is_active !== false);
  res.json(habits.map(h => {
    const logs = db.findAll('habit_logs', l => l.habit_id === h.id);
    const today = new Date().toISOString().split('T')[0];
    return { ...h, total_completions: logs.length, completed_today: logs.some(l => l.date === today), current_streak: calcHabitStreak(logs) };
  }));
});

router.post('/habits', authMiddleware, (req, res) => {
  const { name, description, category, frequency, cue, routine, reward, color, icon } = req.body;
  const result = db.insert('habits', { user_id: req.userId, name, description: description || '', category: category || 'health', frequency: frequency || 'daily', cue: cue || '', routine: routine || '', reward: reward || '', color: color || '#f97316', icon: icon || '⚡', is_active: true });
  res.json({ id: result.lastInsertRowid });
});

router.post('/habits/:id/complete', authMiddleware, (req, res) => {
  const habitId = parseInt(req.params.id);
  const today = new Date().toISOString().split('T')[0];
  if (db.findOne('habit_logs', l => l.habit_id === habitId && l.date === today)) return res.status(400).json({ error: 'Already completed today' });
  db.insert('habit_logs', { habit_id: habitId, user_id: req.userId, date: today, completed_at: new Date().toISOString() });
  const user = db.findOne('users', u => u.id === req.userId);
  db.update('users', u => u.id === req.userId, { xp: (user.xp || 0) + 15 });
  res.json({ success: true, xp_earned: 15 });
});

router.delete('/habits/:id', authMiddleware, (req, res) => {
  db.update('habits', h => h.id === parseInt(req.params.id) && h.user_id === req.userId, { is_active: false });
  res.json({ success: true });
});

function calcHabitStreak(logs) {
  if (!logs.length) return 0;
  const sorted = [...new Set(logs.map(l => l.date))].sort((a, b) => b.localeCompare(a));
  let streak = 0, check = new Date();
  for (const d of sorted) { if (Math.floor((check - new Date(d)) / 86400000) <= 1) { streak++; check = new Date(d); } else break; }
  return streak;
}

// ==================== RITUALS ====================
router.get('/rituals', authMiddleware, (req, res) => {
  let rituals = db.findAll('rituals', r => r.user_id === req.userId);
  if (!rituals.length) {
    db.insert('rituals', { user_id: req.userId, name: 'Morning Routine', type: 'morning', items: ['Drink water 💧', 'Stretch 🧘', 'Set intentions 🎯', 'Gratitude 🙏'], icon: '🌅', is_active: true });
    db.insert('rituals', { user_id: req.userId, name: 'Evening Routine', type: 'evening', items: ['Reflect on day 📝', 'Plan tomorrow 📋', 'Read 📖', 'Gratitude 🙏'], icon: '🌙', is_active: true });
    rituals = db.findAll('rituals', r => r.user_id === req.userId);
  }
  const today = new Date().toISOString().split('T')[0];
  res.json(rituals.map(r => ({ ...r, today_completed: (db.findOne('ritual_logs', l => l.ritual_id === r.id && l.date === today))?.completed_items || [] })));
});

router.post('/rituals/:id/complete', authMiddleware, (req, res) => {
  const { completed_items } = req.body;
  const ritualId = parseInt(req.params.id);
  const today = new Date().toISOString().split('T')[0];
  const existing = db.findOne('ritual_logs', l => l.ritual_id === ritualId && l.date === today);
  if (existing) db.update('ritual_logs', l => l.id === existing.id, { completed_items });
  else db.insert('ritual_logs', { ritual_id: ritualId, user_id: req.userId, date: today, completed_items });
  const user = db.findOne('users', u => u.id === req.userId);
  const xp = (completed_items?.length || 0) * 5;
  db.update('users', u => u.id === req.userId, { xp: (user.xp || 0) + xp });
  res.json({ success: true, xp_earned: xp });
});

// ==================== NOTES ====================
router.get('/notes', authMiddleware, (req, res) => {
  res.json(db.findAll('quick_notes', n => n.user_id === req.userId).sort((a, b) => new Date(b.created_at) - new Date(a.created_at)).slice(0, 100));
});

router.post('/notes', authMiddleware, (req, res) => {
  const result = db.insert('quick_notes', { user_id: req.userId, content: req.body.content, color: req.body.color || '#f97316', pinned: req.body.pinned || false, category: req.body.category || 'general' });
  res.json({ id: result.lastInsertRowid });
});

router.delete('/notes/:id', authMiddleware, (req, res) => {
  db.delete('quick_notes', n => n.id === parseInt(req.params.id) && n.user_id === req.userId);
  res.json({ success: true });
});

// ==================== REWARDS SHOP ====================
router.get('/rewards', authMiddleware, (req, res) => {
  const user = db.findOne('users', u => u.id === req.userId);
  const rewards = [
    { id: 1, name: 'Streak Shield', description: 'Protect your streak for 1 day', cost: 50, icon: '🛡️', type: 'item' },
    { id: 2, name: 'XP Boost (2x)', description: 'Double XP for next 5 actions', cost: 100, icon: '🚀', type: 'boost' },
    { id: 3, name: 'Title: Champion', description: 'Unlock Champion title', cost: 200, icon: '🏅', type: 'title', title: 'Champion' },
    { id: 4, name: 'Title: Legend', description: 'Unlock Legend title', cost: 500, icon: '🌟', type: 'title', title: 'Legend' },
    { id: 5, name: 'Title: Phoenix', description: 'Unlock Phoenix title', cost: 300, icon: '🔥', type: 'title', title: 'Phoenix' },
    { id: 6, name: 'Theme: Ocean', description: 'Unlock Ocean color theme', cost: 150, icon: '🌊', type: 'theme' },
    { id: 7, name: 'Theme: Forest', description: 'Unlock Forest color theme', cost: 150, icon: '🌲', type: 'theme' },
    { id: 8, name: 'Theme: Sunset', description: 'Unlock Sunset color theme', cost: 150, icon: '🌅', type: 'theme' },
    { id: 9, name: 'Mystery Box', description: 'Random reward!', cost: 100, icon: '🎁', type: 'mystery' },
  ];
  const purchased = db.findAll('purchases', p => p.user_id === req.userId).map(p => p.reward_id);
  res.json({ rewards: rewards.map(r => ({ ...r, purchased: purchased.includes(r.id) })), coins: user?.coins || 0, gems: user?.gems || 0 });
});

router.post('/rewards/:id/buy', authMiddleware, (req, res) => {
  const rewardId = parseInt(req.params.id);
  const user = db.findOne('users', u => u.id === req.userId);
  const costs = { 1: 50, 2: 100, 3: 200, 4: 500, 5: 300, 6: 150, 7: 150, 8: 150, 9: 100 };
  const cost = costs[rewardId];
  if (!cost) return res.status(404).json({ error: 'Not found' });
  if ((user.coins || 0) < cost) return res.status(400).json({ error: 'Not enough coins' });
  db.update('users', u => u.id === req.userId, { coins: (user.coins || 0) - cost });
  db.insert('purchases', { user_id: req.userId, reward_id: rewardId, purchased_at: new Date().toISOString() });
  if (rewardId === 9) {
    const xp = Math.floor(Math.random() * 100) + 50;
    db.update('users', u => u.id === req.userId, { xp: (user.xp || 0) + xp });
    return res.json({ success: true, mystery_reward: `+${xp} XP!` });
  }
  res.json({ success: true });
});

// ==================== TEMPLATES ====================
router.get('/templates', (req, res) => {
  res.json([
    { id: 1, name: 'Healthy Living', description: 'Build health habits', category: 'health', goals: [{ title: 'Daily Exercise', category: 'health' }, { title: 'Hydration', category: 'health' }], icon: '💪', difficulty: 'beginner' },
    { id: 2, name: 'Financial Freedom', description: 'Build wealth habits', category: 'finance', goals: [{ title: 'Budget Tracking', category: 'finance' }, { title: 'Savings Growth', category: 'finance' }], icon: '💰', difficulty: 'beginner' },
    { id: 3, name: 'Lifelong Learner', description: 'Never stop learning', category: 'learning', goals: [{ title: 'Daily Reading', category: 'learning' }, { title: 'Skill Building', category: 'learning' }], icon: '📚', difficulty: 'beginner' },
    { id: 4, name: 'Mindfulness Master', description: 'Cultivate inner peace', category: 'mental', goals: [{ title: 'Daily Meditation', category: 'mental' }, { title: 'Gratitude Practice', category: 'mental' }], icon: '🧘', difficulty: 'beginner' },
    { id: 5, name: 'Social Connector', description: 'Strengthen relationships', category: 'social', goals: [{ title: 'Daily Kindness', category: 'social' }], icon: '🤝', difficulty: 'beginner' },
    { id: 6, name: 'Creative Explorer', description: 'Unleash creativity', category: 'creativity', goals: [{ title: 'Daily Creation', category: 'creativity' }], icon: '🎨', difficulty: 'beginner' },
    { id: 7, name: 'Morning Champion', description: 'Win the morning', category: 'health', goals: [{ title: 'Early Wake', category: 'health' }, { title: 'Morning Exercise', category: 'health' }, { title: 'Intention Setting', category: 'mental' }], icon: '🌅', difficulty: 'intermediate' },
    { id: 8, name: 'Life Optimizer', description: 'Optimize everything', category: 'health', goals: CATEGORIES.map(c => ({ title: `${c.charAt(0).toUpperCase() + c.slice(1)} Growth`, category: c })), icon: '🚀', difficulty: 'advanced' },
  ]);
});

router.post('/templates/:id/apply', authMiddleware, (req, res) => {
  const templates = { 1: [{ title: 'Daily Exercise', category: 'health' }, { title: 'Hydration', category: 'health' }], 2: [{ title: 'Budget Tracking', category: 'finance' }, { title: 'Savings Growth', category: 'finance' }], 3: [{ title: 'Daily Reading', category: 'learning' }, { title: 'Skill Building', category: 'learning' }], 4: [{ title: 'Daily Meditation', category: 'mental' }, { title: 'Gratitude Practice', category: 'mental' }], 5: [{ title: 'Daily Kindness', category: 'social' }], 6: [{ title: 'Daily Creation', category: 'creativity' }], 7: [{ title: 'Early Wake', category: 'health' }, { title: 'Morning Exercise', category: 'health' }, { title: 'Intention Setting', category: 'mental' }], 8: CATEGORIES.map(c => ({ title: `${c.charAt(0).toUpperCase() + c.slice(1)} Growth`, category: c })) };
  const goals = templates[parseInt(req.params.id)];
  if (!goals) return res.status(404).json({ error: 'Template not found' });
  let count = 0;
  for (const g of goals) { db.insert('goals', { user_id: req.userId, category: g.category, title: g.title, description: '', target_description: '', difficulty: 'medium', color: '#f97316', is_active: 1, progress_score: 0, priority: 'medium' }); count++; }
  res.json({ success: true, goals_created: count });
});

// ==================== AFFIRMATIONS ====================
router.get('/affirmations', (req, res) => {
  const all = ['I am capable of achieving great things through small daily actions.','Every micro-habit is an investment in my future self.','I choose progress over perfection.','My consistency today creates my success tomorrow.','I am building unbreakable habits one day at a time.','Small steps lead to massive transformations.','I trust the process and celebrate every small win.','My potential is unlimited because my effort is consistent.','I am the architect of my habits and the master of my destiny.','Today I choose growth over comfort.','I embrace the power of compound improvement.','Each action I take is a vote for the person I want to become.','I am resilient, disciplined, and unstoppable.','My habits are my superpower.','I focus on systems, not just goals.'];
  res.json({ affirmation: all[Math.floor(Math.random() * all.length)], all });
});

// ==================== HEATMAP ====================
router.get('/streaks/calendar', authMiddleware, (req, res) => {
  const year = parseInt(req.query.year) || new Date().getFullYear();
  const streaks = db.findAll('streaks', s => s.user_id === req.userId && s.date >= `${year}-01-01` && s.date <= `${year}-12-31`);
  const data = {};
  for (const s of streaks) data[s.date] = s.actions_completed || 0;
  res.json({ year, data, total_active_days: Object.keys(data).length });
});

// ==================== MILESTONES ====================
router.get('/milestones', authMiddleware, (req, res) => {
  const user = db.findOne('users', u => u.id === req.userId);
  const milestones = [
    { id: 1, name: 'First Action', target: 1, current: user?.total_actions_completed || 0, type: 'actions', icon: '👣' },
    { id: 2, name: '10 Actions', target: 10, current: user?.total_actions_completed || 0, type: 'actions', icon: '🌱' },
    { id: 3, name: '50 Actions', target: 50, current: user?.total_actions_completed || 0, type: 'actions', icon: '🌿' },
    { id: 4, name: '100 Actions', target: 100, current: user?.total_actions_completed || 0, type: 'actions', icon: '🌳' },
    { id: 5, name: '500 Actions', target: 500, current: user?.total_actions_completed || 0, type: 'actions', icon: '🏔️' },
    { id: 6, name: '7-Day Streak', target: 7, current: user?.longest_streak || 0, type: 'streak', icon: '⚡' },
    { id: 7, name: '30-Day Streak', target: 30, current: user?.longest_streak || 0, type: 'streak', icon: '🏆' },
    { id: 8, name: 'Level 5', target: 5, current: user?.level || 1, type: 'level', icon: '💎' },
    { id: 9, name: 'Level 10', target: 10, current: user?.level || 1, type: 'level', icon: '👑' },
    { id: 10, name: '1000 XP', target: 1000, current: user?.xp || 0, type: 'xp', icon: '⭐' },
    { id: 11, name: '10000 XP', target: 10000, current: user?.xp || 0, type: 'xp', icon: '🌟' },
  ];
  res.json(milestones.map(m => ({ ...m, completed: m.current >= m.target, progress: Math.min(100, Math.round(m.current / m.target * 100)) })));
});

// ==================== SOCIAL FEED ====================
router.get('/social/feed', authMiddleware, (req, res) => {
  res.json(db.findAll('daily_actions', a => a.is_completed === 1).sort((a, b) => new Date(b.completed_at) - new Date(a.completed_at)).slice(0, 30).map(a => {
    const u = db.findOne('users', u => u.id === a.user_id);
    if (!u || u.profile_visibility === 'private') return null;
    return { id: a.id, action: a.action_text, category: a.category, user_name: u.name, avatar_color: u.avatar_color || '#f97316', level: u.level || 1, completed_at: a.completed_at };
  }).filter(Boolean));
});

// ==================== EXPORT & FEEDBACK ====================
router.get('/export', authMiddleware, (req, res) => {
  const user = db.findOne('users', u => u.id === req.userId);
  const { password, ...safeUser } = user;
  res.json({ user: safeUser, goals: db.findAll('goals', g => g.user_id === req.userId), actions: db.findAll('daily_actions', a => a.user_id === req.userId), journal: db.findAll('journal_entries', j => j.user_id === req.userId), focus: db.findAll('focus_sessions', f => f.user_id === req.userId), habits: db.findAll('habits', h => h.user_id === req.userId), exported_at: new Date().toISOString() });
});

router.post('/feedback', authMiddleware, (req, res) => {
  db.insert('feedback', { user_id: req.userId, type: req.body.type || 'general', message: req.body.message, rating: req.body.rating || null });
  res.json({ success: true });
});

// ==================== DASHBOARD ====================
router.get('/dashboard', authMiddleware, (req, res) => {
  const user = db.findOne('users', u => u.id === req.userId);
  if (!user) return res.status(404).json({ error: 'User not found' });
  const levelInfo = getLevel(user.xp || 0);
  const today = new Date().toISOString().split('T')[0];
  const todayActions = db.findAll('daily_actions', a => a.user_id === req.userId && a.date === today);
  const goals = db.findAll('goals', g => g.user_id === req.userId && g.is_active === 1);
  const sevenDaysAgo = new Date(Date.now() - 7 * 86400000).toISOString().split('T')[0];
  const weekActions = db.findAll('daily_actions', a => a.user_id === req.userId && a.date >= sevenDaysAgo);
  const weekMap = {};
  for (const a of weekActions) { if (!weekMap[a.date]) weekMap[a.date] = { date: a.date, completed: 0, total: 0 }; weekMap[a.date].total++; if (a.is_completed) weekMap[a.date].completed++; }
  const notifications = db.findAll('notifications', n => n.user_id === req.userId && !n.is_read).slice(0, 5);
  const waterToday = db.findOne('water_tracking', w => w.user_id === req.userId && w.date === today);
  const moodToday = db.findAll('mood_tracking', m => m.user_id === req.userId && m.date === today).sort((a, b) => new Date(b.time) - new Date(a.time))[0];
  const focusToday = db.findAll('focus_sessions', f => f.user_id === req.userId && f.completed_at && f.completed_at.startsWith(today));
  const { password, ...safeUser } = user;
  res.json({
    user: { ...safeUser, ...levelInfo, coins: user.coins || 0, gems: user.gems || 0 },
    today: { actions: todayActions, completed: todayActions.filter(a => a.is_completed).length, total: todayActions.length },
    goals, week_progress: Object.values(weekMap).sort((a, b) => a.date.localeCompare(b.date)),
    notifications, unread_count: db.count('notifications', n => n.user_id === req.userId && !n.is_read),
    quote: getRandomQuote(), water_today: waterToday || { glasses: 0, goal: 8 },
    mood_today: moodToday || null, focus_today_minutes: focusToday.reduce((s, f) => s + (f.duration_minutes || 0), 0),
    active_habits: db.count('habits', h => h.user_id === req.userId && h.is_active !== false)
  });
});

router.get('/categories', (req, res) => res.json(CATEGORIES));
module.exports = router;
