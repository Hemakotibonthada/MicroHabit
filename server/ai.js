const OpenAI = require('openai');
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY || 'demo' });

const MICRO_ACTIONS_DB = {
  health: {
    beginner: ['Do 5 pushups right now','Drink a full glass of water','Stand up and stretch for 2 minutes','Take 10 deep breaths','Do 10 jumping jacks','Walk around for 2 minutes','Do a 2-minute wall sit','Touch your toes 10 times','Do 5 squats','Roll your shoulders 20 times','Do 5 lunges per leg','Hold a plank for 30 seconds'],
    intermediate: ['Do 15 pushups','Do a 1-minute plank','Do 20 squats','Run in place for 2 minutes','Do 10 burpees','Do 20 crunches','Do 15 lunges','Jump rope for 2 minutes'],
    advanced: ['Do 30 pushups','Hold a 2-minute plank','Do 30 squats','Do 15 burpees','Do a 2-minute HIIT circuit','Do 50 jumping jacks','Do 20 mountain climbers']
  },
  finance: {
    beginner: ['Write down your 3 biggest expenses this week','Check your bank balance right now','Identify one subscription to cancel','Set a spending limit for tomorrow','Save $1 right now','Research one investment term','Write down one financial goal','Compare prices on something you buy often'],
    intermediate: ['Review last 5 transactions and categorize them','Research one index fund','Calculate your savings rate this month','Automate one bill payment','Read about compound interest','Track every expense today','Set up a savings goal','Compare two bank interest rates'],
    advanced: ['Analyze monthly spending by category','Research one stock/ETF for 2 minutes','Calculate your net worth','Review one insurance policy','Set up automatic investing','Read about tax deductions for 2 minutes']
  },
  learning: {
    beginner: ['Learn one new word in any language','Read one paragraph of a book','Watch a 2-minute educational video','Write one interesting fact learned today','Practice mental math with 2-digit numbers','Learn one keyboard shortcut','Read one Wikipedia summary','Learn one cooking technique name'],
    intermediate: ['Learn 3 words in a new language','Read for 2 minutes from non-fiction','Watch a short tutorial on any skill','Solve one logic puzzle','Learn a new software feature','Write a summary of something learned','Practice typing for 2 minutes','Learn one historical fact'],
    advanced: ['Learn 5 words in a new language','Read a technical article for 2 minutes','Solve a coding challenge','Learn about a scientific concept','Practice instrument for 2 minutes','Write complex topic in simple terms','Teach someone one thing you know']
  },
  social: {
    beginner: ['Send a genuine compliment','Message a friend you havent talked to','Smile at 3 people today','Write a thank-you note','Ask someone how their day really went','Give genuine praise at work','Hold the door for someone','Listen for 2 minutes without interrupting'],
    intermediate: ['Call a family member for 2 minutes','Write a positive review for a business','Introduce two people who should meet','Offer to help someone','Share a helpful resource','Compliment someone publicly','Ask someone for advice','Share expertise online'],
    advanced: ['Organize a virtual coffee with a friend','Mentor someone for 2 minutes','Write a recommendation for someone','Volunteer to help a neighbor','Start a conversation with someone new','Lead team appreciation moment']
  },
  mental: {
    beginner: ['Write down 3 things you are grateful for','Breathe with eyes closed for 1 minute','Write a worry and one action to take','Spend 2 minutes in silence','Look out a window for 2 minutes','Write a positive affirmation','Name 5 see, 4 hear, 3 touch','Tidy one small area'],
    intermediate: ['Meditate for 2 minutes','Journal about your current emotion','Box breathing 4-4-4-4 for 2 minutes','Write about your ideal day','Do a body scan meditation','Name your top 3 emotions now','Write your biggest win today','Progressive muscle relaxation 2 min'],
    advanced: ['Meditate for 5 minutes','Write a letter to future self','Visualization for 2 minutes','Loving-kindness meditation','Reflect on challenge and extract lesson','Mindful eating for 2 minutes','Journal about a limiting belief and reframe']
  },
  creativity: {
    beginner: ['Doodle for 2 minutes','Write a haiku about your day','Take a photo of something interesting','Hum a tune you just made up','Describe a cloud shape as a story','Write 3 random words and connect them','List 5 unusual uses for a paperclip','Draw your mood as a shape'],
    intermediate: ['Write a 6-word story','Sketch an object without looking down','Write a poem about your surroundings','Create a color palette from nature','Design a simple logo concept','Write alternative ending to a movie','Take an artistic photo','Create a short melody'],
    advanced: ['Write a flash fiction in 2 minutes','Create a mind map of an idea','Design solution for everyday problem','Remix two song ideas together','Write a persuasive micro-essay','Create a visual metaphor','Sketch a futuristic invention']
  }
};

const MOTIVATION_QUOTES = [
  '"The compound effect is reaping huge rewards from small, smart choices." — Darren Hardy',
  '"We are what we repeatedly do. Excellence is a habit." — Aristotle',
  '"A journey of a thousand miles begins with a single step." — Lao Tzu',
  '"Small daily improvements lead to stunning results." — Robin Sharma',
  '"Motivation gets you started, habit keeps you going." — Jim Ryun',
  '"Success is the sum of small efforts repeated day in and day out." — Robert Collier',
  '"The secret of getting ahead is getting started." — Mark Twain',
  '"Discipline is choosing what you want most over what you want now."',
  '"Every action you take is a vote for who you wish to become." — James Clear',
  '"Tiny changes, remarkable results." — James Clear'
];

function getDifficultyLevel(totalCompleted) {
  if (totalCompleted < 14) return 'beginner';
  if (totalCompleted < 60) return 'intermediate';
  return 'advanced';
}

