import { useEffect, useState } from 'react';
import { Room, RoomEvent } from 'livekit-client';
import { useMediaRoom } from '../media/livekit';
import { savePref, usePrefs } from '../lib/prefs';
import { Dialog } from '../ui/Dialog';
import { cn } from '../ui/cn';

export function SettingsDialog({ open, onOpenChange, pipSupported }: {
  open: boolean; onOpenChange: (o: boolean) => void; pipSupported: boolean;
}) {
  const prefs = usePrefs();
  return (
    <Dialog open={open} onOpenChange={onOpenChange} title="Settings">
      <div className="space-y-5">
        <section className="space-y-3">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-faint">Devices</h3>
          <DeviceSelect kind="audioinput" label="Microphone" />
          <DeviceSelect kind="videoinput" label="Camera" />
          <DeviceSelect kind="audiooutput" label="Speaker" />
        </section>
        <section className="space-y-3">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-faint">Layout</h3>
          <Segmented value={prefs.layout} onChange={(v) => savePref('layout', v)}
            options={[{ value: 'grid', label: 'Grid' }, { value: 'spotlight', label: 'Spotlight' }]} />
          <div className="flex items-center justify-between gap-3">
            <span className="text-sm">Videos during games</span>
            <Segmented value={prefs.stripPosition} onChange={(v) => savePref('stripPosition', v)}
              options={[{ value: 'right', label: 'Side' }, { value: 'bottom', label: 'Bottom' }]} />
          </div>
          {pipSupported && (
            <label className="flex items-center justify-between gap-3 text-sm">
              <span>
                Pop out videos when I switch tabs
                <span className="block text-xs text-muted">Uses picture-in-picture (Chrome / Edge)</span>
              </span>
              <input type="checkbox" checked={prefs.autoPiP} onChange={(e) => savePref('autoPiP', e.target.checked)}
                className="size-4 accent-[var(--color-accent)]" />
            </label>
          )}
        </section>
      </div>
    </Dialog>
  );
}

function DeviceSelect({ kind, label }: { kind: MediaDeviceKind; label: string }) {
  const room = useMediaRoom();
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [active, setActive] = useState(room.getActiveDevice(kind) ?? '');

  useEffect(() => {
    const load = () => Room.getLocalDevices(kind, false).then(setDevices).catch(() => setDevices([]));
    load();
    room.on(RoomEvent.MediaDevicesChanged, load);
    const onActive = (k: MediaDeviceKind, id: string) => { if (k === kind) setActive(id); };
    room.on(RoomEvent.ActiveDeviceChanged, onActive);
    return () => {
      room.off(RoomEvent.MediaDevicesChanged, load);
      room.off(RoomEvent.ActiveDeviceChanged, onActive);
    };
  }, [room, kind]);

  if (kind === 'audiooutput' && devices.length === 0) return null; // Safari/Firefox can't pick outputs
  return (
    <label className="flex items-center justify-between gap-3 text-sm">
      <span className="shrink-0">{label}</span>
      <select
        value={active}
        onChange={(e) => { setActive(e.target.value); void room.switchActiveDevice(kind, e.target.value); }}
        className="min-w-0 max-w-64 flex-1 h-9 rounded-lg bg-raised border border-line px-2 text-sm truncate"
      >
        {devices.length === 0 && <option value="">Not available</option>}
        {devices.map((d) => (
          <option key={d.deviceId} value={d.deviceId}>{d.label || `${label} ${d.deviceId.slice(0, 4)}`}</option>
        ))}
      </select>
    </label>
  );
}

function Segmented<T extends string>({ value, onChange, options }: {
  value: T; onChange: (v: T) => void; options: { value: T; label: string }[];
}) {
  return (
    <div className="inline-flex rounded-xl bg-raised p-1 border border-line">
      {options.map((o) => (
        <button key={o.value} type="button" onClick={() => onChange(o.value)} aria-pressed={value === o.value}
          className={cn('h-8 px-3 rounded-lg text-sm', value === o.value ? 'bg-text text-ink font-semibold' : 'text-muted hover:text-text')}>
          {o.label}
        </button>
      ))}
    </div>
  );
}
