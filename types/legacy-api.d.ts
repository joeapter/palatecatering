/**
 * The root `api/*.js` handlers are untyped CommonJS from the pre-Next.js site.
 * They are loaded by app/api/[...legacy]/route.ts and adapted at runtime, so
 * they only need a module shape here — not real types. Do not add types that
 * imply guarantees the JavaScript does not actually make.
 */
declare module "*/api/send-order-email.js" {
  const handler: unknown;
  export default handler;
}
declare module "*/api/products.js" {
  const handler: unknown;
  export default handler;
}
declare module "*/api/orders.js" {
  const handler: unknown;
  export default handler;
}
declare module "*/api/order-status.js" {
  const handler: unknown;
  export default handler;
}
declare module "*/api/order-update.js" {
  const handler: unknown;
  export default handler;
}
declare module "*/api/order-delete.js" {
  const handler: unknown;
  export default handler;
}
declare module "*/api/product-image.js" {
  const handler: unknown;
  export default handler;
}
declare module "*/api/abandoned-carts.js" {
  const handler: unknown;
  export default handler;
}
declare module "*/api/auth-login.js" {
  const handler: unknown;
  export default handler;
}
declare module "*/api/auth-register.js" {
  const handler: unknown;
  export default handler;
}
