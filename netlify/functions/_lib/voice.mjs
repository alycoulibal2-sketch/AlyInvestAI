// Neural text-to-speech for the advisor's spoken voice, via the same
// msedge-tts engine that narrates the promo video (free, high quality).
//
// The client only ever sends a voice *id* from the whitelist below — an
// arbitrary string is never handed to the TTS engine.

import { MsEdgeTTS, OUTPUT_FORMAT } from 'msedge-tts';

// Curated advisor voices (id → Microsoft neural voice). Kept in sync with the
// picker in the frontend settings panel.
export const VOICES = {
  jenny:  { edge: 'en-US-JennyNeural',              label: 'Jenny',  tone: 'Warm' },
  ava:    { edge: 'en-US-AvaMultilingualNeural',    label: 'Ava',    tone: 'Natural' },
  aria:   { edge: 'en-US-AriaNeural',               label: 'Aria',   tone: 'Bright' },
  guy:    { edge: 'en-US-GuyNeural',                label: 'Guy',    tone: 'Warm' },
  andrew: { edge: 'en-US-AndrewMultilingualNeural', label: 'Andrew', tone: 'Natural' },
  eric:   { edge: 'en-US-EricNeural',               label: 'Eric',   tone: 'Steady' },
};
export const DEFAULT_VOICE = 'aria';

export function resolveVoice(id) {
  return VOICES[id] ? id : DEFAULT_VOICE;
}

// Synthesize text → MP3 Buffer. Collects the msedge-tts stream to a buffer so
// the caller can return it directly (or base64 it into a JSON response).
export async function synthesize(text, voiceId) {
  const v = VOICES[resolveVoice(voiceId)];
  const clean = (text || '').toString().slice(0, 1500).trim();
  if (!clean) throw new Error('Nothing to speak');

  const tts = new MsEdgeTTS();
  await tts.setMetadata(v.edge, OUTPUT_FORMAT.AUDIO_24KHZ_48KBITRATE_MONO_MP3);
  const { audioStream } = tts.toStream(clean, { rate: '+3%' });

  const chunks = [];
  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('TTS timed out')), 25000);
    audioStream.on('data', (c) => chunks.push(c));
    audioStream.on('end', () => { clearTimeout(timer); resolve(); });
    audioStream.on('error', (e) => { clearTimeout(timer); reject(e); });
  });

  const buf = Buffer.concat(chunks);
  if (buf.length < 500) throw new Error('TTS returned empty audio');
  return buf;
}

// A structured advisor_reply → natural spoken text. Speak the answer and the
// reasoning, then a single gentle recommendation line; the technical block is
// for reading, not speaking.
const ACTION_PHRASE = {
  Buy: 'My recommendation: consider buying.',
  Reduce: 'My recommendation: consider trimming that position.',
  Hold: 'My recommendation is to hold for now.',
  Wait: 'My recommendation is to wait for now.',
  Monitor: "My recommendation: let's keep an eye on it.",
  Rebalance: 'My recommendation: consider rebalancing.',
};

export function composeSpokenText(reply) {
  if (!reply) return '';
  const parts = [];
  if (reply.shortAnswer) parts.push(reply.shortAnswer.trim());
  if (reply.explanation) parts.push(reply.explanation.trim());
  const phrase = reply.action && reply.action !== 'None' ? ACTION_PHRASE[reply.action] : null;
  if (phrase) parts.push(phrase);
  return parts.join(' ').replace(/\s+/g, ' ').trim();
}

export const PREVIEW_LINE =
  "Good morning. Your portfolio held steady overnight. Technology is still your largest position, but nothing today needs your attention — I'd hold for now.";
