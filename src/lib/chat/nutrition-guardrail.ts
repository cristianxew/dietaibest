/**
 * Deterministic nutrition guardrail (DIE-36, Layer 2).
 *
 * Layer 1 (system prompt) forbids the model from emitting macro numbers in
 * prose. This module is the safety net: a regex post-pass that scans streamed
 * text for nutrition-adjacent numbers and redacts any that did not appear in a
 * tool result this turn.
 *
 * Design constraint (locked decision): deterministic, no fuzzy tolerance. A
 * number must match an integer-rounded value in `groundedValues` exactly, or
 * it gets redacted. The structured nutrition card keeps fractional precision;
 * prose only refers to integer macros.
 */

const NUTRITION_KEYWORD = /\b(k?cal|calor(?:i|í)as?|calories|protein|prote(?:i|í)na|carbs?|carbohydrates?|hidratos|fat|grasa|fiber|fibra)\b/i;

// Lookarounds (not word boundaries) so embedded numbers like "30g" still match:
// `\b` does not fire between two word characters (digit→letter), so "30g" would
// be skipped. Lookarounds keep numbers grouped while allowing them next to
// letter unit suffixes.
const NUMBER_PATTERN = /(?<!\d)\d+(?:[.,]\d+)?(?!\d)/g;

/**
 * Find all integer-roundable numbers in `text` that sit within
 * NUTRITION_PROXIMITY characters of a nutrition keyword.
 */
const NUTRITION_PROXIMITY = 30;

export type GuardrailResult = {
  text: string;
  redactedCount: number;
};

export function redactUngroundedNutrition(
  text: string,
  groundedValues: ReadonlySet<number>,
  opts: {
    /**
     * Whether `text[0]` sits at the start of a line in the full output. True
     * for whole-text calls; StreamingGuardrail passes its tracked state since
     * its windows can start mid-sentence. Ignored when `precedingContext` is
     * non-empty (derived from its last character instead).
     */
    startsAtLineStart?: boolean;
    /**
     * Tail of the already-emitted text (≤ NUTRITION_PROXIMITY chars). Without
     * it, a keyword flushed in the previous window ("calorías de ") can no
     * longer vouch for a number arriving in this one ("450"), and the number
     * leaks. Used for the proximity check only — never re-emitted.
     */
    precedingContext?: string;
  } = {}
): GuardrailResult {
  let redactedCount = 0;
  const context = opts.precedingContext ?? "";
  const startsAtLineStart =
    context.length > 0
      ? context.endsWith("\n")
      : opts.startsAtLineStart ?? true;

  // Normalize grounded set to rounded integers — callers may pass raw FDC
  // values like 219.7 and the prose only carries integer macros.
  const rounded = new Set<number>();
  for (const v of groundedValues) rounded.add(Math.round(v));

  const combined = context + text;
  const replaced = text.replace(NUMBER_PATTERN, (match, offset: number) => {
    // List ordinals ("6." / "6)" at the start of a line) are enumeration
    // markers, not macro values — exempt them even inside keyword proximity.
    // A leaked macro would have to be a bare line-leading integer immediately
    // followed by "."/")" to slip through, which prose never produces.
    const lineStart =
      offset === 0 ? startsAtLineStart : text[offset - 1] === "\n";
    const after = text[offset + match.length];
    if (lineStart && (after === "." || after === ")")) return match;

    const combinedOffset = offset + context.length;
    const windowStart = Math.max(0, combinedOffset - NUTRITION_PROXIMITY);
    const windowEnd = Math.min(
      combined.length,
      combinedOffset + match.length + NUTRITION_PROXIMITY
    );
    const window = combined.slice(windowStart, windowEnd);

    if (!NUTRITION_KEYWORD.test(window)) return match;

    const normalized = Math.round(Number(match.replace(",", ".")));
    if (Number.isFinite(normalized) && rounded.has(normalized)) {
      return match;
    }

    redactedCount++;
    return "[…]";
  });

  return { text: replaced, redactedCount };
}

/**
 * Stateful guardrail buffered across streaming chunks. Numbers can be split
 * across chunk boundaries — buffer the trailing partial token, flush on
 * whitespace/punctuation, and emit redacted chunks downstream.
 */
export class StreamingGuardrail {
  private buffer = "";
  private redactedTotal = 0;
  private readonly grounded: Set<number>;
  // Tail (≤ NUTRITION_PROXIMITY chars) of everything processed so far. Feeds
  // the redactor's backward proximity check across window boundaries and the
  // line-start detection for the list-ordinal exemption. "" = stream start.
  private tail = "";

  constructor(initialGrounded: Iterable<number> = []) {
    this.grounded = new Set();
    for (const n of initialGrounded) this.grounded.add(Math.round(n));
  }

  addGroundedValues(values: Iterable<number>): void {
    for (const n of values) this.grounded.add(Math.round(n));
  }

  private redactWindow(window: string): GuardrailResult {
    const result = redactUngroundedNutrition(window, this.grounded, {
      startsAtLineStart: true, // stream start counts as a line start
      precedingContext: this.tail,
    });
    this.tail = (this.tail + window).slice(-NUTRITION_PROXIMITY);
    this.redactedTotal += result.redactedCount;
    return result;
  }

  /**
   * Push a streamed chunk. Returns the safe-to-emit prefix; any incomplete
   * trailing token is kept in the buffer for the next push().
   */
  push(chunk: string): GuardrailResult {
    this.buffer += chunk;

    // Find the last safe boundary — last whitespace or sentence punctuation.
    const safeBoundary = Math.max(
      this.buffer.lastIndexOf(" "),
      this.buffer.lastIndexOf("\n"),
      this.buffer.lastIndexOf(".")
    );

    if (safeBoundary < 0) {
      return { text: "", redactedCount: 0 };
    }

    const ready = this.buffer.slice(0, safeBoundary + 1);
    this.buffer = this.buffer.slice(safeBoundary + 1);

    return this.redactWindow(ready);
  }

  /** Flush any remaining buffer at end-of-stream. */
  flush(): GuardrailResult {
    if (!this.buffer) return { text: "", redactedCount: 0 };
    const window = this.buffer;
    this.buffer = "";
    return this.redactWindow(window);
  }

  get totalRedactions(): number {
    return this.redactedTotal;
  }
}
