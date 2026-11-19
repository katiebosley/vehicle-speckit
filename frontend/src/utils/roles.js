export const ROLE_LABELS = {
  admin: "Admin",
  area_admin: "Area Admin",
  requestor: "Requestor",
};

export const ROLE_OPTIONS = Object.entries(ROLE_LABELS).map(([value, title]) => ({ value, title }));

export function roleLabel(role) {
  return ROLE_LABELS[role] ?? role ?? "";
}
