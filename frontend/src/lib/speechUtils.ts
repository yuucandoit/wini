/**
 * Speech utilities for WINI AI.
 *
 * Strips markdown asterisks, hashes, links, and symbols so Web Speech API
 * reads text naturally in Indonesian without pronouncing "asterisk asterisk",
 * "tanda pagar", or "titik dua".
 */

export function cleanTextForSpeech(text: string): string {
  if (!text) return "";

  let cleaned = text;

  // 1. Remove markdown bold and italic: **bold**, *italic*, __bold__, _italic_
  cleaned = cleaned.replace(/\*\*([^*]+)\*\*/g, "$1");
  cleaned = cleaned.replace(/\*([^*]+)\*/g, "$1");
  cleaned = cleaned.replace(/__([^_]+)__/g, "$1");
  cleaned = cleaned.replace(/_([^_]+)_/g, "$1");

  // 2. Remove markdown headings (e.g. # H1, ## H2, ### H3)
  cleaned = cleaned.replace(/^#{1,6}\s+/gm, "");

  // 3. Remove bullet points (- item, * item, • item, or 1. item)
  cleaned = cleaned.replace(/^[\*\-\•]\s+/gm, "");
  cleaned = cleaned.replace(/^\d+\.\s+/gm, "");

  // 4. Remove links [text](url) -> text
  cleaned = cleaned.replace(/\[([^\]]+)\]\([^)]+\)/g, "$1");

  // 5. Remove quotes and backticks
  cleaned = cleaned.replace(/[`"]/g, "");

  // 6. Remove common UI emojis and icons so TTS doesn't describe them
  cleaned = cleaned.replace(
    /[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F700}-\u{1F77F}\u{1F780}-\u{1F7FF}\u{1F800}-\u{1F8FF}\u{1F900}-\u{1F9FF}\u{1FA00}-\u{1FA6F}\u{1FA70}-\u{1FAFF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{FE00}-\u{FE0F}]/gu,
    ""
  );

  // 7. Convert dashes into natural speech pauses
  cleaned = cleaned.replace(/[—–]/g, ", ");
  cleaned = cleaned.replace(/&amp;/g, "dan");

  // 8. Convert multiple newlines into sentence pauses, single newlines into comma pauses
  cleaned = cleaned.replace(/\n{2,}/g, ". ");
  cleaned = cleaned.replace(/\n/g, ", ");
  cleaned = cleaned.replace(/\s{2,}/g, " ");

  // 9. Fix double punctuation resulting from conversions (e.g. ".. " -> ". ")
  cleaned = cleaned.replace(/\.+/g, ".");
  cleaned = cleaned.replace(/,\s*\./g, ".");
  cleaned = cleaned.replace(/\.\s*,/g, ".");
  cleaned = cleaned.replace(/,\s*,/g, ",");

  return cleaned.trim();
}
