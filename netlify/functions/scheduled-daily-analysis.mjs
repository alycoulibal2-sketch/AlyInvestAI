import * as analysisCore from './_lib/analysisCore.mjs';
import * as userRegistry from './_lib/userRegistry.mjs';
import * as membership from './_lib/membership.mjs';
import * as notifications from './_lib/notifications.mjs';
import * as push from './_lib/push.mjs';

// Calm, respectful reminders as the Founding Member period winds down —
// each fires exactly once. 0 = the day access pauses.
const REMINDERS = [
  { at: 30, title: 'Your Founding Member access ends in 30 days', body: "Nothing changes today — you'll keep every Premium feature until then. Thank you for helping shape Corvexsa." },
  { at: 14, title: 'Your personalized advisor will continue after your subscription begins', body: 'Two weeks of Founding access left. Corvexsa has learned your investing style — Premium keeps it watching your portfolio every day.' },
  { at: 7,  title: 'One week remaining', body: 'Your Founding Member access ends in 7 days. Whenever you decide, your advisor and everything it has learned will be waiting.' },
  { at: 2,  title: 'Your Founding Member access expires soon', body: 'Two days left. If you choose not to continue, your timeline and Advisor Memory stay safe — you can resume anytime.' },
  { at: 0,  title: 'Your Founding Member period has ended', body: 'Daily monitoring and analysis are paused. Your portfolio, timeline and Advisor Memory are untouched — resume Premium whenever you like.' },
];

async function sendDueReminders(userId, m) {
  const DAY = 24 * 3600 * 1000;
  const daysLeft = m.status === 'lapsed' ? 0
    : Math.max(0, Math.ceil((Date.parse(m.foundingEndsAt) - Date.now()) / DAY));
  let changed = false;
  for (const r of REMINDERS) {
    if (daysLeft <= r.at && !m.remindersSent.includes(r.at)) {
      await notifications.add(userId, { tag: 'update', title: r.title, body: r.body });
      await push.sendToUser(userId, { title: 'Corvexsa · ' + r.title, body: r.body, url: '/', tag: 'membership' });
      m.remindersSent.push(r.at);
      changed = true;
    }
  }
  if (changed) await membership.save(userId, m);
}

export default async () => {
  const userIds = await userRegistry.listAll();
  for (const userId of userIds) {
    try {
      const m = await membership.ensure(userId);
      if (m.status === 'founding') await sendDueReminders(userId, m);
      if (m.status === 'lapsed') {
        await sendDueReminders(userId, m); // delivers the "ended" notice once
        continue; // monitoring paused — no analysis for lapsed accounts
      }
      await analysisCore.runDailyAnalysis(userId, { manual: false });
    } catch (err) {
      console.error(`[scheduled-daily-analysis] failed for user ${userId}:`, err.message);
    }
  }
};

// Runs once a day at 07:00 UTC.
export const config = { schedule: '0 7 * * *' };
