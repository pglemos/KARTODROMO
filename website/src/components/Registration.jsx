import { useRef, useState } from "react";
import {
  Plus,
  Trash2,
  ArrowUpRight,
  CheckCircle2,
  AlertCircle,
  ArrowLeft,
  LoaderCircle,
} from "lucide-react";
import { money, registrationStatus, whatsapp } from "../data.js";
import {
  validCPF,
  validatePilots,
  registrationPayload,
} from "../registration.mjs";
import { Button } from "./UI.jsx";
const pilot = () => ({ nome: "", idade: "", altura: "", peso: "" });
export default function Registration({ championship: c }) {
  const [karts, setKarts] = useState([
    Array.from({ length: c.minPilots || 1 }, pilot),
  ]);
  const [errors, setErrors] = useState([]);
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState(null);
  const errorsRef = useRef(null);
  const resultRef = useRef(null);
  const update = (ki, pi, key, value) =>
    setKarts(
      karts.map((k, i) =>
        i !== ki ? k : k.map((p, j) => (j === pi ? { ...p, [key]: value } : p)),
      ),
    );
  const kartCount = (value) => {
    const count = Number(value);
    if (
      count < karts.length &&
      karts
        .slice(count)
        .some((k) => k.some((p) => Object.values(p).some(Boolean)))
    ) {
      if (
        !window.confirm(
          "Remover os últimos karts e os dados dos pilotos preenchidos?",
        )
      )
        return;
    }
    setKarts(
      Array.from(
        { length: count },
        (_, i) => karts[i] || Array.from({ length: c.minPilots }, pilot),
      ),
    );
  };
  const removePilot = (ki, pi) => {
    const p = karts[ki][pi];
    if (
      Object.values(p).some(Boolean) &&
      !window.confirm("Remover este piloto e os dados preenchidos?")
    )
      return;
    setKarts(
      karts.map((k, i) => (i !== ki ? k : k.filter((_, j) => j !== pi))),
    );
  };
  const submit = async (e) => {
    e.preventDefault();
    const d = Object.fromEntries(new FormData(e.currentTarget));
    const errs = [];
    if (registrationStatus(c) !== "open")
      errs.push(
        "A janela de inscrição não está aberta. Consulte a organização.",
      );
    if (!/^\d{10,11}$/.test(d.whatsapp.replace(/\D/g, "")))
      errs.push("Informe um WhatsApp com DDD e 10 ou 11 dígitos.");
    if (c.id === "100-milhas-light" && !validCPF(d.cpf))
      errs.push("Confira o CPF do chefe de equipe.");
    if (c.team) errs.push(...validatePilots(karts, c));
    if (errs.length) {
      setErrors(errs);
      setTimeout(() => errorsRef.current?.focus(), 0);
      return;
    }
    setErrors([]);
    setSending(true);
    const payload = registrationPayload(c, d, karts);
    const text = [
      `Olá! Quero concluir minha inscrição em ${c.name}.`,
      c.team ? `Equipe: ${d.equipe}` : "",
      `Responsável/piloto: ${d.nome}`,
      `WhatsApp: ${d.whatsapp}`,
      `E-mail: ${d.email}`,
      `Cidade: ${d.cidade}`,
      c.team
        ? `Karts: ${karts.length}\n${karts.flatMap((k, i) => k.map((p) => `Kart ${i + 1} — ${p.nome}, ${p.idade} anos, ${p.altura} m, ${p.peso} kg`)).join("\n")}`
        : "",
      c.price ? `Valor: ${money(c.price * karts.length)}` : "",
      `Pagamento: ${payload.pagamento}`,
      d.observacoes || "",
      "Li o regulamento e aceito as condições. Aguardo os dados para pagamento.",
    ]
      .filter(Boolean)
      .join("\n");
    try {
      const response = await fetch("/api/inscricao", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(20000),
      });
      const body = await response.json();
      if (!response.ok || !body.ok || !body.protocol)
        throw new Error("Não foi possível confirmar o registro.");
      setResult({
        ok: true,
        protocol: body.protocol,
        href: whatsapp(`Protocolo: ${body.protocol}\n${text}`),
      });
    } catch {
      setResult({ ok: false, href: whatsapp(text) });
    } finally {
      setSending(false);
      setTimeout(() => resultRef.current?.focus(), 0);
    }
  };
  return (
    <section id="formulario" className="container section registration-section">
      <div className="registration-heading">
        <span className="section-label">
          {c.team ? "Inscrição de equipe" : "Inscrição de piloto"}
        </span>
        <h2>
          O próximo grid
          <br />
          começa <em>aqui.</em>
        </h2>
        <p>
          Preencha os dados, receba o protocolo e envie a mensagem pronta no
          WhatsApp da organização. A vaga depende da confirmação e do pagamento.
        </p>
        {c.team && (
          <div className="registration-total">
            <span>Total da inscrição</span>
            <strong>{money(c.price * karts.length)}</strong>
            <small>
              {karts.length} {karts.length === 1 ? "kart" : "karts"} ×{" "}
              {money(c.price)}
            </small>
          </div>
        )}
        <div className="registration-help">
          <h3>Precisa de uma mão?</h3>
          <p>A organização ajuda com regras, pagamento e requisitos.</p>
          <a
            href={whatsapp(
              `Olá! Preciso de ajuda para me inscrever em ${c.name}.`,
            )}
          >
            Falar com a equipe
            <ArrowUpRight size={16} />
          </a>
        </div>
      </div>
      {result && (
        <div
          className={`registration-result ${!result.ok ? "warning" : ""}`}
          ref={resultRef}
          tabIndex={-1}
          role="status"
        >
          {result.ok ? <CheckCircle2 size={42} /> : <AlertCircle size={42} />}
          <h3>
            {result.ok
              ? "Inscrição registrada."
              : "O registro não foi confirmado."}
          </h3>
          {result.ok ? (
            <>
              <span className="protocol">Protocolo {result.protocol}</span>
              <p>
                O cadastro foi recebido como pendente. Agora envie a mensagem no
                WhatsApp para concluir com a organização e receber os dados de
                pagamento.
              </p>
            </>
          ) : (
            <p>
              Não conseguimos salvar os dados no sistema agora. Você pode tentar
              novamente ou enviar a mensagem no WhatsApp para a organização
              cadastrar a inscrição manualmente.
            </p>
          )}
          <Button href={result.href}>
            {result.ok ? "Concluir no WhatsApp" : "Enviar dados no WhatsApp"}
          </Button>
          <p className="small muted">
            A vaga só é garantida depois da confirmação do pagamento.
          </p>
          <button className="back-button" onClick={() => setResult(null)}>
            <ArrowLeft size={16} />
            {result.ok ? "Voltar ao formulário" : "Revisar e tentar novamente"}
          </button>
        </div>
      )}
      <form
        hidden={!!result}
        className="registration-form form-panel"
        onSubmit={submit}
        aria-label={`Formulário de inscrição ${c.name}`}
      >
        {errors.length > 0 && (
          <div
            className="form-errors"
            tabIndex={-1}
            ref={errorsRef}
            role="alert"
          >
            <strong>Confira os dados para continuar</strong>
            <ul>
              {errors.map((t) => (
                <li key={t}>{t}</li>
              ))}
            </ul>
          </div>
        )}
        <fieldset disabled={sending}>
          <legend>
            01 · {c.team ? "Equipe e responsável" : "Seu cadastro"}
          </legend>
          {c.team && (
            <label>
              Nome da equipe
              <input
                name="equipe"
                maxLength="100"
                required
                placeholder="Nome oficial da equipe"
              />
            </label>
          )}
          <label>
            {c.team ? "Nome completo do chefe de equipe" : "Nome completo"}
            <input
              name="nome"
              autoComplete="name"
              required
              maxLength="100"
              placeholder="Nome e sobrenome"
            />
          </label>
          {c.id === "100-milhas-light" && (
            <label>
              CPF do chefe de equipe
              <input
                name="cpf"
                inputMode="numeric"
                required
                maxLength="14"
                placeholder="000.000.000-00"
                autoComplete="off"
              />
              <span className="field-hint">
                Usado no cadastro oficial da inscrição.
              </span>
            </label>
          )}
          <div className="form-row">
            <label>
              WhatsApp com DDD
              <input
                name="whatsapp"
                type="tel"
                autoComplete="tel"
                required
                maxLength="20"
                placeholder="(31) 99999-9999"
              />
            </label>
            <label>
              E-mail
              <input
                name="email"
                type="email"
                autoComplete="email"
                required
                maxLength="150"
                placeholder="voce@exemplo.com"
              />
            </label>
          </div>
          <label>
            Cidade
            <input
              name="cidade"
              autoComplete="address-level2"
              required
              maxLength="100"
              placeholder="Sua cidade"
            />
          </label>
          {!c.team && (
            <div className="form-row">
              <label>
                Idade
                <input name="idade" type="number" min="14" max="90" required />
              </label>
              <label>
                Peso (kg)
                <input
                  name="peso"
                  type="number"
                  min="50"
                  max="180"
                  step="0.1"
                  required
                />
              </label>
            </div>
          )}
        </fieldset>
        {c.team && (
          <fieldset disabled={sending}>
            <legend>02 · Karts e pilotos</legend>
            <label>
              Quantidade de karts
              <select
                value={karts.length}
                onChange={(e) => kartCount(e.target.value)}
                aria-label="Quantidade de karts"
              >
                {[1, 2, 3, 4, 5].map((n) => (
                  <option value={n} key={n}>
                    {n} {n === 1 ? "kart" : "karts"} · {money(n * c.price)}
                  </option>
                ))}
              </select>
            </label>
            <p className="small muted">
              {c.id === "100-milhas-light"
                ? "De 1 a 3 pilotos por kart."
                : "Equipe com pelo menos 2 pilotos."}{" "}
              Todos precisam ter {c.minAge} anos ou mais, altura acima de 1,50 m
              e peso acima de 50 kg. Menores de 18 anos devem estar com um
              responsável adulto.
            </p>
            {karts.map((k, ki) => (
              <div className="pilot-kart" key={ki}>
                <h3>
                  Kart {ki + 1}
                  <span>
                    {k.length} {k.length === 1 ? "piloto" : "pilotos"}
                  </span>
                </h3>
                {k.map((p, pi) => (
                  <div className="pilot-fields" key={pi}>
                    <div className="pilot-fields-title">
                      <strong>Piloto {pi + 1}</strong>
                      {k.length > c.minPilots && (
                        <button
                          type="button"
                          className="remove-pilot"
                          aria-label={`Remover piloto ${pi + 1} do kart ${ki + 1}`}
                          onClick={() => removePilot(ki, pi)}
                        >
                          <Trash2 size={16} />
                          Remover
                        </button>
                      )}
                    </div>
                    <label>
                      Nome completo
                      <input
                        value={p.nome}
                        onChange={(e) => update(ki, pi, "nome", e.target.value)}
                        required
                        maxLength="100"
                        autoComplete="off"
                      />
                    </label>
                    <div className="form-row pilot-numbers">
                      <label>
                        Idade
                        <input
                          type="number"
                          value={p.idade}
                          onChange={(e) =>
                            update(ki, pi, "idade", e.target.value)
                          }
                          required
                          min={c.minAge}
                          max="90"
                          inputMode="numeric"
                        />
                      </label>
                      <label>
                        Altura (m)
                        <input
                          type="number"
                          value={p.altura}
                          onChange={(e) =>
                            update(ki, pi, "altura", e.target.value)
                          }
                          required
                          min="1.51"
                          max="2.3"
                          step="0.01"
                          inputMode="decimal"
                          placeholder="1,70"
                        />
                      </label>
                      <label>
                        Peso (kg)
                        <input
                          type="number"
                          value={p.peso}
                          onChange={(e) =>
                            update(ki, pi, "peso", e.target.value)
                          }
                          required
                          min="50.1"
                          max="180"
                          step="0.1"
                          inputMode="decimal"
                        />
                      </label>
                    </div>
                  </div>
                ))}
                {k.length < (c.id === "100-milhas-light" ? 3 : 25) &&
                  karts.flat().length < 50 && (
                    <button
                      type="button"
                      className="add-pilot"
                      onClick={() =>
                        setKarts(
                          karts.map((x, i) => (i === ki ? [...x, pilot()] : x)),
                        )
                      }
                    >
                      <Plus size={17} />
                      Adicionar piloto
                    </button>
                  )}
              </div>
            ))}
          </fieldset>
        )}
        <fieldset disabled={sending}>
          <legend>
            {c.team ? "03" : "02"} ·{" "}
            {c.team ? "Pagamento e observações" : "Observações"}
          </legend>
          {c.team && (
            <label>
              Forma de pagamento
              <select name="pagamento" required defaultValue="">
                <option value="" disabled>
                  Selecione
                </option>
                <option>Pix</option>
                <option>Transferência bancária</option>
                <option>
                  {c.id === "100-milhas-light"
                    ? "Cartão de crédito (até 3x)"
                    : "Cartão de crédito (até 5x sem juros)"}
                </option>
              </select>
            </label>
          )}
          <label>
            Observações <span className="muted">(opcional)</span>
            <textarea
              name="observacoes"
              rows="3"
              maxLength="1000"
              placeholder="Algo que a organização precisa saber?"
            />
          </label>
        </fieldset>
        <fieldset disabled={sending} className="form-consents">
          <legend>{c.team ? "04" : "03"} · Confirmações</legend>
          <label>
            <input type="checkbox" name="regulamento" required />
            <span>
              Li e aceito o{" "}
              <a
                href={`/media/regulamentos/${c.pdf}`}
                target="_blank"
                rel="noopener noreferrer"
              >
                regulamento oficial
              </a>
              .
            </span>
          </label>
          <label>
            <input type="checkbox" name="responsabilidade" required />
            <span>
              Confirmo os requisitos dos pilotos e que menores de idade terão um
              responsável adulto. A vaga depende do pagamento e da confirmação
              da organização.
            </span>
          </label>
          {c.team && (
            <label>
              <input type="checkbox" name="imagem" />
              <span>
                Autorizo o uso de imagem da equipe na divulgação do evento{" "}
                <span className="muted">(opcional)</span>.
              </span>
            </label>
          )}
        </fieldset>
        <button type="submit" className="button" disabled={sending}>
          {sending ? (
            <>
              <LoaderCircle className="spinner" size={18} />
              Registrando inscrição...
            </>
          ) : (
            <>
              Registrar e continuar
              <ArrowUpRight size={19} />
            </>
          )}
        </button>
        <p className="small muted">
          Seus dados são enviados ao cadastro de campeonatos do kartódromo. O
          próximo passo é concluir com a organização no WhatsApp.
        </p>
      </form>
    </section>
  );
}
