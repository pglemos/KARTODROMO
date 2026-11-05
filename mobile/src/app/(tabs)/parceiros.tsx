import { demoOnly } from '../../config/features';
import React from 'react';
import { TrackScreen, TrackScreenProps } from '../../components/track-screen';

function ParceirosScreen(props: TrackScreenProps) {
  return <TrackScreen {...props} />;
}

export default demoOnly(ParceirosScreen);
