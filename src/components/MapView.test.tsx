// src/components/MapView.test.tsx
//
// Verifies MapView mounts a container, initializes a MapManager on mount, and
// destroys it on unmount — all with an injected fake manager so nothing touches
// a real WebGL map (the environment is jsdom). Req 1.1, 1.4.
//
// Task 15.2 additions: the LoadingIndicator shows initially and is dismissed on
// the MapManager onReady (Req 1.5); the ErrorMessage shows on onTileFailure
// while the app stays interactive (Req 1.6, 18.1); the control cluster renders;
// and the DemoDataBadge shows when demo layers are present (Req 15.2).

import { act } from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { MapView, type MapManagerLike } from './MapView';
import type { AppConfig } from '../types/config';
import type { MinimalMap } from '../map/MapManager';
import type { LocationResult } from '../services/geolocation';

const CONFIG: AppConfig = { tileKey: 'test-key-123', hasTileKey: true };

/**
 * A fake MapManager tracking init/destroy calls and the options it received. It
 * intentionally does NOT expose an integrable map (getMap returns null) so the
 * real susceptibility/layer/popup integration paths stay skipped under jsdom.
 *
 * `mapOverride` lets a test supply a non-null map object so the guarded
 * marker-placement path runs (still jsdom-safe: it is a plain object of vi.fns,
 * never a real WebGL map). `flyTo`/`easeTo` on that map are recorded so tests
 * can assert the startup path never moves the camera.
 */
function makeFakeManager(mapOverride?: MinimalMap | null) {
  const init = vi.fn();
  const destroy = vi.fn();
  const zoomIn = vi.fn();
  const zoomOut = vi.fn();
  const recenter = vi.fn();
  const frameOverview = vi.fn();
  const getMap = vi.fn(() => mapOverride ?? null);
  const manager: MapManagerLike = {
    init,
    destroy,
    zoomIn,
    zoomOut,
    recenter,
    frameOverview,
    getMap,
  };
  return {
    manager,
    init,
    destroy,
    zoomIn,
    zoomOut,
    recenter,
    frameOverview,
    getMap,
  };
}

/**
 * A minimal non-integrable fake map exposing only `flyTo`/`easeTo` (recorded)
 * so a granted startup location can place a marker without WebGL, while letting
 * tests assert the startup path issues no camera move. It intentionally omits
 * addSource/addLayer so the susceptibility integration stays skipped.
 */
function makeFakeMap() {
  const flyTo = vi.fn();
  const easeTo = vi.fn();
  const map = { flyTo, easeTo } as unknown as MinimalMap;
  return { map, flyTo, easeTo };
}

/** Reads the onReady/onTileFailure callbacks passed to the fake init. */
function initCallbacks(init: ReturnType<typeof vi.fn>) {
  const options = init.mock.calls[0][0];
  return {
    onReady: options.onReady as () => void,
    onTileFailure: options.onTileFailure as (
      reason: 'timeout' | 'error',
    ) => void,
  };
}

