import { physicalWorkspace, readSafe, sha256 } from './quality-files.mjs';
import { readRouteManifestBytes } from './route-contract.mjs';
import { readBrowserReportBytes } from './browser-report.mjs';

// Read-only completion inspection; no browser tools, commands or network access.
export async function inspectBrowserOutput(workspaceRoot) {
  try {
    const root = await physicalWorkspace(workspaceRoot);
    const html = await readSafe(root, 'dist/index.html');
    const routing = readRouteManifestBytes(html);
    const digest = sha256(html);
    const reportBytes = await readSafe(root, 'step_archive/outputs/browser-output.json', 1024 * 1024);
    const report = readBrowserReportBytes(reportBytes, routing);
    if (report.artifact_sha256 !== digest) throw new Error('Browser report does not describe the current final HTML');
    if (sha256(await readSafe(root, 'dist/index.html')) !== digest ||
      sha256(await readSafe(root, 'step_archive/outputs/browser-output.json', 1024 * 1024)) !== sha256(reportBytes)) throw new Error('Final output changed during inspection');
    return { verdict: 'PASS', artifact_sha256: digest };
  } catch (error) { return { verdict: 'FAIL', error: error.message }; }
}
