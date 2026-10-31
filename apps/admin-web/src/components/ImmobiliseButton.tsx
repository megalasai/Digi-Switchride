"use client";

import { Button } from "@/components/ui/Button";
import { api } from "@/lib/api";

export function canSendImmobiliser(vendorType?: string | null, iotDeviceId?: string | null) {
  return Boolean(iotDeviceId);
}

export function immobiliserHint(vendorType?: string | null) {
  if (vendorType === "WanWay") return "WanWay cut-off (DYD) is queued and sent on the next tracker heartbeat.";
  if (!vendorType) return "Link an IoT device to enable immobiliser.";
  return `${vendorType} status is stored on the vehicle. Live cut-off is sent when the vendor protocol supports it.`;
}

export function ImmobiliseButton({
  vehicleId,
  immobilised,
  vendorType,
  iotDeviceId,
  disabled,
  onDone,
  onError,
}: {
  vehicleId: string;
  immobilised?: boolean;
  vendorType?: string | null;
  iotDeviceId?: string | null;
  disabled?: boolean;
  onDone: (message: string) => void;
  onError: (message: string) => void;
}) {
  const enabled = canSendImmobiliser(vendorType, iotDeviceId) && !disabled;
  const next = !immobilised;
  return (
    <Button
      type="button"
      variant={immobilised ? "secondary" : "danger"}
      className="text-xs"
      disabled={!enabled}
      title={immobiliserHint(vendorType)}
      onClick={() => {
        const label = next ? "immobilise (cut fuel/ignition)" : "restore movement";
        if (!window.confirm(`Send ${label} to this vehicle?`)) return;
        api
          .immobiliseVehicle(vehicleId, next)
          .then((r) => onDone(r.message || (next ? "Immobilise queued" : "Restore queued")))
          .catch((err) => onError(err instanceof Error ? err.message : "Command failed"));
      }}
    >
      {immobilised ? "Restore" : "Immobilise"}
    </Button>
  );
}
