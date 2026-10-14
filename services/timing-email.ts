/**
 * Envio do resultado por e-mail aos pilotos (no lugar do "envio automático de e-mail" do LapTime).
 * Conta de e-mail do KARTÓDROMO (HostGator: mail.kartodromodebetim.com.br) — nunca a do fornecedor do LapTime.
 * Configuração em data/timing/email.json (fora do git); a senha nunca volta pela API nem vai para o log.
 * PDFs gerados pelo Edge do próprio PC (headless). No simulador nada sai de verdade: vira arquivo .eml.
 */
import { execFile } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import https from 'node:https';
import { join } from 'node:path';
import tls from 'node:tls';
import nodemailer from 'nodemailer';
import type { EnvioEmailsResultado, Session } from '../lib/timing/race-engine';
import {
  assunto,
  destinatarios,
  emailValido,
  AVISO_ATRASO,
  AVISO_CORRECAO,
  htmlEmail,
  htmlPdfResultado,
  htmlPdfVoltaAVolta,
  htmlPdfVoltaAVoltaTodos,
  nomeArquivo,
  textoEmail,
  voltasDoPiloto,
  type ContextoProva,
  type PilotoEmail,
} from '../lib/timing/email-resultado';

export type ConfigEmail = {
  /** dispara sozinho ao encerrar tomada de tempo e corrida */
  automatico: boolean;
  host: string;
  porta: number;
  usuario: string;
  senha: string;
  remetenteNome: string;
  /** vazio = o próprio usuário (a HostGator só aceita remetente da caixa autenticada) */
  remetenteEmail: string;
  /** cópia oculta de todo envio (ex.: a caixa do kartódromo, para conferência) */
  copiaOculta: string;
  /** anexar os PDFs (resultado oficial + volta a volta), como o LapTime */
  anexarPdf: boolean;
};

export const CONFIG_PADRAO: ConfigEmail = {
  automatico: true,
  host: 'mail.kartodromodebetim.com.br',
  porta: 465,
  usuario: '',
  senha: '',
  remetenteNome: 'Kartódromo Internacional de Betim',
  remetenteEmail: '',
  copiaOculta: '',
  anexarPdf: true,
};

export function lerConfig(arquivo: string): ConfigEmail {
  try {
    return { ...CONFIG_PADRAO, ...(JSON.parse(readFileSync(arquivo, 'utf8')) as Partial<ConfigEmail>) };
  } catch {
    return { ...CONFIG_PADRAO };
  }
}

/** Grava o que veio da tela; senha vazia = mantém a atual. */
export function salvarConfig(arquivo: string, entrada: Record<string, unknown>): ConfigEmail {
  const novo = montarConfig(lerConfig(arquivo), entrada);
  writeFileSync(arquivo, JSON.stringify(novo, null, 2));
  return novo;
}

/**
 * Configuração da tela aplicada sobre a gravada, com as mesmas validações, SEM gravar (o "Enviar teste" usa isto:
 * testar e depois cancelar não pode deixar a configuração trocada).
 */
