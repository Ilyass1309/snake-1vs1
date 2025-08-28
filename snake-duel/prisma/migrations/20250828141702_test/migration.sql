-- CreateTable
CREATE TABLE "AiStats" (
    "id" TEXT NOT NULL DEFAULT 'global',
    "level1Games" INTEGER NOT NULL DEFAULT 0,
    "level1Wins" INTEGER NOT NULL DEFAULT 0,
    "level2Games" INTEGER NOT NULL DEFAULT 0,
    "level2Wins" INTEGER NOT NULL DEFAULT 0,
    "level3Games" INTEGER NOT NULL DEFAULT 0,
    "level3Wins" INTEGER NOT NULL DEFAULT 0,
    "level4Games" INTEGER NOT NULL DEFAULT 0,
    "level4Wins" INTEGER NOT NULL DEFAULT 0,
    "level5Games" INTEGER NOT NULL DEFAULT 0,
    "level5Wins" INTEGER NOT NULL DEFAULT 0,
    "lastUpdated" TIMESTAMPTZ(6),

    CONSTRAINT "AiStats_pkey" PRIMARY KEY ("id")
);
