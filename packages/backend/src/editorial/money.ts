// Repair only an unambiguous English USD scale copied with the same coefficient and a wrong Chinese unit.
// This does not guess exchange rates, repair changed coefficients, or reinterpret non-money quantities.
const ENGLISH_SCALE: Record<string, number> = { million: 1e6, billion: 1e9, trillion: 1e12 };
const CHINESE_SCALE: Record<string, number> = { 万: 1e4, 亿: 1e8, 万亿: 1e12 };
const valueOf = (s: string) => Number(s.replaceAll(",", ""));
const same = (a: number, b: number) => Math.abs(a - b) <= Math.max(1, Math.abs(a), Math.abs(b)) * 1e-12;

export function correctUsdScale(source: string, copy: string): string {
  const amounts: Array<{ coefficient: number; value: number }> = [];
  // An unqualified dollar symbol is ambiguous when the material explicitly discusses other dollar currencies.
  const ambiguousDollar = /\b(?:CAD|AUD|HKD|SGD|Canadian|Australian|Hong Kong|Singapore)\b/i.test(source);
  for (const match of source.matchAll(/(US\$|USD|\$)\s*(\d[\d,]*(?:\.\d+)?)\s*(million|billion|trillion)\b/gi)) {
    if (match[1] === "$" && ambiguousDollar) continue;
    const coefficient = valueOf(match[2]!);
    const value = coefficient * ENGLISH_SCALE[match[3]!.toLowerCase()]!;
    if (Number.isFinite(value) && value > 0 && value <= Number.MAX_SAFE_INTEGER) amounts.push({ coefficient, value });
  }
  return copy.replace(/(\d[\d,]*(?:\.\d+)?)\s*(万亿|亿|万)\s*美元/g, (whole, raw: string, unit: string) => {
    const coefficient = valueOf(raw);
    const value = coefficient * CHINESE_SCALE[unit]!;
    if (amounts.some(a => same(a.value, value))) return whole;
    const possible = [...new Set(amounts.filter(a => same(a.coefficient, coefficient)).map(a => a.value))];
    if (possible.length !== 1) return whole;
    const expected = possible[0]!;
    const targetUnit = expected >= 1e12 ? "万亿" : expected >= 1e8 ? "亿" : "万";
    const scaled = expected / CHINESE_SCALE[targetUnit]!;
    // Preserve exact decimals rather than rounding a source amount into a different number.
    const formatted = Number(scaled.toFixed(8)).toString();
    if (!same(Number(formatted) * CHINESE_SCALE[targetUnit]!, expected)) return whole;
    return `${formatted} ${targetUnit}美元`;
  });
}
