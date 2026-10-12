import { mkdirSync } from 'node:fs';
import { resolve, sep } from 'node:path';
import { pathToFileURL } from 'node:url';
// Generated evidence belongs outside tracked historical reports.
const directory=resolve(process.env.GARAGE_EVIDENCE_DIR||'.browser-checks/ci');
mkdirSync(directory,{recursive:true});
export const evidenceDir=pathToFileURL(directory+sep);
