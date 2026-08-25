import findingWaySvg from "../../svgs/undraw_finding-the-way_qp1z.svg?raw";
import orderRideSvg from "../../svgs/undraw_order-ride_4gaq.svg?raw";
import { cn } from "@/lib/utils";

function prepareSvg(raw: string, className: string): string {
  return raw.replace(/<svg\b([^>]*)>/i, (_match, attrs: string) => {
    let next = attrs
      .replace(/\swidth="[^"]*"/i, "")
      .replace(/\sheight="[^"]*"/i, "")
      .replace(/\spreserveAspectRatio="[^"]*"/i, "");
    return `<svg${next} width="100%" height="100%" preserveAspectRatio="xMidYMid meet" class="${className}">`;
  });
}

const ORDER_RIDE = prepareSvg(orderRideSvg, "emp-home-way-svg");
const FINDING_WAY = prepareSvg(findingWaySvg, "emp-home-way-svg");

function HomeIllustration({
  html,
  stageClass,
  className,
}: {
  html: string;
  stageClass: string;
  className?: string;
}) {
  return (
    <div className={cn("emp-home-way", className)} aria-hidden>
      <div className={cn("emp-home-way__stage", stageClass)} dangerouslySetInnerHTML={{ __html: html }} />
    </div>
  );
}

/** Employee home — order / ride illustration (wide). */
export function EmployeeHomeIllustration({ className }: { className?: string }) {
  return <HomeIllustration html={ORDER_RIDE} stageClass="emp-home-way__stage--wide" className={className} />;
}

/** Driver home — finding the way (tall). */
export function DriverHomeIllustration({ className }: { className?: string }) {
  return <HomeIllustration html={FINDING_WAY} stageClass="emp-home-way__stage--tall" className={className} />;
}
