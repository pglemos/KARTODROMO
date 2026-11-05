import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { createRoot } from "react-dom/client";
import {
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  CalendarDays,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Clock3,
  CreditCard,
  Flag,
  Info,
  LoaderCircle,
  LockKeyhole,
  MapPin,
  Minus,
  Plus,
  QrCode,
  RefreshCw,
  ShieldCheck,
  Users,
} from "lucide-react";
import Payment, { HelpLink } from "./Payment.jsx";
import { useOrder } from "./hooks.js";
import {
  api,
  arrival,
  availability,
  dayLabel,
  isoDOB,
  maskCPF,
  maskDOB,
  maskPhone,
  money,
  monthLabel,
  rememberOrder,
  rememberedOrder,
  timeLabel,
  UUID,
  validateCustomer,
  WHATS,
} from "./model.js";
import "./style.css";

const steps = ["Corrida", "Pilotos", "Cadastro", "Pagamento"];
const initialCustomer = {
  nome: "",
  documento: "",
  telefone: "",
  nascimento: "",
  email: "",
  peso: "",
};
const titles = [
  "Escolha quando correr.",
  "Quem vai para a pista?",
  "Dados de quem reserva.",
  "Confira e finalize.",
];
const descriptions = [
  "Selecione o dia e o horário da sua bateria.",
  "Reserve as vagas do seu grupo na mesma bateria.",
  "A reserva deve ser feita por um adulto, que pode ou não pilotar.",
  "Revise sua corrida e escolha como pagar.",
];

