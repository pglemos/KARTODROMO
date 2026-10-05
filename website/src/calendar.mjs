const escape = (text) =>
  text
    .replace(/\\/g, "\\\\")
    .replace(/\n/g, "\\n")
    .replace(/,/g, "\\,")
    .replace(/;/g, "\\;");
function foldLine(line) {
  const encoder = new TextEncoder();
  let result = "",
    chunk = "",
    bytes = 0;
  for (const char of line) {
    const size = encoder.encode(char).length;
    if (bytes + size > 75) {
      result += chunk + "\r\n";
      chunk = " ";
      bytes = 1;
    }
    chunk += char;
    bytes += size;
  }
  return result + chunk;
}
export function calendarEvent(c) {
  if (!/^\d{2}\/\d{2}\/\d{4}$/.test(c.date)) return null;
  const [d, m, y] = c.date.split("/").map(Number);
  const end = new Date(Date.UTC(y, m - 1, d + 1))
    .toISOString()
    .slice(0, 10)
    .replace(/-/g, "");
  const start = `${y}${String(m).padStart(2, "0")}${String(d).padStart(2, "0")}`;
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Kartodromo Internacional de Betim//Calendario//PT-BR",
    "CALSCALE:GREGORIAN",
    "BEGIN:VEVENT",
    `UID:${c.id}-${start}@kartodromodebetim.com.br`,
    "DTSTAMP:20261005T000000Z",
    `DTSTART;VALUE=DATE:${start}`,
    `DTEND;VALUE=DATE:${end}`,
    `SUMMARY:${escape(c.name)}`,
    `DESCRIPTION:${escape(c.intro + "\nConsulte o cronograma oficial e confirme a inscrição com a organização.")}`,
    "LOCATION:Kartódromo Internacional de Betim\\, Av. Adutora Várzea das Flores 477\\, Betim MG",
    `URL:https://kartodromodebetim.com.br/${c.id}`,
    "END:VEVENT",
    "END:VCALENDAR",
  ];
  return lines.map(foldLine).join("\r\n") + "\r\n";
}
export function downloadCalendar(c) {
  const content = calendarEvent(c);
  if (!content) return;
  const url = URL.createObjectURL(
    new Blob([content], { type: "text/calendar;charset=utf-8" }),
  );
  const a = document.createElement("a");
  a.href = url;
  a.download = `${c.id}-${c.year}.ics`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
