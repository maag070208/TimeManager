// API pública del slice "notification". Nada fuera de esta carpeta debe importar
// directo desde model/ o api/ — todo pasa por este barrel.
export * from "./model/types";
export * from "./model/notification.slice";
export { default } from "./model/notification.slice";
export { notificationsApi } from "./api/notificationApi";