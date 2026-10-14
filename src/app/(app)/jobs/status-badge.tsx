import { Badge } from "@/components/ui";

export function StatusBadge({ status }: { status: string }) {
  const tone =
    status === "Offer"
      ? "good"
      : ["Interview", "Final round", "To do assessment", "Assessment complete"].includes(status)
        ? "accent"
        : status === "Applied"
          ? "accent"
          : status === "Rejected"
            ? "bad"
            : ["Ghosted", "Withdrawn", "Closed"].includes(status)
              ? "neutral"
              : "warn";
  return <Badge tone={tone}>{status}</Badge>;
}
