"use client";

import { PageHeader } from "@/components/ui/PageHeader";
import { ComingSoonBadge, DisabledAction, DisabledField, DisabledSelect, ProvisionPanel } from "@/components/ui/Provision";
import { Card } from "@/components/ui/Card";
import { PaymentGatewayForm } from "@/components/PaymentGatewayForm";

const integrations = [
  {
    name: "SMS (MSG91 / Twilio)",
    status: "Not connected",
    detail: "OTP, breakdown alerts and campaign SMS to rider mobiles.",
  },
  {
    name: "Push (Firebase FCM)",
    status: "Not connected",
    detail: "Android and iOS push for bookings, payments and service slots.",
  },
  {
    name: "Document vault (Azure Blob)",
    status: "Not connected",
    detail: "KYC images, agreement PDFs and GST invoice files.",
  },
  {
    name: "KYC vendor (Digio / Signzy)",
    status: "Not connected",
    detail: "Aadhaar, PAN and DL verification against a licensed provider.",
  },
  {
    name: "Track360 telematics",
    status: "Connected",
    detail: "Live device pull from prod-s1.track360.net.in. Devices appear on IoT Devices and refresh every 30 seconds.",
  },
  {
    name: "Maps geofence",
    status: "Not connected",
    detail: "OpenStreetMap is used to pick hub, station, workshop and breakdown locations. Live geofence radius and fleet tracking can still be added later.",
  },
];

export default function IntegrationsPage() {
  return (
    <div>
      <PageHeader
        title="Integrations"
        description="Connect each tenant's payment gateway below. SMS, push, vault and KYC vendors remain provisioned until credentials are wired."
      />

      <div className="mb-8 grid grid-cols-1 gap-4 md:grid-cols-2">
        {integrations.map((item) => (
          <Card key={item.name} className="p-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-semibold text-text-primary">{item.name}</p>
                <p className="mt-1 text-sm text-text-secondary">{item.detail}</p>
              </div>
              <ComingSoonBadge />
            </div>
            <p className="mt-3 text-xs font-medium text-text-muted">{item.status}</p>
          </Card>
        ))}
      </div>

      <div className="mb-8">
        <PaymentGatewayForm />
      </div>

      <ProvisionPanel
        title="SMS gateway"
        description="Transactional OTP and operational alerts. Templates will be mapped per event."
      >
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <DisabledSelect label="Provider" options={["MSG91", "Twilio"]} />
          <DisabledField label="Sender ID" placeholder="SWITCH" />
          <DisabledField label="Auth key" type="password" placeholder="••••••••" />
          <DisabledSelect label="OTP template" options={["login_otp", "breakdown_alert"]} />
          <DisabledAction label="Save SMS" />
        </div>
      </ProvisionPanel>

      <ProvisionPanel
        title="Push notifications"
        description="Firebase project for the rider Android and iOS apps."
      >
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <DisabledField label="FCM project ID" placeholder="digi-switchride" />
          <DisabledField label="Service account JSON" placeholder="Upload later" />
          <DisabledAction label="Save FCM" />
        </div>
      </ProvisionPanel>

      <ProvisionPanel
        title="Document vault"
        description="Private storage for KYC photos and signed agreements."
      >
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <DisabledField label="Storage account" placeholder="switchridedocs" />
          <DisabledField label="Container" placeholder="kyc" />
          <DisabledAction label="Save vault" />
        </div>
      </ProvisionPanel>
    </div>
  );
}
