import {
  ITAlert,
  ITBadget,
  ITButton,
  ITCard,
  ITInput,
  ITSlideToggle,
  ITText,
} from "@axzydev/axzy_ui_system";
import { useCallback, useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import {
  FaArrowsRotate,
  FaDownload,
  FaFolderOpen,
  FaKey,
  FaPlug,
  FaServer,
  FaRotate,
} from "react-icons/fa6";
import type { AgentClockState, AgentSnapshot } from "./types";

const bridge = typeof window !== "undefined" ? window.agent : undefined;

const formatDate = (iso: string | null): string =>
  iso
    ? new Date(iso).toLocaleString("es-MX", { dateStyle: "short", timeStyle: "medium" })
    : "—";

const messageOf = (error: unknown): string => {
  const raw = error instanceof Error ? error.message : String(error);
  return raw.replace(/^Error invoking remote method '[^']+': (Error: )?/, "");
};

const shortId = (id: string | null): string =>
  id ? `${id.slice(0, 8)}…${id.slice(-4)}` : "—";

export default function App() {
  const [snapshot, setSnapshot] = useState<AgentSnapshot | null>(null);
  const [apiUrl, setApiUrl] = useState("");
  const [token, setToken] = useState("");
  const [chunkSeconds, setChunkSeconds] = useState("20");
  const [autoStart, setAutoStart] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ kind: "ok" | "error"; text: string } | null>(null);
  const [rotatedToken, setRotatedToken] = useState<string | null>(null);
  const dirty = useRef(false);

  const hydrate = useCallback((state: AgentSnapshot) => {
    setSnapshot(state);
    if (dirty.current) return;
    setApiUrl(state.apiUrl);
    setChunkSeconds(String(state.chunkSeconds));
    setAutoStart(state.autoStart);
  }, []);

  useEffect(() => {
    if (!bridge) return;
    let alive = true;
    void bridge.getState().then((state) => {
      if (alive) hydrate(state);
    });
    const unsubscribe = bridge.onState((state) => {
      if (alive) hydrate(state);
    });
    return () => {
      alive = false;
      unsubscribe();
    };
  }, [hydrate]);

  const run = async (label: string, action: () => Promise<AgentSnapshot | void>) => {
    setBusy(label);
    setNotice(null);
    try {
      const next = await action();
      if (next) hydrate(next);
    } catch (error) {
      setNotice({ kind: "error", text: messageOf(error) });
    } finally {
      setBusy(null);
    }
  };

  const saveConnection = async () => {
    if (!bridge) return;
    dirty.current = false;
    await run("save", async () => {
      const saved = await bridge.saveConfig({
        apiUrl,
        chunkSeconds: Number(chunkSeconds),
        autoStart,
      });
      return token.trim() ? await bridge.setToken(token.trim()) : saved;
    });
    setToken("");
    setNotice({ kind: "ok", text: "Configuración guardada." });
  };

  const register = async () => {
    if (!bridge) return;
    dirty.current = false;
    setBusy("register");
    setNotice(null);
    try {
      if (token.trim()) await bridge.setToken(token.trim());
      setToken("");
      hydrate(await bridge.register());
      setNotice({ kind: "ok", text: "Agente registrado y relojes descargados." });
    } catch (error) {
      setNotice({ kind: "error", text: messageOf(error) });
    } finally {
      setBusy(null);
    }
  };

  const syncNow = () =>
    run("sync", async () => {
      if (!bridge) return;
      const state = await bridge.syncNow();
      setNotice({ kind: "ok", text: "Sincronización terminada." });
      return state;
    });

  const rotateToken = () =>
    run("rotate", async () => {
      if (!bridge) return;
      const result = await bridge.rotateToken();
      setRotatedToken(result.token);
      setNotice({ kind: "ok", text: "Token rotado. El anterior ya no funciona." });
      return bridge.getState();
    });

  const exportLogs = () =>
    run("logs", async () => {
      if (!bridge) return;
      const result = await bridge.exportLogs();
      if (result.saved) setNotice({ kind: "ok", text: `Logs guardados en ${result.path}` });
    });

  const testClock = (clock: AgentClockState) =>
    run(`test:${clock.serialNumber}`, async () => {
      if (!bridge) return;
      const result = await bridge.testClock(clock.serialNumber);
      setNotice({
        kind: result.ok ? "ok" : "error",
        text: `${clock.name ?? clock.serialNumber}: ${result.message}`,
      });
    });

  if (!bridge) {
    return (
      <div className="agent-shell flex h-full items-center justify-center p-8">
        <ITCard className="max-w-lg">
          <ITText as="h1" className="text-lg font-semibold">
            CheckLab Agent necesita Electron
          </ITText>
          <ITText muted className="mt-2 block text-sm">
            Esta ventana se abrió en un navegador. Para usar el agente ejecuta
            <code className="mx-1 rounded bg-slate-100 px-1.5 py-0.5 text-xs">pnpm app</code>
            (compila la UI y abre Electron).
          </ITText>
        </ITCard>
      </div>
    );
  }

  const tokenStatus = snapshot?.tokenValid;
  const state = snapshot;

  return (
    <div className="agent-shell flex h-full flex-col">
      <header className="flex items-center gap-3 bg-[#1D2636] px-6 py-3 text-[#F4F6FA] shadow-md">
        <svg viewBox="14 14 92 92" className="h-9 w-9 shrink-0" aria-hidden="true">
          <defs><mask id="agentBrandMask" maskUnits="userSpaceOnUse" x="0" y="0" width="120" height="120"><rect width="120" height="120" fill="#fff" /><circle cx="87" cy="88" r="20" fill="#000" /></mask></defs>
          <g mask="url(#agentBrandMask)">
            <rect x="31" y="22" width="58" height="76" rx="11" fill="none" stroke="#F4F6FA" strokeWidth="8" />
            <path d="M51 33 H69" stroke="#F4F6FA" strokeWidth="6" strokeLinecap="round" />
            <circle cx="60" cy="54" r="9" fill="#F4F6FA" />
            <path d="M41 86 Q41 69 60 69 Q79 69 79 86 Z" fill="#F4F6FA" stroke="#F4F6FA" strokeWidth="2" strokeLinejoin="round" />
          </g>
          <circle cx="87" cy="88" r="14.5" fill="#34D399" />
          <path d="M80.5 88 L85 92.5 L94 82.5" fill="none" stroke="#1D2636" strokeWidth="5.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        <div className="flex-1">
          <ITText as="h1" className="text-base font-semibold leading-tight" style={{ color: "inherit" }}>
            CheckLab Agent
          </ITText>
          <ITText as="span" className="text-xs opacity-75" style={{ color: "inherit" }}>
            Sincronización local del reloj · v{state?.version ?? "0.1.0"}
          </ITText>
        </div>
        {tokenStatus === true && <ITBadget color="success">● Conectado</ITBadget>}
        {tokenStatus === false && <ITBadget color="danger">● Token inválido</ITBadget>}
        {!state?.tokenSet && <ITBadget color="warning">Sin configurar</ITBadget>}
      </header>

      <main className="flex-1 overflow-y-auto p-5">
        {notice && (
          <div className="mb-4">
            <ITAlert variant={notice.kind === "error" ? "error" : "success"} dismissible onDismiss={() => setNotice(null)}>
              {notice.text}
            </ITAlert>
          </div>
        )}
        {rotatedToken && (
          <div className="mb-4">
            <ITAlert variant="warning" dismissible onDismiss={() => setRotatedToken(null)}>
              <span className="font-semibold">Token nuevo (se muestra una sola vez): </span>
              <code className="break-all rounded bg-white/60 px-1.5 py-0.5 text-xs">{rotatedToken}</code>
            </ITAlert>
          </div>
        )}

        <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1.55fr_1fr]">
          <div className="flex flex-col gap-4">
            <ITCard>
              <SectionTitle icon={<FaPlug />} title="Conexión con el API" hint="Token de dispositivo del cliente" />
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <ITInput
                  name="apiUrl"
                  label="URL del API"
                  value={apiUrl}
                  onChange={(event) => {
                    dirty.current = true;
                    setApiUrl(event.target.value);
                  }}
                  placeholder="https://cliente.timemanager.mx/api/v1"
                  containerClassName="md:col-span-2"
                />
                <ITInput
                  name="token"
                  type="password"
                  label="Token de dispositivo"
                  value={token}
                  onChange={(event) => {
                    dirty.current = true;
                    setToken(event.target.value);
                  }}
                  placeholder={state?.tokenSet ? "•••• (guardado, escribe uno nuevo para reemplazarlo)" : "tma_…"}
                  containerClassName="md:col-span-2"
                />
                <ITInput
                  name="chunkSeconds"
                  type="number"
                  label="Chunk de sincronización (s)"
                  value={chunkSeconds}
                  onChange={(event) => {
                    dirty.current = true;
                    setChunkSeconds(event.target.value);
                  }}
                  placeholder="20"
                />
                <div className="flex items-end gap-3 pb-1">
                  <ITSlideToggle isOn={autoStart} onToggle={(value: boolean) => { dirty.current = true; setAutoStart(value); }} />
                  <div>
                    <ITText as="span" className="block text-sm font-medium">
                      Arrancar con el sistema
                    </ITText>
                    <ITText as="span" muted className="text-xs">
                      Windows/Linux (autoarranque del usuario)
                    </ITText>
                  </div>
                </div>
              </div>
              <div className="mt-4 flex flex-wrap items-center gap-2">
                <ITButton label="Guardar" size="sm" variant="outlined" onClick={() => void saveConnection()} disabled={busy !== null} />
                <ITButton
                  label="Validar y registrar"
                  size="sm"
                  icon={<FaKey />}
                  onClick={() => void register()}
                  disabled={busy !== null}
                />
                <ITText as="span" muted className="text-xs">
                  El token se guarda cifrado en este equipo (write-only).
                </ITText>
              </div>
            </ITCard>

            <ITCard>
              <SectionTitle
                icon={<FaServer />}
                title="Relojes del cliente"
                hint={`${state?.clocks.length ?? 0} configurado(s) en el panel`}
                action={
                  <ITButton
                    label={busy === "sync" ? "Sincronizando…" : "Sincronizar ahora"}
                    size="sm"
                    icon={<FaRotate />}
                    onClick={() => void syncNow()}
                    disabled={busy !== null || !state?.configured}
                  />
                }
              />
              {state && state.clocks.length > 0 ? (
                <div className="flex flex-col gap-2">
                  {state.clocks.map((clock) => (
                    <ClockRow key={clock.serialNumber} clock={clock} busy={busy} onTest={() => void testClock(clock)} />
                  ))}
                </div>
              ) : (
                <ITText muted className="block py-6 text-center text-sm">
                  Sin relojes todavía. Da de alta un reloj en el panel de CheckLab y vuelve a registrar el agente.
                </ITText>
              )}
            </ITCard>

            <ITCard>
              <SectionTitle
                icon={<FaDownload />}
                title="Registro de actividad"
                hint="Se guarda en este equipo"
                action={
                  <div className="flex gap-2">
                    <ITButton label="Exportar" size="sm" variant="outlined" icon={<FaDownload />} onClick={() => void exportLogs()} disabled={busy !== null} />
                    <ITButton label="Abrir carpeta" size="sm" variant="text" icon={<FaFolderOpen />} onClick={() => void bridge.openLogsFolder()} />
                  </div>
                }
              />
              <div className="max-h-56 overflow-y-auto rounded-xl bg-[#0F141C] p-3 font-mono text-[11px] leading-relaxed text-[#D7DEE8]">
                {(state?.logLines ?? []).length === 0 && <div className="opacity-60">Sin eventos todavía.</div>}
                {(state?.logLines ?? []).map((line, index) => (
                  <div key={`${line.at}-${index}`} className={line.level === "error" ? "text-[#FF9A8A]" : line.level === "warn" ? "text-[#F2C97D]" : undefined}>
                    <span className="opacity-50">{new Date(line.at).toLocaleTimeString("es-MX")} </span>
                    {line.message}
                  </div>
                ))}
              </div>
            </ITCard>
          </div>

          <div className="flex flex-col gap-4">
            <ITCard>
              <SectionTitle icon={<FaPlug />} title="Agente" hint="Credencial y salud" />
              <dl className="flex flex-col gap-2 text-sm">
                <Row label="Cliente" value={state?.tenantName ?? "Sin registrar"} />
                <Row label="agentId" value={shortId(state?.agentId ?? null)} mono />
                <Row label="Último heartbeat" value={formatDate(state?.lastHeartbeatAt ?? null)} />
                <Row label="Última sync" value={formatDate(state?.lastSyncAt ?? null)} />
                <Row label="Trabajos pendientes" value={String(state?.pendingJobs ?? 0)} />
                <Row label="Checadas en cola local" value={String(state?.pendingPunches ?? 0)} />
              </dl>
              <div className="mt-4 flex flex-wrap gap-2">
                <ITButton
                  label="Rotar token"
                  size="sm"
                  variant="outlined"
                  icon={<FaArrowsRotate />}
                  onClick={() => void rotateToken()}
                  disabled={busy !== null || !state?.tokenSet}
                />
              </div>
              {state?.lastError && (
                <div className="mt-3">
                  <ITAlert variant="error">{state.lastError}</ITAlert>
                </div>
              )}
            </ITCard>

            <ITCard>
              <SectionTitle icon={<FaRotate />} title="Ciclo del agente" hint="Local-first" />
              <dl className="flex flex-col gap-2 text-sm">
                <Row label="Chunk de checadas" value={`cada ${state?.chunkSeconds ?? 20} s`} />
                <Row label="Poll de trabajos" value={`cada ${state?.jobsPollSeconds ?? 5} s`} />
                <Row label="Heartbeat" value={`cada ${state?.heartbeatSeconds ?? 30} s`} />
                <Row label="Estado" value={state?.running ? "Activo" : "Detenido"} />
              </dl>
              <ITText muted className="mt-3 block text-xs">
                Si se cae la red, el agente sigue leyendo el reloj y deja las checadas en la cola local:
                se suben solas al reconectar, sin duplicados.
              </ITText>
            </ITCard>
          </div>
        </div>
      </main>
    </div>
  );
}

