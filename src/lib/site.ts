// The site name lives here only. Change it in one place.
export const SITE_NAME = "The Studio";

// The four room pages, in switcher order. `zone` matches the 3D room id.
export const ROOMS = [
  { id: "office", label: "Office", href: "/office", zone: "desk" },
  { id: "kitchen", label: "Kitchen", href: "/kitchen", zone: "kitchen" },
  { id: "gym", label: "Gym", href: "/training", zone: "gym" },
  { id: "bedroom", label: "Bedroom", href: "/bedroom", zone: "bed" },
] as const;
