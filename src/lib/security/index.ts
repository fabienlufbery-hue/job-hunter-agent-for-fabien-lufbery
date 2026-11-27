interface RateLimitEntry {
  count: number;
  resetAt: number;
}

const buckets = new Map<string, RateLimitEntry>();

export function checkRateLimit(
  key: string,
  maxRequests: number,
  windowMs: number
): { allowed: boolean; remaining: number; resetAt: number } {
  const now = Date.now();
  const current = buckets.get(key);

  if (!current || current.resetAt <= now) {
    const resetAt = now + windowMs;
    buckets.set(key, { count: 1, resetAt });
    return { allowed: true, remaining: Math.max(0, maxRequests - 1), resetAt };
  }

  if (current.count >= maxRequests) {
    return { allowed: false, remaining: 0, resetAt: current.resetAt };
  }

  current.count += 1;
  return {
    allowed: true,
    remaining: Math.max(0, maxRequests - current.count),
    resetAt: current.resetAt,
  };
}

export function getClientIp(request: Request): string {
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) {
    return forwarded.split(',')[0]?.trim() || 'unknown';
  }
  return request.headers.get('x-real-ip') || 'local';
}

/**
 * Sanitizes untrusted text (CVs, job descriptions, scraped DOM fields) before passing to LLMs.
 * Strips ASCII control characters, neutralizes delimiter tag spoofing, and enforces a max length.
 */
export function sanitizeUntrustedForPrompt(input: string, maxLength = 15000): string {
  if (!input) return '';
  return input
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, ' ')
    .replace(/<\/?(UNTRUSTED_[A-Z_]+|SYSTEM|INSTRUCTION|ASSISTANT|USER)>/gi, '[TAG_REMOVED]')
    .replace(/\r\n/g, '\n')
    .trim()
    .slice(0, maxLength);
}

/**
 * Detects potential prompt injection patterns for logging / audit visibility.
 * We never trust user/job text as instructions regardless of detection.
 */
export function detectPromptInjectionPatterns(input: string): string[] {
  const patterns: Array<{ label: string; regex: RegExp }> = [
    { label: 'ignore_previous', regex: /ignore\s+(all\s+)?(previous|prior|above)\s+instructions?/i },
    { label: 'system_override', regex: /\b(system\s*prompt|you\s+are\s+now|act\s+as\s+system)\b/i },
    { label: 'force_score', regex: /\b(give|set|return|output)\s+(a\s+)?(fit_score|score)\s*(of|=|:)?\s*10\b/i },
    { label: 'exfiltrate', regex: /\b(reveal|print|leak)\s+(your\s+)?(api\s*key|secret|env|system\s+prompt)\b/i },
  ];
  return patterns.filter((p) => p.regex.test(input)).map((p) => p.label);
}

export function isValidHttpUrl(rawUrl: string): boolean {
  try {
    const parsed = new URL(rawUrl);
    return !parsed.username && !parsed.password && ['https:', 'http:'].includes(parsed.protocol);
  } catch {
    return false;
  }
}

export function resetRateLimitsForTests(): void {
  buckets.clear();
}
