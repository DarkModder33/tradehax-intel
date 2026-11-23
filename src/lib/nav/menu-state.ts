/**
 * One state machine for every menu in the header: desktop dropdowns, the mobile
 * drawer and the command palette. Only one can be open at a time.
 */
export type MenuId = string;

export interface MenuState {
  open: MenuId | null;
}

export type MenuAction =
  | { type: "open"; id: MenuId }
  | { type: "toggle"; id: MenuId }
  | { type: "close"; id?: MenuId }
  | { type: "escape" }
  | { type: "outside" }
  | { type: "route" }
  | { type: "select" };

export const MENU_CLOSED: MenuState = { open: null };

export function menuReducer(state: MenuState, action: MenuAction): MenuState {
  switch (action.type) {
    case "open":
      return state.open === action.id ? state : { open: action.id };
    case "toggle":
      return state.open === action.id ? MENU_CLOSED : { open: action.id };
    case "close":
      // A delayed close for one menu must not close another that opened since.
      if (action.id && state.open !== action.id) return state;
      return state.open == null ? state : MENU_CLOSED;
    case "escape":
    case "outside":
    case "route":
    case "select":
      return state.open == null ? state : MENU_CLOSED;
    default:
      return state;
  }
}

/** Hover intent on desktop: open after a short pause, close after a longer one. */
export const HOVER_OPEN_MS = 90;
export const HOVER_CLOSE_MS = 180;

/** True when an event target sits inside any of the given roots. */
export function isInside(target: unknown, roots: Array<{ contains(node: unknown): boolean } | null | undefined>): boolean {
  return roots.some((root) => root != null && target != null && root.contains(target));
}
