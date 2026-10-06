import { createContext, useContext, type ReactNode, type RefObject } from 'react';
import type { View } from 'react-native';

export type ScrollMode = 'input' | 'menu';

export const FieldScrollContext = createContext<(target: View | null, mode: ScrollMode) => void>(() => {});

export function useRevealField() {
  return useContext(FieldScrollContext);
}

export type MenuFrame = {
  id: string;
  anchor: RefObject<View | null>;
  render: () => ReactNode;
};

const menuListeners = new Set<(id: string | null) => void>();
const menuFrames = new Map<string, MenuFrame>();
const menuFrameListeners = new Set<() => void>();
let menuFrameSnapshot: MenuFrame[] = [];

function publishMenuFrames() {
  menuFrameSnapshot = [...menuFrames.values()];
  menuFrameListeners.forEach((listener) => listener());
}

export const menuStore = {
  set(frame: MenuFrame) {
    menuFrames.set(frame.id, frame);
    publishMenuFrames();
  },
  remove(id: string) {
    if (!menuFrames.delete(id)) return;
    publishMenuFrames();
  },
  subscribe(listener: () => void) {
    menuFrameListeners.add(listener);
    return () => {
      menuFrameListeners.delete(listener);
    };
  },
  getSnapshot() {
    return menuFrameSnapshot;
  },
};

let measureMenus = () => {};

export function setMenuMeasurer(measure: () => void) {
  measureMenus = measure;
  return () => {
    if (measureMenus === measure) measureMenus = () => {};
  };
}

export function requestMenuMeasure() {
  measureMenus();
}

export function setActiveMenu(id: string | null) {
  menuListeners.forEach((listener) => listener(id));
}

export function subscribeActiveMenu(listener: (id: string | null) => void) {
  menuListeners.add(listener);
  return () => {
    menuListeners.delete(listener);
  };
}
