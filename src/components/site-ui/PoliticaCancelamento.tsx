import { POLITICA_SECOES, POLITICA_TITULO } from '../../config/politica-cancelamento';

/** Texto oficial da política (mesma fonte da página de reserva online e do aceite gravado em cada pedido). */
const PoliticaCancelamento = ({ className = '' }: { className?: string }) => (
  <div id="politica-cancelamento" className={`scroll-mt-24 border border-white/10 bg-ink-950 px-5 py-6 text-left md:px-8 ${className}`}>
    <h2 className="font-race text-lg font-bold uppercase italic tracking-[0.08em] text-white">{POLITICA_TITULO}</h2>
    <div className="mt-4 space-y-4 text-sm leading-6 text-white/70 md:text-base">
      {POLITICA_SECOES.map((secao) => (
        <section key={secao.titulo}>
          <h3 className="font-bold text-white">{secao.titulo}</h3>
          {secao.paragrafos?.map((p) => <p key={p}>{p}</p>)}
          {secao.subsecoes?.map((sub) => (
            <div key={sub.titulo} className="mt-2">
              <h4 className="font-semibold text-white/90">{sub.titulo}</h4>
              {sub.paragrafos.map((p) => <p key={p}>{p}</p>)}
            </div>
          ))}
          {secao.itens && (
            <ul className="mt-1 list-disc space-y-1 pl-5">
              {secao.itens.map((i) => <li key={i}>{i}</li>)}
            </ul>
          )}
        </section>
      ))}
    </div>
  </div>
);

export default PoliticaCancelamento;
