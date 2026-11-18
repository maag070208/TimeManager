-- Checada olvidada: el trabajador pide que se agregue una entrada/salida que
-- nunca se registró. El ajuste no apunta a una checada (`targetId` = persona);
-- al aprobarse se inserta el marcaje remoto y se enlaza en `remotePunchId`.
ALTER TYPE "PunchAdjustmentTarget" ADD VALUE IF NOT EXISTS 'MISSING';
