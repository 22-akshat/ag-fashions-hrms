/**
 * Service façade for alert derivation (pure logic lives in `../lib/alertDetection.js`).
 * Keeps a stable import path for future persistence / Edge integration.
 */
export { deriveAllAlerts, deriveAlertsForRow } from '@/module4/alerts/lib/alertDetection'
export { filterAlerts } from '@/module4/alerts/lib/alertFilters'