function Requirements({ full = false }) {
  return (
    <div className="requirements">
      <div className="requirement-tags">
        <span>14 anos ou mais</span>
        <span>Altura mín. 1,50 m</span>
        <span>50 a 120 kg</span>
      </div>
      <details open={full || undefined}>
        <summary>
          Requisitos e orientações para pilotar
          <ChevronDown size={16} aria-hidden="true" />
        </summary>
        <ul>
          <li>Use calçado fechado. Gestantes não podem pilotar.</li>
          <li>
            Menores de 18 anos precisam do responsável no dia para assinar o
            termo.
          </li>
          <li>Não precisa de experiência nem de equipamento próprio.</li>
          <li>
            O termo de responsabilidade é assinado no kartódromo, antes da
            corrida.
          </li>
        </ul>
      </details>
    </div>
  );
}
function Cancellation() {
  return (
    <details className="cancellation">
      <summary>
        Política de cancelamento e reembolso
        <ChevronDown size={16} aria-hidden="true" />
      </summary>
      <p>
        Com pelo menos 48 horas de antecedência, o reembolso tem desconto de 5%
        de taxa administrativa. No cartão, o estorno é solicitado em até 7 dias
        úteis; no Pix, a devolução ocorre em até 7 dias úteis, somente para a
        conta do titular.
      </p>
      <p>
        Com menos de 48 horas ou em caso de não comparecimento, não há
        reembolso. Em casos excepcionais, pode ser concedido voucher. O
        reagendamento é gratuito com 48 horas de antecedência, conforme
        disponibilidade.
      </p>
      <p>
        Se o kartódromo cancelar por motivo operacional ou de força maior, o
        reembolso é integral. Solicite cancelamentos e alterações pelo{" "}
        <a href={WHATS} target="_blank" rel="noopener noreferrer">
          WhatsApp da recepção
        </a>
        .
      </p>
    </details>
  );
}
function Ticket({ slot, quantity, price, step, edit, order, busy }) {
  const [expanded, setExpanded] = useState(() => window.innerWidth >= 1000);
  const booked = order?.inicio ? order : null;
  const start = booked?.inicio || slot?.inicio;
  const qty = booked?.quantidade || quantity;
  const unitPrice =
    Number.isFinite(booked?.valorCentavos) && booked.quantidade
      ? booked.valorCentavos / booked.quantidade
      : price;
  const total = Number.isFinite(booked?.valorCentavos)
    ? booked.valorCentavos
    : price
      ? price * qty
      : null;
  return (
    <aside className="ticket" aria-label="Resumo da reserva">
      <div className="ticket-photo">
        <img
          src="/booking-media/action.webp"
          alt="Kart em ação na pista de Betim"
          width="600"
          height="400"
        />
        <span>
          <Flag size={15} aria-hidden="true" />
          Kart de aluguel
        </span>
      </div>
      <details
        className="ticket-body"
        open={expanded}
        onToggle={(e) => setExpanded(e.currentTarget.open)}
      >
        <summary>
          <span>Sua corrida</span>
          <span className="mobile-total">
            {total !== null ? money(total) : "Escolha um horário"}
            <ChevronDown size={16} aria-hidden="true" />
          </span>
        </summary>
        <div className="ticket-content">
          <div className="ticket-item">
            <CalendarDays size={19} aria-hidden="true" />
            <div>
              <span>Dia da corrida</span>
              <strong className={start ? "" : "muted"}>
                {start
                  ? dayLabel(start, {
                      weekday: "short",
                      month: "short",
                      year: "numeric",
                    })
                  : "Selecione na agenda"}
              </strong>
            </div>
            {!order && step > 0 && (
              <button
                className="text-button"
                disabled={busy}
                onClick={() => edit(0)}
                type="button"
              >
                Alterar
              </button>
            )}
          </div>
          <div className="ticket-times">
            <div>
              <span>Largada</span>
              <strong>{start ? timeLabel(start) : "—"}</strong>
            </div>
            <div>
              <span>Chegada</span>
              <strong>{start ? arrival(start) : "—"}</strong>
            </div>
            <div>
              <span>Na pista</span>
              <strong>30 min</strong>
            </div>
          </div>
          <div className="ticket-item">
            <Users size={19} aria-hidden="true" />
            <div>
              <span>{qty === 1 ? "1 piloto" : `${qty} pilotos`}</span>
              <strong>
                {unitPrice
                  ? `${money(unitPrice)} por pessoa`
                  : "Consultando valor…"}
              </strong>
            </div>
            {!order && step > 1 && (
              <button
                className="text-button"
                type="button"
                disabled={busy}
                onClick={() => edit(1)}
              >
                Alterar
              </button>
            )}
          </div>
          <div className="ticket-total">
            <span>Total da reserva</span>
            <strong>{total !== null ? money(total) : "—"}</strong>
          </div>
          <p className="ticket-note">
            <Info size={15} aria-hidden="true" />
            Chegue uma hora antes para cadastro, preparação e orientações.
          </p>
        </div>
      </details>
      <div className="ticket-support">
        <ShieldCheck size={18} aria-hidden="true" />
        <span>Pix ou cartão pela Asaas</span>
      </div>
    </aside>
  );
}
function Calendar({ dates, month, setMonth, date, chooseDate }) {
  const months = [...new Set(dates.map((d) => d.slice(0, 7)))];
  const index = months.indexOf(month);
  const [year, m] = (month || "").split("-").map(Number);
  const first = new Date(Date.UTC(year, m - 1, 1)).getUTCDay();
  const last = new Date(Date.UTC(year, m, 0)).getUTCDate();
  const enabled = new Set(dates);
  const tabDate = date?.startsWith(month)
    ? date
    : dates.find((d) => d.startsWith(month));
  const changeMonth = (value) => {
    if (months.includes(value)) setMonth(value);
  };
  function keyboard(event, value) {
    const moves = { ArrowRight: 1, ArrowLeft: -1, ArrowDown: 7, ArrowUp: -7 };
    if (event.key === "PageDown" || event.key === "PageUp") {
      event.preventDefault();
      changeMonth(months[index + (event.key === "PageDown" ? 1 : -1)]);
      return;
    }
    if (!moves[event.key] && event.key !== "Home" && event.key !== "End")
      return;
    event.preventDefault();
    const current = dates.indexOf(value);
    let target;
    if (event.key === "Home" || event.key === "End") {
      const available = dates.filter((d) => d.startsWith(month));
      target = event.key === "Home" ? available[0] : available.at(-1);
    } else if (Math.abs(moves[event.key]) === 1)
      target = dates[current + moves[event.key]];
    else {
      const wanted = new Date(`${value}T12:00:00Z`);
      wanted.setUTCDate(wanted.getUTCDate() + moves[event.key]);
      const day = wanted.toISOString().slice(0, 10);
      target =
        moves[event.key] > 0
          ? dates.find((d) => d >= day)
          : dates.findLast((d) => d <= day);
    }
    if (target) {
      if (!target.startsWith(month)) setMonth(target.slice(0, 7));
      requestAnimationFrame(() =>
        document.querySelector(`[data-calendar-date="${target}"]`)?.focus(),
      );
    }
  }
  return (
    <div className="calendar">
      <div className="calendar-heading">
        <label className="sr-only" htmlFor="calendar-month">
          Mês da corrida
        </label>
        <select
          id="calendar-month"
          value={month}
          onChange={(e) => changeMonth(e.target.value)}
        >
          {months.map((v) => (
            <option key={v} value={v}>
              {monthLabel(v)}
            </option>
          ))}
        </select>
        <div>
          <button
            className="icon-button"
            type="button"
            disabled={index <= 0}
            onClick={() => changeMonth(months[index - 1])}
            aria-label="Mês anterior"
          >
            <ChevronLeft size={18} aria-hidden="true" />
          </button>
          <button
            className="icon-button"
            type="button"
            disabled={index === months.length - 1}
            onClick={() => changeMonth(months[index + 1])}
            aria-label="Próximo mês"
          >
            <ChevronRight size={18} aria-hidden="true" />
          </button>
        </div>
      </div>
      <div className="weekdays" aria-hidden="true">
        {["D", "S", "T", "Q", "Q", "S", "S"].map((v, i) => (
          <span key={i}>{v}</span>
        ))}
      </div>
      <div
        className="calendar-days"
        role="group"
        aria-label={`Datas disponíveis em ${monthLabel(month)}`}
      >
        {Array.from({ length: first || 0 }, (_, i) => (
          <span key={`blank-${i}`} aria-hidden="true" />
        ))}
        {Array.from({ length: last || 0 }, (_, i) => {
          const day = `${month}-${String(i + 1).padStart(2, "0")}`;
          const available = enabled.has(day);
          return (
            <button
              key={day}
              type="button"
              data-calendar-date={day}
              disabled={!available}
              tabIndex={day === tabDate ? 0 : -1}
              aria-pressed={date === day}
              aria-label={`${dayLabel(day, { year: "numeric" })}${available ? ", com horários disponíveis" : ", indisponível"}`}
              className={date === day ? "selected" : ""}
              onClick={() => chooseDate(day)}
              onKeyDown={(e) => keyboard(e, day)}
            >
              {i + 1}
              {available && <span className="day-dot" aria-hidden="true" />}
            </button>
          );
        })}
      </div>
      <p className="calendar-legend">
        <span aria-hidden="true" />
        Dias com horários disponíveis
      </p>
    </div>
  );
}
function Field({
  name,
  label,
  hint,
  optional,
  error,
  value,
  onChange,
  ...props
}) {
  return (
    <div className={`field ${name === "nome" ? "full" : ""}`}>
      <label htmlFor={name}>
        {label}
        {optional && <span>Opcional</span>}
      </label>
      <input
        {...props}
        id={name}
        name={name}
        value={value}
        onChange={(e) => onChange(name, e.target.value)}
        aria-invalid={Boolean(error)}
        aria-describedby={
          error ? `${name}-error` : hint ? `${name}-hint` : undefined
        }
      />
      {error ? (
        <p className="field-error" id={`${name}-error`}>
          {error}
        </p>
      ) : (
        hint && (
          <p className="field-hint" id={`${name}-hint`}>
            {hint}
          </p>
        )
      )}
    </div>
  );
}
function Loading() {
  return (
    <section className="panel" aria-busy="true" aria-label="Carregando agenda">
      <div className="section-heading">
        <div className="skeleton skeleton-title" />
        <div className="skeleton skeleton-line" />
      </div>
      <div className="agenda-layout">
        <div className="skeleton-calendar">
          <div className="skeleton skeleton-title" />
          <div className="skeleton-dates">
            {Array.from({ length: 35 }, (_, i) => (
              <span className="skeleton" key={i} />
            ))}
          </div>
        </div>
        <div className="skeleton-times">
          {Array.from({ length: 6 }, (_, i) => (
            <div className="skeleton" key={i} />
          ))}
        </div>
      </div>
      <p className="loading-label">
        <LoaderCircle size={16} className="spin" aria-hidden="true" />
        Consultando horários disponíveis…
      </p>
    </section>
  );
}

