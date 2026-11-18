import { Component, type ErrorInfo, type ReactNode } from "react";
import i18n from "i18next";
import { ITButton } from "@axzydev/axzy_ui_system";
import { supportMessage } from "@shared/api/errors";
import { TicState } from "@shared/ui/tic";

interface State {
  failed: boolean;
}

/**
 * Si una pantalla truena, en lugar de quedar en blanco (o con el detalle del
 * error en desarrollo) se muestra a Tic con el código AX-14 para soporte.
 */
export default class ErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { failed: false };

  static getDerivedStateFromError(): State {
    return { failed: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error("[AX-14]", error, info.componentStack);
  }

  render(): ReactNode {
    if (!this.state.failed) return this.props.children;
    return (
      <div className="flex min-h-[60vh] items-center justify-center p-6">
        <TicState
          kind="error"
          description={supportMessage("AX-14")}
          action={
            <ITButton variant="filled" color="primary" onClick={() => window.location.reload()}>
              {i18n.t("common:errors.reload")}
            </ITButton>
          }
        />
      </div>
    );
  }
}
