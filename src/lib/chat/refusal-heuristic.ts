/**
 * Heuristic detection for medical-advice refusals (decision #117).
 *
 * v1 has no classifier. The system prompt is the only enforcement layer; this
 * function is purely for telemetry — it flags assistant turns that look like
 * a refusal so a weekly cron can count them and surface false-negative drift
 * for manual review. Misses are acceptable; false positives just inflate the
 * weekly count, not user behaviour.
 *
 * The keywords are multilingual (en/es/pl) so the same heuristic works across
 * locales without per-locale branching.
 */

const REFUSAL_PATTERNS: RegExp[] = [
  // English: refuse phrasing + redirect target
  /can(?:not|'t)\s+(?:give|provide|offer)\s+(?:you\s+)?medical\s+advice/i,
  /not\s+a\s+(?:doctor|clinician|medical\s+professional)/i,
  /(?:healthcare|medical)\s+professional/i,
  /\b(?:registered\s+)?dietitian\b/i,
  /talk\s+to\s+(?:a|your)\s+(?:doctor|gp|physician|dietitian|nutritionist)/i,

  // Spanish
  /no\s+(?:te\s+)?puedo\s+(?:asesorar|aconsejar|dar(?:te|le)?\s+(?:un\s+)?consejos?\s+m[eé]dic)/i,
  /no\s+soy\s+m[eé]dic[oa]/i,
  /consult[aá]\s+(?:con\s+)?(?:un|una|tu|el|la)?\s*(?:profesional|m[eé]dic[oa]|nutricionista)/i,
  /profesional\s+de\s+la\s+salud/i,

  // Polish: lekarz / dietetyk / nie mogę udzielać porad medycznych
  /nie\s+mog[ęe]\s+udziel(?:a[ćc]|i[ćc])\s+porad\s+medyczn/i,
  /skonsultuj\s+si[ęe]\s+z\s+(?:lekarz|dietetyk|specjalist)/i,
];

export function looksLikeRefusal(text: string): boolean {
  if (!text || text.length < 20) return false;
  return REFUSAL_PATTERNS.some((re) => re.test(text));
}
