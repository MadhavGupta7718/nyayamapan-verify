import { createHmac, timingSafeEqual } from "crypto";

export type SignInput = {
  certificateNumber: string;
  content: string;
};

export type SignResult = {
  algorithm: string;
  signature: string;
  signer: string;
  signedAt: string;
  mode: "platform-hmac" | "dsc";
};

export interface CertificateSigner {
  sign(input: SignInput): Promise<SignResult>;
  verify(input: SignInput, signature: string): Promise<boolean>;
}

function secret() {
  const s = process.env.QR_SIGNING_SECRET;
  if (!s && process.env.NODE_ENV === "production") {
    throw new Error("QR_SIGNING_SECRET must be configured in production");
  }
  return s ?? "local-development-signing-key";
}

/**
 * Integrity seal using HMAC-SHA256 with a server-held key. It proves the record was produced
 * by this platform and has not been altered; it is not a statutory digital signature (DSC).
 */
export class PlatformHmacSigner implements CertificateSigner {
  private mac(input: SignInput) {
    return createHmac("sha256", secret()).update(`${input.certificateNumber}|${input.content}`).digest("hex");
  }
  async sign(input: SignInput): Promise<SignResult> {
    return {
      algorithm: "HMAC-SHA256",
      signature: this.mac(input),
      signer: "Platform integrity key",
      signedAt: new Date().toISOString(),
      mode: "platform-hmac",
    };
  }
  async verify(input: SignInput, signature: string) {
    const expected = Buffer.from(this.mac(input), "hex");
    const given = Buffer.from(signature, "hex");
    return expected.length === given.length && timingSafeEqual(expected, given);
  }
}

/** Integration point for a government DSC / HSM. Holds no keys; fails closed until configured. */
export class ProductionDSCSigner implements CertificateSigner {
  async sign(_input: SignInput): Promise<SignResult> {
    throw new Error("DSC signer is not configured. Integrate the authority's DSC / HSM before enabling DSC_MODE=production.");
  }
  async verify() {
    return false;
  }
}

export function getCertificateSigner(): CertificateSigner {
  if (process.env.DSC_MODE === "production") return new ProductionDSCSigner();
  return new PlatformHmacSigner();
}
