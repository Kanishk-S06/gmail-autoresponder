export function buildStyleHint(profile?: {
  preferredTone?: string|null; preferredLang?: string|null;
  greeting?: string|null; closing?: string|null;
  mustUse?: string|null; mustAvoid?: string|null; avgLength?: number|null;
}) {
  if (!profile) return "Style: default professional; Language: en; Length: concise.";
  const lang = profile.preferredLang ?? "en";
  const tone = profile.preferredTone ?? "concise, calm, polite";
  const greet = profile.greeting ?? "Hi {first}";
  const close = profile.closing ?? "Best, Kanishk";
  const include = profile.mustUse ? `Must-include phrases: ${profile.mustUse}.` : "";
  const avoid = profile.mustAvoid ? `Avoid phrases: ${profile.mustAvoid}.` : "";
  const len = profile.avgLength ? `Target length ~${profile.avgLength} words.` : "Target length ~120 words.";
  return `Language: ${lang}. Tone: ${tone}. Greeting: "${greet}". Closing: "${close}". ${include} ${avoid} ${len}`;
}