export function montarConfig(atual: ConfigEmail, entrada: Record<string, unknown>): ConfigEmail {
  const texto = (k: keyof ConfigEmail, max = 200) => (typeof entrada[k] === 'string' ? String(entrada[k]).trim().slice(0, max) : (atual[k] as string));
  const novo: ConfigEmail = {
    automatico: typeof entrada.automatico === 'boolean' ? entrada.automatico : atual.automatico,
    host: texto('host'),
    porta: Number.isInteger(Number(entrada.porta)) && Number(entrada.porta) > 0 ? Number(entrada.porta) : atual.porta,
    usuario: texto('usuario'),
    senha: typeof entrada.senha === 'string' && entrada.senha.length > 0 ? entrada.senha : atual.senha,
    remetenteNome: texto('remetenteNome'),
    // trocou a caixa e a tela não mandou remetente: sai pela caixa nova (o antigo ficaria com o e-mail da conta anterior)
    remetenteEmail: typeof entrada.remetenteEmail === 'string' || texto('usuario').toLowerCase() === atual.usuario.toLowerCase() ? texto('remetenteEmail') : '',
    copiaOculta: texto('copiaOculta'),
    anexarPdf: typeof entrada.anexarPdf === 'boolean' ? entrada.anexarPdf : atual.anexarPdf,
  };
  if (novo.usuario && !emailValido(novo.usuario) && !(novo.usuario === 'api_token' && smtpCloudflare(novo.host)))
    throw new Error('Usuário deve ser o e-mail completo da caixa (ex.: resultados@kartodromodebetim.com.br).');
  if (novo.remetenteEmail && !emailValido(novo.remetenteEmail)) throw new Error('E-mail do remetente inválido.');
  if (novo.copiaOculta && !emailValido(novo.copiaOculta)) throw new Error('E-mail da cópia oculta inválido.');
  // a senha guardada é da caixa/servidor anterior: trocar o servidor ou a caixa sem digitar a senha mandaria a
  // senha antiga para outro servidor
  const semSenhaNova = !(typeof entrada.senha === 'string' && entrada.senha.length > 0);
  const mudouDestino = novo.host.toLowerCase() !== atual.host.trim().toLowerCase() || novo.usuario.toLowerCase() !== atual.usuario.trim().toLowerCase();
  if (semSenhaNova && mudouDestino && atual.senha) {
    if (novo.host && novo.usuario) throw new Error('Você trocou o servidor ou a caixa de e-mail: digite a senha dessa caixa.');
    novo.senha = '';
  }
  return novo;
}

/**
 * SMTP do Cloudflare Email Sending (06/10: a saída da HostGator descarta tudo no relay cloudfilter.net).
 * Login: usuário "api_token" e senha = token só com "Email Sending: Edit", digitado pelo dono na tela.
 */
export const SMTP_CLOUDFLARE = 'smtp.mx.cloudflare.net';
export const REMETENTE_PADRAO = 'crono@kartodromodebetim.com.br';
export function smtpCloudflare(host: string) { return host.trim().toLowerCase() === SMTP_CLOUDFLARE; }

/** O remetente tem que ser uma caixa do domínio (crono@ ou resultados@); na HostGator, a própria caixa autenticada. */
export function enderecoRemetente(cfg: ConfigEmail, padrao = REMETENTE_PADRAO) {
  if (!cfg.usuario.includes('@')) return cfg.remetenteEmail || padrao;
  const dominio = (e: string) => e.slice(e.lastIndexOf('@') + 1).toLowerCase();
  if (cfg.remetenteEmail && dominio(cfg.remetenteEmail) === dominio(cfg.usuario)) return cfg.remetenteEmail;
  return cfg.usuario;
}

/** O que a tela pode ver: tudo menos a senha. */
export function configPublica(c: ConfigEmail) {
  const { senha, ...resto } = c;
  return { ...resto, senhaDefinida: senha.length > 0, pronto: Boolean(c.host && c.usuario && senha) };
}

export type Dependencias = {
  dataDir: string;
  simulador: boolean;
  log: (texto: string) => void;
  salvarSessao: (s: Session) => void;
  contexto: (s: Session) => Promise<ContextoProva>;
  /** clienteId → e-mail (cadastro da recepção) */
  emailsDosClientes: (ids: string[]) => Promise<Map<string, string>>;
  logoPng: Buffer | null;
};

// hospedagem compartilhada (HostGator): mail.<domínio> entrega o certificado da própria HostGator (*.hostgator.com.br).
// A cadeia continua sendo verificada; só o nome aceita também o da HostGator.
function aceitaNomeHostgator(host: string, cert: tls.PeerCertificate) {
  const erro = tls.checkServerIdentity(host, cert);
  return erro && /(^|,\s*)DNS:\*\.hostgator\.com\.br(,|$)/.test(cert.subjectaltname ?? '') ? undefined : erro;
}

export type Entrega = { tipo: string; motivo: string };

export type SituacaoTesteEmail = {
  status: 'aceito-pelo-relay' | 'aceito-pelo-smtp';
  entregaConfirmada: false;
  mensagem: string;
};

