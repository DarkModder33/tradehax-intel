import { describe, expect, it } from "vitest";
import { MENU_CLOSED, isInside, menuReducer } from "./menu-state";
import { NAV_GROUPS, NAV_HREFS } from "./model";

describe("menu state", () => {
  it("keeps only one menu open", () => {
    let state = menuReducer(MENU_CLOSED, { type: "open", id: "Flow" });
    expect(state.open).toBe("Flow");
    state = menuReducer(state, { type: "open", id: "Options" });
    expect(state.open).toBe("Options");
    state = menuReducer(state, { type: "toggle", id: "palette" });
    expect(state.open).toBe("palette");
  });

  it("closes on escape, outside click, route change and item select", () => {
    for (const type of ["escape", "outside", "route", "select"] as const) {
      expect(menuReducer({ open: "Flow" }, { type }).open).toBeNull();
    }
    expect(menuReducer(MENU_CLOSED, { type: "escape" })).toBe(MENU_CLOSED);
  });

  it("toggles on tap and ignores a stale delayed close", () => {
    expect(menuReducer({ open: "Flow" }, { type: "toggle", id: "Flow" }).open).toBeNull();
    expect(menuReducer({ open: "Options" }, { type: "close", id: "Flow" }).open).toBe("Options");
    expect(menuReducer({ open: "Flow" }, { type: "close", id: "Flow" }).open).toBeNull();
  });

  it("detects clicks inside the menu roots", () => {
    const node = {};
    const root = { contains: (value: unknown) => value === node };
    expect(isInside(node, [null, root])).toBe(true);
    expect(isInside({}, [root])).toBe(false);
  });

  it("groups the nav into six sections with unique links", () => {
    expect(NAV_GROUPS.map((group) => group.label)).toEqual(["Markets", "Flow", "Options", "Research", "News", "Alerts"]);
    expect(new Set(NAV_HREFS).size).toBe(NAV_HREFS.length);
  });
});
