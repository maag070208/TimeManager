export { default as RolesWorkspace } from "./ui/RolesWorkspace";
export { default as PermissionCatalogPanel } from "./ui/PermissionCatalogPanel";
export {
  useRolesAdmin,
  usePermissionCatalog,
  type RolesAdminState,
  type CatalogAdminState,
} from "./model/useRolesAdmin";
export { useRolesWorkspace, type RolesWorkspaceState } from "./model/useRolesWorkspace";