export type SituacaoEnvioEmail = SituacaoTesteEmail | {
  status: 'simulador';
  entregaConfirmada: false;
  mensagem: string;
};

/**
 * O rastreio da hospedagem só confirma aceite pelo relay. Ele não acessa a
 * caixa do destinatário, portanto nunca deve ser apresentado como recebimento.
 */
export function situacaoTesteEmail(entrega: Entrega | null): SituacaoTesteEmail {
  return entrega?.tipo === 'success'
    ? {
      status: 'aceito-pelo-relay',
      entregaConfirmada: false,
      mensagem: 'O relay aceitou a mensagem, mas não foi possível confirmar a chegada na caixa do destinatário.',
    }
    : {
      status: 'aceito-pelo-smtp',
      entregaConfirmada: false,
      mensagem: 'O servidor SMTP aceitou a mensagem, mas não foi possível confirmar a chegada na caixa do destinatário.',
    };
}

function motivoEntrega(tipo: string, mensagem: string) {
  if (tipo === 'filtered') return 'descartado pelo antispam de saída da hospedagem (HostGator) — peça a liberação do envio da conta';
  if (tipo === 'defer') return `adiado pelo destino (a hospedagem tenta de novo): ${mensagem}`.slice(0, 200);
  return `recusado: ${mensagem || tipo}`.slice(0, 200);
}

/**
 * O SMTP da hospedagem responde "250 OK" mesmo quando o antispam de saída joga a mensagem fora (30/09: o fightspamHG
 * da HostGator descartou todos os resultados e a tela dizia "enviado"). O rastreio de entrega do webmail (cPanel,
 * porta 2096, mesma conta) mostra o destino real. null = não deu para consultar (outra hospedagem, sem rede…).
 */
export async function conferirEntrega(cfg: ConfigEmail, desdeMs: number): Promise<Map<string, Entrega & { t: number }> | null> {
  if (smtpCloudflare(cfg.host) || !cfg.usuario.includes('@')) return null; // o rastreio é do webmail da HostGator; nunca mandar o token para lá
  const caminho = '/json-api/cpanel?cpanel_jsonapi_module=EmailTrack&cpanel_jsonapi_func=search&cpanel_jsonapi_apiversion=2&success=1&defer=1&failure=1&inprogress=1&deliverytype=all';
  const corpo = await new Promise<string | null>((ok) => {
    const req = https.request({
      host: cfg.host, port: 2096, path: caminho, method: 'GET', timeout: 15_000, checkServerIdentity: aceitaNomeHostgator,
      headers: { authorization: 'Basic ' + Buffer.from(`${cfg.usuario}:${cfg.senha}`).toString('base64') },
    }, (res) => {
      let d = '';
      res.setEncoding('utf8');
      res.on('data', (c) => { d += c; });
      res.on('end', () => ok(res.statusCode === 200 ? d : null));
    });
    req.on('error', () => ok(null));
    req.on('timeout', () => { req.destroy(); ok(null); });
    req.end();
  });
  if (!corpo) return null;
  type Linha = { type?: string; recipient?: string; sender?: string; email?: string; message?: string; sendunixtime?: number };
  let lista: Linha[];
  try { const j = JSON.parse(corpo); lista = j.cpanelresult?.data ?? j.data; } catch { return null; }
  if (!Array.isArray(lista)) return null;
  const r = new Map<string, Entrega & { t: number }>();
  for (const x of lista) {
    const t = Number(x.sendunixtime ?? 0) * 1000;
    if (t < desdeMs - 60_000) continue;
    if (String(x.sender ?? x.email ?? '').toLowerCase() !== cfg.usuario.toLowerCase()) continue;
    const dest = String(x.recipient ?? '').toLowerCase();
    if (!dest || (r.get(dest)?.t ?? 0) > t) continue;
    r.set(dest, { tipo: String(x.type ?? ''), motivo: motivoEntrega(String(x.type ?? ''), String(x.message ?? '')), t });
  }
  return r;
}