function App() {
  const [agenda, setAgenda] = useState(null);
  const [loadError, setLoadError] = useState("");
  const [loading, setLoading] = useState(true);
  const [step, setStep] = useState(0);
  const [date, setDate] = useState("");
  const [month, setMonth] = useState("");
  const [slotId, setSlotId] = useState(null);
  const [quantity, setQuantity] = useState(1);
  const [pilots, setPilots] = useState([]);
  const [customer, setCustomer] = useState(initialCustomer);
  const [errors, setErrors] = useState({});
  const [method, setMethod] = useState("pix");
  const [policy, setPolicy] = useState(false);
  const [privacy, setPrivacy] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [uncertain, setUncertain] = useState(false);
  const [orderId, setOrderId] = useState(rememberedOrder);
  const [refresh, setRefresh] = useState(0);
  const [showAllTimes, setShowAllTimes] = useState(false);
  const [period, setPeriod] = useState("all");
  const [calendarExpanded, setCalendarExpanded] = useState(
    () => window.innerWidth > 600,
  );
  const site = useRef(null);
  const opened = useRef(Date.now());
  const submitLock = useRef(false);
  const heading = useRef(null);
  const { order, connection } = useOrder(orderId, refresh);
  const slots = useMemo(() => availability(agenda), [agenda]);
  const dates = useMemo(
    () => [...new Set(slots.map((h) => h.inicio.slice(0, 10)))],
    [slots],
  );
  const selected = slots.find((h) => h.id === slotId);
  const max = Math.max(
    1,
    Math.min(agenda?.maxPilotos || 10, selected?.livres || 1),
  );
  const total = (agenda?.precoCentavos || 0) * quantity;
  const daySlots = slots.filter((h) => h.inicio.startsWith(date));
  const visibleSlots = daySlots.filter(
    (h) =>
      period === "all" ||
      (period === "afternoon"
        ? Number(timeLabel(h.inicio).slice(0, 2)) < 18
        : Number(timeLabel(h.inicio).slice(0, 2)) >= 18),
  );

  const loadAgenda = useCallback(async () => {
    setLoading(true);
    setLoadError("");
    try {
      const data = await api("/api/agenda");
      if (
        !Array.isArray(data.horarios) ||
        !Number.isInteger(data.precoCentavos) ||
        data.precoCentavos <= 0
      )
        throw new Error("A agenda não pôde ser verificada. Tente novamente.");
      setAgenda(data);
      const available = availability(data);
      if (available.length) {
        setMonth((v) => v || available[0].inicio.slice(0, 7));
        setDate((v) => v || available[0].inicio.slice(0, 10));
      }
    } catch (e) {
      setLoadError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    void loadAgenda();
  }, [loadAgenda]);
  useEffect(() => {
    const notify = () => {
      if (window.parent !== window)
        window.parent.postMessage(
          {
            type: "kartodromo-reserva-height",
            height: document.documentElement.scrollHeight,
          },
          "*",
        );
    };
    const observer = new ResizeObserver(notify);
    observer.observe(document.body);
    notify();
    return () => observer.disconnect();
  }, []);
  useEffect(() => {
    function restore() {
      setOrderId(rememberedOrder());
    }
    window.addEventListener("hashchange", restore);
    return () => window.removeEventListener("hashchange", restore);
  }, []);
  function moveStep(next) {
    setStep(next);
    setSubmitError("");
    requestAnimationFrame(() => {
      heading.current?.focus({ preventScroll: true });
      window.scrollTo({
        top: 0,
        behavior: matchMedia("(prefers-reduced-motion: reduce)").matches
          ? "instant"
          : "smooth",
      });
    });
  }
  function chooseDate(value) {
    setDate(value);
    setShowAllTimes(false);
    setSlotId(null);
    setPeriod("all");
    if (window.innerWidth <= 600) setCalendarExpanded(false);
  }
  function chooseSlot(id) {
    const slot = slots.find((h) => h.id === id);
    setSlotId(id);
    setQuantity((v) => Math.min(v, agenda.maxPilotos, slot.livres));
  }
  function editCustomer(name, value) {
    const masked =
      name === "documento"
        ? maskCPF(value)
        : name === "telefone"
          ? maskPhone(value)
          : name === "nascimento"
            ? maskDOB(value)
            : value;
    setCustomer((c) => ({ ...c, [name]: masked }));
    setErrors((e) => ({ ...e, [name]: undefined }));
  }
  function validate() {
    const next = validateCustomer(customer);
    setErrors(next);
    if (Object.keys(next).length) {
      requestAnimationFrame(() =>
        document.getElementById(Object.keys(next)[0])?.focus(),
      );
      return false;
    }
    return true;
  }
  function next() {
    if (step === 0 && !selected) return;
    if (step === 2 && !validate()) return;
    moveStep(step + 1);
  }
  async function submit(event) {
    event.preventDefault();
    if (
      submitLock.current ||
      orderId ||
      uncertain ||
      !selected ||
      !policy ||
      !privacy
    )
      return;
    if (!validate()) {
      moveStep(2);
      return;
    }
    if (Date.now() - opened.current < 6000) {
      setSubmitError(
        "Confira os dados e aguarde alguns segundos antes de enviar.",
      );
      return;
    }
    submitLock.current = true;
    setSubmitting(true);
    setSubmitError("");
    let sending = false;
    try {
      // Refresh before creating a charge; stale availability must never be presented as a guarantee.
      const latest = await api("/api/agenda");
      const current = availability(latest).find((h) => h.id === slotId);
      if (!latest.pagamentoOnline)
        throw new Error("Pagamento online indisponível. Fale com a recepção.");
      if (
        !current ||
        current.livres < quantity ||
        quantity > latest.maxPilotos
      ) {
        setAgenda(latest);
        setSlotId(null);
        moveStep(0);
        throw new Error(
          "A disponibilidade mudou. Selecione outro horário para o seu grupo.",
        );
      }
      if (latest.precoCentavos !== agenda.precoCentavos) {
        setAgenda(latest);
        setPolicy(false);
        throw new Error(
          "O valor foi atualizado. Confira o novo total e aceite a política para continuar.",
        );
      }
      sending = true;
      const result = await api("/api/reservas", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          ...customer,
          nome: customer.nome.trim(),
          email: customer.email.trim(),
          nascimento: isoDOB(customer.nascimento),
          bateriaId: selected.id,
          quantidade: quantity,
          pilotos: pilots.slice(0, quantity),
          forma: method,
          politica: true,
          lgpd: true,
          site: site.current?.value || "",
          t: opened.current,
        }),
      });
      if (!UUID.test(result.id || ""))
        throw new Error("Não foi possível verificar o número do pedido.");
      rememberOrder(result.id);
      setOrderId(result.id);
      requestAnimationFrame(() => {
        heading.current?.focus();
        window.scrollTo({ top: 0 });
      });
    } catch (e) {
      if (sending && (!e.status || e.status >= 500)) {
        setUncertain(true);
        setSubmitError(
          "Não conseguimos verificar se o pedido foi recebido. Para evitar pedidos duplicados, fale com a recepção antes de enviar novamente. Nenhuma confirmação foi exibida.",
        );
      } else setSubmitError(e.message);
    } finally {
      setSubmitting(false);
      submitLock.current = false;
    }
  }
  function newReservation() {
    rememberOrder(null);
    setOrderId(null);
    setSlotId(null);
    setPolicy(false);
    setPrivacy(false);
    setUncertain(false);
    moveStep(0);
    void loadAgenda();
  }
  const stopped =
    loadError || (!loading && (!agenda?.pagamentoOnline || !slots.length));
  return (
    <>
      <a className="skip-link" href="#booking-main">
        Pular para a reserva
      </a>
      <header className="site-header">
        <div className="header-inner">
          <a
            className="brand"
            href="https://kartodromodebetim.com.br"
            aria-label="Kartódromo Internacional de Betim, site principal"
          >
            <img
              src="/booking-media/logo.png"
              alt="Kartódromo Internacional de Betim"
              width="190"
              height="69"
            />
          </a>
          <div className="header-links">
            <a className="back-site" href="https://kartodromodebetim.com.br">
              <ArrowLeft size={15} aria-hidden="true" />
              Voltar ao site
            </a>
            <HelpLink>Precisa de ajuda?</HelpLink>
          </div>
        </div>
      </header>
      <main id="booking-main" className="booking-main">
        <div className="page-intro">
          <div>
            <p className="eyebrow">
              <span className="live-dot" aria-hidden="true" />
              Kartódromo de Betim · Reserva online
            </p>
            <h1 ref={heading} tabIndex="-1">
              {orderId ? "Acompanhe sua reserva." : titles[step]}
            </h1>
            <p>
              {orderId
                ? "Pagamento e confirmação, tudo em um só lugar."
                : descriptions[step]}
            </p>
          </div>
          <span className="location-tag">
            <MapPin size={16} aria-hidden="true" />
            Betim, MG
          </span>
        </div>
        {!orderId && (
          <nav className="progress" aria-label="Etapas da reserva">
            <ol>
              {steps.map((label, i) => (
                <li
                  key={label}
                  className={
                    i === step ? "current" : i < step ? "complete" : ""
                  }
                  aria-current={i === step ? "step" : undefined}
                >
                  <button
                    type="button"
                    disabled={i >= step || submitting}
                    onClick={() => moveStep(i)}
                    aria-label={`${i + 1}. ${label}${i < step ? ", concluída, voltar" : ""}`}
                  >
                    <span className="step-number">
                      {i < step ? (
                        <Check size={15} aria-hidden="true" />
                      ) : (
                        i + 1
                      )}
                    </span>
                    <span>{label}</span>
                  </button>
                </li>
              ))}
            </ol>
          </nav>
        )}
        <div className="booking-grid">
          <div className="booking-flow">
            {orderId ? (
              <Payment
                key={orderId}
                order={order}
                connection={connection}
                retry={() => setRefresh((v) => v + 1)}
                newReservation={newReservation}
              />
            ) : loading ? (
              <Loading />
            ) : stopped ? (
              <section className="panel empty-state">
                <div className="status-icon">
                  <CalendarDays size={28} aria-hidden="true" />
                </div>
                <h2>
                  {loadError
                    ? "Não foi possível carregar a agenda"
                    : !agenda?.pagamentoOnline
                      ? "Pagamento online indisponível"
                      : "Sem horários disponíveis agora"}
                </h2>
                <p>
                  {loadError ||
                    "A recepção pode ajudar você a encontrar a melhor opção para correr."}
                </p>
                <div className="empty-actions">
                  <button
                    className="secondary"
                    type="button"
                    onClick={loadAgenda}
                  >
                    <RefreshCw size={17} aria-hidden="true" />
                    Atualizar agenda
                  </button>
                  <HelpLink />
                </div>
              </section>
            ) : (
              <form noValidate onSubmit={submit}>
                <section
                  className="panel"
                  aria-label={`Etapa ${step + 1}: ${steps[step]}`}
                >
                  <div className="honeypot" aria-hidden="true">
                    <label htmlFor="website">
                      Site
                      <input
                        id="website"
                        ref={site}
                        name="website"
                        tabIndex="-1"
                        autoComplete="off"
                      />
                    </label>
                  </div>
                  <div className="section-heading">
                    <span className="section-index">0{step + 1}</span>
                    <div>
                      <h2>
                        {
                          [
                            "Data e horário",
                            "Seu grupo",
                            "Cadastro do responsável",
                            "Pagamento e revisão",
                          ][step]
                        }
                      </h2>
                      <p>
                        {
                          [
                            "Os horários abaixo têm vagas disponíveis.",
                            "Cada piloto precisa atender aos requisitos da pista.",
                            "Seus dados são usados na reserva e no termo de responsabilidade.",
                            "As vagas serão verificadas antes da geração do pagamento.",
                          ][step]
                        }
                      </p>
                    </div>
                    {step === 0 && (
                      <button
                        className="icon-button refresh-agenda"
                        type="button"
                        aria-label="Atualizar horários disponíveis"
                        onClick={loadAgenda}
                      >
                        <RefreshCw size={16} aria-hidden="true" />
                      </button>
                    )}
                  </div>
                  {submitError && (
                    <div className="notice warning" role="alert">
                      <Info size={20} aria-hidden="true" />
                      <div>
                        {submitError}
                        {uncertain && (
                          <div>
                            <HelpLink />
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                  {step === 0 && (
                    <>
                      <div className="agenda-layout">
                        <details
                          className="date-picker"
                          open={calendarExpanded}
                          onToggle={(e) =>
                            setCalendarExpanded(e.currentTarget.open)
                          }
                        >
                          <summary>
                            <CalendarDays size={18} aria-hidden="true" />
                            <span>
                              <small>Dia da corrida</small>
                              <strong>
                                {dayLabel(date, {
                                  weekday: "short",
                                  month: "long",
                                })}
                              </strong>
                            </span>
                            <span className="change-date">
                              Alterar data
                              <ChevronDown size={15} aria-hidden="true" />
                            </span>
                          </summary>
                          <Calendar
                            dates={dates}
                            date={date}
                            month={month}
                            setMonth={setMonth}
                            chooseDate={chooseDate}
                          />
                        </details>
                        <div className="time-picker">
                          <div className="time-heading">
                            <p className="small-label">Horários de largada</p>
                            <h3>
                              {dayLabel(date, {
                                weekday: "short",
                                month: "short",
                              })}
                            </h3>
                          </div>
                          {daySlots.some(
                            (h) => Number(timeLabel(h.inicio).slice(0, 2)) < 18,
                          ) &&
                            daySlots.some(
                              (h) =>
                                Number(timeLabel(h.inicio).slice(0, 2)) >= 18,
                            ) && (
                              <div
                                className="period-filter"
                                role="group"
                                aria-label="Filtrar horários"
                              >
                                {[
                                  ["all", "Todos"],
                                  ["afternoon", "Antes das 18h"],
                                  ["evening", "A partir das 18h"],
                                ].map(([value, label]) => (
                                  <button
                                    type="button"
                                    key={value}
                                    aria-pressed={period === value}
                                    className={
                                      period === value ? "selected" : ""
                                    }
                                    onClick={() => setPeriod(value)}
                                  >
                                    {label}
                                  </button>
                                ))}
                              </div>
                            )}
                          <fieldset
                            className={`time-options ${showAllTimes ? "all-times" : ""}`}
                          >
                            <legend className="sr-only">
                              Escolha o horário de largada
                            </legend>
                            {visibleSlots.map((h) => (
                              <label
                                className={`time-option ${selected?.id === h.id ? "selected" : ""}`}
                                key={h.id}
                              >
                                <input
                                  type="radio"
                                  name="slot"
                                  value={h.id}
                                  checked={selected?.id === h.id}
                                  onChange={() => chooseSlot(h.id)}
                                />
                                <span className="time-top">
                                  <strong>{timeLabel(h.inicio)}</strong>
                                  {selected?.id === h.id ? (
                                    <Check size={15} aria-hidden="true" />
                                  ) : (
                                    <span className="capacity">
                                      {h.livres}{" "}
                                      {h.livres === 1 ? "vaga" : "vagas"}
                                    </span>
                                  )}
                                </span>
                                <span className="time-arrival">
                                  Chegue às {arrival(h.inicio)}
                                </span>
                              </label>
                            ))}
                          </fieldset>
                          {visibleSlots.length > 6 && (
                            <button
                              className="text-button time-expand-button"
                              type="button"
                              onClick={() => setShowAllTimes((v) => !v)}
                            >
                              {showAllTimes
                                ? "Mostrar menos horários"
                                : `Ver todos os horários (${visibleSlots.length})`}
                              <ChevronDown size={13} aria-hidden="true" />
                            </button>
                          )}
                          {!visibleSlots.length && (
                            <p className="no-times">
                              {daySlots.length
                                ? "Nenhum horário neste período. Escolha Todos."
                                : "Sem horários nesta data. Selecione outro dia na agenda."}
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="notice arrival-notice">
                        <Clock3 size={20} aria-hidden="true" />
                        <div>
                          <strong>Planeje chegar uma hora antes.</strong>
                          <p>
                            {selected
                              ? `Largada às ${timeLabel(selected.inicio)}? Chegue às ${arrival(selected.inicio)} para cadastro e preparação.`
                              : "Esse tempo é necessário para cadastro, preparação e orientações."}
                          </p>
                        </div>
                      </div>
                    </>
                  )}
                  {step === 1 && (
                    <>
                      <div className="quantity-picker">
                        <div>
                          <h3>Quantos pilotos vão correr?</h3>
                          <p>
                            Até {max} {max === 1 ? "piloto" : "pilotos"} nesta
                            reserva.
                          </p>
                        </div>
                        <div className="quantity-control">
                          <button
                            type="button"
                            className="icon-button"
                            disabled={quantity <= 1}
                            onClick={() => setQuantity((v) => v - 1)}
                            aria-label="Remover um piloto"
                          >
                            <Minus size={19} aria-hidden="true" />
                          </button>
                          <output
                            aria-label="Quantidade de pilotos"
                            aria-live="polite"
                          >
                            {quantity}
                          </output>
                          <button
                            type="button"
                            className="icon-button"
                            disabled={quantity >= max}
                            onClick={() => setQuantity((v) => v + 1)}
                            aria-label="Adicionar um piloto"
                          >
                            <Plus size={19} aria-hidden="true" />
                          </button>
                        </div>
                      </div>
                      <div className="group-total">
                        <span>
                          {quantity} × {money(agenda.precoCentavos)}
                        </span>
                        <strong>{money(total)}</strong>
                      </div>
                      <Requirements full />
                      <details className="pilot-names">
                        <summary>
                          Adicionar nomes dos pilotos <span>Opcional</span>
                          <ChevronDown size={16} aria-hidden="true" />
                        </summary>
                        <p>Você também pode informar os nomes na recepção.</p>
                        <div className="fields">
                          {Array.from({ length: quantity }, (_, i) => (
                            <div className="field" key={i}>
                              <label htmlFor={`pilot-${i}`}>
                                Piloto {i + 1}
                              </label>
                              <input
                                id={`pilot-${i}`}
                                value={pilots[i] || ""}
                                autoComplete="off"
                                autoCapitalize="words"
                                maxLength="80"
                                onChange={(e) =>
                                  setPilots((v) => {
                                    const next = [...v];
                                    next[i] = e.target.value;
                                    return next;
                                  })
                                }
                              />
                            </div>
                          ))}
                        </div>
                      </details>
                      <div className="group-help">
                        <Users size={18} aria-hidden="true" />
                        <div>
                          Grupo com mais de {agenda.maxPilotos} pilotos?
                          <HelpLink>Combine com a recepção</HelpLink>
                        </div>
                      </div>
                    </>
                  )}
                  {step === 2 && (
                    <>
                      <div className="fields">
                        <Field
                          name="nome"
                          label="Nome completo"
                          value={customer.nome}
                          error={errors.nome}
                          onChange={editCustomer}
                          autoComplete="name"
                          autoCapitalize="words"
                          maxLength="120"
                        />
                        <Field
                          name="documento"
                          label="CPF"
                          value={customer.documento}
                          error={errors.documento}
                          onChange={editCustomer}
                          inputMode="numeric"
                          autoComplete="off"
                          placeholder="000.000.000-00"
                          maxLength="14"
                        />
                        <Field
                          name="telefone"
                          label="Celular com DDD"
                          value={customer.telefone}
                          error={errors.telefone}
                          onChange={editCustomer}
                          type="tel"
                          inputMode="tel"
                          autoComplete="tel-national"
                          placeholder="(31) 99999-9999"
                        />
                        <Field
                          name="nascimento"
                          label="Data de nascimento"
                          value={customer.nascimento}
                          error={errors.nascimento}
                          onChange={editCustomer}
                          inputMode="numeric"
                          autoComplete="bday"
                          placeholder="DD/MM/AAAA"
                          maxLength="10"
                          hint="Quem reserva precisa ter 18 anos ou mais."
                        />
                        <Field
                          name="email"
                          label="E-mail"
                          optional
                          value={customer.email}
                          error={errors.email}
                          onChange={editCustomer}
                          type="email"
                          autoComplete="email"
                          maxLength="160"
                        />
                        <Field
                          name="peso"
                          label="Seu peso (kg)"
                          optional
                          value={customer.peso}
                          error={errors.peso}
                          onChange={editCustomer}
                          inputMode="decimal"
                          type="number"
                          min="15"
                          max="250"
                          hint="Peso de quem reserva. Os requisitos para pilotar são separados."
                        />
                      </div>
                      <p className="data-note">
                        <LockKeyhole size={17} aria-hidden="true" />
                        Seu cadastro fica preservado ao voltar às etapas desta
                        reserva.
                      </p>
                    </>
                  )}
                  {step === 3 && (
                    <>
                      <div className="review-card">
                        <div>
                          <span>Corrida</span>
                          <strong>
                            {selected
                              ? dayLabel(selected.inicio)
                              : "Selecione um horário"}
                          </strong>
                          <p>
                            Largada {timeLabel(selected?.inicio)} · chegada{" "}
                            {arrival(selected?.inicio)} · {quantity}{" "}
                            {quantity === 1 ? "piloto" : "pilotos"}
                          </p>
                        </div>
                        <button
                          className="text-button"
                          type="button"
                          disabled={submitting}
                          onClick={() => moveStep(0)}
                        >
                          Alterar
                        </button>
                        <div>
                          <span>Responsável</span>
                          <strong>{customer.nome}</strong>
                          <p>{customer.telefone}</p>
                        </div>
                        <button
                          className="text-button"
                          type="button"
                          disabled={submitting}
                          onClick={() => moveStep(2)}
                        >
                          Alterar
                        </button>
                      </div>
                      <fieldset className="payment-methods">
                        <legend>Como você prefere pagar?</legend>
                        {[
                          ["pix", "Pix", "QR code ou copia e cola", QrCode],
                          [
                            "cartao",
                            "Cartão",
                            "Na página segura da Asaas",
                            CreditCard,
                          ],
                        ].map(([value, label, description, Icon]) => (
                          <label
                            key={value}
                            className={`payment-method ${method === value ? "selected" : ""}`}
                          >
                            <input
                              type="radio"
                              name="payment"
                              value={value}
                              checked={method === value}
                              onChange={() => setMethod(value)}
                            />
                            <Icon size={24} aria-hidden="true" />
                            <span>
                              <strong>{label}</strong>
                              <small>{description}</small>
                            </span>
                            <span className="radio-mark" aria-hidden="true">
                              {method === value && <span />}
                            </span>
                          </label>
                        ))}
                      </fieldset>
                      <Requirements />
                      <Cancellation />
                      <div className="consents">
                        <label>
                          <input
                            type="checkbox"
                            checked={policy}
                            onChange={(e) => setPolicy(e.target.checked)}
                          />
                          <span>
                            Li e aceito a política de cancelamento e os
                            requisitos para pilotar.
                          </span>
                        </label>
                        <label>
                          <input
                            type="checkbox"
                            checked={privacy}
                            onChange={(e) => setPrivacy(e.target.checked)}
                          />
                          <span>
                            Concordo com o tratamento dos meus dados para a
                            reserva e o termo de responsabilidade (LGPD).
                          </span>
                        </label>
                      </div>
                      <p className="secure-line">
                        <ShieldCheck size={16} aria-hidden="true" />
                        Pagamento processado pela Asaas. Seu cartão é informado
                        na página de pagamento.
                      </p>
                    </>
                  )}
                  <div className="stage-actions">
                    {step > 0 ? (
                      <button
                        className="back-button"
                        type="button"
                        disabled={submitting}
                        onClick={() => moveStep(step - 1)}
                      >
                        <ArrowLeft size={16} aria-hidden="true" />
                        Voltar
                      </button>
                    ) : (
                      <span className="selection-hint">
                        {selected
                          ? `Largada às ${timeLabel(selected.inicio)}`
                          : "Escolha um horário para continuar"}
                      </span>
                    )}
                    {step < 3 ? (
                      <button
                        className="primary"
                        type="button"
                        disabled={step === 0 && !selected}
                        onClick={next}
                      >
                        Continuar
                        <ArrowRight size={18} aria-hidden="true" />
                      </button>
                    ) : (
                      <button
                        className="primary"
                        type="submit"
                        disabled={
                          submitting ||
                          !selected ||
                          !policy ||
                          !privacy ||
                          uncertain
                        }
                      >
                        {submitting ? (
                          <>
                            <LoaderCircle
                              size={17}
                              className="spin"
                              aria-hidden="true"
                            />
                            Verificando…
                          </>
                        ) : (
                          <>
                            Reservar e pagar {money(total)}
                            <ArrowRight size={18} aria-hidden="true" />
                          </>
                        )}
                      </button>
                    )}
                  </div>
                </section>
                <p className="availability-note">
                  A disponibilidade é confirmada ao enviar o pedido. O pagamento
                  deve ser feito dentro do prazo informado na próxima tela.
                </p>
              </form>
            )}
          </div>
          <Ticket
            slot={selected}
            quantity={quantity}
            price={agenda?.precoCentavos}
            step={step}
            busy={submitting}
            edit={moveStep}
            order={orderId ? order || { status: "novo" } : null}
          />
        </div>
        <footer className="booking-footer">
          <span>Kartódromo Internacional de Betim</span>
          <a href="https://kartodromodebetim.com.br/contato">
            Como chegar
            <ArrowUpRight size={13} aria-hidden="true" />
          </a>
          <span>
            <LockKeyhole size={13} aria-hidden="true" />
            Conexão segura
          </span>
        </footer>
      </main>
    </>
  );
}

createRoot(document.getElementById("root")).render(<App />);
