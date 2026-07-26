const WhatsAppFloat = () => {
  return (
    <a
      href="https://wa.me/5531998842898"
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Falar no WhatsApp"
      className="fixed bottom-24 right-5 z-[65] flex h-14 w-14 items-center justify-center rounded-full bg-primary-400 text-ink-950 shadow-[0_12px_30px_rgba(0,230,118,0.35)] transition-transform hover:scale-110 md:bottom-6"
    >
      <svg aria-hidden="true" className="h-7 w-7 fill-current" viewBox="0 0 24 24">
        <path d="M12.04 2a9.84 9.84 0 0 0-8.42 14.93L2 22l5.23-1.58A9.95 9.95 0 1 0 12.04 2Zm0 17.92a8.08 8.08 0 0 1-4.12-1.13l-.3-.18-3.1.94.96-3.02-.2-.31a8.02 8.02 0 1 1 6.76 3.7Zm4.42-6.04c-.24-.12-1.43-.7-1.65-.78-.22-.08-.38-.12-.54.12-.16.24-.62.78-.76.94-.14.16-.28.18-.52.06-.24-.12-1.02-.38-1.94-1.2a7.27 7.27 0 0 1-1.34-1.67c-.14-.24-.02-.37.1-.49.11-.11.24-.28.36-.42.12-.14.16-.24.24-.4.08-.16.04-.3-.02-.42-.06-.12-.54-1.3-.74-1.78-.2-.47-.4-.4-.54-.41h-.46c-.16 0-.42.06-.64.3-.22.24-.84.82-.84 2s.86 2.32.98 2.48c.12.16 1.7 2.6 4.12 3.64.58.25 1.03.4 1.38.51.58.18 1.1.16 1.52.1.46-.07 1.43-.59 1.63-1.15.2-.56.2-1.04.14-1.14-.06-.1-.22-.16-.46-.28Z" />
      </svg>
    </a>
  );
};

export default WhatsAppFloat;