describe('MapView', () => {
  it('mounts a full-size container and calls init on mount', () => {
    const { manager, init } = makeFakeManager();

    render(<MapView config={CONFIG} createMapManager={() => manager} />);

    const container = screen.getByTestId('map-container');
    expect(container).toBeInTheDocument();

    expect(init).toHaveBeenCalledTimes(1);
    const options = init.mock.calls[0][0];
    expect(options.container).toBe(container);
    expect(options.config).toBe(CONFIG);
  });

  it('calls destroy on unmount', () => {
    const { manager, destroy } = makeFakeManager();

    const { unmount } = render(
      <MapView config={CONFIG} createMapManager={() => manager} />,
    );

    expect(destroy).not.toHaveBeenCalled();
    unmount();
    expect(destroy).toHaveBeenCalledTimes(1);
  });

  it('forwards onReady and onTileFailure through to the manager', () => {
    const { manager, init } = makeFakeManager();
    const onReady = vi.fn();
    const onTileFailure = vi.fn();

    render(
      <MapView
        config={CONFIG}
        createMapManager={() => manager}
        onReady={onReady}
        onTileFailure={onTileFailure}
      />,
    );

    const { onReady: readyCb, onTileFailure: failCb } = initCallbacks(init);
    // The wrappers delegate to the current props.
    act(() => readyCb());
    act(() => failCb('timeout'));

    expect(onReady).toHaveBeenCalledTimes(1);
    expect(onTileFailure).toHaveBeenCalledWith('timeout');
  });

  it('shows the LoadingIndicator initially and dismisses it on ready (Req 1.5)', () => {
    const { manager, init } = makeFakeManager();

    render(<MapView config={CONFIG} createMapManager={() => manager} />);

    // Loading is visible before the map reports ready.
    expect(screen.getByTestId('loading-indicator')).toBeInTheDocument();
    expect(screen.queryByTestId('error-message')).not.toBeInTheDocument();

    const { onReady } = initCallbacks(init);
    act(() => onReady());

    // Dismissed once the base map is ready.
    expect(screen.queryByTestId('loading-indicator')).not.toBeInTheDocument();
    expect(screen.queryByTestId('error-message')).not.toBeInTheDocument();
  });

  it('shows the ErrorMessage on tile failure while staying interactive (Req 1.6, 18.1)', () => {
    const { manager, init } = makeFakeManager();

    render(<MapView config={CONFIG} createMapManager={() => manager} />);

    const { onTileFailure } = initCallbacks(init);
    act(() => onTileFailure('error'));

    const error = screen.getByTestId('error-message');
    expect(error).toBeInTheDocument();
    expect(screen.queryByTestId('loading-indicator')).not.toBeInTheDocument();
    // App stays interactive: the control cluster is still present.
    expect(screen.getByTestId('map-controls')).toBeInTheDocument();
    expect(screen.getByTestId('map-container')).toBeInTheDocument();
  });

  it('renders the control cluster over the map', () => {
    const { manager } = makeFakeManager();

    render(<MapView config={CONFIG} createMapManager={() => manager} />);

    expect(screen.getByTestId('map-controls')).toBeInTheDocument();
    expect(screen.getByTestId('zoom-controls')).toBeInTheDocument();
    expect(screen.getByTestId('layer-control')).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /recenter map to metro manila/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /show my location/i }),
    ).toBeInTheDocument();
  });

  it('wires zoom / recenter controls to the manager', async () => {
    const { manager, zoomIn, zoomOut, recenter } = makeFakeManager();
    const { default: userEvent } = await import('@testing-library/user-event');
    const user = userEvent.setup();

    render(<MapView config={CONFIG} createMapManager={() => manager} />);

    await user.click(screen.getByTestId('zoom-in'));
    await user.click(screen.getByTestId('zoom-out'));
    await user.click(
      screen.getByRole('button', { name: /recenter map to metro manila/i }),
    );

    expect(zoomIn).toHaveBeenCalledTimes(1);
    expect(zoomOut).toHaveBeenCalledTimes(1);
    expect(recenter).toHaveBeenCalledTimes(1);
  });

  it('shows the DemoDataBadge because the fixture layers are demo (Req 15.2)', () => {
    const { manager } = makeFakeManager();

    render(<MapView config={CONFIG} createMapManager={() => manager} />);

    expect(screen.getByTestId('demo-data-badge')).toBeInTheDocument();
  });

  it('does not throw in jsdom with an injected fake manager (no WebGL)', () => {
    const { manager } = makeFakeManager();
    expect(() =>
      render(<MapView config={CONFIG} createMapManager={() => manager} />),
    ).not.toThrow();
  });

  it('frames the tuned NCR overview on ready (Req 1.1)', () => {
    const { manager, init, frameOverview } = makeFakeManager();

    render(<MapView config={CONFIG} createMapManager={() => manager} />);

    // No framing until the base map reports ready.
    expect(frameOverview).not.toHaveBeenCalled();

    const { onReady } = initCallbacks(init);
    act(() => onReady());

    expect(frameOverview).toHaveBeenCalledTimes(1);
  });

  it('places the current-location marker on a granted startup location WITHOUT moving the camera (Req 2.1, 2.2, 2.3)', async () => {
    const { map, flyTo, easeTo } = makeFakeMap();
    const { manager, init, frameOverview } = makeFakeManager(map);

    // Injected startup location resolves granted.
    const requestLocation = vi.fn(
      async (): Promise<LocationResult> => ({
        status: 'granted',
        lng: 121.05,
        lat: 14.6,
      }),
    );

    // Injected MarkerManager records setOrigin without constructing real markers.
    const setOrigin = vi.fn();
    const createMarkerManager = vi.fn(
      () =>
        ({
          setOrigin,
          setDestination: vi.fn(),
          clearOrigin: vi.fn(),
          clearDestination: vi.fn(),
          getOrigin: vi.fn(),
          getDestination: vi.fn(),
          getElement: vi.fn(),
          destroy: vi.fn(),
        }) as never,
    );

    render(
      <MapView
        config={CONFIG}
        createMapManager={() => manager}
        createMarkerManager={createMarkerManager}
        requestLocation={requestLocation}
      />,
    );

    // Firing onReady frames the overview once and kicks off the startup request.
    const { onReady } = initCallbacks(init);
    await act(async () => {
      onReady();
      // Let the awaited startup location promise resolve and flush microtasks.
      await Promise.resolve();
      await Promise.resolve();
    });

    // The current-location marker was placed at the granted position.
    expect(requestLocation).toHaveBeenCalledTimes(1);
    expect(createMarkerManager).toHaveBeenCalledTimes(1);
    expect(setOrigin).toHaveBeenCalledWith(121.05, 14.6);

    // The camera was framed to the overview exactly once and NOT moved to the
    // user's position: the startup path must not fly/ease to the street.
    expect(frameOverview).toHaveBeenCalledTimes(1);
    expect(flyTo).not.toHaveBeenCalled();
    expect(easeTo).not.toHaveBeenCalled();
  });

  it('keeps the overview and stays interactive when startup location is denied (Req 2.4, 21.1)', async () => {
    const { map, flyTo, easeTo } = makeFakeMap();
    const { manager, init, frameOverview } = makeFakeManager(map);

    const setOrigin = vi.fn();
    const createMarkerManager = vi.fn(
      () => ({ setOrigin, destroy: vi.fn() }) as never,
    );

    const requestLocation = vi.fn(
      async (): Promise<LocationResult> => ({ status: 'denied' }),
    );

    render(
      <MapView
        config={CONFIG}
        createMapManager={() => manager}
        createMarkerManager={createMarkerManager}
        requestLocation={requestLocation}
      />,
    );

    const { onReady } = initCallbacks(init);
    await act(async () => {
      onReady();
      await Promise.resolve();
      await Promise.resolve();
    });

    // Overview stays framed once; no marker placement and no camera move.
    expect(requestLocation).toHaveBeenCalledTimes(1);
    expect(frameOverview).toHaveBeenCalledTimes(1);
    expect(setOrigin).not.toHaveBeenCalled();
    expect(flyTo).not.toHaveBeenCalled();
    expect(easeTo).not.toHaveBeenCalled();

    // The map + controls remain rendered and interactive.
    expect(screen.getByTestId('map-container')).toBeInTheDocument();
    expect(screen.getByTestId('map-controls')).toBeInTheDocument();
  });

  it('keeps the overview when startup location is unavailable, without throwing (Req 2.4, 21.1)', async () => {
    const { manager, init, frameOverview } = makeFakeManager(makeFakeMap().map);

    const requestLocation = vi.fn(
      async (): Promise<LocationResult> => ({ status: 'unavailable' }),
    );

    expect(() =>
      render(
        <MapView
          config={CONFIG}
          createMapManager={() => manager}
          requestLocation={requestLocation}
        />,
      ),
    ).not.toThrow();

    const { onReady } = initCallbacks(init);
    await act(async () => {
      onReady();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(requestLocation).toHaveBeenCalledTimes(1);
    expect(frameOverview).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId('map-container')).toBeInTheDocument();
    expect(screen.getByTestId('map-controls')).toBeInTheDocument();
  });
});