function getLocalAction(category, difficulty) {
  const cat = MICRO_ACTIONS_DB[category] || MICRO_ACTIONS_DB.health;
  const actions = cat[difficulty] || cat.beginner;
  return actions[Math.floor(Math.random() * actions.length)];
}

function getRandomQuote() {
  return MOTIVATION_QUOTES[Math.floor(Math.random() * MOTIVATION_QUOTES.length)];
}

async function generateDailyAction(category, difficulty, userHistory, goalDescription) {
  try {
    const recentActions = userHistory?.slice(0, 10).map(a => a.action_text).join(', ') || 'none';
    const prompt = `Generate ONE micro-action (2 minutes or less) for personal growth.
Category: ${category}, Difficulty: ${difficulty}, Goal: ${goalDescription || 'General improvement'}
Recent actions (avoid repeating): ${recentActions}
Respond JSON only: {"action":"<the micro-action>","duration_seconds":<60-120>,"why":"<one sentence>","xp":<10-50>,"tip":"<motivational tip>","chain_suggestion":"<a follow-up micro-action to do after>"}`;
    const response = await openai.chat.completions.create({ model: 'gpt-4o-mini', messages: [{ role: 'user', content: prompt }], response_format: { type: 'json_object' }, max_tokens: 250, temperature: 0.8 });
    return JSON.parse(response.choices[0].message.content);
  } catch {
    const action = getLocalAction(category, difficulty);
    const xp = difficulty === 'beginner' ? 10 : difficulty === 'intermediate' ? 25 : 40;
    return { action, duration_seconds: 120, why: 'Small consistent actions create massive results over time.', xp, tip: getRandomQuote(), chain_suggestion: getLocalAction(category, difficulty) };
  }
}

async function generateCompoundReport(userData) {
  try {
    const prompt = `Generate a compound growth report for this user's micro-habit journey:
${JSON.stringify(userData)}
Respond JSON only: {"title":"<title>","summary":"<2-3 sentences>","compound_effect":"<how actions compound>","total_minutes_invested":<number>,"equivalent_to":"<fun comparison>","strongest_category":"<best>","improvement_areas":["<a1>","<a2>"],"next_milestone":"<next achievement>","projected_90_day":"<projection>","motivational_quote":"<quote>","personality_type":"<habit personality>","weekly_consistency":"<consistency assessment>"}`;
    const response = await openai.chat.completions.create({ model: 'gpt-4o-mini', messages: [{ role: 'user', content: prompt }], response_format: { type: 'json_object' }, max_tokens: 500, temperature: 0.6 });
    return JSON.parse(response.choices[0].message.content);
  } catch {
    const totalMinutes = (userData.total_completed || 0) * 2;
    return {
      title: 'Your Growth Journey', summary: `You've completed ${userData.total_completed || 0} micro-actions. Every small step counts!`,
      compound_effect: 'Your daily consistency is building neural pathways for lasting change.',
      total_minutes_invested: totalMinutes, equivalent_to: `${Math.floor(totalMinutes / 60)} hours of focused self-improvement`,
      strongest_category: userData.top_category || 'health', improvement_areas: ['Try adding a new goal category', 'Increase your streak length'],
      next_milestone: `${Math.ceil((userData.total_completed || 0) / 10) * 10} total actions`,
      projected_90_day: `At this rate, ${((userData.total_completed || 0) / Math.max(userData.days_active || 1, 1) * 90).toFixed(0)} more actions!`,
      motivational_quote: getRandomQuote(), personality_type: 'Consistent Builder',
      weekly_consistency: `${userData.days_active || 0} active days`
    };
  }
}

async function generatePersonalizedAdvice(category, streak, completionRate) {
  try {
    const prompt = `Give brief personalized advice for someone building ${category} habits. Streak: ${streak} days. Completion rate: ${completionRate}%.
Respond JSON: {"advice":"<2 sentences>","adjustment":"<suggestion>","habit_stack":"<habit stacking suggestion>","reward_idea":"<reward idea for maintaining streak>"}`;
    const response = await openai.chat.completions.create({ model: 'gpt-4o-mini', messages: [{ role: 'user', content: prompt }], response_format: { type: 'json_object' }, max_tokens: 200, temperature: 0.6 });
    return JSON.parse(response.choices[0].message.content);
  } catch {
    return {
      advice: `Great job on your ${streak}-day streak! Keep the momentum going.`,
      adjustment: completionRate < 70 ? 'Try doing actions at the same time each day.' : 'You\'re doing great! Consider adding a new category.',
      habit_stack: `After your morning ${category} action, immediately follow with a 1-minute gratitude practice.`,
      reward_idea: streak >= 7 ? 'Treat yourself to something special for your week-long streak!' : 'Each completed day is its own reward.'
    };
  }
}

async function generateJournalPrompt(category, mood) {
  const prompts = {
    health: ['What did your body need today?', 'How did movement make you feel?', 'What healthy choice are you proudest of?'],
    finance: ['What spending decision felt good today?', 'What financial goal excites you most?', 'What money habit would you change?'],
    learning: ['What did you learn today that surprised you?', 'How will you apply what you learned?', 'What are you curious about?'],
    social: ['Who made you smile today?', 'How did you make someone else\'s day better?', 'What relationship matters most?'],
    mental: ['What are you grateful for right now?', 'What emotion was strongest today?', 'What would you tell your younger self?'],
    creativity: ['What inspired you today?', 'What would you create if you had no limits?', 'What pattern did you notice?']
  };
  const catPrompts = prompts[category] || prompts.mental;
  return catPrompts[Math.floor(Math.random() * catPrompts.length)];
}

module.exports = { generateDailyAction, generateCompoundReport, generatePersonalizedAdvice, generateJournalPrompt, getDifficultyLevel, getLocalAction, getRandomQuote, MICRO_ACTIONS_DB };
