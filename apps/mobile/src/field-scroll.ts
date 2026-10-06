import { createContext, useContext } from 'react';
import type { View } from 'react-native';

export type ScrollMode = 'input' | 'menu';

export const FieldScrollContext = createContext<(target: View | null, mode: ScrollMode) => void>(() => {});

export function useRevealField() {
  return useContext(FieldScrollContext);
}

const menuListeners = new Set<(id: string | null) => void>();

export function setActiveMenu(id: string | null) {
  menuListeners.forEach((listener) => listener(id));
}

export function subscribeActiveMenu(listener: (id: string | null) => void) {
  menuListeners.add(listener);
  return () => {
    menuListeners.delete(listener);
  };
}