/** Espera o rastreio registrar os destinatários (costuma levar segundos). */
async function conferirComEspera(cfg: ConfigEmail, desdeMs: number, enderecos: string[]) {
  let r: Awaited<ReturnType<typeof conferirEntrega>> = null;
  for (let i = 0; i < 3; i++) {
    await new Promise((ok) => setTimeout(ok, 4_000));
    r = await conferirEntrega(cfg, desdeMs);
    if (!r || enderecos.every((e) => r!.has(e.toLowerCase()))) break;
  }
  return r;
}

const ENTREGA_RUIM = new Set(['filtered', 'failure', 'rejected']);

export const SMTP_EHLO_PADRAO = 'mail.kartodromodebetim.com.br';

function nomeEhlo(host: string) {
  const limpo = host.trim().replace(/^\[|\]$/g, '');
  const ipv4 = /^\d{1,3}(?:\.\d{1,3}){3}$/.test(limpo);
  const local = !limpo || limpo === 'localhost' || ipv4 || limpo.includes(':') || !limpo.includes('.') || smtpCloudflare(limpo);
  return local ? SMTP_EHLO_PADRAO : limpo;
}

export function opcoesTransporte(cfg: ConfigEmail, simulador: boolean) {
  if (simulador) return { streamTransport: true, buffer: true, newline: 'windows' as const };
  return {
    host: cfg.host,
    port: cfg.porta,
    secure: cfg.porta === 465,
    requireTLS: cfg.porta === 587,
    name: nomeEhlo(cfg.host),
    auth: { user: cfg.usuario, pass: cfg.senha },
    tls: { checkServerIdentity: aceitaNomeHostgator },
    connectionTimeout: 15_000,
    greetingTimeout: 15_000,
    socketTimeout: 30_000,
  };
}

export function situacaoEnvioEmail(entrega: Entrega | null, simulador: boolean): SituacaoEnvioEmail {
  if (simulador) {
    return {
      status: 'simulador',
      entregaConfirmada: false,
      mensagem: 'Teste gravado no simulador; nenhuma entrega foi feita.',
    };
  }
  return situacaoTesteEmail(entrega);
}

function transporte(cfg: ConfigEmail, simulador: boolean) {
  return nodemailer.createTransport(opcoesTransporte(cfg, simulador));
}

