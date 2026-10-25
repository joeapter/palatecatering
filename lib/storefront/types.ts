export type ProductVariant = {
  id?: number;
  label: string;
  price: number;
  soldBy: string;
  unitType: "each" | "weight" | "volume" | "container";
  unitValue?: number;
  unitLabel: string;
  minimumQuantity: number;
  quantityStep: number;
  maximumQuantity?: number;
  servesMin?: number;
  servesMax?: number;
  /** Set on an add-on: the id of the size it extends, e.g. cholent + kishka. */
  addonOf?: number;
  addonLabel?: string;
};
export type StorefrontProduct = {
  id: number | string; category: string; categorySlug: string; title: string; slug: string;
  description: string; price: number; soldBy: string; image: string; badge?: string;
  serves?: string; variants: ProductVariant[];
};
export type StorefrontCategory = { id?: number; name: string; slug: string; description: string; image: string; products: StorefrontProduct[] };
