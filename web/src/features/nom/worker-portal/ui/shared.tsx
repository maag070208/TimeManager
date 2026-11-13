import type { ReactNode } from "react";
import { ITFlex, ITText } from "@axzydev/axzy_ui_system";
import { HelpTip } from "@shared/ui/help-tip";

export const CardHeader = ({ icon, title, help }: { icon: ReactNode; title: string; help?: string }) => (
  <ITFlex align="center" gap={2} className="min-w-0">
    <span className="text-slate-500">{icon}</span>
    <ITText className="truncate font-bold">{title}</ITText>
    {help && <HelpTip text={help} />}
  </ITFlex>
);

export const ErrorNote = ({ children }: { children: ReactNode }) => (
  <ITText className="block rounded-lg border border-red-200 bg-red-50 px-3 py-2 !text-[12.5px] text-red-700">{children}</ITText>
);
