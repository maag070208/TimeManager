import { createSlice, PayloadAction } from "@reduxjs/toolkit";

export type ToastType = "success" | "error" | "warning" | "info" | "primary" | "danger";
export type ToastPosition =
  | "top-right"
  | "top-center"
  | "top-left"
  | "bottom-right"
  | "bottom-center"
  | "bottom-left";

export interface ToastState {
  message: string;
  type: ToastType;
  duration: number;
  position: ToastPosition;
  isVisible: boolean;
}

const initialState: ToastState = {
  message: "",
  type: "info",
  duration: 2500,
  position: "bottom-center",
  isVisible: false,
};

export const toastSlice = createSlice({
  name: "toast",
  initialState,
  reducers: {
    showToast(
      state,
      action: PayloadAction<Partial<Omit<ToastState, "isVisible">> & { message: string }>
    ) {
      state.message = action.payload.message;
      state.type = action.payload.type ?? "info";
      state.duration = action.payload.duration ?? 2500;
      state.position = action.payload.position ?? "bottom-center";
      state.isVisible = true;
    },
    hideToast(state) {
      state.isVisible = false;
    },
  },
});

export const { showToast, hideToast } = toastSlice.actions;
export default toastSlice.reducer;