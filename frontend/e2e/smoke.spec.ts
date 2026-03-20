import { test, expect } from '@playwright/test';

test('app loads and shows login or home page', async ({ page }) => {
	await page.goto('/');
	// The app should render without crashing — check for any visible content
	await expect(page.locator('body')).not.toBeEmpty();
	// Page title or a known element should exist
	const title = await page.title();
	expect(title.length).toBeGreaterThan(0);
});
