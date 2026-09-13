/**
 * Server surface. Importing this from a client component pulls
 * @copilotkit/runtime (and Express, and Node's `fs`) into the browser bundle.
 * Client code wants `agent-core/shared`.
 */
export { makeAgent } from "./agent";
export { resolveModel, resolveLanguageModel } from "./model";
export { searchWeb, isSearchConfigured } from "./capabilities/search";
export {
  workplaceMcpServers,
  isWorkplaceConfigured,
  WORKPLACE_CONTEXT,
} from "./capabilities/workplace";
export {
  extractCaptures,
  EXTRACTION_RULES,
  type ExtractInput,
  type ExtractableMessage,
  type ExtractedCapture,
} from "./capabilities/extract";
export { serviceClient, isSupabaseConfigured } from "./supabase";
export {
  calendarConnection,
  isCalendarConnected,
  isCalendarClientConfigured,
  syncItem,
  createEvent,
  updateEvent,
  markEventDone,
  deleteEvent,
  eventBody,
  NotConnected,
  CALENDAR_SCOPES,
} from "./capabilities/calendar";
export * from "./shared";
