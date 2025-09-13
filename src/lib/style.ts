export function extractSignals(text: string) {
  const words = text.trim().split(/\s+/).length;
  const hasPlease = /\bplease\b/i.test(text);
  const hasThanks = /\bthank(s| you)\b/i.test(text);
  const hasExclaim = /!/g.test(text);
  const greeting = (text.match(/^(hi|hello|dear)[^\n]{0,40}/i)?.[0] ?? "").trim();
  const closing = (text.match(/\n(?:best|regards|thanks)[^\n]{0,40}$/i)?.[0] ?? "").trim();

  // crude “tone” tags
  const tone: string[] = [];
  if (hasPlease || hasThanks) tone.push("polite");
  if (!hasExclaim) tone.push("calm");
  if (words < 120) tone.push("concise");
  return {
    targetLen: Math.max(60, Math.min(180, words)), // clamp 60–180 words
    greeting: greeting || undefined,
    closing: closing || undefined,
    mustUse: hasThanks ? "Thanks" : undefined,
    tone: tone.join(", ")
  };
}

export function mergeCsv(prev?: string | null, next?: string) {
  const set = new Set<string>();
  (prev ?? "").split(",").map(s => s.trim()).filter(Boolean).forEach(s => set.add(s));
  (next ?? "").split(",").map(s => s.trim()).filter(Boolean).forEach(s => set.add(s));
  return Array.from(set).join(", ");
}
export function editDistance(a: string, b: string) {
  const dp = Array.from({length: a.length+1}, () => new Array(b.length+1).fill(0));
  for (let i=0;i<=a.length;i++) dp[i][0]=i;
  for (let j=0;j<=b.length;j++) dp[0][j]=j;
  for (let i=1;i<=a.length;i++)
    for (let j=1;j<=b.length;j++)
      dp[i][j]=a[i-1]===b[j-1]?dp[i-1][j-1]:1+Math.min(dp[i-1][j],dp[i][j-1],dp[i-1][j-1]);
  return dp[a.length][b.length];
}
