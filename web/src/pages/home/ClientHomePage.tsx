import { ITPage } from "@shared/ui/page";
import { LuHouse } from "react-icons/lu";
import { useSelector } from "react-redux";
import { useTranslation } from "react-i18next";
import type { RootState } from "@app/store";
import { ClientOverview } from "@features/home/client-overview";
import { useClientContext } from "@features/tenant/tenant-switcher";

/** Inicio de un cliente: lo de hoy y lo pendiente, según los permisos de la persona. */
export default function ClientHomePage() {
  const { t, i18n } = useTranslation("home");
  const user = useSelector((s: RootState) => s.auth.user);
  const { client } = useClientContext();
  const firstName = (user?.name ?? user?.username ?? "").split(" ")[0];
  const today = new Date().toLocaleDateString(i18n.language, { weekday: "long", day: "numeric", month: "long" });

  return (
    <ITPage
      className="m-0! p-0! px-8! min-w-full! pb-12!"
      noPadding
      title={t("client.greeting", { name: firstName })}
      description={t("client.description", { company: client?.name ?? "CheckLab", date: today })}
      icon={<LuHouse size={20} />}
    >
      <ClientOverview />
    </ITPage>
  );
}
