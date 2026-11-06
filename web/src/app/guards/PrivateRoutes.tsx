import { ITLayout, ITSidebarProps, ITToast, type ITNavigationItem } from "@axzydev/axzy_ui_system";
import { useEffect, useState, useCallback, type ReactNode } from "react";
import { LuHouse, LuUsers, LuSettings, LuCalendarCheck, LuBuilding2 } from "react-icons/lu";
import { useDispatch, useSelector } from "react-redux";
import { Navigate, Outlet, useLocation, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import type { AppDispatch, RootState } from "@app/store";
import { logout, meThunk, setRolesCatalog } from "@entities/user";
import { APP_SCREENS, isScreenVisible, permissionApi, type AppScreen } from "@entities/permission";
import { fetchUnreadCount, markNotificationRead, notificationRoute } from "@entities/notification";
import { blobatarDataUri } from "@shared/lib/blobatar";
import { API_CONSTANTS } from "@shared/api/constants/API_CONSTANTS";
import { desktop } from "@shared/lib/desktop";
import { useAblyNotifications, type LiveNotification } from "./useAblyNotifications";
import ForcePasswordChange from "./ForcePasswordChange";
import { PLATFORM_PATHS, TenantSwitcher, useClientContext } from "@features/tenant/tenant-switcher";
import { getSelectedTenant } from "@shared/api/tenant";
import { isPathInDisabledModule } from "@shared/lib/tenant-modules";
import { setTenantBrand } from "@shared/lib/tenantBrand";
import logoUrl from "@shared/assets/brand/timemanager-logo-for-light-bg.svg";
import symbolUrl from "@shared/assets/brand/timemanager-symbol-for-light-bg.svg";

/** Icono del menú por pantalla (el catálogo vive en `@entities/permission`). */
const NAV_ICONS: Record<string, ReactNode> = {
  start: <LuHouse size={14} />,
  // Portal del trabajador: sin icono quedaba un círculo vacío en el riel.
  myWorkday: <LuCalendarCheck size={14} />,
  hr: <LuUsers size={14} />,
  settings: <LuSettings size={14} />,
};

export default function PrivateRoutes() {
  const { t: tt, i18n } = useTranslation(["common"]);
  const navigate = useNavigate();
  const location = useLocation();
  const dispatch = useDispatch<AppDispatch>();
  const { token, user } = useSelector((s: RootState) => s.auth);
  const unreadCount = useSelector((s: RootState) => s.notifications.unreadCount);
  const [toast, setToast] = useState<string | null>(null);
  const { platformWithoutClient } = useClientContext();

  // En la app de escritorio llega como notificación nativa del sistema; en el
  // navegador, como aviso dentro de la página.
  const handleNewNotification = useCallback(
    (n: LiveNotification) => {
      const title = n.title ?? i18n.t("notifications:newNotification");
      if (desktop) {
        desktop.notify({
          id: n.id,
          title,
          body: n.detail ?? undefined,
          route: notificationRoute(n) ?? "/notifications",
        });
        return;
      }
      setToast(title);
      setTimeout(() => setToast(null), 3000);
    },
    [i18n]
  );

  // Clic en una notificación nativa: la app ya se trajo al frente; se abre su
  // pantalla y se marca leída.
  useEffect(
    () =>
      desktop?.onNotificationClick(({ id, route }) => {
        if (id) void dispatch(markNotificationRead(id));
        if (route) navigate(route);
      }),
    [dispatch, navigate]
  );

  // Al abrir la app (o iniciar sesión) se refresca `/auth/me`: el usuario
  // guardado puede traer permisos o idioma viejos. Al volver a la ventana se
  // refresca otra vez para que un cambio aplique sin relogin.
  useEffect(() => {
    if (token) dispatch(meThunk());
  }, [token, dispatch]);

  // Catálogo de roles dinámico (nombres, `staff`, activo): la web lo usa para
  // etiquetas y selectores. Se refresca al volver a la ventana, igual que la
  // sesión, para que un rol nuevo o renombrado aplique sin relogin.
  useEffect(() => {
    if (!token) return undefined;
    const loadRoles = () => {
      void permissionApi
        .listRoles()
        .then(setRolesCatalog)
        .catch(() => undefined);
    };
    loadRoles();
    window.addEventListener("focus", loadRoles);
    return () => window.removeEventListener("focus", loadRoles);
  }, [token]);

  // Membrete de PDFs y credenciales: el cliente de la sesión o el elegido.
  useEffect(() => {
    setTenantBrand({
      name: user?.tenant?.name ?? getSelectedTenant()?.name ?? null,
      color: user?.tenant?.brandColor ?? null,
      logoDataUrl: user?.tenant?.logoDataUrl ?? null,
    });
  }, [user]);

  // La interfaz sigue el idioma del sistema que trae la sesión.
  useEffect(() => {
    if (user?.language && user.language !== i18n.language) {
      void i18n.changeLanguage(user.language);
    }
  }, [user, i18n]);

  useEffect(() => {
    if (token) {
      dispatch(fetchUnreadCount());
    }
    if (!token) return undefined;
    const refreshSession = () => dispatch(meThunk());
    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") dispatch(meThunk());
    };
    window.addEventListener("focus", refreshSession);
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => {
      window.removeEventListener("focus", refreshSession);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [token, user, dispatch]);

  useAblyNotifications(user?.id, user?.tenant?.id, handleNewNotification);

  if (!token) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  // Contraseña provisional: no se monta la app hasta cambiarla (el diálogo no
  // se puede cerrar). Al guardarla, `/auth/me` refresca y esta marca baja.
  if (user?.mustChangePassword) {
    return <ForcePasswordChange />;
  }

  // Plataforma sin cliente elegido: solo su consola, roles y avisos. Las
  // pantallas de cliente mezclarían datos de todos los clientes (F1A-10).
  // `platformWithoutClient` se calcula con la sesión persistida: tras un
  // reload, el usuario del login aún no trae `tenant`/permisos hasta que
  // responde `/auth/me`. No redirigir en ese estado o un cliente acabaría
  // expulsado a la consola de plataforma.
  const isPlatformPath = PLATFORM_PATHS.some((path) =>
    path === "/" ? location.pathname === "/" : location.pathname === path || location.pathname.startsWith(`${path}/`)
  );
  if (user?.permissions !== undefined && platformWithoutClient && !isPlatformPath) {
    return <Navigate to="/" replace />;
  }

  // Módulos apagados por la plataforma: oculta el menú y bloquea la ruta directa.
  if (user?.tenant && isPathInDisabledModule(location.pathname, user.tenant.disabledModules)) {
    return <Navigate to="/" replace />;
  }

  // El menú se arma desde el catálogo de pantallas (`APP_SCREENS`) y los
  // permisos efectivos (`GET /auth/me`); la web no reimplementa la matriz.
  const permissions = user?.permissions;

  const matchesPath = (
    path: string,
    match: "exact" | "prefix" | undefined,
    excludes: readonly string[] | undefined
  ): boolean => {
    const hit =
      match === "exact"
        ? location.pathname === path
        : location.pathname === path || location.pathname.startsWith(`${path}/`);
    if (!hit) return false;
    return !(excludes ?? []).some(
      (excluded) =>
        location.pathname === excluded || location.pathname.startsWith(`${excluded}/`)
    );
  };

  const isScreenActive = (screen: AppScreen): boolean => {
    if (screen.path && matchesPath(screen.path, screen.match, screen.excludes)) return true;
    return screen.children?.some((child) => isScreenActive(child)) ?? false;
  };

  const canView = (screen: AppScreen): boolean =>
    isScreenVisible(permissions, screen, user?.role) &&
    // Mi jornada es personal: el personal de plataforma no tiene expediente.
    !(screen.id === "myWorkday" && !user?.tenant) &&
    (!platformWithoutClient || !screen.path || (PLATFORM_PATHS as readonly string[]).some((path) => screen.path === path || screen.path?.startsWith(`${path}/`)));

  const toSubItem = (screen: AppScreen) => ({
    id: screen.id,
    label: tt(screen.labelKey),
    action: () => {
      if (screen.path) navigate(screen.path);
    },
    isActive: isScreenActive(screen),
  });

  const toNavigationItem = (screen: AppScreen): ITNavigationItem | null => {
    if (!canView(screen)) return null;
    const leavesOf = (section: AppScreen) => (section.children ?? []).filter((leaf) => canView(leaf));
    const children = (screen.children ?? []).filter(
      (child) => canView(child) && (!child.children?.length || leavesOf(child).length > 0)
    );
    if (!screen.path && screen.children?.length && children.length === 0) return null;
    return {
      id: screen.id,
      label: tt(screen.labelKey),
      icon: NAV_ICONS[screen.id],
      ...(screen.path ? { action: () => navigate(screen.path!) } : {}),
      isActive: isScreenActive(screen),
      ...(children.length > 0
        ? {
          // Una sección (hijo con hijos) va como grupo con título del ITSidebar.
          subitems: children.map((child) =>
            child.children?.length
              ? {
                id: child.id,
                label: tt(child.labelKey),
                items: leavesOf(child).map(toSubItem),
              }
              : toSubItem(child)
          ),
        }
        : {}),
    };
  };

  const pruneDisabledModules = (screens: readonly AppScreen[]): AppScreen[] =>
    screens
      .map((screen) => {
        const children = screen.children ? pruneDisabledModules(screen.children) : undefined;
        if (screen.path && isPathInDisabledModule(screen.path, user?.tenant?.disabledModules)) return null;
        if (screen.children?.length && children?.length === 0) return null;
        return children ? { ...screen, children } : screen;
      })
      .filter((screen): screen is AppScreen => screen !== null);
  const isPlatformStaff = user?.role === "ADMIN" || user?.role === "SUPPORT";
  const clientsItem: ITNavigationItem = {
    id: "tenants",
    label: tt("nav.clients"),
    icon: <LuBuilding2 size={14} />,
    action: () => navigate("/tenants"),
    isActive: location.pathname === "/tenants" || location.pathname.startsWith("/tenants/"),
  };
  const navigationItems = [
    ...(isPlatformStaff ? [clientsItem] : []),
    ...pruneDisabledModules(APP_SCREENS).map(toNavigationItem).filter(
      (item): item is ITNavigationItem => item !== null
    ),
  ];

  const handleLogout = () => {
    dispatch(logout());
    // `replace`: tras salir, "atrás" no debe devolver a la pantalla protegida.
    navigate("/login", { replace: true });
  };

  const sidebar: ITSidebarProps = {
    navigationItems,
    isCollapsed: true,
    // Marca: en el riel colapsado solo el símbolo; al expandirse (hover o
    // cuando el kit lo abre) aparece el nombre junto al logo.
    brand: {
      // Branding del cliente (F3-05): logo/name propios si la sesión los trae.
      logo: (
        <img
          src={user?.tenant?.logoDataUrl ?? symbolUrl}
          alt={user?.tenant?.name ?? "TimeManager"}
          className="h-8 w-8 object-contain"
        />
      ),
      text: user?.tenant?.name ?? "TimeManager",
    },
    // Panel flotante con la persona al pie (mismo lenguaje bento del resto).
    variant: "bento",
    // La tarjeta flota separada del borde (el kit respeta el className desde 1.8.14).
    className: "p-2",
    profile: user
      ? {
          name: user.name ?? user.username,
          detail: unreadCount > 0 ? tt("nav.notifications", { count: unreadCount }) : user.username,
          image: user.photoUrl
            ? `${API_CONSTANTS.BASE_URL}${user.photoUrl}`
            : blobatarDataUri(user.name ?? user.username),
          label: tt("nav.accountMenu"),
          // La tarjeta lleva a la cuenta de la persona (si puede editarla).
          onClick: (permissions?.["users.edit"] ?? "NONE") !== "NONE" ? () => navigate(`/employees/${user.id}/account`) : undefined,
        }
      : undefined,
  };

  const topBar = {
    variant: "bento" as const,
    logo: (
      <img
        src={logoUrl}
        alt="TimeManager"
        className="h-12 w-auto object-contain"
      />
    ),
    children: <TenantSwitcher />,
    userMenu: user
      ? {
        userName: user.name ?? "—",
        userEmail: user.username,
        // Foto del expediente si existe; si no, el mismo Blobatar del resto de
        // la app (la barra solo acepta una URL de imagen).
        userImage: user.photoUrl
          ? `${API_CONSTANTS.BASE_URL}${user.photoUrl}`
          : blobatarDataUri(user.name ?? user.username),
        menuItems: [
          {
            label:
              unreadCount > 0
                ? tt("nav.notifications", { count: unreadCount })
                : tt("nav.notifications"),
            onClick: () => navigate("/notifications"),
          },
          { label: tt("nav.logout"), onClick: handleLogout },
        ],
      }
      : undefined,
  };

  return (
    <>
      <ITLayout topBar={topBar} sidebar={sidebar} sidebarFullHeight contentClassName="max-w-screen! m-0! !px-2">
        <Outlet />
      </ITLayout>
      {toast && (
        <ITToast
          message={toast}
          type="info"
          position="top-right"
          duration={3000}
          onClose={() => setToast(null)}
        />
      )}
    </>
  );
}
