ALTER TABLE "nom_settings"
  ADD COLUMN "blockRemoteWithoutAgreement" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "requireUnionForCollective" BOOLEAN NOT NULL DEFAULT true;
