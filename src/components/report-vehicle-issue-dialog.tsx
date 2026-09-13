import { useState } from "react";
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
import { useReportVehicleIssue } from "@/lib/queries";

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
  vehicleId: string;
  driverId?: string | null;
  tripId?: string | null;
  vehicleLabel?: string;
};

export function ReportVehicleIssueDialog({
  open,
  onOpenChange,
  vehicleId,
  driverId,
  tripId,
  vehicleLabel,
}: Props) {
  const { user } = useAuth();
  const report = useReportVehicleIssue();
  const [reason, setReason] = useState<(typeof REASONS)[number][0]>("mechanical");
  const [severity, setSeverity] = useState<(typeof SEVERITIES)[number][0]>("medium");
  const [description, setDescription] = useState("");

  function submit() {
    if (!user) return;
    const desc = description.trim();
    if (!desc) {
      toast.error("Describe the issue");
      return;
    }
    report.mutate(
      {
        vehicleId,
        driverId: driverId ?? null,
        tripId: tripId ?? null,
        reason,
        description: desc,
        severity,
        actorId: user.id,
      },
      {
        onSuccess: () => {
          toast.success("Report sent to maintenance");
          setDescription("");
          onOpenChange(false);
        },
        onError: (e) => toast.error(e.message),
      },
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Report vehicle issue</DialogTitle>
          <DialogDescription>
            {vehicleLabel
              ? `Tell dispatch about a problem with ${vehicleLabel}.`
              : "Tell dispatch about a vehicle problem."}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
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
              placeholder="Short description for the workshop…"
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
            {report.isPending ? "Sending…" : "Send report"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
