const IS_MOCK_PRODUCTION =
  process.env.MOCK_PRODUCTION === "true" ||
  process.env.NEXT_PUBLIC_MOCK_PRODUCTION === "true";

export function isProductionLike(): boolean {
  return process.env.NODE_ENV === "production" || IS_MOCK_PRODUCTION;
}
