import type { PrismaClient } from "@prisma/client";
import { env } from "@core/config/env.config";
import { logger } from "@core/utils/logger";
import {
  acquireLeaderLock,
  heartbeatLeaderLock,
  releaseLeaderLock,
  workerHolderId,
} from "./leader-lock";

/**
 * Elección de líder entre procesos de workers (F1B-02). Mientras un proceso es
 * líder corre los trabajos periódicos; los demás esperan y reintentan. Si el
 * líder muere, el heartbeat caduca (TTL) y otro lo toma sin intervención.
 *
 * `onChange` recibe `true` al ganar y `false` al perder el liderazgo: el
 * runtime arranca/detiene los timers ahí.
 */
export class LeaderElection {
  readonly holder = workerHolderId();
  private timer: ReturnType<typeof setInterval> | null = null;
  private leader = false;
  private stopping = false;
  private ticking = false;
  private renewing = false;

  constructor(
    private readonly db: PrismaClient,
    private readonly onChange: (isLeader: boolean) => void,
    private readonly options: { name?: string; ttlMs?: number; retryMs?: number } = {}
  ) {}

  private get name(): string {
    return this.options.name ?? "workers";
  }

  get isLeader(): boolean {
    return this.leader;
  }

  /** Toma el liderazgo si está libre y arranca el ciclo de heartbeat. */
  async start(): Promise<boolean> {
    this.stopping = false;
    const won = await acquireLeaderLock(
      this.db,
      this.name,
      this.holder,
      this.options.ttlMs ?? env.LEADER_LOCK_TTL_MS
    );
    this.setLeader(won);
    this.timer = setInterval(() => void this.tick(), this.options.retryMs ?? env.LEADER_LOCK_RETRY_MS);
    return won;
  }

  /** Un ciclo: renueva si somos líder o intenta tomarlo si no. */
  async tick(): Promise<void> {
    if (this.stopping || this.ticking) return;
    this.ticking = true;
    try {
      if (this.leader) {
        const still = await heartbeatLeaderLock(this.db, this.name, this.holder);
        if (!still) {
          logger.warn(`[workers] leadership lost (${this.name}); this instance stops its periodic work`);
          this.setLeader(false);
        }
        return;
      }
      const won = await acquireLeaderLock(
        this.db,
        this.name,
        this.holder,
        this.options.ttlMs ?? env.LEADER_LOCK_TTL_MS
      );
      if (won) this.setLeader(true);
    } catch (err) {
      // La BD caída no debe tumbar el proceso: en el siguiente ciclo se reintenta.
      logger.warn(`[workers] leader election failed: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      this.ticking = false;
    }
  }

  /** Suelta el liderazgo y detiene el ciclo (apagado ordenado). */
  async stop(): Promise<void> {
    this.stopping = true;
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    if (this.leader) {
      this.setLeader(false);
      await releaseLeaderLock(this.db, this.name, this.holder).catch((err: unknown) => {
        logger.warn(`[workers] could not release the leader lock: ${err instanceof Error ? err.message : String(err)}`);
      });
    }
  }

  private setLeader(value: boolean): void {
    if (this.leader === value) return;
    this.leader = value;
    if (value) logger.info(`[workers] leader acquired (${this.name}, holder ${this.holder})`);
    this.onChange(value);
  }
}
