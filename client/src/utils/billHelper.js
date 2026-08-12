/**
 * Helper utilities to parse bill due dates and check urgency thresholds.
 */

export function parseDueDays(dueIn) {
  if (!dueIn) return 999;
  const str = String(dueIn).toLowerCase().trim();
  if (str.includes("today") || str.includes("0 day") || str.includes("now") || str === "0") return 0;
  if (str.includes("1 day") || str.includes("tomorrow") || str === "1") return 1;
  if (str.includes("2 day") || str === "2") return 2;
  if (str.includes("3 day") || str === "3") return 3;
  if (str.includes("7 day")) return 7;
  if (str.includes("15 day")) return 15;
  if (str.includes("month")) return 30;

  const match = str.match(/^(\d+)/);
  if (match) return parseInt(match[1], 10);

  const parsedDate = Date.parse(dueIn);
  if (!isNaN(parsedDate)) {
    const diffMs = parsedDate - new Date().setHours(0, 0, 0, 0);
    const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
    return Math.max(0, diffDays);
  }

  return 999;
}

export function isDueWithinDays(dueIn, maxDays) {
  return parseDueDays(dueIn) <= maxDays;
}
