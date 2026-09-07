export const singleRouteManifest = { schema_version: 1, mode: 'hash', fallback: 'home', routes: [{ id: 'home', path: '/' }] };

export function routeManifestScript(manifest = singleRouteManifest) {
  return `<script id="harness50-routes" type="application/json">${JSON.stringify(manifest)}</script>`;
}

export const completionHtml = `<!doctype html><html lang="en"><head><title>Fixture</title>${routeManifestScript()}</head><body><main data-harness-screen="home">Fixture</main></body></html>`;

export function passingBrowserReport(digest, manifest = singleRouteManifest) {
  const metrics = { errors: [], blocked_requests: 0, violations: [], accessibility_incomplete: [], horizontal_overflow: false, visible_text_length: 7, focusable_elements: 0 };
  const viewports = absent => [{ name: 'desktop', width: 1440, height: 900 }, { name: 'mobile', width: 390, height: 844 }].map(view => ({
      ...view, ...structuredClone(metrics), pass: true, keyboard_focus: false,
      navigation_api: { available: !absent, property_present: !absent },
      screenshot: `step_archive/screenshots/verified-${absent ? 'navigation-api-unavailable-' : ''}${view.name}.png`, initial_entry: true, unknown_fallback: true,
      routes: manifest.routes.map((route, index) => ({ ...route, ...structuredClone(metrics), pass: true, direct_entry: true, reload: true,
        navigation_api: { available: !absent, property_present: !absent },
        navigation: manifest.routes.length === 1 ? { status: 'not-applicable', reason: 'single-screen' }
          : { status: 'pass', target_id: manifest.routes[(index + 1) % manifest.routes.length].id, back: true, forward: true }
      }))
    }));
  return {
    schema_version: 3, generated_at: new Date().toISOString(), verdict: 'PASS',
    artifact_path: 'dist/index.html', artifact_sha256: digest, routing: structuredClone(manifest),
    viewports: viewports(false), compatibility: { navigation_api_unavailable: { viewports: viewports(true) } }
  };
}
