export type TermoEmpresa = {
  nome: string;
  razaoSocial?: string | null;
  cidade?: string | null;
};

export type TermoParticipante = {
  nome: string;
  documento: string | null;
  nascimento: string | null;
  email: string | null;
  telefone: string | null;
  cep: string | null;
  endereco: string | null;
  numero?: string | null;
  complemento?: string | null;
  bairro: string | null;
  cidade: string | null;
  responsavelNome: string | null;
  responsavelDocumento: string | null;
  responsavelTelefone: string | null;
  responsavelEmail: string | null;
};

type RenderTermoOptions = {
  empresa: TermoEmpresa;
  participantes: TermoParticipante[];
  branco?: boolean;
  textoPersonalizado?: string;
  impressoEm?: Date;
};

const esc = (value: unknown) =>
  String(value ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

const DEFAULT_SECTIONS: Array<{ titulo?: string; texto: (empresa: string) => string }> = [
  {
    texto: () =>
      'Pelo presente Termo de Responsabilidade, o participante acima qualificado declara estar ciente das condições abaixo elencadas atinentes à utilização do KARTÓDROMO, seja em treinos e ou provas de qualquer natureza:',
  },
  {
    titulo: 'Dos equipamentos obrigatórios:',
    texto: () => 'É de uso obrigatório para a prática do kartismo a idumentária completa, indispensável ao esporte.',
  },
  {
    titulo: 'Das condições gerais da pista:',
    texto: () =>
      'O participante declara ter plena consciência dos riscos inerentes ao esporte, tendo conhecimento das condições físicas da pista, seu traçado, acesso ao Box, bem como das normas previstas no Código Desportivo de Automobilismo e Regulamento Nacional de Kart.',
  },
  {
    titulo: 'Declaração de saúde:',
    texto: () => 'O participante declara neste ato, estar em plenas condições de saúde e apto a realizar a atividade esportiva.',
  },
  {
    titulo: 'Das responsabilidades:',
    texto: () =>
      'O kartódromo se reserva no direito de a qualquer momento durante a bateria, de excluir qualquer piloto que esteja conduzindo seu kart de maneira irresponsável ou antidesportiva colocando em risco a si e os demais pilotos; neste caso o piloto excluído perderá integralmente o valor de sua inscrição. É expressamente proibida a condução do kart, quando o piloto estiver alcoolizado ou sob efeito de qualquer substância entorpecente (conforme normas do Código Brasileiro de Trânsito).',
  },
  {
    titulo: 'Atenção:',
    texto: () =>
      'Em caso de acidentes provocados por condução imprudente, antidesportiva ou por não observar as regras e orientações, o piloto arcará com todos os danos materiais, pessoais e morais.',
  },
  {
    titulo: 'Menores de 18 (dezoito) anos:',
    texto: () => 'Os participantes/pilotos com idade inferior a DEZOITO anos deverão assinar o termo juntamente com seu Representante Legal.',
  },
  {
    texto: (empresa) =>
      'A ' +
      empresa +
      ', administradora do KARTÓDROMO, se exime de toda e qualquer responsabilidade civil ou penal, por infrações cometidas ou acidentes causados pelos participantes ou terceiros durante os treinos e as provas, sendo tais responsabilidades exclusivas daqueles que as tenham cometido ou ocasionado ou do Representante Legal.',
  },
  {
    texto: () =>
      'Declaro ter lido, compreendido e aceito as condições supra mencionadas, não cabendo qualquer alegação de desconhecimento quanto ao seu teor.',
  },
];

function dataNascimento(value: string | null) {
  const match = String(value ?? '').match(/^(\d{4})-(\d{2})-(\d{2})/);
  return match ? match[3] + '/' + match[2] + '/' + match[1] : value ?? '';
}

function dataImpressao(date: Date, cidade: string) {
  const data = new Intl.DateTimeFormat('pt-BR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'America/Sao_Paulo',
  }).format(date);
  const hora = new Intl.DateTimeFormat('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: 'America/Sao_Paulo',
  }).format(date);
  return cidade.toLocaleUpperCase('pt-BR') + ', ' + data + ', às ' + hora;
}

function renderLegal(empresa: string, textoPersonalizado?: string) {
  if (textoPersonalizado?.trim()) {
    return textoPersonalizado
      .split(/\n\s*\n/)
      .map((paragraph) => '<p>' + esc(paragraph).replace(/\n/g, '<br>') + '</p>')
      .join('');
  }
  return DEFAULT_SECTIONS.map((section) => {
    const title = section.titulo ? '<strong>' + esc(section.titulo) + '</strong> ' : '';
    const text = esc(section.texto(empresa));
    return '<p>' + title + text + '</p>';
  }).join('');
}

function value(text: string | null | undefined, branco: boolean, placeholder = '________________________') {
  const content = String(text ?? '').trim();
  return esc(branco ? placeholder : content);
}

