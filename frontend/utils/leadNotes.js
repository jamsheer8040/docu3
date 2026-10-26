// Keep the original import identifiers intact when staff edit the visible notes.
function parts(notes) {
  const tracking = [], visible = [];
  for (const line of String(notes || '').split(/\r?\n/)) {
    const metadata = /^Original lead date: \d{4}-\d{2}-\d{2}\. Imported at: \S+\. Source: .+ \/ .+ \/ row \d+\.$/.test(line) ||
      /^\[Import:concept-lead:[a-f0-9]{64}:Sheet1:\d+\]$/.test(line);
    (metadata ? tracking : visible).push(line);
  }
  return { visible: visible.join('\n').trim(), tracking };
}
export const visibleLeadNotes = notes => parts(notes).visible;
export const preserveLeadTracking = (notes, original) => [String(notes || '').trim(), ...parts(original).tracking].filter(Boolean).join('\n');
