import { useEffect, useRef, useState, type RefObject } from "react";
import { PlanRideChooser } from "@/components/plan-ride-chooser";
import { Button } from "@/components/ui/button";
import {
  createDotMarker,
  DHAKA_CENTER,
  maplibregl,
  markerColor,
  mountMap,
  whenStyleReady,
} from "@/lib/free-map";
import { reverseGeocode } from "@/lib/osm";
import { cn } from "@/lib/utils";

function MapPinBody({
  containerRef,
  pin,
  busy,
  onConfirm,
  onCancel,
}: {
  containerRef: RefObject<HTMLDivElement | null>;
  pin: { lat: number; lng: number } | null;
  busy: boolean;
  onConfirm: () => void;
  onCancel?: () => void;
}) {
  return (
    <div className="plan-ride-pin">
      <p className="plan-ride-pin__hint">Click the map to place a pin.</p>
      <div className="plan-ride-pin__map">
        <div ref={containerRef} className="fleet-map h-full w-full" />
      </div>
      <div className="plan-ride-pin__actions">
        {onCancel ? (
          <Button type="button" variant="outline" className="flex-1" onClick={onCancel}>
            Cancel
          </Button>
        ) : null}
        <Button
          type="button"
          className={cn(onCancel ? "flex-1" : "w-full")}
          disabled={!pin || busy}
          onClick={onConfirm}
        >
          {busy ? "Saving…" : "Use this location"}
        </Button>
      </div>
    </div>
  );
}

export function PlaceMapPicker({
  open,
  onOpenChange,
  title,
  tone,
  initialLat,
  initialLng,
  onConfirm,
  variant = "sheet",
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  tone: "pickup" | "stop" | "drop";
  initialLat?: number | null;
  initialLng?: number | null;
  onConfirm: (place: { name: string; address: string; lat: number; lng: number }) => void;
  /** `panel` = embed in desktop aside; `sheet` = mobile bottom sheet */
  variant?: "sheet" | "panel";
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const markerRef = useRef<maplibregl.Marker | null>(null);
  const [pin, setPin] = useState<{ lat: number; lng: number } | null>(null);
  const [busy, setBusy] = useState(false);
  const [ready, setReady] = useState(false);
  const isPanel = variant === "panel";

  useEffect(() => {
    if (!open) return;
    const el = containerRef.current;
    if (!el) return;

    const hasInit =
      initialLat != null &&
      initialLng != null &&
      Number.isFinite(initialLat) &&
      Number.isFinite(initialLng);
    const map = mountMap(el, {
      center: hasInit ? [initialLng!, initialLat!] : DHAKA_CENTER,
      zoom: hasInit ? 15 : 12,
      cooperativeGestures: false,
    });
    mapRef.current = map;
    const cancelReady = whenStyleReady(map, () => setReady(true));
    setPin(hasInit ? { lat: initialLat!, lng: initialLng! } : null);

    return () => {
      cancelReady();
      markerRef.current?.remove();
      markerRef.current = null;
      map.remove();
      mapRef.current = null;
      setReady(false);
    };
  }, [open, initialLat, initialLng, variant]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready || !open) return;

    const onClick = (e: maplibregl.MapMouseEvent) => {
      setPin({ lat: e.lngLat.lat, lng: e.lngLat.lng });
    };
    map.on("click", onClick);
    return () => {
      map.off("click", onClick);
    };
  }, [ready, open]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;

    markerRef.current?.remove();
    markerRef.current = null;
    if (!pin) return;

    const pointType = tone === "drop" ? "destination" : tone;
    markerRef.current = createDotMarker(markerColor(pointType), true)
      .setLngLat([pin.lng, pin.lat])
      .addTo(map);
    map.easeTo({ center: [pin.lng, pin.lat], duration: 280 });
  }, [pin, ready, tone]);

  async function confirm() {
    if (!pin) return;
    setBusy(true);
    try {
      const full = await reverseGeocode(pin.lat, pin.lng);
      const shortName = full?.split(",")[0]?.trim() || "Selected location";
      onConfirm({
        name: shortName,
        address: full ?? `${pin.lat.toFixed(5)}, ${pin.lng.toFixed(5)}`,
        lat: pin.lat,
        lng: pin.lng,
      });
      onOpenChange(false);
    } finally {
      setBusy(false);
    }
  }

  const body = (
    <MapPinBody
      containerRef={containerRef}
      pin={pin}
      busy={busy}
      onConfirm={() => void confirm()}
      {...(isPanel ? { onCancel: () => onOpenChange(false) } : {})}
    />
  );

  if (isPanel) {
    if (!open) return null;
    return (
      <div className="plan-ride-pin-panel">
        <p className="plan-ride-pin-panel__title">{title}</p>
        {body}
      </div>
    );
  }

  return (
    <PlanRideChooser
      open={open}
      onOpenChange={onOpenChange}
      title={title}
      description="Tap the map to place a pin."
      wide
    >
      {body}
    </PlanRideChooser>
  );
}
