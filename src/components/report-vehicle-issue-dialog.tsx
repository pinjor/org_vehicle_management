import { useMemo, useState } from "react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/lib/auth";
import { useReportVehicleIssue, useVehicles, type VehicleRecord } from "@/lib/queries";

const REASONS = [
  ["mechanical", "Mechanical"],
  ["tire", "Tyre"],
  ["battery", "Battery"],
  ["accident", "Accident"],
  ["maintenance", "Scheduled maintenance"],
  ["cleaning", "Cleaning"],
  ["other", "Other"],
] as const;

const SEVERITIES = [
  ["low", "Low"],
  ["medium", "Medium"],
  ["high", "High"],
  ["critical", "Critical"],
] as const;

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Prefill when logging from a known vehicle. */
  vehicleId?: string;
  vehicleLabel?: string;
};

function vehicleOptionLabel(v: VehicleRecord) {
  return `${v.fleet_number} · ${v.registration_number} · ${v.name}`;
}

export function ReportVehicleIssueDialog({ open, onOpenChange, vehicleId, vehicleLabel }: Props) {
  const { user } = useAuth();
  const vehicles = useVehicles();
  const report = useReportVehicleIssue();
  const [pickedId, setPickedId] = useState(vehicleId ?? "");
  const [reason, setReason] = useState<(typeof REASONS)[number][0]>("mechanical");
  const [severity, setSeverity] = useState<(typeof SEVERITIES)[number][0]>("medium");
  const [description, setDescription] = useState("");

  const fleetOptions = useMemo(() => {
    const list = vehicles.data ?? [];
    return [...list].sort((a, b) => a.fleet_number.localeCompare(b.fleet_number));
  }, [vehicles.data]);

  const effectiveVehicleId = vehicleId ?? pickedId;

  function submit() {
    if (!user) return;
    if (!effectiveVehicleId) {
      toast.error("Pick a vehicle");
      return;
    }
    const desc = description.trim();
    if (!desc) {
      toast.error("Describe the issue");
      return;
    }
    const vehicle = fleetOptions.find((v) => v.id === effectiveVehicleId);
    report.mutate(
      {
        vehicleId: effectiveVehicleId,
        driverId: vehicle?.primary_driver_id ?? null,
        tripId: null,
        reason,
        description: desc,
        severity,
        actorId: user.id,
      },
      {
        onSuccess: () => {
          toast.success("Issue logged");
          setDescription("");
          if (!vehicleId) setPickedId("");
          onOpenChange(false);
        },
        onError: (e) => toast.error(e.message),
      },
    );
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) {
          setDescription("");
          if (!vehicleId) setPickedId("");
        }
        onOpenChange(next);
      }}
    >
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Log vehicle issue</DialogTitle>
          <DialogDescription>
            {vehicleLabel
              ? `Record downtime for ${vehicleLabel}.`
              : "Pick a fleet vehicle and log an issue for the workshop."}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          {!vehicleId ? (
            <div className="space-y-1.5">
              <Label htmlFor="issue-vehicle">Vehicle</Label>
              <select
                id="issue-vehicle"
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                value={pickedId}
                onChange={(e) => setPickedId(e.target.value)}
              >
                <option value="">Select vehicle…</option>
                {fleetOptions.map((v) => (
                  <option key={v.id} value={v.id}>
                    {vehicleOptionLabel(v)}
                  </option>
                ))}
              </select>
            </div>
          ) : null}
          <div className="space-y-1.5">
            <Label htmlFor="issue-reason">Reason</Label>
            <select
              id="issue-reason"
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              value={reason}
              onChange={(e) => setReason(e.target.value as (typeof REASONS)[number][0])}
            >
              {REASONS.map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="issue-severity">Severity</Label>
            <select
              id="issue-severity"
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              value={severity}
              onChange={(e) => setSeverity(e.target.value as (typeof SEVERITIES)[number][0])}
            >
              {SEVERITIES.map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="issue-desc">What happened</Label>
            <Textarea
              id="issue-desc"
              rows={3}
              placeholder="Short note for the workshop…"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button disabled={report.isPending} onClick={submit}>
            {report.isPending ? "Saving…" : "Log issue"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
