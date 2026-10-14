import type { ZoneId } from "./store";

/** DOM label elements, registered by the overlay and positioned every frame by <LabelProjector/>. */
export const labelEls = new Map<ZoneId, HTMLElement>();
