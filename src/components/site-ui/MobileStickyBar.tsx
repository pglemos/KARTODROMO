import { SITE_BOOKING_ANCHOR, WHATSAPP_BOOKING_URL } from '../../config/booking';

const MobileStickyBar = () => {
  return (
    <div className="fixed inset-x-0 bottom-0 z-[64] grid grid-cols-2 gap-px border-t border-white/10 bg-ink-950 md:hidden">
      <a
        href={SITE_BOOKING_ANCHOR}
        className="flex items-center justify-center bg-primary-400 py-3.5 font-race text-xs italic font-bold uppercase tracking-wide text-ink-950"
      >
        Reservar
      </a>
      <a
        href={WHATSAPP_BOOKING_URL}
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center justify-center border-l border-white/10 bg-ink-900 py-3.5 font-race text-xs italic font-bold uppercase tracking-wide text-white"
      >
        WhatsApp
      </a>
    </div>
  );
};

export default MobileStickyBar;
