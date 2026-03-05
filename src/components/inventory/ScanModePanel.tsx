"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { PhotoUploader } from "@/components/inventory/PhotoUploader";
import { SectionDivider } from "@/components/inventory/SectionDivider";
import { Button } from "@/components/ui/button";
import { FormFieldError, FormSubmitError } from "@/components/ui/form-feedback";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useBusyCursor } from "@/hooks/useBusyCursor";
import { setActivePreferenceAction } from "@/lib/actions/preferences";
import { quickAddAction } from "@/lib/actions/scan";

type RoomOption = {
  id: string;
  name: string;
  locationName: string;
};

type BoxOption = {
  id: string;
  name: string;
  roomName: string;
  locationName: string;
  code: string | null;
};

type ActiveBox = {
  id: string;
  name: string;
  roomName: string;
  locationName: string;
  code: string | null;
};

const UUID_REGEX =
  /[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/i;

function extractBoxId(raw: string) {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const directMatch = trimmed.match(UUID_REGEX);
  if (directMatch?.[0]) {
    return directMatch[0];
  }

  try {
    const url = new URL(trimmed);
    const pathMatch = url.pathname.match(UUID_REGEX);
    return pathMatch?.[0] || null;
  } catch {
    return null;
  }
}

export function ScanModePanel({
  locale,
  householdId,
  activeRoomId,
  rooms,
  recentBoxes,
  activeBox,
}: {
  locale: string;
  householdId: string;
  activeRoomId?: string;
  rooms: RoomOption[];
  recentBoxes: BoxOption[];
  activeBox: ActiveBox | null;
}) {
  const router = useRouter();
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const intervalRef = useRef<number | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [manualInput, setManualInput] = useState("");
  const [quickText, setQuickText] = useState("");
  const [quickTextError, setQuickTextError] = useState<string | null>(null);
  const [cameraActive, setCameraActive] = useState(false);
  const [pendingScanStart, setPendingScanStart] = useState(false);
  const [pendingQuickAdd, setPendingQuickAdd] = useState(false);
  const [scanError, setScanError] = useState<string | null>(null);
  const [quickAddError, setQuickAddError] = useState<string | null>(null);
  const [quickAddSuccess, setQuickAddSuccess] = useState("");

  useBusyCursor(pendingQuickAdd || pendingScanStart);

  useEffect(() => {
    if (!scanError) return;
    toast.error(scanError);
  }, [scanError]);

  useEffect(() => {
    if (!quickAddError) return;
    toast.error(quickAddError);
  }, [quickAddError]);

  const activeIndex = useMemo(
    () => recentBoxes.findIndex((box) => box.id === activeBox?.id),
    [recentBoxes, activeBox?.id],
  );
  const nextBox = activeIndex >= 0 ? recentBoxes[activeIndex + 1] : null;

  function openBox(boxId: string) {
    const params = new URLSearchParams();
    if (activeRoomId) params.set("roomId", activeRoomId);
    params.set("boxId", boxId);
    router.push(`/${locale}/scan?${params.toString()}`);
  }

  async function stopCamera() {
    if (intervalRef.current) {
      window.clearInterval(intervalRef.current);
      intervalRef.current = null;
    }

    if (streamRef.current) {
      for (const track of streamRef.current.getTracks()) {
        track.stop();
      }
      streamRef.current = null;
    }

    setCameraActive(false);
  }

  async function startCamera() {
    setPendingScanStart(true);
    setScanError(null);
    if (!("mediaDevices" in navigator) || !navigator.mediaDevices.getUserMedia) {
      setScanError("Camera not available in this browser.");
      setPendingScanStart(false);
      return;
    }

    const BarcodeDetectorCtor = (
      window as unknown as { BarcodeDetector?: unknown }
    ).BarcodeDetector as
      | (new (config?: { formats?: string[] }) => {
          detect: (
            input: ImageBitmapSource,
          ) => Promise<Array<{ rawValue?: string }>>;
        })
      | undefined;

    if (!BarcodeDetectorCtor) {
      setScanError("QR detection is unsupported here. Paste QR/deeplink manually.");
      setPendingScanStart(false);
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: "environment" } },
        audio: false,
      });

      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }

      const detector = new BarcodeDetectorCtor({ formats: ["qr_code"] });
      setCameraActive(true);

      intervalRef.current = window.setInterval(async () => {
        if (!videoRef.current) return;
        if (videoRef.current.readyState < 2) return;
        try {
          const results = await detector.detect(videoRef.current);
          const first = results[0]?.rawValue;
          if (!first) return;
          const boxId = extractBoxId(first);
          if (!boxId) return;
          await stopCamera();
          openBox(boxId);
        } catch {
          // Ignore decode errors; keep scanning.
        }
      }, 450);
    } catch (error) {
      console.error(error);
      setScanError("Failed to start camera.");
      await stopCamera();
    } finally {
      setPendingScanStart(false);
    }
  }

  async function startVoiceCapture() {
    const w = window as unknown as {
      SpeechRecognition?: new () => {
        lang: string;
        interimResults: boolean;
        onresult?: (event: {
          results: ArrayLike<ArrayLike<{ transcript: string }>>;
        }) => void;
        onerror?: () => void;
        start: () => void;
      };
      webkitSpeechRecognition?: new () => {
        lang: string;
        interimResults: boolean;
        onresult?: (event: {
          results: ArrayLike<ArrayLike<{ transcript: string }>>;
        }) => void;
        onerror?: () => void;
        start: () => void;
      };
    };

    const VoiceCtor = w.SpeechRecognition || w.webkitSpeechRecognition;
    if (!VoiceCtor) {
      setQuickAddError("Voice input is not available in this browser.");
      return;
    }

    const recognition = new VoiceCtor();
    recognition.lang = locale === "sv" ? "sv-SE" : "en-US";
    recognition.interimResults = false;
    recognition.onresult = (event) => {
      const transcript = event.results?.[0]?.[0]?.transcript || "";
      setQuickText((current) =>
        [current.trim(), transcript.trim()].filter(Boolean).join(", "),
      );
      setQuickAddError(null);
      setQuickTextError(null);
    };
    recognition.onerror = () => {
      setQuickAddError("Voice capture failed.");
    };
    recognition.start();
  }

  useEffect(() => {
    return () => {
      stopCamera().catch(() => null);
    };
  }, []);

  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <SectionDivider
          title="Scan box QR"
          description="Paste QR text, URL, or box id - or use camera."
          className="pt-1"
        />
        <div className="flex flex-wrap gap-2">
          <Input
            placeholder="Paste QR text, URL, or box id"
            value={manualInput}
            onChange={(event) => {
              setManualInput(event.target.value);
              if (!scanError) return;
              setScanError(null);
            }}
            className="min-w-[260px] flex-1"
          />
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              const boxId = extractBoxId(manualInput);
              if (!boxId) {
                setScanError("Could not parse a box id from input.");
                return;
              }
              setScanError(null);
              openBox(boxId);
            }}
          >
            Open box
          </Button>
          <Button
            type="button"
            onClick={startCamera}
            loading={pendingScanStart || cameraActive}
            loadingText={cameraActive ? "Scanning..." : "Starting..."}
            disabled={cameraActive || pendingScanStart}
          >
            Start camera scan
          </Button>
          {cameraActive ? (
            <Button type="button" variant="ghost" onClick={() => stopCamera()}>
              Stop
            </Button>
          ) : null}
        </div>
        <video
          ref={videoRef}
          className={`w-full rounded-md border bg-black ${cameraActive ? "block" : "hidden"}`}
          playsInline
          muted
        />
        <FormSubmitError error={scanError} title="Scan failed" />
      </div>

      <div className="space-y-2">
        <SectionDivider title="Switch room" className="pt-1" />
        <Select
          defaultValue={activeRoomId || rooms[0]?.id}
          onValueChange={async (roomId) => {
            try {
              const result = await setActivePreferenceAction({
                householdId,
                roomId,
              });
              if (!result.ok) {
                console.error(result.error);
              }
            } catch {
              // Ignore preference errors and continue navigation.
            } finally {
              const params = new URLSearchParams();
              params.set("roomId", roomId);
              router.push(`/${locale}/scan?${params.toString()}`);
            }
          }}
        >
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Choose room" />
          </SelectTrigger>
          <SelectContent>
            {rooms.map((room) => (
              <SelectItem key={room.id} value={room.id}>
                {room.locationName} / {room.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <SectionDivider title="Recent boxes" className="pt-1" />
        <div className="grid gap-2">
          {recentBoxes.length === 0 ? (
            <div className="text-xs text-muted-foreground">
              No boxes in this room yet.
            </div>
          ) : (
            recentBoxes.map((box) => (
              <button
                key={box.id}
                type="button"
                className={`rounded-md border p-2 text-left text-sm transition ${
                  box.id === activeBox?.id
                    ? "border-primary bg-primary/5"
                    : "hover:border-primary/60"
                }`}
                onClick={() => openBox(box.id)}
              >
                <div className="font-medium">{box.name}</div>
                <div className="text-xs text-muted-foreground">
                  {box.locationName} / {box.roomName}
                  {box.code ? ` - ${box.code}` : ""}
                </div>
              </button>
            ))
          )}
        </div>
      </div>

      {activeBox ? (
        <div className="space-y-3">
          <SectionDivider
            title={`Box session: ${activeBox.name}`}
            description={`${activeBox.locationName} / ${activeBox.roomName}${
              activeBox.code ? ` - ${activeBox.code}` : ""
            }`}
            className="pt-1"
          />

          <div className="space-y-3">
            <div>
              <div className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                1) Add photos
              </div>
              <PhotoUploader
                householdId={householdId}
                entityType="container"
                entityId={activeBox.id}
                onUploaded={() => router.refresh()}
              />
            </div>

            <div>
              <div className="mb-2 flex items-center justify-between gap-2">
                <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  2) Quick add by text/voice
                </div>
                <Button type="button" variant="ghost" size="sm" onClick={startVoiceCapture}>
                  Voice
                </Button>
              </div>
              <Textarea
                placeholder="2 HDMI cables, 1 powerbank"
                value={quickText}
                onChange={(event) => {
                  setQuickText(event.target.value);
                  if (!quickTextError) return;
                  setQuickTextError(null);
                }}
                aria-invalid={quickTextError ? true : undefined}
              />
              <FormFieldError error={quickTextError} />
              <div className="mt-2 flex flex-wrap gap-2">
                <Button
                  type="button"
                  loading={pendingQuickAdd}
                  loadingText="Adding..."
                  disabled={pendingQuickAdd || !quickText.trim()}
                  onClick={async () => {
                    const text = quickText.trim();
                    if (!text) {
                      setQuickTextError("Enter at least one item.");
                      return;
                    }

                    try {
                      setPendingQuickAdd(true);
                      setQuickAddError(null);
                      setQuickAddSuccess("");
                      const result = await quickAddAction({
                        householdId,
                        containerId: activeBox.id,
                        text,
                      });
                      if (!result.ok) {
                        if (result.fieldErrors?.text) {
                          setQuickTextError(result.fieldErrors.text);
                        } else {
                          setQuickAddError(result.error);
                        }
                        return;
                      }
                      setQuickAddSuccess(`Added ${result.processed || 0} entries.`);
                      setQuickText("");
                      router.refresh();
                    } catch (error) {
                      setQuickAddError(
                        error instanceof Error ? error.message : "Quick add failed",
                      );
                    } finally {
                      setPendingQuickAdd(false);
                    }
                  }}
                >
                  Add to box
                </Button>
                {nextBox ? (
                  <Button type="button" variant="outline" onClick={() => openBox(nextBox.id)}>
                    Accept + next box
                  </Button>
                ) : null}
              </div>
              <FormSubmitError error={quickAddError} title="Quick add failed" />
              {quickAddSuccess ? (
                <div className="text-xs text-muted-foreground">{quickAddSuccess}</div>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
