import { targetsText, type Profile } from "../types";

/** The candidate, as every prompt sees it. The master CV owns employment history; the LinkedIn export may add skills. */
export function profileBlock(p: Profile): string {
  return [
    "CANDIDATE PROFILE",
    `Name: ${p.name} · Email: ${p.email} · Phone: ${p.phone || "n/a"} · LinkedIn: ${p.linkedin || "n/a"} · Website: ${p.website || "n/a"}`,
    `Work rights: ${p.workRights || "not stated"}`,
    `Availability: ${p.availability || "not stated"}`,
    `Looking for (only these; anything else is not applicable):\n${targetsText(p)}`,
    `Keywords: ${p.keywords.join(", ")}`,
    `Sectors of interest: ${p.sectors.join(", ") || "any"}`,
    `Locations: ${p.locations.join(", ")}${p.remote ? " (remote is fine)" : ""}`,
    `Salary floor: ${p.salaryFloor.amount ? `${p.salaryFloor.amount} ${p.salaryFloor.currency} per year for full-time roles (internships exempt)` : "none"}`,
    `Languages: ${p.languages.map((l) => `${l.name} (${l.level})`).join(", ") || "not stated"}`,
    `Deal-breakers (any hit vetoes): ${p.dealBreakers.join("; ") || "none"}`,
    p.notes ? `About the candidate (goals, what energises or drains them, constraints):\n${p.notes}` : "",
    "",
    "MASTER CV (source of truth for employment history, education, titles, dates and metrics; nothing about roles or employers may be claimed from anywhere else):",
    p.masterCv?.text ?? "(no master CV uploaded)",
    ...(p.linkedinProfile ? ["", "LINKEDIN PROFILE (additional source for skills, tools, certifications, languages, publications and awards only. Roles, employers or titles that appear only here must not be claimed):", p.linkedinProfile.text] : []),
  ].filter((l) => l !== undefined).join("\n");
}

export const companyKey = (c: string) => c.toLowerCase().trim().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
