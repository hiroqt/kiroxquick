// src/components/controls/LayerControl.tsx
//
// The Layer_Control lists every available Data_Layer uniformly, one toggle per
// layer (design → Components: `LayerControl`, Req 9).
//
// Behavior:
// - Renders one entry per provided DataLayerMeta, in the order given. Every
//   layer — flood, route, evacuation-center, boundaries — is exposed through the
//   SAME toggle interaction, so future layers are added as additional entries
//   without introducing a different control (Req 9.1, 9.4).
// - Each entry is a real <input type="checkbox"> with an associated <label>
//   text (the meta.label). On/off state is conveyed by the native checkbox
//   state plus text, never by color alone (Req 9.5, 11.4). The checkbox is
//   keyboard-operable and carries an accessible name via the label association
//   (Req 11.1–11.3).
// - Toggling an entry calls `onToggle(id, newVisible)` synchronously; the parent
//   wires this to LayerRegistry.setVisibility, which shows/hides the layer. The
//   500 ms rendering budget (Req 9.2) is a MapLibre/registry concern — the
//   control just fires the callback.
// - An empty layers list renders an empty list with a subtle "No layers" note
//   and NO error/alert (Req 9.3).
// - Each toggle manages its own checked state, seeded from `meta.defaultVisible`
//   (or an optional `initialVisibility` override), so the checkbox reflects the
//   current on/off state locally while still notifying the parent.

import { useState, type CSSProperties } from 'react';
import type { DataLayerMeta, LayerId } from '../../types/layer';

export interface LayerControlProps {
  /** Every available Data_Layer, listed uniformly (Req 9.1, 9.4). */
  layers: DataLayerMeta[];
  /**
   * Invoked when the user toggles a layer entry. The parent wires this to
   * LayerRegistry.setVisibility(id, visible) (Req 9.2).
   */
  onToggle: (id: LayerId, visible: boolean) => void;
  /**
   * Optional initial visibility override per layer id. When a layer id is
   * absent from this map, the entry seeds its state from `meta.defaultVisible`.
   */
  initialVisibility?: Partial<Record<LayerId, boolean>>;
  /** Optional extra class appended to the container for layout/positioning. */
  className?: string;
}

const listStyle: CSSProperties = {
  listStyle: 'none',
  margin: 0,
  padding: 0,
};

const itemLabelStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '0.5rem',
  cursor: 'pointer',
};

/**
 * Resolves the initial checked state for a layer: the explicit override when
 * present, otherwise the layer's `defaultVisible`.
 */
function initialCheckedFor(
  meta: DataLayerMeta,
  overrides: Partial<Record<LayerId, boolean>> | undefined,
): boolean {
  const override = overrides?.[meta.id];
  return override === undefined ? meta.defaultVisible : override;
}

/** A single labeled layer toggle. Manages its own checked state locally. */
function LayerToggle({
  meta,
  initialChecked,
  onToggle,
}: {
  meta: DataLayerMeta;
  initialChecked: boolean;
  onToggle: (id: LayerId, visible: boolean) => void;
}) {
  const [checked, setChecked] = useState(initialChecked);
  const checkboxId = `baharoute-layer-toggle-${meta.id}`;
  // Non-color state cue: an explicit "On"/"Off" text alongside the checkbox,
  // so the on/off state is perceivable without relying on color (Req 9.5, 11.4).
  const stateText = checked ? 'On' : 'Off';

  return (
    <li className="baharoute-layer-item" data-testid={`layer-item-${meta.id}`}>
      <label htmlFor={checkboxId} style={itemLabelStyle}>
        <input
          id={checkboxId}
          type="checkbox"
          className="baharoute-layer-checkbox baharoute-focus-ring"
          data-testid={`layer-checkbox-${meta.id}`}
          checked={checked}
          onChange={(event) => {
            const next = event.target.checked;
            setChecked(next);
            onToggle(meta.id, next);
          }}
        />
        <span className="baharoute-layer-label">{meta.label}</span>
        <span className="baharoute-layer-state" data-testid={`layer-state-${meta.id}`}>
          {stateText}
        </span>
      </label>
    </li>
  );
}

/**
 * Renders the accessible layer-toggle list. Presentation only — visibility
 * state is applied to the map by the parent via `onToggle`.
 */
export function LayerControl({
  layers,
  onToggle,
  initialVisibility,
  className,
}: LayerControlProps) {
  const containerClass = className
    ? `baharoute-layer-control ${className}`
    : 'baharoute-layer-control';

  return (
    <div
      className={containerClass}
      data-testid="layer-control"
      role="group"
      aria-label="Map layers"
    >
      {layers.length === 0 ? (
        // Empty list: no error, no toggles — just a subtle note (Req 9.3).
        <p className="baharoute-layer-empty" data-testid="layer-control-empty">
          No layers
        </p>
      ) : (
        <ul className="baharoute-layer-list" style={listStyle}>
          {layers.map((meta) => (
            <LayerToggle
              key={meta.id}
              meta={meta}
              initialChecked={initialCheckedFor(meta, initialVisibility)}
              onToggle={onToggle}
            />
          ))}
        </ul>
      )}
    </div>
  );
}

export default LayerControl;
