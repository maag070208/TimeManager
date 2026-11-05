import { useClientContext } from "@features/tenant/tenant-switcher";
import ClientHomePage from "./ClientHomePage";
import PlatformHomePage from "./PlatformHomePage";

/** `/`: consola de plataforma sin cliente elegido; inicio del cliente en cualquier otro caso. */
export default function HomePage() {
  const { platformWithoutClient } = useClientContext();
  return platformWithoutClient ? <PlatformHomePage /> : <ClientHomePage />;
}
