import React, { createContext, useContext } from 'react';

import { Slot } from '@noodl-core-ui/types/global';

/**
 * Chrome the host application puts into *every* panel header, as opposed to the
 * per-panel actions a panel passes as `children`.
 *
 * PNL-003 uses it for the wide/hide controls: those belong to the side panel as
 * a whole, not to any one panel, and adding a second header component to carry
 * them was explicitly ruled out. PNL-005 formalises the header's slots — this is
 * the seam it should absorb.
 */
const PanelModeSlotContext = createContext<Slot>(null);

export interface PanelModeSlotProviderProps {
  slot: Slot;
  children: React.ReactNode;
}

export function PanelModeSlotProvider({ slot, children }: PanelModeSlotProviderProps) {
  return <PanelModeSlotContext.Provider value={slot}>{children}</PanelModeSlotContext.Provider>;
}

export function usePanelModeSlot(): Slot {
  return useContext(PanelModeSlotContext);
}
