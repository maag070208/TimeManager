let getToken: () => string | null = () => null;
let getRefreshToken: () => string | null = () => null;
let setTokens: (tokens: { token: string; refreshToken?: string }) => void = () => {};
let onUnauthorized: () => void = () => {};

export const setSessionHooks = (
  tokenGetter: () => string | null,
  unauthorizedHandler: () => void,
  refreshTokenGetter?: () => string | null,
  tokensSetter?: (tokens: { token: string; refreshToken?: string }) => void
) => {
  getToken = tokenGetter;
  onUnauthorized = unauthorizedHandler;
  if (refreshTokenGetter) getRefreshToken = refreshTokenGetter;
  if (tokensSetter) setTokens = tokensSetter;
};

export const getSessionToken = () => getToken();

/** Refresh token de la sesión (endurecimiento: access corto + refresh). */
export const getSessionRefreshToken = () => getRefreshToken();

/** Actualiza los tokens de la sesión tras una renovación. */
export const updateSessionTokens = (tokens: { token: string; refreshToken?: string }) =>
  setTokens(tokens);

export const handleUnauthorized = () => onUnauthorized();
