// Back-compat: ImportContacts.tsx imports parseSchedulePhoto + ParsedContact from here.
// Implementation now lives in src/lib/parseRosterText.ts.
export {
  parseRosterText as parseSchedulePhoto,
  type ParsedRosterEntry as ParsedContact,
} from '../lib/parseRosterText'
