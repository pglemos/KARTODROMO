import React, { useState } from "react";
import {
  ArrowUpRight,
  Check,
  CheckCircle2,
  Clock3,
  Copy,
  CreditCard,
  Download,
  LoaderCircle,
  MapPin,
  MessageCircle,
  Printer,
  QrCode,
  RefreshCw,
  ShieldCheck,
  TriangleAlert,
} from "lucide-react";
import {
  arrival,
  calendarFile,
  dayLabel,
  MAPS,
  money,
  safeInvoice,
  timeLabel,
  WHATS,
} from "./model.js";
import { useClock } from "./hooks.js";

export function HelpLink({ children = "Falar com a recepção", code }) {
  const url = code
    ? `${WHATS}?text=${encodeURIComponent(`Olá! Preciso de ajuda com a reserva ${code}.`)}`
    : WHATS;
  return (
    <a
      className="help-link"
      href={url}
      target="_blank"
      rel="noopener noreferrer"
    >
      <MessageCircle size={17} aria-hidden="true" />
      {children}
      <ArrowUpRight size={14} aria-hidden="true" />
    </a>
  );
}
export function OrderDetails({ order }) {
  if (!order?.inicio) return null;
  return (
    <div className="order-details">
      <div>
        <span>Dia da corrida</span>
        <strong>{dayLabel(order.inicio, { year: "numeric" })}</strong>
      </div>
      <div className="order-times">
        <div>
          <span>Largada</span>
          <strong>{timeLabel(order.inicio)}</strong>
        </div>
        <div>
          <span>Chegue às</span>
          <strong>{arrival(order.inicio)}</strong>
        </div>
        <div>
          <span>Pilotos</span>
          <strong>{order.quantidade}</strong>
        </div>
      </div>
      {Number.isFinite(order.valorCentavos) && (
        <div className="order-total">
          <span>Total</span>
          <strong>{money(order.valorCentavos)}</strong>
        </div>
      )}
    </div>
  );
}
function CopyButton({ value, children, inputId }) {
  const [state, setState] = useState("");
  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setState("copied");
    } catch {
      document.getElementById(inputId)?.select();
      setState("manual");
    }
    setTimeout(() => setState(""), 4000);
  }
  return (
    <>
      <button className="secondary" type="button" onClick={copy}>
        {state === "copied" ? (
          <Check size={18} aria-hidden="true" />
        ) : (
          <Copy size={18} aria-hidden="true" />
        )}
        {state === "copied" ? "Copiado!" : children}
      </button>
      <span className="sr-only" role="status">
        {state === "manual"
          ? "Selecione e copie o código no campo acima."
          : state === "copied"
            ? "Código copiado."
            : ""}
      </span>
      {state === "manual" && (
        <p className="field-hint">Selecione e copie o código no campo acima.</p>
      )}
    </>
  );
}
export default function Payment({ order, connection, retry, newReservation }) {
  const now = useClock();
  const [began] = useState(Date.now());
  const p = order;
  const remaining = p?.expiraEm
    ? Math.max(0, Math.ceil((Date.parse(p.expiraEm) - now) / 1000))
    : null;
  const expired = Number.isFinite(remaining) && remaining === 0;
  const invoice = safeInvoice(p?.invoiceUrl);
  const pending =
    !p ||
    p.status === "novo" ||
    (p.status === "aguardando_pagamento" &&
      (p.preparandoPagamento || (!p.pix && !invoice)));
  const failure = [
    "recusado",
    "expirado",
    "erro_pagamento",
    "nao_encontrada",
    "pago_sem_vaga",
  ].includes(p?.status);
  const titles = {
    recusado: "Esse horário ficou indisponível",
    expirado: "O prazo de pagamento terminou",
    erro_pagamento: "Não foi possível gerar o pagamento",
    nao_encontrada: "Reserva não encontrada",
    pago_sem_vaga: "Seu pagamento precisa de atendimento",
  };
  const descriptions = {
    recusado:
      "A disponibilidade mudou antes da confirmação. Escolha outro horário para continuar.",
    expirado:
      "O pagamento não foi confirmado dentro do prazo. Se você já pagou, fale com a recepção antes de fazer outra reserva.",
    erro_pagamento:
      "Entre em contato com a recepção ou escolha outro horário. Se já fez um pagamento, confirme a situação com a equipe.",
    nao_encontrada:
      "Não encontramos o pedido deste link. Se você já pagou, fale com a recepção antes de reservar novamente.",
    pago_sem_vaga:
      "Recebemos o pagamento, mas a vaga não pôde ser confirmada. Fale com a recepção para resolver sua reserva ou o reembolso. Não pague novamente.",
  };
  function downloadCalendar() {
    const blob = new Blob([calendarFile(p)], {
      type: "text/calendar;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `kart-betim-${p.codigo}.ics`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  return (
    <section className="panel payment-panel" aria-labelledby="payment-title">
      <p className="sr-only" role="status" aria-atomic="true">
        {p?.status === "confirmado"
          ? `Reserva confirmada. Código ${p.codigo}.`
          : p?.status === "pago"
            ? "Pagamento recebido. Aguardando confirmação da reserva."
            : p?.status === "aguardando_pagamento"
              ? "Aguardando pagamento. A reserva ainda não está confirmada."
              : failure
                ? titles[p.status]
                : "Verificando disponibilidade."}
      </p>
      {connection && (
        <div className="notice warning" role="status">
          <TriangleAlert size={20} aria-hidden="true" />
          <div>
            <strong>Atualização interrompida</strong>
            <p>{connection}</p>
            <button className="text-button" type="button" onClick={retry}>
              <RefreshCw size={15} aria-hidden="true" />
              Tentar atualizar
            </button>
          </div>
        </div>
      )}
      {pending && (
        <>
          <div className="status-icon">
            <LoaderCircle className="spin" size={28} aria-hidden="true" />
          </div>
          <p className="eyebrow">Pedido em andamento</p>
          <h2 id="payment-title">
            {p?.status === "aguardando_pagamento"
              ? "Preparando seu pagamento"
              : "Verificando disponibilidade"}
          </h2>
          <p className="intro">
            {p?.status === "aguardando_pagamento"
              ? "As vagas foram separadas temporariamente. A confirmação acontece após o pagamento."
              : "A recepção está verificando as vagas para esta corrida. Aguarde aqui, sem enviar outro pedido."}
          </p>
          {now - began > 45000 && (
            <div className="notice">
              <Clock3 size={20} aria-hidden="true" />
              <div>
                A confirmação está levando mais tempo. Você pode manter esta
                tela aberta ou retornar pelo mesmo link.
                <div>
                  <HelpLink code={p?.codigo} />
                </div>
              </div>
            </div>
          )}
        </>
      )}
      {!pending && p?.status === "aguardando_pagamento" && (
        <>
          <div className="status-icon">
            {p.forma === "pix" ? (
              <QrCode size={28} aria-hidden="true" />
            ) : (
              <CreditCard size={28} aria-hidden="true" />
            )}
          </div>
          <p className="eyebrow">Último passo</p>
          <h2 id="payment-title">
            {p.forma === "pix" ? "Pague com Pix" : "Pague com cartão"}
          </h2>
          <p className="intro">
            {p.forma === "pix"
              ? "Copie o código no app do seu banco ou escaneie o QR code. Acompanhe a confirmação nesta tela."
              : "O pagamento acontece na página segura da Asaas. Depois de pagar, volte a esta tela para acompanhar a confirmação."}
          </p>
          {Number.isFinite(remaining) && (
            <div className={`countdown ${expired ? "ended" : ""}`}>
              <Clock3 size={18} aria-hidden="true" />
              <span>
                {expired ? (
                  "Prazo encerrado. Verificando a situação…"
                ) : (
                  <>
                    Vagas separadas por{" "}
                    <strong>
                      {Math.floor(remaining / 60)}:
                      {String(remaining % 60).padStart(2, "0")}
                    </strong>
                  </>
                )}
              </span>
            </div>
          )}
          {!expired && p.pix && (
            <div className="pix-payment">
              {p.pix.imagem && (
                <img
                  className="qr-code"
                  src={`data:image/png;base64,${p.pix.imagem}`}
                  alt="QR code do Pix desta reserva"
                  width="200"
                  height="200"
                />
              )}
              <div className="pix-copy">
                <label htmlFor="pix-code">Pix copia e cola</label>
                <input
                  id="pix-code"
                  className="code-input"
                  value={p.pix.payload}
                  readOnly
                  onFocus={(e) => e.target.select()}
                />
                <CopyButton value={p.pix.payload} inputId="pix-code">
                  Copiar código Pix
                </CopyButton>
                <p className="field-hint">
                  Confira o valor no banco antes de confirmar.
                </p>
              </div>
            </div>
          )}
          {!expired && !p.pix && invoice && (
            <a
              className="primary card-payment"
              href={invoice}
              target="_blank"
              rel="noopener noreferrer"
            >
              Pagar{" "}
              {Number.isFinite(p.valorCentavos) ? money(p.valorCentavos) : ""}{" "}
              com cartão
              <ArrowUpRight size={18} aria-hidden="true" />
            </a>
          )}
          {expired && (
            <div className="notice warning">
              <TriangleAlert size={20} aria-hidden="true" />
              <div>
                Não faça outro pagamento. Estamos aguardando a atualização do
                pedido. Se você já pagou, fale com a recepção.
              </div>
            </div>
          )}
          <p className="secure-line">
            <ShieldCheck size={16} aria-hidden="true" />
            Pagamento processado pela Asaas
          </p>
        </>
      )}
      {p?.status === "pago" && (
        <>
          <div className="status-icon">
            <LoaderCircle className="spin" size={28} aria-hidden="true" />
          </div>
          <p className="eyebrow">Pagamento recebido</p>
          <h2 id="payment-title">Falta confirmar sua reserva</h2>
          <p className="intro">
            Estamos registrando a reserva no sistema do kartódromo. Aguarde o
            código de confirmação nesta tela. Não pague novamente.
          </p>
          {now - began > 45000 && <HelpLink code={p.codigo} />}
        </>
      )}
      {p?.status === "confirmado" && (
        <>
          <div className="status-icon success">
            <CheckCircle2 size={32} aria-hidden="true" />
          </div>
          <p className="eyebrow">Tudo certo para a corrida</p>
          <h2 id="payment-title">
            Reserva confirmada{p.nome ? `, ${p.nome}` : ""}!
          </h2>
          <p className="intro">
            Guarde seu código e chegue uma hora antes da largada.
          </p>
          <div className="confirmation-code">
            <label htmlFor="reservation-code">Código da reserva</label>
            <input id="reservation-code" value={p.codigo} readOnly />
            <CopyButton value={p.codigo} inputId="reservation-code">
              Copiar código
            </CopyButton>
          </div>
        </>
      )}
      {failure && (
        <>
          <div className="status-icon attention">
            <TriangleAlert size={28} aria-hidden="true" />
          </div>
          <p className="eyebrow">
            {p.status === "pago_sem_vaga"
              ? "Pagamento recebido · reserva não confirmada"
              : "Pedido não confirmado"}
          </p>
          <h2 id="payment-title">{titles[p.status]}</h2>
          <p className="intro">{descriptions[p.status]}</p>
          {p.erro && (
            <p className="server-message">Informação da recepção: {p.erro}</p>
          )}
          {p.codigo && (
            <p className="reference">
              Referência do pedido: <strong>{p.codigo}</strong>
            </p>
          )}
        </>
      )}
      <OrderDetails order={p} />
      {p?.status === "confirmado" && (
        <>
          <div className="confirmation-actions">
            <button
              className="secondary"
              type="button"
              onClick={downloadCalendar}
              disabled={!p.inicio}
            >
              <Download size={17} aria-hidden="true" />
              Salvar na agenda
            </button>
            <button
              className="secondary"
              type="button"
              onClick={() => window.print()}
            >
              <Printer size={17} aria-hidden="true" />
              Imprimir
            </button>
          </div>
          <div className="arrival-guide">
            <h3>No dia da corrida</h3>
            <ol>
              <li>
                <strong>Chegue às {arrival(p.inicio)}.</strong> Uma hora antes
                da largada.
              </li>
              <li>
                No totem, informe o CPF de quem reservou e confira os dados.
              </li>
              <li>
                Cada piloto assina o termo de responsabilidade no kartódromo.
                Menores de 18 anos precisam do responsável.
              </li>
            </ol>
            <a
              className="address"
              href={MAPS}
              target="_blank"
              rel="noopener noreferrer"
            >
              <MapPin size={20} aria-hidden="true" />
              <span>
                Av. Adutora Várzea das Flores, 477
                <br />
                Itacolomi · Betim/MG
              </span>
              <ArrowUpRight size={16} aria-hidden="true" />
            </a>
          </div>
        </>
      )}
      {(failure || p?.status === "confirmado") && (
        <div className="terminal-actions">
          <HelpLink code={p.codigo} />
          {p.status !== "pago_sem_vaga" && (
            <button
              className="secondary"
              type="button"
              onClick={newReservation}
            >
              {p.status === "confirmado"
                ? "Fazer outra reserva"
                : "Escolher outro horário"}
            </button>
          )}
        </div>
      )}
      {!failure && p?.status !== "confirmado" && (
        <div className="payment-footer">
          <span>Você pode voltar pelo mesmo link.</span>
          <HelpLink code={p?.codigo} />
        </div>
      )}
    </section>
  );
}
