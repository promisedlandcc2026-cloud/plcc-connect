import { CHURCH_INFO, MINISTRIES, ANNOUNCEMENTS, UPCOMING_EVENTS as FALLBACK_EVENTS } from '../data';
import { isPlaceholderSermon } from './memberHomeData';
import { supabase } from './supabase';
import {
  churchDateKey,
  formatTodaysWordLine,
  getTodaysWord,
} from './todaysWord';

const openaiKey =
  (import.meta.env.VITE_OPENAI_API_KEY as string | undefined)?.trim() ||
  (import.meta.env.OPENAI_API_KEY as string | undefined)?.trim() ||
  '';
const geminiKey = (import.meta.env.VITE_GEMINI_API_KEY as string | undefined)?.trim() || '';

const CONNECT_ERROR =
  "I'm having a little trouble connecting right now. Please try again or call us at " +
  CHURCH_INFO.phone +
  '.';
const NOT_CONFIGURED =
  'The AI assistant is not configured yet. Please use the Connect Card or call us at ' +
  CHURCH_INFO.phone +
  '.';

async function buildSystemContext(): Promise<string> {
  let liveEvents = FALLBACK_EVENTS;
  let liveTeams = MINISTRIES;
  let liveAnnouncements = ANNOUNCEMENTS;
  let sermonInfo = 'No published sermon message is available right now.';
  let givingInfo = 'Online, Text, or Mail.';
  let todaysWordInfo = formatTodaysWordLine(getTodaysWord());

  try {
    const today = churchDateKey();
    const [eventsRes, teamsRes, annRes, sermonRes, givingRes, inspoRes] = await Promise.all([
      supabase
        .from('events')
        .select('*')
        .gte('starts_at', new Date().toISOString())
        .order('starts_at', { ascending: true })
        .limit(5),
      supabase.from('teams').select('*'),
      supabase.from('announcements').select('*').order('created_at', { ascending: false }).limit(3),
      supabase
        .from('sermons')
        .select('*')
        .lte('date', today)
        .order('date', { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase.from('giving_settings').select('*').maybeSingle(),
      supabase
        .from('daily_inspiration')
        .select('text, reference')
        .eq('publish_date', today)
        .maybeSingle(),
    ]);

    if (!eventsRes.error && eventsRes.data?.length) liveEvents = eventsRes.data;
    if (!teamsRes.error && teamsRes.data?.length) liveTeams = teamsRes.data;
    if (!annRes.error && annRes.data?.length) liveAnnouncements = annRes.data;

    if (!sermonRes.error && sermonRes.data && !isPlaceholderSermon(sermonRes.data)) {
      const s = sermonRes.data;
      sermonInfo = `Latest published message: "${s.title}" from ${s.scripture} (${s.book}). Speaker: ${s.speaker}.`;
    }

    if (!givingRes.error && givingRes.data) {
      const g = givingRes.data;
      givingInfo = `Ways to Give: Online at ${g.online_url}, Text to give by texting "GIVE" to ${g.text_number}, or Mail to ${g.mail_address}.`;
    }

    if (!inspoRes.error && inspoRes.data?.text) {
      const ref = inspoRes.data.reference ? ` (${inspoRes.data.reference})` : '';
      todaysWordInfo = `Admin scripture of the day: "${inspoRes.data.text}"${ref}`;
    }
  } catch (err) {
    console.error('AI Context Fetch Error:', err);
  }

  return `
    You are the AI Assistant for Promised Land Christian Center (PLCC). 
    Your tone is warm, welcoming, and helpful.
    
    CHURCH DATABASE:
    - Name: ${CHURCH_INFO.name}
    - Motto: ${CHURCH_INFO.motto}
    - Address: ${CHURCH_INFO.address}
    - Phone: ${CHURCH_INFO.phone}
    - Schedule: ${JSON.stringify(CHURCH_INFO.schedule)}
    - Ministry Teams: ${JSON.stringify(liveTeams)}
    - Announcements: ${JSON.stringify(liveAnnouncements)}
    - Upcoming Events: ${JSON.stringify(liveEvents)}
    - Today's Word (shared verse of the day for everyone): ${todaysWordInfo}
    - Latest Message: ${sermonInfo}
    - Giving: ${givingInfo}

    INSTRUCTIONS:
    1. Answer concisely and encouragingly.
    2. If asked for a bible verse for today, today's scripture, or Today's Word, use "Today's Word" — quote the verse and reference. Do not invent a different verse.
    3. If asked about the sermon or latest message, use "Latest Message" only when real data is present. Never invent placeholder titles or pastor names.
    4. If asked how to give or for the giving number/link, use the "Giving" data.
    5. If asked about visiting or planning a visit, guide them to the "Plan a Visit" action in the app.
    6. If asked about what's happening at the church or the schedule, guide them to the "Upcoming Events" section.
    7. If a user expresses interest in serving, direct them to Ministries or the Connect Card.
    8. If you don't have specific information, ask them to use the Connect Card or call ${CHURCH_INFO.phone}.
  `;
}

async function askOpenAI(userPrompt: string, context: string, apiKey: string): Promise<string> {
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      temperature: 0.7,
      messages: [
        { role: 'system', content: context },
        { role: 'user', content: userPrompt },
      ],
    }),
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => '');
    throw new Error(`OpenAI ${response.status}: ${detail.slice(0, 200)}`);
  }

  const data = (await response.json()) as {
    choices?: Array<{ message?: { content?: string | null } }>;
  };
  const text = data.choices?.[0]?.message?.content?.trim() ?? '';
  if (!text) throw new Error('OpenAI returned empty content');
  return text;
}

async function askGemini(userPrompt: string, context: string, apiKey: string): Promise<string> {
  // Lazy-load so OpenAI-only installs do not pull Gemini until fallback runs.
  const { GoogleGenAI } = await import('@google/genai');
  const ai = new GoogleGenAI({ apiKey });
  // gemini-2.0-flash-lite shut down June 2026 — use current Flash-Lite.
  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash-lite',
    contents: userPrompt,
    config: {
      systemInstruction: context,
      temperature: 0.7,
    },
  });
  const text = typeof response.text === 'string' ? response.text.trim() : '';
  if (!text) throw new Error('Gemini returned empty content');
  return text;
}

export const askAWCAssistant = async (userPrompt: string) => {
  if (!openaiKey && !geminiKey) {
    return NOT_CONFIGURED;
  }

  const context = await buildSystemContext();

  if (openaiKey) {
    try {
      return await askOpenAI(userPrompt, context, openaiKey);
    } catch (error) {
      console.error('AI Assistant OpenAI Error (falling back to Gemini):', error);
    }
  }

  if (geminiKey) {
    try {
      return await askGemini(userPrompt, context, geminiKey);
    } catch (error) {
      console.error('AI Assistant Gemini Error:', error);
    }
  }

  return CONNECT_ERROR;
};
