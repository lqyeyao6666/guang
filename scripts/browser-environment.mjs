// The workstation's antivirus sometimes injects its own script into local HTTP
// pages. Block ONLY that known injected origin during QA, record it separately,
// and keep all game-origin errors and every other external request as failures.
export const isEnvironmentRequest = value => {
  try { return new URL(value).hostname.endsWith('.kis.v2.scr.kaspersky-labs.com'); }
  catch { return false; }
};
export async function isolateBrowserEnvironment(page) {
  const requests = [];
  await page.route('**/*',route => {
    if (isEnvironmentRequest(route.request().url())) {
      requests.push(route.request().url()); return route.abort();
    }
    return route.continue();
  });
  return requests;
}

// Gameplay regressions continue past the new opening; check-storybook tests it in full.
export async function dismissStoryOpening(page) {
  const opening = page.locator('#storybook-dialog[data-opening="true"]');
  if (await opening.isVisible()) await opening.locator('#close-story').click();
  const spirit = page.locator('#spirit-bubble');
  if (await spirit.isVisible()) await spirit.locator('#close-spirit').click();
}

// Legacy gameplay suites exercise arbitrary levels. Opt into the same per-tab
// debug mode as the password UI; check-progress separately verifies normal locks.
export async function prepareDebugNavigation(page) {
  await page.addInitScript(() => sessionStorage.setItem('warm-light.debug-session.v1', 'enabled'));
}

export async function selectLevel(page, number) {
  if (!await page.locator('#settings-dialog').isVisible()) await page.locator('#open-settings').click();
  const tools = page.locator('#debug-tools');
  if (!await tools.evaluate(element => element.open)) await tools.locator('summary').click();
  await page.locator('#debug-level').selectOption(String(number));
  await page.locator('#debug-jump').click();
}

export async function pauseAction(page, id) {
  if (!await page.locator('#settings-dialog').isVisible()) await page.locator('#open-settings').click();
  await page.locator(`#${id}`).click();
}

export async function useHint(page) {
  if (!await page.locator('#settings-dialog').isVisible()) await page.locator('#open-settings').click();
  if (!await page.locator('.pause-help').evaluate(element => element.open)) await page.locator('.pause-help summary').click();
  await page.locator('#hint').click();
  await page.locator('#done-settings').click();
}
