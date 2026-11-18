/** Solo se comparan MAYOR.MENOR: un parche distinto no rompe nada. */
export const versionsMismatch = (web: string | null, api: string | null): boolean => {
  if (!web || !api) return false;
  const minor = (v: string) => v.split(".").slice(0, 2).join(".");
  return minor(web) !== minor(api);
};