function SectionTitle({
  icon,
  title,
  hint,
  action,
}: {
  icon: ReactNode;
  title: string;
  hint?: string;
  action?: ReactNode;
}) {
  return (
    <div className="mb-3 flex items-start justify-between gap-3">
      <div className="flex items-center gap-2">
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#1D2636] text-sm text-[#F2A93B]">{icon}</span>
        <div>
          <ITText as="h2" className="text-sm font-semibold leading-tight">
            {title}
          </ITText>
          {hint && (
            <ITText as="span" muted className="text-xs">
              {hint}
            </ITText>
          )}
        </div>
      </div>
      {action}
    </div>
  );
}

function Row({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <dt className="text-slate-500">{label}</dt>
      <dd className={`font-medium text-[#1D2636] ${mono ? "font-mono text-xs" : ""}`}>{value}</dd>
    </div>
  );
}

function ClockRow({
  clock,
  busy,
  onTest,
}: {
  clock: AgentClockState;
  busy: string | null;
  onTest: () => void;
}) {
  const badge =
    clock.ok === true ? (
      <ITBadget color="success">● En línea</ITBadget>
    ) : clock.ok === false ? (
      <ITBadget color="danger">● Error</ITBadget>
    ) : (
      <ITBadget color="gray">Sin probar</ITBadget>
    );

  return (
    <div className="flex flex-wrap items-center gap-3 rounded-xl border border-slate-200 bg-white/70 px-3 py-2.5">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <ITText as="span" className="truncate text-sm font-semibold">
            {clock.name ?? clock.serialNumber}
          </ITText>
          {badge}
        </div>
        <ITText as="span" muted className="block truncate text-xs">
          {clock.serialNumber} · {clock.url}
        </ITText>
        {clock.error && <ITText as="span" className="block truncate text-xs text-[#BA1A1A]">{clock.error}</ITText>}
      </div>
      <div className="text-right">
        <ITText as="span" className="block text-xs text-slate-500">
          Cursor {clock.cursor}
          {clock.pending > 0 ? ` · ${clock.pending} en cola` : ""}
        </ITText>
        <ITText as="span" muted className="block text-xs">
          {formatDate(clock.lastSyncAt)}
        </ITText>
      </div>
      <ITButton
        label="Probar"
        size="sm"
        variant="text"
        onClick={onTest}
        disabled={busy !== null}
      />
    </div>
  );
}
