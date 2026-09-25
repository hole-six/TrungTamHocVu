const suspiciousMojibakePattern = /[\u00c3\u00c2\u00c4\u00c6\u00e2\u00ef\u00bf\u00bd]|\u00e1[\u00ba\u00bb]/;

function mojibakeScore(value: string) {
  let score = 0;
  for (const char of value) {
    const code = char.codePointAt(0) ?? 0;
    if (code === 0xfffd) score += 8;
    if (code === 0x00c3 || code === 0x00c2 || code === 0x00c4 || code === 0x00c6) score += 4;
    if (code === 0x00e1 || code === 0x00e2) score += 2;
    if (code >= 0x0080 && code <= 0x009f) score += 3;
  }
  return score;
}

export function repairMojibakeText(value: string | null | undefined) {
  if (!value || !suspiciousMojibakePattern.test(value)) return value ?? "";

  const bytes: number[] = [];
  for (const char of value) {
    const code = char.codePointAt(0) ?? 0;
    if (code > 0xff) return value;
    bytes.push(code);
  }

  try {
    const decoded = new TextDecoder("utf-8", { fatal: false }).decode(new Uint8Array(bytes));
    return mojibakeScore(decoded) < mojibakeScore(value) ? decoded : value;
  } catch {
    return value;
  }
}
