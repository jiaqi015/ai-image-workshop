import React, { useEffect } from 'react';
import { AppState, Frame } from '../types';

type Setter<T> = React.Dispatch<React.SetStateAction<T>>;

interface ConceptSelectionParams {
  appState: AppState;
  frames: Frame[];
  selectedProposalId: number | null;
  setSelectedProposalId: Setter<number | null>;
}

const scoreForFrame = (frame: Frame): number => {
  if (typeof frame.metadata?.curationScore === 'number') return frame.metadata.curationScore;
  if (frame.metadata?.variantType === 'balanced') return 0.8;
  if (frame.metadata?.variantType === 'strict') return 0.7;
  if (frame.metadata?.variantType === 'creative') return 0.65;
  return 0.6;
};

export const useConceptSelection = ({
  appState,
  frames,
  selectedProposalId,
  setSelectedProposalId,
}: ConceptSelectionParams) => {
  useEffect(() => {
    if (appState !== AppState.CONCEPT) return;
    if (selectedProposalId !== null && frames.some((frame) => frame.id === selectedProposalId)) return;

    const completedFrames = frames.filter((frame) => frame.status === 'completed' && Boolean(frame.imageUrl));
    if (completedFrames.length === 0) return;

    const bestFrame = completedFrames.reduce((acc, frame) =>
      scoreForFrame(frame) > scoreForFrame(acc) ? frame : acc
    , completedFrames[0]);

    setSelectedProposalId(bestFrame.id);
  }, [appState, frames, selectedProposalId, setSelectedProposalId]);
};
