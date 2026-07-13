import { useState, type FormEvent } from 'react';
import { X } from 'lucide-react';
import AngledButton from './AngledButton';

const WHATSAPP_NUMBER = '5531998842898';

const eventTypes = ['Aniversário', 'Grupo de amigos', 'Evento corporativo'];

type WhatsAppQuoteModalProps = {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  subtitle: string;
};

const WhatsAppQuoteModal = ({ isOpen, onClose, title, subtitle }: WhatsAppQuoteModalProps) => {
  const [nome, setNome] = useState('');
  const [tipo, setTipo] = useState(eventTypes[0]);
  const [pessoas, setPessoas] = useState('');
  const [data, setData] = useState('');
  const [mensagem, setMensagem] = useState('');

  if (!isOpen) return null;

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const lines = [
      `Olá! Meu nome é ${nome || '(não informado)'}.`,
      `Gostaria de um orçamento para: ${tipo}.`,
      pessoas ? `Quantidade de pessoas: ${pessoas}.` : null,
      data ? `Data desejada: ${data}.` : null,
      mensagem ? mensagem : null,
    ].filter(Boolean);

    const text = encodeURIComponent(lines.join(' '));
    window.open(`https://wa.me/${WHATSAPP_NUMBER}?text=${text}`, '_blank', 'noopener,noreferrer');
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-ink-950/90 p-4 backdrop-blur-sm" role="dialog" aria-modal="true">
      <div className="relative w-full max-w-lg border border-white/10 bg-ink-900 p-6 md:p-8">
        <button
          type="button"
          onClick={onClose}
          aria-label="Fechar formulário"
          className="absolute right-4 top-4 flex h-9 w-9 items-center justify-center border border-white/15 bg-white/5 text-white/60 transition-colors hover:border-primary-400/40 hover:text-primary-400"
        >
          <X className="h-4 w-4" />
        </button>

        <span className="font-race text-xs italic font-bold uppercase tracking-[0.18em] text-primary-400">{subtitle}</span>
        <h2 className="mt-2 font-display text-3xl italic uppercase leading-none tracking-tight text-white">{title}</h2>
        <p className="mt-3 text-sm leading-6 text-white/60">
          Preencha os dados. Ao enviar, a conversa abre no WhatsApp com tudo organizado.
        </p>

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <div>
            <label htmlFor="quote-nome" className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-white/60">
              Nome
            </label>
            <input
              id="quote-nome"
              type="text"
              value={nome}
              onChange={(event) => setNome(event.target.value)}
              placeholder="Seu nome"
              className="w-full border border-white/15 bg-ink-950 px-4 py-2.5 text-sm text-white placeholder:text-white/30 focus:border-primary-400/50 focus:outline-none"
            />
          </div>

          <div>
            <label htmlFor="quote-tipo" className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-white/60">
              Tipo de evento
            </label>
            <select
              id="quote-tipo"
              value={tipo}
              onChange={(event) => setTipo(event.target.value)}
              className="w-full border border-white/15 bg-ink-950 px-4 py-2.5 text-sm text-white focus:border-primary-400/50 focus:outline-none"
            >
              {eventTypes.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="quote-pessoas" className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-white/60">
                Quantidade de pessoas
              </label>
              <input
                id="quote-pessoas"
                type="number"
                min={1}
                value={pessoas}
                onChange={(event) => setPessoas(event.target.value)}
                placeholder="Ex.: 25"
                className="w-full border border-white/15 bg-ink-950 px-4 py-2.5 text-sm text-white placeholder:text-white/30 focus:border-primary-400/50 focus:outline-none"
              />
            </div>
            <div>
              <label htmlFor="quote-data" className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-white/60">
                Data desejada
              </label>
              <input
                id="quote-data"
                type="date"
                value={data}
                onChange={(event) => setData(event.target.value)}
                className="w-full border border-white/15 bg-ink-950 px-4 py-2.5 text-sm text-white focus:border-primary-400/50 focus:outline-none [color-scheme:dark]"
              />
            </div>
          </div>

          <div>
            <label htmlFor="quote-mensagem" className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-white/60">
              Mensagem
            </label>
            <textarea
              id="quote-mensagem"
              value={mensagem}
              onChange={(event) => setMensagem(event.target.value)}
              placeholder="Conte um pouco sobre o evento"
              rows={3}
              className="w-full border border-white/15 bg-ink-950 px-4 py-2.5 text-sm text-white placeholder:text-white/30 focus:border-primary-400/50 focus:outline-none"
            />
          </div>

          <AngledButton type="submit" className="w-full">
            Enviar pelo WhatsApp
          </AngledButton>
        </form>
      </div>
    </div>
  );
};

export default WhatsAppQuoteModal;
