-- AlterTable
ALTER TABLE "State" ADD COLUMN     "isActive" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE "District" ADD COLUMN     "isActive" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "gatcId" TEXT;

-- AlterTable
ALTER TABLE "Application" ADD COLUMN     "preferredGatcId" TEXT;

-- AlterTable
ALTER TABLE "ApplicationDocument" ADD COLUMN     "storageUrl" TEXT;

-- AlterTable
ALTER TABLE "Inspection" ADD COLUMN     "dismissReason" TEXT,
ADD COLUMN     "dismissedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "InspectionPhoto" ADD COLUMN     "storageUrl" TEXT;

-- CreateTable
CREATE TABLE "_OfficerJurisdiction" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_OfficerJurisdiction_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE INDEX "_OfficerJurisdiction_B_index" ON "_OfficerJurisdiction"("B");

-- CreateIndex
CREATE INDEX "User_gatcId_idx" ON "User"("gatcId");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_gatcId_fkey" FOREIGN KEY ("gatcId") REFERENCES "GATCProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Application" ADD CONSTRAINT "Application_preferredGatcId_fkey" FOREIGN KEY ("preferredGatcId") REFERENCES "GATCProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_OfficerJurisdiction" ADD CONSTRAINT "_OfficerJurisdiction_A_fkey" FOREIGN KEY ("A") REFERENCES "District"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_OfficerJurisdiction" ADD CONSTRAINT "_OfficerJurisdiction_B_fkey" FOREIGN KEY ("B") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

