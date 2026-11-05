export const WHATS = "https://wa.me/5531998842898";
export const MAPS =
  "https://www.google.com/maps/search/?api=1&query=Kart%C3%B3dromo+Internacional+de+Betim";
export const TERMINAL = new Set([
  "confirmado",
  "recusado",
  "expirado",
  "pago_sem_vaga",
  "erro_pagamento",
  "nao_encontrada",
]);
export const UUID =
  /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
export const digits = (v) => String(v || "").replace(/\D/g, "");
export const money = (c) =>
  (Number(c) / 100).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
export function timestamp(start) {
  return Date.parse(
    /(?:Z|[+-]\d{2}:\d{2})$/.test(start || "") ? start : `${start}:00-03:00`,
  );
}
export function dayLabel(day, options = {}) {
  if (!day) return "Escolha a data";
  return new Date(`${day.slice(0, 10)}T12:00:00-03:00`).toLocaleDateString(
    "pt-BR",
    {
      timeZone: "America/Sao_Paulo",
      weekday: "long",
      day: "numeric",
      month: "long",
      ...options,
    },
  );
}
export function monthLabel(month) {
  return new Date(`${month}-01T12:00:00-03:00`).toLocaleDateString("pt-BR", {
    timeZone: "America/Sao_Paulo",
    month: "long",
    year: "numeric",
  });
}
export const timeLabel = (start) => (start || "").slice(11, 16);
export function arrival(start) {
  if (!Number.isFinite(timestamp(start))) return "";
  return new Date(timestamp(start) - 3600000).toLocaleTimeString("pt-BR", {
    timeZone: "America/Sao_Paulo",
    hour: "2-digit",
    minute: "2-digit",
  });
}
export function availability(agenda, now = Date.now()) {
  return (agenda?.horarios || [])
    .filter(
      (h) =>
        Number.isInteger(h.id) &&
        h.livres > 0 &&
        timestamp(h.inicio) > now + (agenda.antecedenciaMin || 0) * 60000,
    )
    .sort((a, b) => a.inicio.localeCompare(b.inicio));
}
export const maskCPF = (v) =>
  digits(v)
    .slice(0, 11)
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d{1,2})$/, "$1-$2");
export const maskDOB = (v) =>
  digits(v)
    .slice(0, 8)
    .replace(/(\d{2})(\d)/, "$1/$2")
    .replace(/(\d{2})(\d)/, "$1/$2");
export function maskPhone(v) {
  const d = digits(v).slice(0, 11);
  if (d.length <= 2) return d ? `(${d}` : "";
  return d.length <= 10
    ? d.replace(/^(\d{2})(\d{0,4})(\d*)$/, "($1) $2-$3").replace(/-$/, "")
    : d.replace(/^(\d{2})(\d{5})(\d*)$/, "($1) $2-$3");
}
export function cpfValid(v) {
  const d = digits(v);
  if (d.length !== 11 || /^(\d)\1{10}$/.test(d)) return false;
  for (const t of [9, 10]) {
    let sum = 0;
    for (let i = 0; i < t; i++) sum += Number(d[i]) * (t + 1 - i);
    if (((sum * 10) % 11) % 10 !== Number(d[t])) return false;
  }
  return true;
}
export function isoDOB(v) {
  const match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(v);
  if (!match) return "";
  const iso = `${match[3]}-${match[2]}-${match[1]}`;
  const date = new Date(`${iso}T12:00:00Z`);
  return Number.isFinite(date.getTime()) &&
    date.toISOString().slice(0, 10) === iso
    ? iso
    : "";
}
export function age(dob, now = new Date()) {
  const today = now.toLocaleDateString("en-CA", {
    timeZone: "America/Sao_Paulo",
  });
  const [y, m, d] = today.split("-").map(Number);
  const [by, bm, bd] = dob.split("-").map(Number);
  return y - by - (m < bm || (m === bm && d < bd) ? 1 : 0);
}
export function validateCustomer(c, now = new Date()) {
  const errors = {};
  if (!cpfValid(c.documento))
    errors.documento = "Confira os 11 números do CPF.";
  if (c.nome.trim().split(/\s+/).length < 2)
    errors.nome = "Informe nome e sobrenome.";
  if (digits(c.telefone).length < 10)
    errors.telefone = "Informe um celular com DDD.";
  if (c.email && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(c.email.trim()))
    errors.email = "Confira o endereço de e-mail.";
  const dob = isoDOB(c.nascimento);
  if (!dob) errors.nascimento = "Use uma data válida: DD/MM/AAAA.";
  else if (age(dob, now) < 18 || age(dob, now) >= 110)
    errors.nascimento =
      "A reserva deve ser feita por um adulto de 18 anos ou mais. Confira a data.";
  if (
    c.peso &&
    (!Number.isFinite(Number(c.peso)) ||
      Number(c.peso) < 15 ||
      Number(c.peso) > 250)
  )
    errors.peso = "Informe um peso entre 15 e 250 kg, ou deixe em branco.";
  return errors;
}
export function safeInvoice(url) {
  try {
    const u = new URL(url);
    return u.protocol === "https:" &&
      (u.hostname === "asaas.com" || u.hostname.endsWith(".asaas.com"))
      ? u.href
      : null;
  } catch {
    return null;
  }
}
export function rememberedOrder() {
  const hash = new URLSearchParams(location.hash.slice(1)).get("p");
  if (hash && UUID.test(hash)) return hash;
  try {
    const id = localStorage.getItem("kib-reserva");
    return UUID.test(id || "") ? id : null;
  } catch {
    return null;
  }
}
export function rememberOrder(id) {
  try {
    if (id) localStorage.setItem("kib-reserva", id);
    else localStorage.removeItem("kib-reserva");
  } catch {
    /* Storage may be disabled. The URL still permits recovery. */
  }
  history.replaceState(
    null,
    "",
    location.pathname + location.search + (id ? `#p=${id}` : ""),
  );
}
export async function api(path, options = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);
  const previa = new URLSearchParams(location.search).get("previa");
  try {
    const response = await fetch(path, {
      ...options,
      cache: "no-store",
      signal: controller.signal,
      headers: {
        ...(previa ? { "x-previa": previa } : {}),
        ...options.headers,
      },
    });
    let data;
    try {
      data = await response.json();
    } catch {
      throw new Error("A resposta não pôde ser verificada. Confira a conexão.");
    }
    if (!response.ok) {
      const error = new Error(data.erro || "Não foi possível carregar agora.");
      error.status = response.status;
      throw error;
    }
    return data;
  } finally {
    clearTimeout(timeout);
  }
}
export function calendarFile(order) {
  const start = timestamp(order.inicio) - 3600000;
  const stamp = (value) =>
    new Date(value)
      .toISOString()
      .replace(/[-:]/g, "")
      .replace(/\.\d{3}/, "");
  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Kartodromo de Betim//Reservas//PT-BR",
    "BEGIN:VEVENT",
    `UID:${order.id}@reservas.kartodromodebetim.com.br`,
    `DTSTAMP:${stamp(Date.now())}`,
    `DTSTART:${stamp(start)}`,
    `DTEND:${stamp(timestamp(order.inicio) + 1800000)}`,
    "SUMMARY:Chegada ao Kartódromo de Betim",
    "LOCATION:Av. Adutora Várzea das Flores\\, 477 - Itacolomi - Betim/MG",
    `DESCRIPTION:Reserva ${String(order.codigo).replace(/[^a-z0-9]/gi, "")}. Chegue 1 hora antes da largada.`,
    "END:VEVENT",
    "END:VCALENDAR",
    "",
  ].join("\r\n");
}
