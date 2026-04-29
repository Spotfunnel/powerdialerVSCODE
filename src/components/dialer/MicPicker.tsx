"use client";

import { useEffect, useRef, useState } from "react";
import { Mic, ChevronDown, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { useTwilio } from "@/contexts/TwilioContext";

/**
 * Discreet mic-input picker. Sits inline in the dialer header; renders a small
 * icon + truncated active-device name. Click opens a popover listing every
 * available mic; selecting one calls into TwilioContext.setInputDevice which
 * applies it to Twilio's audio stack and persists to sessionStorage.
 *
 * Communicative contract: the active device name is ALWAYS visible (not just
 * a generic icon), so the rep can see at a glance whether their headset is
 * driving the call. If a device gets unplugged mid-session, deviceChange
 * refreshes the list and the picker's label reflects the new active device.
 */
export function MicPicker() {
    const { availableInputDevices, inputDeviceId, setInputDevice, deviceState } = useTwilio();
    const [open, setOpen] = useState(false);
    const ref = useRef<HTMLDivElement | null>(null);

    useEffect(() => {
        if (!open) return;
        const onClick = (e: MouseEvent) => {
            if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
        };
        const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
        window.addEventListener("mousedown", onClick);
        window.addEventListener("keydown", onKey);
        return () => {
            window.removeEventListener("mousedown", onClick);
            window.removeEventListener("keydown", onKey);
        };
    }, [open]);

    const active = availableInputDevices.find(d => d.deviceId === inputDeviceId)
        || availableInputDevices[0]
        || null;

    const truncate = (s: string, n: number) => (s.length > n ? s.slice(0, n - 1) + "…" : s);
    const labelText = active ? truncate(active.label || "Default mic", 22) : "No mic";

    const disabled = deviceState !== "ready" || availableInputDevices.length === 0;

    return (
        <div ref={ref} data-testid="mic-picker" className="relative">
            <button
                type="button"
                onClick={() => !disabled && setOpen(o => !o)}
                disabled={disabled}
                data-testid="mic-picker-trigger"
                aria-haspopup="listbox"
                aria-expanded={open}
                aria-label={`Microphone: ${active?.label ?? "no device"}. Click to change.`}
                title={active?.label ?? "No microphone detected"}
                className={cn(
                    "inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider transition-colors",
                    "text-zinc-400 hover:text-zinc-700 hover:bg-zinc-100/60",
                    "disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-transparent",
                )}
            >
                <Mic className="h-3 w-3" strokeWidth={2.5} />
                <span data-testid="mic-picker-active-label" className="max-w-[180px] truncate normal-case font-semibold tracking-normal">
                    {labelText}
                </span>
                <ChevronDown className={cn("h-3 w-3 transition-transform", open && "rotate-180")} />
            </button>

            {open && (
                <div
                    role="listbox"
                    data-testid="mic-picker-list"
                    className="absolute z-50 right-0 mt-1 min-w-[240px] max-w-[320px] rounded-lg border border-zinc-200 bg-white shadow-lg p-1"
                >
                    {availableInputDevices.length === 0 ? (
                        <div className="px-3 py-2 text-xs text-zinc-400 italic">No microphones detected.</div>
                    ) : (
                        availableInputDevices.map(d => {
                            const selected = d.deviceId === inputDeviceId
                                || (!inputDeviceId && d === active);
                            return (
                                <button
                                    key={d.deviceId}
                                    type="button"
                                    role="option"
                                    aria-selected={selected}
                                    data-testid={`mic-option-${d.deviceId}`}
                                    onClick={async () => {
                                        try {
                                            await setInputDevice(d.deviceId);
                                        } catch (e) {
                                            console.error("[MicPicker] setInputDevice failed", e);
                                        } finally {
                                            setOpen(false);
                                        }
                                    }}
                                    className={cn(
                                        "w-full flex items-center gap-2 px-3 py-2 text-left text-xs rounded-md",
                                        "hover:bg-zinc-50 transition-colors",
                                        selected ? "text-teal-700 font-bold" : "text-zinc-700",
                                    )}
                                >
                                    <Check
                                        className={cn("h-3 w-3 shrink-0", selected ? "opacity-100" : "opacity-0")}
                                        strokeWidth={3}
                                    />
                                    <span className="truncate">{d.label || "Microphone"}</span>
                                </button>
                            );
                        })
                    )}
                </div>
            )}
        </div>
    );
}
