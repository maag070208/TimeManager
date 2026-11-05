-- RJ-02: las checadas web/app cuentan para la jornada cuando no hay reloj.
ALTER TABLE "nom_settings" ADD COLUMN "remoteCountsForWorkday" BOOLEAN NOT NULL DEFAULT true;
