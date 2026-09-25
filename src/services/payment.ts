export type PaymentResult = { providerRef: string | null; status: "PENDING" | "COMPLETED" | "NOT_REQUIRED" };

export interface PaymentProvider {
  createPayment(input: { applicationId: string; amountPaise: number | null }): Promise<PaymentResult>;
}

/**
 * Fees are state-specific and remain CONFIGURATION REQUIRED until loaded from the applicable
 * State Enforcement Rules, so no amount is ever charged or invented here.
 */
export class UnconfiguredPaymentProvider implements PaymentProvider {
  async createPayment(input: { applicationId: string; amountPaise: number | null }): Promise<PaymentResult> {
    return { providerRef: null, status: input.amountPaise == null ? "NOT_REQUIRED" : "PENDING" };
  }
}

export class GatewayPaymentProvider implements PaymentProvider {
  async createPayment(): Promise<PaymentResult> {
    throw new Error("Payment gateway is not configured (PAYMENT_MODE=gateway requires provider credentials)");
  }
}

export function getPaymentProvider(): PaymentProvider {
  return process.env.PAYMENT_MODE === "gateway" ? new GatewayPaymentProvider() : new UnconfiguredPaymentProvider();
}
