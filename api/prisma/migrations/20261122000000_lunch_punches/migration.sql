-- Checada de comida: inicio y regreso (además de entrada/salida).
ALTER TYPE "RemotePunchType" ADD VALUE IF NOT EXISTS 'LUNCH_START';
ALTER TYPE "RemotePunchType" ADD VALUE IF NOT EXISTS 'LUNCH_END';
