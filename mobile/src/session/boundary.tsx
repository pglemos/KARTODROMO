import { Fragment, useState, type PropsWithChildren } from 'react';

import { useSession } from './provider';

export function SessionBoundary({ children }: PropsWithChildren) {
  const { session } = useSession();
  const [view, setView] = useState({ session, key: 0 });
  // shortcut: renovar tokens também limpa formulários; usar accountId quando a API o fornecer.
  if (view.session !== session) setView({ session, key: view.key + 1 });
  return <Fragment key={view.key}>{children}</Fragment>;
}
