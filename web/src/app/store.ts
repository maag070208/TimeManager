import { configureStore } from "@reduxjs/toolkit";
import authReducer, { logout, setTokens } from "@entities/user";
import notificationsReducer from "@entities/notification";
import toastReducer from "@app/toast/toast.slice";
import { setSessionHooks } from "@shared/api/session";

export const store = configureStore({
  reducer: {
    auth: authReducer,
    notifications: notificationsReducer,
    toast: toastReducer,
  },
});

setSessionHooks(
  () => store.getState().auth.token,
  () => store.dispatch(logout()),
  () => store.getState().auth.refreshToken,
  (tokens) => store.dispatch(setTokens(tokens))
);

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
/** Alias compat con providers/componentes que esperan `AppState` como nombre. */
export type AppState = ReturnType<typeof store.getState>;