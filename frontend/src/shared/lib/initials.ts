export function initials(firstName: string, lastName: string): string {
  return `${firstName.at(0) ?? ""}${lastName.at(0) ?? ""}`.toUpperCase();
}