function participanteHtml(
  participante: TermoParticipante,
  empresa: TermoEmpresa,
  branco: boolean,
  date: Date,
  textoPersonalizado?: string,
) {
  const endereco = [participante.endereco, participante.numero, participante.complemento]
    .map((part) => String(part ?? '').trim())
    .filter(Boolean)
    .join(', ');
  const companyName = empresa.razaoSocial?.trim() || empresa.nome;
  const city = empresa.cidade?.trim() || 'Betim';

  return (
    '<section class="page">' +
    '<img class="logo" src="/ui/kib-logo.png" alt="Kartódromo Internacional de Betim">' +
    '<h1>TERMO DE RESPONSABILIDADE</h1>' +
    '<div class="customer-info">' +
    '<div class="row"><div>Nome: ' + value(participante.nome, branco) + '</div></div>' +
    '<div class="row pair"><div>Doc.: ' + value(participante.documento, branco) + '</div><div>Nascimento: ' + value(dataNascimento(participante.nascimento), branco, '____/____/________') + '</div></div>' +
    '<div class="row"><div>Endereço: ' + value(endereco, branco) + '</div></div>' +
    '<div class="row pair"><div>Bairro: ' + value(participante.bairro, branco) + '</div><div>CEP: ' + value(participante.cep, branco) + '</div></div>' +
    '<div class="row"><div>Cidade: ' + value(participante.cidade, branco) + '</div></div>' +
    '<div class="row"><div>Tel.: ' + value(participante.telefone, branco) + '</div></div>' +
    '<div class="row"><div>E-mail: ' + value(participante.email, branco) + '</div></div>' +
    '</div>' +
    '<div class="rule rule-legal"></div>' +
    '<article class="legal">' +
    renderLegal(companyName, textoPersonalizado) +
    '</article>' +
    // igual ao termo do LapTime: data e as duas linhas de assinatura logo depois do texto (sem posição fixa,
    // que deixava o texto passar por cima quando era longo)
    '<div class="date">' + esc(dataImpressao(date, city)) + '</div>' +
    '<div class="assinatura"><div class="linha"></div><div class="rotulo">PARTICIPANTE PILOTO</div></div>' +
    '<div class="assinatura"><div class="linha"></div><div class="rotulo">RESPONSÁVEL LEGAL</div><div class="obs">(obrigatório para menores de 18 anos)</div></div>' +
    '</section>'
  );
}

export function renderTermoResponsabilidade(options: RenderTermoOptions) {
  const date = options.impressoEm ?? new Date();
  const pages = options.participantes
    .map((participante) => participanteHtml(participante, options.empresa, options.branco ?? false, date, options.textoPersonalizado))
    .join('');

  return (
    '<!doctype html><html lang="pt-BR"><head><meta charset="utf-8">' +
    '<meta name="viewport" content="width=device-width, initial-scale=1">' +
    '<title>Termo de responsabilidade</title><style>' +
    '@page{size:80mm 297mm;margin:0}' +
    '*{box-sizing:border-box}' +
    'html,body{margin:0;padding:0;width:80mm;background:#fff;color:#000}' +
    'body{font:8pt/1.22 Arial,Helvetica,sans-serif}' +
    '.page{position:relative;width:80mm;min-height:297mm;padding:0 5.7mm 0;display:flex;flex-direction:column;margin:0 auto;background:#fff;break-after:page;page-break-after:always}' +
    '.page:last-child{break-after:auto;page-break-after:auto}' +
    '.logo{display:block;width:38.1mm;height:20.3mm;object-fit:contain;filter:grayscale(1) contrast(1.15);margin:.7mm auto .7mm}' +
    'h1{font:bold 12pt/1.2 Arial,Helvetica,sans-serif;text-align:center;height:7.62mm;flex:none;margin:0}' +
    '.rule{height:0;border:0;border-top:.45pt solid #000;width:100%;flex:none}' +
    '.customer-info{font:8pt/1.35 Arial,Helvetica,sans-serif;margin:1.67mm 0 0;flex:none}' +
    '.row{min-height:3.81mm;display:block;overflow-wrap:anywhere}' +
    '.pair{display:grid;grid-template-columns:1fr 1fr;gap:1.5mm}' +
    '.rule-legal{margin-top:0}' +
    '.legal{font:8pt/1.1 Arial,Helvetica,sans-serif;text-align:justify;margin:1.52mm 0 0;flex:none}' +
    '.legal p{margin:0;orphans:2;widows:2}' +
    '.legal strong{font-weight:700}' +
    '.date{font:8pt/1.25 Arial,Helvetica,sans-serif;text-align:center;margin:5mm 0 0;flex:none}' +
    '.assinatura{margin:16mm auto 0;width:50mm;text-align:center;flex:none;break-inside:avoid;page-break-inside:avoid}' +
    '.assinatura .linha{border-top:.6pt solid #000}' +
    '.assinatura .rotulo{font:bold 8pt/1.3 Arial,Helvetica,sans-serif;margin-top:.8mm}' +
    '.assinatura .obs{font:6.5pt/1.2 Arial,Helvetica,sans-serif}' +
    '@media print{html,body{width:80mm}.page{margin:0;box-shadow:none}}' +
    '</style></head><body>' +
    (pages || '<p>Nada para imprimir.</p>') +
    '<script>window.addEventListener("load",()=>setTimeout(()=>window.print(),300));</script>' +
    '</body></html>'
  );
}
