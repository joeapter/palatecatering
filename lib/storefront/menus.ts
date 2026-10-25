/**
 * The menus a product can be tagged for.
 *
 * One list, shared by the product admin, the manual order form and anything
 * else that needs to offer a choice of menu — so a new seasonal menu is added
 * in a single place rather than in whichever screens happened to remember it.
 * The tag is also what `order_windows.event_type` holds, which is how a date
 * knows which menu the kitchen is cooking that week.
 */
export type MenuTag = { tag: string; label: string };

export const MENUS: MenuTag[] = [
  { tag: "shabbos", label: "Shabbos" },
  { tag: "sukkos", label: "Sukkos" },
  { tag: "rosh-hashanah", label: "Rosh Hashanah" },
  { tag: "dairy", label: "Dairy" },
  { tag: "shavuos", label: "Shavuos" },
  { tag: "purim", label: "Purim" },
];

export const MENU_TAGS = MENUS.map((menu) => menu.tag);

export function menuLabel(tag: string) {
  return MENUS.find((menu) => menu.tag === tag)?.label || tag;
}
