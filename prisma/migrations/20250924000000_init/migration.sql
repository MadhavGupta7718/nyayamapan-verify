-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "Role" AS ENUM ('SUPER_ADMIN', 'STATE_ADMIN', 'LMO', 'GATC_ADMIN', 'GATC_OFFICER', 'BUSINESS_USER', 'INSPECTOR', 'PUBLIC', 'AUDITOR');

-- CreateEnum
CREATE TYPE "AccountStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'SUSPENDED', 'PENDING');

-- CreateEnum
CREATE TYPE "ApplicationStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'DOCUMENT_REVIEW', 'APPROVED', 'RETURNED', 'REJECTED', 'SCHEDULED', 'ASSIGNED', 'FIELD_VERIFICATION', 'INSPECTION_COMPLETED', 'PASS', 'FAIL', 'STAMPING', 'CERTIFICATE_GENERATED', 'CERTIFICATE_ISSUED', 'ACTIVE', 'CANCELLED', 'EXPIRED', 'SUSPENDED', 'REVOKED');

-- CreateEnum
CREATE TYPE "CertificateStatus" AS ENUM ('ACTIVE', 'EXPIRED', 'SUSPENDED', 'REVOKED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "VerificationType" AS ENUM ('INITIAL_VERIFICATION', 'RE_VERIFICATION', 'OTHER_APPLICABLE');

-- CreateEnum
CREATE TYPE "RuleStatus" AS ENUM ('DRAFT', 'UNDER_REVIEW', 'APPROVED', 'ACTIVE', 'RETIRED', 'CONFIGURATION_REQUIRED');

-- CreateEnum
CREATE TYPE "ChecklistResult" AS ENUM ('PASS', 'FAIL', 'NA', 'PENDING');

-- CreateEnum
CREATE TYPE "DocumentStatus" AS ENUM ('UPLOADED', 'VERIFIED', 'REJECTED', 'SUPERSEDED');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('NOT_REQUIRED', 'PENDING', 'COMPLETED', 'FAILED');

-- CreateTable
CREATE TABLE "State" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "nameHi" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "State_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "District" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "nameHi" TEXT,
    "stateId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "District_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Organization" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'BUSINESS',
    "address" TEXT,
    "stateId" TEXT,
    "districtId" TEXT,
    "gstin" TEXT,
    "isDemo" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Organization_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "mobile" TEXT,
    "role" "Role" NOT NULL,
    "organizationId" TEXT,
    "stateId" TEXT,
    "status" "AccountStatus" NOT NULL DEFAULT 'ACTIVE',
    "isDemo" BOOLEAN NOT NULL DEFAULT false,
    "locale" TEXT NOT NULL DEFAULT 'en',
    "preferences" JSONB,
    "lastLoginAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "License" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "licenseType" TEXT NOT NULL,
    "licenseNumber" TEXT,
    "authority" TEXT,
    "status" TEXT NOT NULL DEFAULT 'CONFIGURATION_REQUIRED',
    "validFrom" TIMESTAMP(3),
    "validUntil" TIMESTAMP(3),
    "sourceDocument" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "License_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InstrumentType" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "nameHi" TEXT,
    "category" TEXT,
    "technicalParameters" JSONB,
    "verificationParameters" JSONB,
    "testParameters" JSONB,
    "requiredDocuments" JSONB,
    "requiredPhotos" JSONB,
    "validityRuleId" TEXT,
    "eligibleVerificationAuthorities" JSONB,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InstrumentType_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InstrumentModel" (
    "id" TEXT NOT NULL,
    "manufacturer" TEXT NOT NULL,
    "modelName" TEXT NOT NULL,
    "instrumentTypeId" TEXT NOT NULL,
    "approvalNumber" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InstrumentModel_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Instrument" (
    "id" TEXT NOT NULL,
    "instrumentCode" TEXT NOT NULL,
    "instrumentTypeId" TEXT NOT NULL,
    "modelId" TEXT,
    "manufacturer" TEXT NOT NULL,
    "modelName" TEXT NOT NULL,
    "serialNumber" TEXT NOT NULL,
    "capacity" TEXT,
    "accuracy" TEXT,
    "unit" TEXT,
    "yearOfManufacture" INTEGER,
    "dateOfInstallation" TIMESTAMP(3),
    "organizationId" TEXT NOT NULL,
    "locationLabel" TEXT,
    "address" TEXT,
    "stateId" TEXT,
    "districtId" TEXT,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "currentStatus" TEXT NOT NULL DEFAULT 'REGISTERED',
    "verificationStatus" TEXT NOT NULL DEFAULT 'PENDING',
    "lastVerificationAt" TIMESTAMP(3),
    "nextDueDate" TIMESTAMP(3),
    "certificateNumber" TEXT,
    "isDemo" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Instrument_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LegalSource" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "documentUrl" TEXT,
    "publisher" TEXT NOT NULL DEFAULT 'Department of Consumer Affairs',
    "publishedAt" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LegalSource_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RuleAmendment" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "notification" TEXT,
    "effectiveFrom" TIMESTAMP(3),
    "sourceId" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RuleAmendment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LegalRule" (
    "id" TEXT NOT NULL,
    "ruleKey" TEXT NOT NULL,
    "actName" TEXT NOT NULL,
    "ruleName" TEXT NOT NULL,
    "ruleNumber" TEXT,
    "sectionNumber" TEXT,
    "scheduleReference" TEXT,
    "instrumentTypeId" TEXT,
    "stateCode" TEXT,
    "requirement" TEXT NOT NULL,
    "parameter" TEXT NOT NULL,
    "value" TEXT,
    "unit" TEXT,
    "valueStatus" TEXT NOT NULL DEFAULT 'SET',
    "sourceNotification" TEXT,
    "sourceDocument" TEXT,
    "amendmentReference" TEXT,
    "sourceId" TEXT,
    "status" "RuleStatus" NOT NULL DEFAULT 'DRAFT',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LegalRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LegalRuleVersion" (
    "id" TEXT NOT NULL,
    "legalRuleId" TEXT NOT NULL,
    "versionNumber" INTEGER NOT NULL,
    "value" TEXT,
    "valueStatus" TEXT NOT NULL DEFAULT 'SET',
    "effectiveFrom" TIMESTAMP(3) NOT NULL,
    "effectiveUntil" TIMESTAMP(3),
    "changeReason" TEXT,
    "approvedById" TEXT,
    "snapshot" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LegalRuleVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StateRuleConfiguration" (
    "id" TEXT NOT NULL,
    "stateId" TEXT NOT NULL,
    "ruleKey" TEXT NOT NULL,
    "effectiveFrom" TIMESTAMP(3) NOT NULL,
    "effectiveUntil" TIMESTAMP(3),
    "authority" TEXT,
    "feesJson" JSONB,
    "workflowJson" JSONB,
    "instrumentRules" JSONB,
    "notificationRules" JSONB,
    "notes" TEXT DEFAULT 'CONFIGURATION REQUIRED — load from State Enforcement Rules',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StateRuleConfiguration_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Application" (
    "id" TEXT NOT NULL,
    "applicationNumber" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "instrumentId" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "verificationType" "VerificationType" NOT NULL,
    "status" "ApplicationStatus" NOT NULL DEFAULT 'DRAFT',
    "preferredDate" TIMESTAMP(3),
    "preferredSlot" TEXT,
    "remarks" TEXT,
    "declarationAccepted" BOOLEAN NOT NULL DEFAULT false,
    "ruleVersionId" TEXT,
    "feeRequired" BOOLEAN NOT NULL DEFAULT false,
    "paymentStatus" "PaymentStatus" NOT NULL DEFAULT 'NOT_REQUIRED',
    "isDemo" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Application_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ApplicationDocument" (
    "id" TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,
    "documentType" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "storageKey" TEXT NOT NULL,
    "checksum" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "status" "DocumentStatus" NOT NULL DEFAULT 'UPLOADED',
    "uploadedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ApplicationDocument_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ApplicationStatusHistory" (
    "id" TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,
    "previousStatus" "ApplicationStatus",
    "newStatus" "ApplicationStatus" NOT NULL,
    "changedById" TEXT,
    "reason" TEXT,
    "remarks" TEXT,
    "changedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ApplicationStatusHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GATCProfile" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "approvalNumber" TEXT NOT NULL,
    "address" TEXT,
    "stateId" TEXT,
    "districtId" TEXT,
    "approvalStatus" TEXT NOT NULL DEFAULT 'APPROVED',
    "approvalStart" TIMESTAMP(3),
    "approvalEnd" TIMESTAMP(3),
    "contactEmail" TEXT,
    "contactPhone" TEXT,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "isDemo" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GATCProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GATCInstrumentAuthorization" (
    "id" TEXT NOT NULL,
    "gatcId" TEXT NOT NULL,
    "instrumentTypeId" TEXT NOT NULL,
    "validFrom" TIMESTAMP(3),
    "validUntil" TIMESTAMP(3),
    "sourceNote" TEXT DEFAULT 'CONFIGURATION REQUIRED — load from GATC First Schedule / amendment',

    CONSTRAINT "GATCInstrumentAuthorization_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VerificationAssignment" (
    "id" TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,
    "officerId" TEXT,
    "gatcId" TEXT,
    "authorityType" TEXT NOT NULL DEFAULT 'LMO',
    "status" TEXT NOT NULL DEFAULT 'ASSIGNED',
    "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "notes" TEXT,

    CONSTRAINT "VerificationAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VerificationSchedule" (
    "id" TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,
    "assignmentId" TEXT,
    "scheduledDate" TIMESTAMP(3) NOT NULL,
    "timeSlot" TEXT,
    "status" TEXT NOT NULL DEFAULT 'SCHEDULED',
    "conflictFlags" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VerificationSchedule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Inspection" (
    "id" TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,
    "officerId" TEXT,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "overallResult" "ChecklistResult" NOT NULL DEFAULT 'PENDING',
    "observations" TEXT,
    "serialConfirmed" BOOLEAN NOT NULL DEFAULT false,
    "offlineSynced" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Inspection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InspectionChecklist" (
    "id" TEXT NOT NULL,
    "inspectionId" TEXT NOT NULL,
    "itemKey" TEXT NOT NULL,
    "itemLabel" TEXT NOT NULL,
    "result" "ChecklistResult" NOT NULL DEFAULT 'PENDING',
    "remarks" TEXT,
    "ruleRef" TEXT,

    CONSTRAINT "InspectionChecklist_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InspectionTest" (
    "id" TEXT NOT NULL,
    "inspectionId" TEXT NOT NULL,
    "testName" TEXT NOT NULL,
    "requiredStandard" TEXT,
    "expectedValue" TEXT,
    "observedValue" TEXT,
    "unit" TEXT,
    "permissibleError" TEXT DEFAULT 'CONFIGURATION_REQUIRED',
    "calculatedError" TEXT,
    "result" "ChecklistResult" NOT NULL DEFAULT 'PENDING',
    "ruleVersionRef" TEXT,

    CONSTRAINT "InspectionTest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InspectionMeasurement" (
    "id" TEXT NOT NULL,
    "inspectionId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "observedValue" DOUBLE PRECISION,
    "referenceValue" DOUBLE PRECISION,
    "error" DOUBLE PRECISION,
    "permissibleError" DOUBLE PRECISION,
    "unit" TEXT,
    "result" "ChecklistResult" NOT NULL DEFAULT 'PENDING',
    "calculationNote" TEXT,

    CONSTRAINT "InspectionMeasurement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InspectionPhoto" (
    "id" TEXT NOT NULL,
    "inspectionId" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "storageKey" TEXT NOT NULL,
    "checksum" TEXT NOT NULL,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "capturedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "capturedById" TEXT,

    CONSTRAINT "InspectionPhoto_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GpsRecord" (
    "id" TEXT NOT NULL,
    "inspectionId" TEXT,
    "userId" TEXT,
    "latitude" DOUBLE PRECISION NOT NULL,
    "longitude" DOUBLE PRECISION NOT NULL,
    "accuracy" DOUBLE PRECISION,
    "purpose" TEXT NOT NULL,
    "capturedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GpsRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StampingRecord" (
    "id" TEXT NOT NULL,
    "inspectionId" TEXT NOT NULL,
    "stampIdentifier" TEXT,
    "stampType" TEXT,
    "stampDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "authority" TEXT,
    "officerId" TEXT,
    "remarks" TEXT,
    "evidenceKey" TEXT,
    "formatNote" TEXT DEFAULT 'Stamp identifier format: CONFIGURATION REQUIRED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StampingRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Certificate" (
    "id" TEXT NOT NULL,
    "certificateNumber" TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,
    "instrumentId" TEXT NOT NULL,
    "status" "CertificateStatus" NOT NULL DEFAULT 'ACTIVE',
    "verificationDate" TIMESTAMP(3) NOT NULL,
    "validUntil" TIMESTAMP(3),
    "result" TEXT NOT NULL,
    "issuingAuthority" TEXT,
    "officerName" TEXT,
    "ruleVersionId" TEXT,
    "validityCalcMethod" TEXT,
    "pdfStorageKey" TEXT,
    "contentHash" TEXT,
    "signatureMeta" JSONB,
    "isDemo" BOOLEAN NOT NULL DEFAULT false,
    "publicFields" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Certificate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CertificateVersion" (
    "id" TEXT NOT NULL,
    "certificateId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "pdfStorageKey" TEXT,
    "snapshot" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CertificateVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CertificateRevocation" (
    "id" TEXT NOT NULL,
    "certificateId" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "revokedById" TEXT,
    "revokedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CertificateRevocation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QrToken" (
    "id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "certificateId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3),

    CONSTRAINT "QrToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PublicVerification" (
    "id" TEXT NOT NULL,
    "qrTokenId" TEXT NOT NULL,
    "result" TEXT NOT NULL,
    "ipHash" TEXT,
    "userAgent" TEXT,
    "verifiedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PublicVerification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NotificationTemplate" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "channel" TEXT NOT NULL,
    "subjectEn" TEXT,
    "subjectHi" TEXT,
    "bodyEn" TEXT NOT NULL,
    "bodyHi" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NotificationTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "channel" TEXT NOT NULL DEFAULT 'IN_APP',
    "readAt" TIMESTAMP(3),
    "meta" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FeeRule" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "amountPaise" INTEGER,
    "currency" TEXT NOT NULL DEFAULT 'INR',
    "valueStatus" TEXT NOT NULL DEFAULT 'CONFIGURATION_REQUIRED',
    "stateCode" TEXT,
    "sourceRef" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FeeRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Payment" (
    "id" TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,
    "amountPaise" INTEGER,
    "status" "PaymentStatus" NOT NULL DEFAULT 'PENDING',
    "provider" TEXT NOT NULL DEFAULT 'UNCONFIGURED',
    "providerRef" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Payment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PaymentTransaction" (
    "id" TEXT NOT NULL,
    "paymentId" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "raw" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PaymentTransaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Complaint" (
    "id" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "stateCode" TEXT,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Complaint_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EnforcementAction" (
    "id" TEXT NOT NULL,
    "complaintId" TEXT,
    "actionType" TEXT NOT NULL,
    "notes" TEXT,
    "penaltyNote" TEXT DEFAULT 'Penalty amounts: CONFIGURATION REQUIRED from applicable law',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EnforcementAction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "actorId" TEXT,
    "action" TEXT NOT NULL,
    "entity" TEXT NOT NULL,
    "entityId" TEXT,
    "before" JSONB,
    "after" JSONB,
    "reason" TEXT,
    "ip" TEXT,
    "userAgent" TEXT,
    "requestId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SystemSetting" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "value" JSONB NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SystemSetting_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Location" (
    "id" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "latitude" DOUBLE PRECISION NOT NULL,
    "longitude" DOUBLE PRECISION NOT NULL,
    "meta" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Location_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "State_code_key" ON "State"("code");

-- CreateIndex
CREATE INDEX "District_stateId_idx" ON "District"("stateId");

-- CreateIndex
CREATE UNIQUE INDEX "District_stateId_name_key" ON "District"("stateId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_role_idx" ON "User"("role");

-- CreateIndex
CREATE INDEX "User_organizationId_idx" ON "User"("organizationId");

-- CreateIndex
CREATE INDEX "User_stateId_role_idx" ON "User"("stateId", "role");

-- CreateIndex
CREATE INDEX "License_organizationId_idx" ON "License"("organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "InstrumentType_code_key" ON "InstrumentType"("code");

-- CreateIndex
CREATE INDEX "InstrumentModel_instrumentTypeId_idx" ON "InstrumentModel"("instrumentTypeId");

-- CreateIndex
CREATE UNIQUE INDEX "Instrument_instrumentCode_key" ON "Instrument"("instrumentCode");

-- CreateIndex
CREATE INDEX "Instrument_organizationId_idx" ON "Instrument"("organizationId");

-- CreateIndex
CREATE INDEX "Instrument_instrumentTypeId_idx" ON "Instrument"("instrumentTypeId");

-- CreateIndex
CREATE INDEX "Instrument_nextDueDate_idx" ON "Instrument"("nextDueDate");

-- CreateIndex
CREATE INDEX "Instrument_stateId_idx" ON "Instrument"("stateId");

-- CreateIndex
CREATE INDEX "Instrument_createdAt_idx" ON "Instrument"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Instrument_serialNumber_manufacturer_key" ON "Instrument"("serialNumber", "manufacturer");

-- CreateIndex
CREATE INDEX "LegalRule_ruleKey_idx" ON "LegalRule"("ruleKey");

-- CreateIndex
CREATE INDEX "LegalRule_parameter_status_idx" ON "LegalRule"("parameter", "status");

-- CreateIndex
CREATE INDEX "LegalRuleVersion_effectiveFrom_effectiveUntil_idx" ON "LegalRuleVersion"("effectiveFrom", "effectiveUntil");

-- CreateIndex
CREATE UNIQUE INDEX "LegalRuleVersion_legalRuleId_versionNumber_key" ON "LegalRuleVersion"("legalRuleId", "versionNumber");

-- CreateIndex
CREATE INDEX "StateRuleConfiguration_stateId_ruleKey_idx" ON "StateRuleConfiguration"("stateId", "ruleKey");

-- CreateIndex
CREATE UNIQUE INDEX "Application_applicationNumber_key" ON "Application"("applicationNumber");

-- CreateIndex
CREATE INDEX "Application_organizationId_status_idx" ON "Application"("organizationId", "status");

-- CreateIndex
CREATE INDEX "Application_status_updatedAt_idx" ON "Application"("status", "updatedAt");

-- CreateIndex
CREATE INDEX "Application_instrumentId_idx" ON "Application"("instrumentId");

-- CreateIndex
CREATE INDEX "Application_createdAt_idx" ON "Application"("createdAt");

-- CreateIndex
CREATE INDEX "ApplicationDocument_applicationId_idx" ON "ApplicationDocument"("applicationId");

-- CreateIndex
CREATE INDEX "ApplicationStatusHistory_applicationId_changedAt_idx" ON "ApplicationStatusHistory"("applicationId", "changedAt");

-- CreateIndex
CREATE UNIQUE INDEX "GATCProfile_approvalNumber_key" ON "GATCProfile"("approvalNumber");

-- CreateIndex
CREATE UNIQUE INDEX "GATCInstrumentAuthorization_gatcId_instrumentTypeId_key" ON "GATCInstrumentAuthorization"("gatcId", "instrumentTypeId");

-- CreateIndex
CREATE INDEX "VerificationAssignment_officerId_idx" ON "VerificationAssignment"("officerId");

-- CreateIndex
CREATE INDEX "VerificationAssignment_applicationId_idx" ON "VerificationAssignment"("applicationId");

-- CreateIndex
CREATE INDEX "VerificationAssignment_gatcId_idx" ON "VerificationAssignment"("gatcId");

-- CreateIndex
CREATE INDEX "VerificationSchedule_scheduledDate_idx" ON "VerificationSchedule"("scheduledDate");

-- CreateIndex
CREATE INDEX "VerificationSchedule_applicationId_idx" ON "VerificationSchedule"("applicationId");

-- CreateIndex
CREATE INDEX "VerificationSchedule_assignmentId_idx" ON "VerificationSchedule"("assignmentId");

-- CreateIndex
CREATE INDEX "Inspection_applicationId_idx" ON "Inspection"("applicationId");

-- CreateIndex
CREATE INDEX "Inspection_officerId_idx" ON "Inspection"("officerId");

-- CreateIndex
CREATE INDEX "InspectionChecklist_inspectionId_idx" ON "InspectionChecklist"("inspectionId");

-- CreateIndex
CREATE INDEX "InspectionTest_inspectionId_idx" ON "InspectionTest"("inspectionId");

-- CreateIndex
CREATE INDEX "InspectionPhoto_inspectionId_idx" ON "InspectionPhoto"("inspectionId");

-- CreateIndex
CREATE INDEX "GpsRecord_inspectionId_idx" ON "GpsRecord"("inspectionId");

-- CreateIndex
CREATE UNIQUE INDEX "StampingRecord_inspectionId_key" ON "StampingRecord"("inspectionId");

-- CreateIndex
CREATE UNIQUE INDEX "Certificate_certificateNumber_key" ON "Certificate"("certificateNumber");

-- CreateIndex
CREATE INDEX "Certificate_status_validUntil_idx" ON "Certificate"("status", "validUntil");

-- CreateIndex
CREATE INDEX "Certificate_validUntil_idx" ON "Certificate"("validUntil");

-- CreateIndex
CREATE INDEX "Certificate_applicationId_idx" ON "Certificate"("applicationId");

-- CreateIndex
CREATE INDEX "Certificate_instrumentId_idx" ON "Certificate"("instrumentId");

-- CreateIndex
CREATE INDEX "Certificate_verificationDate_idx" ON "Certificate"("verificationDate");

-- CreateIndex
CREATE UNIQUE INDEX "QrToken_token_key" ON "QrToken"("token");

-- CreateIndex
CREATE UNIQUE INDEX "QrToken_certificateId_key" ON "QrToken"("certificateId");

-- CreateIndex
CREATE INDEX "PublicVerification_qrTokenId_idx" ON "PublicVerification"("qrTokenId");

-- CreateIndex
CREATE INDEX "PublicVerification_verifiedAt_idx" ON "PublicVerification"("verifiedAt");

-- CreateIndex
CREATE UNIQUE INDEX "NotificationTemplate_key_key" ON "NotificationTemplate"("key");

-- CreateIndex
CREATE INDEX "Notification_userId_readAt_idx" ON "Notification"("userId", "readAt");

-- CreateIndex
CREATE INDEX "Notification_userId_createdAt_idx" ON "Notification"("userId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "FeeRule_code_key" ON "FeeRule"("code");

-- CreateIndex
CREATE INDEX "AuditLog_entity_entityId_idx" ON "AuditLog"("entity", "entityId");

-- CreateIndex
CREATE INDEX "AuditLog_actorId_idx" ON "AuditLog"("actorId");

-- CreateIndex
CREATE INDEX "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_action_idx" ON "AuditLog"("action");

-- CreateIndex
CREATE UNIQUE INDEX "SystemSetting_key_key" ON "SystemSetting"("key");

-- AddForeignKey
ALTER TABLE "District" ADD CONSTRAINT "District_stateId_fkey" FOREIGN KEY ("stateId") REFERENCES "State"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Organization" ADD CONSTRAINT "Organization_stateId_fkey" FOREIGN KEY ("stateId") REFERENCES "State"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Organization" ADD CONSTRAINT "Organization_districtId_fkey" FOREIGN KEY ("districtId") REFERENCES "District"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_stateId_fkey" FOREIGN KEY ("stateId") REFERENCES "State"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "License" ADD CONSTRAINT "License_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InstrumentModel" ADD CONSTRAINT "InstrumentModel_instrumentTypeId_fkey" FOREIGN KEY ("instrumentTypeId") REFERENCES "InstrumentType"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Instrument" ADD CONSTRAINT "Instrument_instrumentTypeId_fkey" FOREIGN KEY ("instrumentTypeId") REFERENCES "InstrumentType"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Instrument" ADD CONSTRAINT "Instrument_modelId_fkey" FOREIGN KEY ("modelId") REFERENCES "InstrumentModel"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Instrument" ADD CONSTRAINT "Instrument_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Instrument" ADD CONSTRAINT "Instrument_stateId_fkey" FOREIGN KEY ("stateId") REFERENCES "State"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Instrument" ADD CONSTRAINT "Instrument_districtId_fkey" FOREIGN KEY ("districtId") REFERENCES "District"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RuleAmendment" ADD CONSTRAINT "RuleAmendment_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "LegalSource"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LegalRule" ADD CONSTRAINT "LegalRule_instrumentTypeId_fkey" FOREIGN KEY ("instrumentTypeId") REFERENCES "InstrumentType"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LegalRule" ADD CONSTRAINT "LegalRule_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "LegalSource"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LegalRuleVersion" ADD CONSTRAINT "LegalRuleVersion_legalRuleId_fkey" FOREIGN KEY ("legalRuleId") REFERENCES "LegalRule"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StateRuleConfiguration" ADD CONSTRAINT "StateRuleConfiguration_stateId_fkey" FOREIGN KEY ("stateId") REFERENCES "State"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Application" ADD CONSTRAINT "Application_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Application" ADD CONSTRAINT "Application_instrumentId_fkey" FOREIGN KEY ("instrumentId") REFERENCES "Instrument"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Application" ADD CONSTRAINT "Application_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Application" ADD CONSTRAINT "Application_ruleVersionId_fkey" FOREIGN KEY ("ruleVersionId") REFERENCES "LegalRuleVersion"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApplicationDocument" ADD CONSTRAINT "ApplicationDocument_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "Application"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApplicationStatusHistory" ADD CONSTRAINT "ApplicationStatusHistory_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "Application"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApplicationStatusHistory" ADD CONSTRAINT "ApplicationStatusHistory_changedById_fkey" FOREIGN KEY ("changedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GATCProfile" ADD CONSTRAINT "GATCProfile_stateId_fkey" FOREIGN KEY ("stateId") REFERENCES "State"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GATCProfile" ADD CONSTRAINT "GATCProfile_districtId_fkey" FOREIGN KEY ("districtId") REFERENCES "District"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GATCInstrumentAuthorization" ADD CONSTRAINT "GATCInstrumentAuthorization_gatcId_fkey" FOREIGN KEY ("gatcId") REFERENCES "GATCProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GATCInstrumentAuthorization" ADD CONSTRAINT "GATCInstrumentAuthorization_instrumentTypeId_fkey" FOREIGN KEY ("instrumentTypeId") REFERENCES "InstrumentType"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VerificationAssignment" ADD CONSTRAINT "VerificationAssignment_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "Application"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VerificationAssignment" ADD CONSTRAINT "VerificationAssignment_officerId_fkey" FOREIGN KEY ("officerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VerificationAssignment" ADD CONSTRAINT "VerificationAssignment_gatcId_fkey" FOREIGN KEY ("gatcId") REFERENCES "GATCProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VerificationSchedule" ADD CONSTRAINT "VerificationSchedule_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "Application"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VerificationSchedule" ADD CONSTRAINT "VerificationSchedule_assignmentId_fkey" FOREIGN KEY ("assignmentId") REFERENCES "VerificationAssignment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Inspection" ADD CONSTRAINT "Inspection_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "Application"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Inspection" ADD CONSTRAINT "Inspection_officerId_fkey" FOREIGN KEY ("officerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InspectionChecklist" ADD CONSTRAINT "InspectionChecklist_inspectionId_fkey" FOREIGN KEY ("inspectionId") REFERENCES "Inspection"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InspectionTest" ADD CONSTRAINT "InspectionTest_inspectionId_fkey" FOREIGN KEY ("inspectionId") REFERENCES "Inspection"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InspectionMeasurement" ADD CONSTRAINT "InspectionMeasurement_inspectionId_fkey" FOREIGN KEY ("inspectionId") REFERENCES "Inspection"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InspectionPhoto" ADD CONSTRAINT "InspectionPhoto_inspectionId_fkey" FOREIGN KEY ("inspectionId") REFERENCES "Inspection"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GpsRecord" ADD CONSTRAINT "GpsRecord_inspectionId_fkey" FOREIGN KEY ("inspectionId") REFERENCES "Inspection"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GpsRecord" ADD CONSTRAINT "GpsRecord_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StampingRecord" ADD CONSTRAINT "StampingRecord_inspectionId_fkey" FOREIGN KEY ("inspectionId") REFERENCES "Inspection"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StampingRecord" ADD CONSTRAINT "StampingRecord_officerId_fkey" FOREIGN KEY ("officerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Certificate" ADD CONSTRAINT "Certificate_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "Application"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Certificate" ADD CONSTRAINT "Certificate_instrumentId_fkey" FOREIGN KEY ("instrumentId") REFERENCES "Instrument"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Certificate" ADD CONSTRAINT "Certificate_ruleVersionId_fkey" FOREIGN KEY ("ruleVersionId") REFERENCES "LegalRuleVersion"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CertificateVersion" ADD CONSTRAINT "CertificateVersion_certificateId_fkey" FOREIGN KEY ("certificateId") REFERENCES "Certificate"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CertificateRevocation" ADD CONSTRAINT "CertificateRevocation_certificateId_fkey" FOREIGN KEY ("certificateId") REFERENCES "Certificate"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QrToken" ADD CONSTRAINT "QrToken_certificateId_fkey" FOREIGN KEY ("certificateId") REFERENCES "Certificate"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PublicVerification" ADD CONSTRAINT "PublicVerification_qrTokenId_fkey" FOREIGN KEY ("qrTokenId") REFERENCES "QrToken"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "Application"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentTransaction" ADD CONSTRAINT "PaymentTransaction_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "Payment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EnforcementAction" ADD CONSTRAINT "EnforcementAction_complaintId_fkey" FOREIGN KEY ("complaintId") REFERENCES "Complaint"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
