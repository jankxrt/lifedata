// Shared CRM / Outreach constants and helpers.

/** The binding-commitment status. Selecting it requires a CRM ID. */
export const VERBINDLICHE_ZUSAGE = 'verbindliche Zusage';

/** Build the deep link into the Life Initiative CRM for a given conversation/CRM ID. */
export function crmUrl(crmId: string): string {
  return `https://crm.life-initiative.org/conversation/${encodeURIComponent(crmId.trim())}`;
}
