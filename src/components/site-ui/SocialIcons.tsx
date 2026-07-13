type IconProps = {
  className?: string;
};

export const FacebookIcon = ({ className }: IconProps) => (
  <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
    <path d="M13.5 21v-8.15h2.73l.41-3.17h-3.14V7.66c0-.92.25-1.54 1.57-1.54h1.68V3.29A22.6 22.6 0 0 0 14.4 3.1c-2.32 0-3.91 1.42-3.91 4.02v2.56H7.75v3.17h2.74V21h3.01Z" />
  </svg>
);

export const InstagramIcon = ({ className }: IconProps) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className={className} aria-hidden="true">
    <rect x="3.5" y="3.5" width="17" height="17" rx="4.5" />
    <circle cx="12" cy="12" r="4" />
    <circle cx="17.2" cy="6.8" r="1" fill="currentColor" stroke="none" />
  </svg>
);

export const YoutubeIcon = ({ className }: IconProps) => (
  <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
    <path d="M22.5 7.6a3 3 0 0 0-2.1-2.1C18.5 5 12 5 12 5s-6.5 0-8.4.5A3 3 0 0 0 1.5 7.6 31.6 31.6 0 0 0 1 12a31.6 31.6 0 0 0 .5 4.4 3 3 0 0 0 2.1 2.1C5.5 19 12 19 12 19s6.5 0 8.4-.5a3 3 0 0 0 2.1-2.1A31.6 31.6 0 0 0 23 12a31.6 31.6 0 0 0-.5-4.4ZM9.8 15.2V8.8L15.5 12l-5.7 3.2Z" />
  </svg>
);