// o serviço roda como SISTEMA (sessão 0): o Edge se recusa (sai com 1002); o Chrome com --no-sandbox funciona.
const EDGE = [process.env.TIMING_EDGE_PATH, 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', 'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe', 'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe'].filter(Boolean) as string[];

/** HTML → PDF pelo Edge headless (perfil próprio, não mexe no Edge de quem usa o PC). null se não conseguir. */
export async function gerarPdf(html: string, pasta: string, base: string, log: (t: string) => void): Promise<Buffer | null> {
  const edge = EDGE.find((p) => existsSync(p));
  if (!edge) { log('e-mail: Chrome/Edge não encontrado, resultado vai sem PDF'); return null; }
  mkdirSync(pasta, { recursive: true });
  const htmlArq = join(pasta, `${base}.html`);
  const pdfArq = join(pasta, `${base}.pdf`);
  writeFileSync(htmlArq, html, 'utf8');
  // perfil próprio a cada PDF: com um só, o 2º envio seguido falhava enquanto o Edge do 1º ainda fechava
  const perfil = join(pasta, `perfil-${process.pid}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`);
  const rodar = () => new Promise<void>((ok, falha) =>
    execFile(edge, ['--headless=new', '--no-sandbox', '--disable-gpu', '--no-first-run', '--disable-crash-reporter', '--no-pdf-header-footer', `--user-data-dir=${perfil}`,
      `--print-to-pdf=${pdfArq}`, 'file:///' + htmlArq.replace(/\\/g, '/')], { timeout: 45_000, windowsHide: true }, (err) => (err && !existsSync(pdfArq) ? falha(err) : ok())));
  try {
    try { await rodar(); } catch { await new Promise((r) => setTimeout(r, 1500)); await rodar(); } // uma nova tentativa
    return existsSync(pdfArq) ? readFileSync(pdfArq) : null;
  } catch (e) {
    log(`e-mail: PDF ${base} não foi gerado (${(e as Error).message.split('\n')[0].slice(0, 160)}); envia sem ele`);
    return null;
  } finally {
    for (const a of [htmlArq, pdfArq]) try { rmSync(a, { force: true }); } catch { /* arquivo em uso */ }
    setTimeout(() => { try { rmSync(perfil, { recursive: true, force: true }); } catch { /* Edge ainda fechando */ } }, 10_000);
  }
}

export type OpcoesEnvio = {
  /** true = disparo do encerramento: respeita "automático" e não repete quem já recebeu */
  automatico: boolean;
  /** nome do evento da bateria (para reconhecer o Tabajara pelo nome) */
  nomeEvento?: string;
  /** só este kart (reenvio para um piloto) */
  kart?: string | null;
  /** manda o resultado oficial para este endereço (ex.: o pai do piloto, o dono do evento) */
  para?: string | null;
  /** com "para": vai também o volta a volta de TODOS os pilotos num PDF só (organizador do Tabajara divulga) */
  organizador?: boolean;
  /** reenvio manual só para quem ainda não recebeu (falhas do domingo 11/10, limite diário do Gmail) */
  somenteFaltantes?: boolean;
  /** reenvio de resultado que não chegou na data: o e-mail abre com o pedido de desculpas (AVISO_ATRASO) */
  atrasado?: boolean;
  /** reenvio depois de a classificação mudar com a bateria já encerrada: abre com AVISO_CORRECAO */
  corrigido?: boolean;
};

/**
 * Bateria em que o organizador divulga o resultado (Tabajara, áudio de 06/10): o automático não manda aos pilotos.
 * Sem marcação na bateria, vale o nome: "Tabajara" no nome do evento/bateria = não manda.
 */
export function semEmailAosPilotos(s: Session, nomeEvento = '') {
  if (typeof s.semEmailPilotos === 'boolean') return s.semEmailPilotos;
  return /tabajara/i.test(`${nomeEvento} ${s.name}`);
}

/**
 * Manda o resultado da prova. Um e-mail por piloto (resumo dele + classificação) com os PDFs anexos.
 * Guarda em s.emailsResultado quem recebeu, quem falhou e quem está sem e-mail; falhas tentam de novo depois.
 */
export async function enviarResultado(s: Session, cfgArquivo: string, dep: Dependencias, op: OpcoesEnvio): Promise<EnvioEmailsResultado> {
  const cfg = lerConfig(cfgArquivo);
  const anterior = s.emailsResultado;
  const agora = Date.now();
  if (op.automatico && (!cfg.automatico || semEmailAosPilotos(s, op.nomeEvento ?? ''))) {
    s.emailsResultado = { status: cfg.automatico ? 'sem-email-pilotos' : 'desligado', atualizadoEm: agora, tentativas: 0, enviados: [], falhas: [], semEmail: [] };
    dep.salvarSessao(s);
    return s.emailsResultado;
  }
  if (!dep.simulador && !(cfg.host && cfg.usuario && cfg.senha)) throw new Error('E-mail não configurado: preencha a conta de e-mail do kartódromo em Cronometragem › Configurar e-mail dos resultados.');

  const ctx = await dep.contexto(s);
  const ids = [...new Set(s.competitors.map((c) => c.customerId).filter(Boolean).map(String))];
  const emails = ids.length ? await dep.emailsDosClientes(ids) : new Map<string, string>();
  const todos = destinatarios(s, emails);
  const semEmail = s.competitors
    .filter((c) => !c.autoAdded && !c.detalhes?.oculto && !todos.some((d) => d.competidor === c))
    .map((c) => ({ kart: c.kart, nome: c.name }));

  // quem recebe desta vez
  type Alvo = { kart: string; nome: string; email: string; piloto: PilotoEmail | null };
  let alvos: Alvo[];
  const piloto = (c: (typeof todos)[number]['competidor'], email: string): PilotoEmail => ({
    nome: c.name, kart: c.kart, email, standing: ctx.classificacao.find((r) => r.kart === c.kart && r.name === c.name) ?? ctx.classificacao.find((r) => r.kart === c.kart) ?? null, voltas: voltasDoPiloto(c),
  });
  if (op.para) {
    if (!emailValido(op.para)) throw new Error('Endereço de e-mail inválido.');
    const para = op.para.trim().toLowerCase();
    // com kart: o mesmo e-mail que aquele piloto recebe (resumo + volta a volta dele), entregue neste endereço
    const c = op.kart ? s.competitors.find((x) => x.kart === op.kart && !x.autoAdded) ?? s.competitors.find((x) => x.kart === op.kart) : null;
    if (op.kart && !c) throw new Error(`Kart ${op.kart} não está nesta prova.`);
    alvos = [{ kart: c?.kart ?? '', nome: c?.name ?? 'Resultado', email: para, piloto: c ? piloto(c, para) : null }];
  } else {
    const jaForam = new Set(op.automatico || op.somenteFaltantes ? anterior?.enviados ?? [] : []);
    alvos = todos
      .filter((d) => !op.kart || d.competidor.kart === op.kart)
      .filter((d) => !jaForam.has(`${d.competidor.kart}|${d.email}`))
      .map((d) => ({ kart: d.competidor.kart, nome: d.competidor.name, email: d.email, piloto: piloto(d.competidor, d.email) }));
    if (op.kart && !alvos.length) throw new Error(`O piloto do kart ${op.kart} não tem e-mail no cadastro.`);
  }

  const pasta = join(dep.dataDir, 'emails-tmp');
  const logoDataUri = dep.logoPng ? `data:image/png;base64,${dep.logoPng.toString('base64')}` : null;
  const base = nomeArquivo(`Resultado ${[ctx.grupo, ctx.prova].filter(Boolean).join(' ')}`);
  const pdfResultado = cfg.anexarPdf ? await gerarPdf(htmlPdfResultado(ctx, logoDataUri), pasta, `${s.id}-resultado`, dep.log) : null;
  const t = transporte(cfg, dep.simulador);
  const remetente = { name: cfg.remetenteNome || ctx.empresa.nome, address: enderecoRemetente(cfg) };
  const enviados = op.automatico || op.somenteFaltantes ? [...(anterior?.enviados ?? [])] : [];
  const aviso = op.atrasado ? AVISO_ATRASO : op.corrigido ? AVISO_CORRECAO : undefined;
  const falhas: EnvioEmailsResultado['falhas'] = [];
  const pastaTeste = join(dep.dataDir, 'emails-simulador');
  const inicioEnvio = Date.now();

  for (const a of alvos) {
    try {
      const p: PilotoEmail = a.piloto ?? { nome: 'amigo(a)', kart: '', email: a.email, standing: null, voltas: [] };
      const anexos: { filename: string; content: Buffer; contentType?: string; cid?: string }[] = [];
      if (dep.logoPng) anexos.push({ filename: 'logo.png', content: dep.logoPng, contentType: 'image/png', cid: 'logo-kartodromo' });
      if (pdfResultado) anexos.push({ filename: `${base}.pdf`, content: pdfResultado, contentType: 'application/pdf' });
      if (op.organizador) {
        // pacote do organizador: o volta a volta de todos os pilotos num PDF só (sempre anexa, mesmo com anexos desligados)
        const pilotosTodos = s.competitors.filter((c) => !c.autoAdded && !c.detalhes?.oculto && c.crossings.some((x) => !x.deleted))
          .map((c) => piloto(c, a.email))
          .sort((x, y) => (x.standing?.position ?? 999) - (y.standing?.position ?? 999));
        const todos = await gerarPdf(htmlPdfVoltaAVoltaTodos(ctx, pilotosTodos, logoDataUri), pasta, `${s.id}-todos`, dep.log);
        if (todos) anexos.push({ filename: nomeArquivo(`Volta a volta de todos ${[ctx.grupo, ctx.prova].filter(Boolean).join(' ')}`) + '.pdf', content: todos, contentType: 'application/pdf' });
        if (!pdfResultado) {
          const r = await gerarPdf(htmlPdfResultado(ctx, logoDataUri), pasta, `${s.id}-resultado`, dep.log);
          if (r) anexos.push({ filename: `${base}.pdf`, content: r, contentType: 'application/pdf' });
        }
      } else if (cfg.anexarPdf && a.piloto) {
        const vv = await gerarPdf(htmlPdfVoltaAVolta(ctx, a.piloto, logoDataUri), pasta, `${s.id}-${nomeArquivo(a.kart)}`, dep.log);
        if (vv) anexos.push({ filename: nomeArquivo(`Volta a volta ${a.nome} kart ${a.kart}`) + '.pdf', content: vv, contentType: 'application/pdf' });
      }
      const info = await t.sendMail({
        from: remetente,
        to: a.piloto ? { name: a.nome, address: a.email } : a.email,
        bcc: cfg.copiaOculta || undefined,
        subject: assunto(ctx),
        html: htmlEmail(ctx, p, dep.logoPng ? 'logo-kartodromo' : null, aviso),
        text: textoEmail(ctx, p, aviso),
        attachments: anexos,
      });
      if (dep.simulador) {
        mkdirSync(pastaTeste, { recursive: true });
        writeFileSync(join(pastaTeste, `${s.id}-${nomeArquivo(a.kart || 'avulso')}.eml`), (info as unknown as { message: Buffer }).message);
      }
      if (a.piloto && !op.para) enviados.push(`${a.kart}|${a.email}`);
    } catch (e) {
      falhas.push({ kart: a.kart, nome: a.nome, email: a.email, erro: traduzirErro(e).slice(0, 200) });
    }
  }
  t.close();

  // "250 OK" do SMTP não é entrega: confere no rastreio da hospedagem e devolve para falhas o que foi descartado
  const aceitos = alvos.filter((a) => !falhas.some((f) => f.kart === a.kart && f.email === a.email));
  let rastreioEntrega: Awaited<ReturnType<typeof conferirComEspera>> = null;
  if (!dep.simulador && aceitos.length) {
    rastreioEntrega = await conferirComEspera(cfg, inicioEnvio, aceitos.map((a) => a.email));
    if (!rastreioEntrega) dep.log('e-mail: não deu para conferir a entrega no rastreio da hospedagem (fica como aceito pelo servidor)');
    for (const a of aceitos) {
      const e = rastreioEntrega?.get(a.email.toLowerCase());
      if (!e || !ENTREGA_RUIM.has(e.tipo)) continue;
      falhas.push({ kart: a.kart, nome: a.nome, email: a.email, erro: e.motivo });
      const chave = `${a.kart}|${a.email}`;
      for (let i = enviados.indexOf(chave); i >= 0; i = enviados.indexOf(chave)) enviados.splice(i, 1);
    }
  }

  const situacaoRastreio = rastreioEntrega
    ? [...rastreioEntrega.values()].find((e) => e.tipo === 'success') ?? [...rastreioEntrega.values()][0] ?? null
    : null;
  const situacaoEntrega = aceitos.length ? situacaoEnvioEmail(situacaoRastreio, dep.simulador) : null;
  const resultado: EnvioEmailsResultado = {
    status: !todos.length && !op.para ? 'sem-destinatarios' : falhas.length === 0 ? 'enviado' : falhas.length < alvos.length ? 'parcial' : 'falhou',
    atualizadoEm: Date.now(),
    tentativas: (anterior?.tentativas ?? 0) + 1,
    enviados: [...new Set(enviados)],
    falhas,
    semEmail,
    ...(situacaoEntrega ? {
      aceite: situacaoEntrega.status,
      entregaConfirmada: situacaoEntrega.entregaConfirmada,
      mensagemEntrega: situacaoEntrega.mensagem,
    } : {}),
  };
  // reenvio para um piloto só / outro endereço não apaga o histórico do envio da prova
  if (!op.kart && !op.para) { s.emailsResultado = resultado; dep.salvarSessao(s); }
  else if (anterior) {
    anterior.enviados = [...new Set([...anterior.enviados, ...enviados])];
    anterior.falhas = anterior.falhas.filter((f) => !enviados.includes(`${f.kart}|${f.email}`));
    if (anterior.falhas.length === 0 && anterior.status !== 'sem-destinatarios') anterior.status = 'enviado';
    anterior.atualizadoEm = Date.now();
    dep.salvarSessao(s);
  }
  const quem = op.para ? `para ${op.para}${op.kart ? ` (como o kart ${op.kart} recebe)` : ''}` : op.kart ? `para o kart ${op.kart}` : `${alvos.length - falhas.length} de ${alvos.length} pilotos`;
  dep.log(`e-mail do resultado de ${s.name}: ${quem} enviado(s)${falhas.length ? `, ${falhas.length} falha(s): ${falhas.map((f) => f.erro).join(' / ').slice(0, 300)}` : ''}${semEmail.length && !op.kart && !op.para ? `, ${semEmail.length} sem e-mail` : ''}`);
  return resultado;
}

/** Erros do servidor de e-mail em português (a tela e o registro mostram isso para o operador). */
export function traduzirErro(e: unknown): string {
  const m = e instanceof Error ? e.message : String(e);
  if (/\b535\b|Invalid login|authentication/i.test(m)) return 'o servidor de e-mail recusou o usuário/senha (confira se a caixa existe na hospedagem e se a senha está certa)';
  if (/certificate|altname|self.signed/i.test(m)) return 'certificado de segurança do servidor de e-mail não confere com o endereço';
  if (/ENOTFOUND|EAI_AGAIN/i.test(m)) return 'endereço do servidor de e-mail não encontrado (confira o "Servidor de saída")';
  if (/ETIMEDOUT|ECONNREFUSED|ECONNRESET|timeout/i.test(m)) return 'sem conexão com o servidor de e-mail (internet ou porta bloqueada)';
  // HostGator: "550 (500/500 (100%)) allowed. Message discarded." = limite de 500 e-mails por hora da conta (13/10)
  if (/\(\d+\/\d+ \(\d+%\)\) allowed|exceeded|sending limit/i.test(m)) return 'limite de e-mails por hora da hospedagem atingido (500 por hora); tenta de novo sozinho em alguns minutos';
  if (/\b550\b|relay/i.test(m)) return 'o servidor de e-mail não aceitou o destinatário';
  return m;
}

/** E-mail de teste da tela de configuração (confere servidor, porta, usuário e senha). */
/** `daTela`: o que está digitado na tela, testado sem gravar (sem ele vale a configuração gravada). */
export async function enviarTeste(cfgArquivo: string, para: string, simulador: boolean, daTela?: Record<string, unknown>): Promise<SituacaoTesteEmail | undefined> {
  const cfg = daTela ? montarConfig(lerConfig(cfgArquivo), daTela) : lerConfig(cfgArquivo);
  if (!emailValido(para)) throw new Error('Informe um e-mail válido para o teste.');
  if (!simulador && !(cfg.host && cfg.usuario && cfg.senha)) throw new Error('Preencha servidor, usuário e senha antes do teste.');
  const t = transporte(cfg, simulador);
  const inicio = Date.now();
  try {
    if (!simulador) await t.verify();
    await t.sendMail({
      from: { name: cfg.remetenteNome, address: enderecoRemetente(cfg) },
      to: para,
      subject: 'Teste do e-mail dos resultados · Cronometragem',
      text: 'Se você recebeu este e-mail, o envio automático dos resultados para os pilotos está funcionando.',
      html: '<p style="font-family:Segoe UI,Arial,sans-serif">Se você recebeu este e-mail, o envio automático dos resultados para os pilotos está <b>funcionando</b>.</p>',
    });
  } finally {
    t.close();
  }
  if (simulador) return undefined;
  const e = (await conferirComEspera(cfg, inicio, [para]))?.get(para.trim().toLowerCase());
  if (e && ENTREGA_RUIM.has(e.tipo)) throw new Error(`o servidor aceitou, mas a mensagem não saiu: ${e.motivo}`);
  return situacaoTesteEmail(e ?? null);
}
