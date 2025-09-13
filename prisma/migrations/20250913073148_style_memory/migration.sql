-- CreateTable
CREATE TABLE "SenderProfile" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "email" TEXT NOT NULL,
    "preferredTone" TEXT,
    "preferredLang" TEXT,
    "greeting" TEXT,
    "closing" TEXT,
    "mustUse" TEXT,
    "mustAvoid" TEXT,
    "avgLength" INTEGER,
    "editsCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "StyleExample" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "sender" TEXT NOT NULL,
    "original" TEXT NOT NULL,
    "edited" TEXT NOT NULL,
    "editDelta" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE UNIQUE INDEX "SenderProfile_email_key" ON "SenderProfile"("email");
