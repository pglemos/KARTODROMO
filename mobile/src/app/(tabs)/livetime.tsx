import { demoOnly } from '../../config/features';
import React from 'react';
import { LiveTimeScreen, LiveTimeScreenProps } from '../../components/livetime-screen';

function LiveTimeRoute(props: LiveTimeScreenProps) {
  return <LiveTimeScreen {...props} />;
}

export default demoOnly(LiveTimeRoute);
