import {
  createAsyncThunk,
  createSlice,
  type PayloadAction,
} from "@reduxjs/toolkit";
import { authApi } from "../api/userApi";
import type { AuthMe, AuthUser } from "../model/types";
import i18n from "@shared/i18n";

interface State {
  token: string | null;
  refreshToken: string | null;
  user: AuthUser | null;
  loading: boolean;
  error: string | null;
}

const STORAGE_KEY = "ptnv_auth_v1";

const loadInitial = (): State => {
  if (typeof window === "undefined") return defaultState();
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultState();
    return JSON.parse(raw) as State;
  } catch {
    return defaultState();
  }
};

const defaultState = (): State => ({
  token: null,
  refreshToken: null,
  user: null,
  loading: false,
  error: null,
});

const persist = (state: State) => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    /* noop */
  }
};

export const loginThunk = createAsyncThunk(
  "auth/login",
  async (creds: { username: string; password: string }, { rejectWithValue }) => {
    try {
      const data = await authApi.login(creds.username, creds.password);
      return data;
    } catch (e: any) {
      // Reenviamos la causa serializable para que el componente de login
      // pueda distinguir ACCOUNT_DEACTIVATED vs INVALID_CREDENTIALS.
      return rejectWithValue({
        code: e?.code,
        message: e?.message,
        details: e?.details,
        status: e?.status,
      });
    }
  }
);

export const meThunk = createAsyncThunk("auth/me", async () => {
  return authApi.me();
});

const slice = createSlice({
  name: "auth",
  initialState: loadInitial(),
  reducers: {
    logout(state) {
      state.token = null;
      state.refreshToken = null;
      state.user = null;
      state.error = null;
      persist(state);
    },
    /** Actualiza los tokens (p. ej. tras un refresh) sin tocar al usuario. */
    setTokens(state, action: PayloadAction<{ token: string; refreshToken?: string }>) {
      state.token = action.payload.token;
      if (action.payload.refreshToken) state.refreshToken = action.payload.refreshToken;
      persist(state);
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(loginThunk.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(loginThunk.fulfilled, (state, action) => {
        state.loading = false;
        state.token = action.payload.token;
        state.refreshToken = action.payload.refreshToken ?? null;
        state.user = action.payload.user;
        persist(state);
      })
      .addCase(loginThunk.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message ?? i18n.t("auth:login.errorAuth");
      })
      .addCase(meThunk.fulfilled, (state, action: PayloadAction<AuthMe>) => {
        state.user = action.payload;
        persist(state);
      });
  },
});

export const { logout, setTokens } = slice.actions;
export default slice.reducer;