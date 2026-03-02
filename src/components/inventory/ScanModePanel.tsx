"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import { PhotoUploader } from "@/components/inventory/PhotoUploader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

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
  const [cameraActive, setCameraActive] = useState(false);
  const [pendingQuickAdd, setPendingQuickAdd] = useState(false);
  const [message, setMessage] = useState("");

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
    setMessage("");
    if (!("mediaDevices" in navigator) || !navigator.mediaDevices.getUserMedia) {
      setMessage("Camera not available in this browser.");
      return;
    }

    const BarcodeDetectorCtor = (window as unknown as { BarcodeDetector?: unknown })
      .BarcodeDetector as
      | (new (config?: { formats?: string[] }) => {
          detect: (input: ImageBitmapSource) => Promise<Array<{ rawValue?: string }>>;
        })
      | undefined;

    if (!BarcodeDetectorCtor) {
      setMessage("QR detection is unsupported here. Paste QR/deeplink manually.");
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
      setMessage("Failed to start camera.");
      await stopCamera();
    }
  }

  async function startVoiceCapture() {
    const w = window as unknown as {
      SpeechRecognition?: new () => {
        lang: string;
        interimResults: boolean;
        onresult?: (event: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void;
        onerror?: () => void;
        start: () => void;
      };
      webkitSpeechRecognition?: new () => {
        lang: string;
        interimResults: boolean;
        onresult?: (event: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void;
        onerror?: () => void;
        start: () => void;
      };
    };

    const VoiceCtor = w.SpeechRecognition || w.webkitSpeechRecognition;
    if (!VoiceCtor) {
      setMessage("Voice input is not available in this browser.");
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
    };
    recognition.onerror = () => {
      setMessage("Voice capture failed.");
    };
    recognition.start();
  }

  useEffect(() => {
    return () => {
      stopCamera().catch(() => null);
    };
  }, []);

  return (
    <div className="space-y-4">
      <div className="rounded-md border p-3">
        <div className="mb-2 text-sm font-medium">Scan box QR</div>
        <div className="flex flex-wrap gap-2">
          <Input
            placeholder="Paste QR text, URL, or box id"
            value={manualInput}
            onChange={(event) => setManualInput(event.target.value)}
            className="min-w-[260px] flex-1"
          />
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              const boxId = extractBoxId(manualInput);
              if (!boxId) {
                setMessage("Could not parse a box id from input.");
                return;
              }
              openBox(boxId);
            }}
          >
            Open box
          </Button>
          <Button type="button" onClick={startCamera} disabled={cameraActive}>
            {cameraActive ? "Scanning..." : "Start camera scan"}
          </Button>
          {cameraActive ? (
            <Button type="button" variant="ghost" onClick={() => stopCamera()}>
              Stop
            </Button>
          ) : null}
        </div>
        <video
          ref={videoRef}
          className={`mt-3 w-full rounded-md border bg-black ${cameraActive ? "block" : "hidden"}`}
          playsInline
          muted
        />
        {message ? <div className="mt-2 text-xs text-muted-foreground">{message}</div> : null}
      </div>

      <div className="rounded-md border p-3">
        <div className="mb-2 text-sm font-medium">Switch room</div>
        <select
          className="h-9 w-full rounded-md border bg-background px-3 text-sm"
          defaultValue={activeRoomId}
          onChange={async (event) => {
            const roomId = event.target.value;
            try {
              await fetch("/api/preferences/active", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  householdId,
                  roomId,
                }),
              });
            } catch {
              // Ignore preference errors and continue navigation.
            } finally {
              const params = new URLSearchParams();
              params.set("roomId", roomId);
              router.push(`/${locale}/scan?${params.toString()}`);
            }
          }}
        >
          {rooms.map((room) => (
            <option key={room.id} value={room.id}>
              {room.locationName} / {room.name}
            </option>
          ))}
        </select>
      </div>

      <div className="rounded-md border p-3">
        <div className="mb-2 text-sm font-medium">Recent boxes</div>
        <div className="grid gap-2">
          {recentBoxes.length === 0 ? (
            <div className="text-xs text-muted-foreground">No boxes in this room yet.</div>
          ) : (
            recentBoxes.map((box) => (
              <button
                key={box.id}
                type="button"
                className={`rounded-md border p-2 text-left text-sm ${
                  box.id === activeBox?.id ? "border-primary bg-primary/5" : ""
                }`}
                onClick={() => openBox(box.id)}
              >
                <div className="font-medium">{box.name}</div>
                <div className="text-xs text-muted-foreground">
                  {box.locationName} / {box.roomName}
                  {box.code ? ` · ${box.code}` : ""}
                </div>
              </button>
            ))
          )}
        </div>
      </div>

      {activeBox ? (
        <div className="rounded-md border p-3">
          <div className="mb-1 text-sm font-medium">Box session: {activeBox.name}</div>
          <div className="mb-3 text-xs text-muted-foreground">
            {activeBox.locationName} / {activeBox.roomName}
            {activeBox.code ? ` · ${activeBox.code}` : ""}
          </div>

          <div className="space-y-3">
            <div>
              <div className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                1) Add photos
              </div>
              <PhotoUploader
                householdId={householdId}
                entityType="container"
                entityId={activeBox.id}
                analyzeBatchOnComplete
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
                onChange={(event) => setQuickText(event.target.value)}
              />
              <div className="mt-2 flex flex-wrap gap-2">
                <Button
                  type="button"
                  disabled={pendingQuickAdd || !quickText.trim()}
                  onClick={async () => {
                    try {
                      setPendingQuickAdd(true);
                      setMessage("");
                      const response = await fetch("/api/scan/quick-add", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                          householdId,
                          containerId: activeBox.id,
                          text: quickText,
                        }),
                      });
                      const data = await response.json().catch(() => null);
                      if (!response.ok) {
                        throw new Error(data?.error || "Quick add failed");
                      }
                      setMessage(`Added ${data?.processed || 0} entries.`);
                      setQuickText("");
                      router.refresh();
                    } catch (error) {
                      setMessage(error instanceof Error ? error.message : "Quick add failed");
                    } finally {
                      setPendingQuickAdd(false);
                    }
                  }}
                >
                  {pendingQuickAdd ? "Adding..." : "Add to box"}
                </Button>
                {nextBox ? (
                  <Button type="button" variant="outline" onClick={() => openBox(nextBox.id)}>
                    Accept + next box
                  </Button>
                ) : null}
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

