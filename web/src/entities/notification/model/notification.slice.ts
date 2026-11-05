import { createAsyncThunk, createSlice } from "@reduxjs/toolkit";
import { notificationsApi } from "../api/notificationApi";
import type { Notification } from "../model/types";

interface NotificationsState {
  items: Notification[];
  unreadCount: number;
  loading: boolean;
}

const initialState: NotificationsState = {
  items: [],
  unreadCount: 0,
  loading: false,
};

export const fetchNotifications = createAsyncThunk<Notification[], boolean>(
  "notifications/fetch",
  async (unreadOnly) => {
    const res = await notificationsApi.list(unreadOnly);
    return res.data;
  }
);

export const fetchUnreadCount = createAsyncThunk<number>(
  "notifications/unreadCount",
  async () => {
    const res = await notificationsApi.unreadCount();
    return res.count;
  }
);

export const markNotificationRead = createAsyncThunk<string, string>(
  "notifications/markRead",
  async (id) => {
    await notificationsApi.markRead(id);
    return id;
  }
);

export const markAllNotificationsRead = createAsyncThunk(
  "notifications/markAllRead",
  async () => {
    await notificationsApi.markAllRead();
  }
);

const slice = createSlice({
  name: "notifications",
  initialState,
  reducers: {
    incrementUnread(state) {
      state.unreadCount += 1;
    },
    prependNotification(state, action) {
      state.items.unshift(action.payload);
      state.unreadCount += 1;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchNotifications.pending, (state) => {
        state.loading = true;
      })
      .addCase(fetchNotifications.fulfilled, (state, action) => {
        state.loading = false;
        state.items = action.payload;
      })
      .addCase(fetchUnreadCount.fulfilled, (state, action) => {
        state.unreadCount = action.payload;
      })
      .addCase(markNotificationRead.fulfilled, (state, action) => {
        const item = state.items.find((n) => n.id === action.payload);
        if (item && !item.read) {
          item.read = true;
          state.unreadCount = Math.max(0, state.unreadCount - 1);
        }
      })
      .addCase(markAllNotificationsRead.fulfilled, (state) => {
        state.items.forEach((n) => (n.read = true));
        state.unreadCount = 0;
      });
  },
});

export const { incrementUnread, prependNotification } = slice.actions;
export default slice.reducer;