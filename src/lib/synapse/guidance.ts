// Interim/final transitions and punctuation alone do not warrant another AI call.
export function spokenWords(text: string): string {
  return (text.toLocaleLowerCase().match(/[\p{L}\p{N}]+/gu) || []).join(" ");
}
