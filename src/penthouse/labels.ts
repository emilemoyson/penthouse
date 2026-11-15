import type { ZoneId } from "./store";

/** DOM label elements, registered by the overlay and positioned every frame by <LabelProjector/>. */
export const labelEls = new Map<ZoneId, HTMLElement>();

/** The "Connectors" label over the bookshelf, and where the shelf stands. */
export const shelfLabel: { el: HTMLElement | null; at: [number, number, number] } = { el: null, at: [-3.2, 2.35, -0.1] };
