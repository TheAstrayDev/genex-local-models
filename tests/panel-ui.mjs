/** Plugin UI behavior in a disposable Electron page; fixture screenshots are not full-app evidence. */
import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { build } from "esbuild";
import { catalog, defaults } from "../src/catalog.ts";

if (!process.env.GENEX_SOURCE_DIR)
	throw Error(
		"Set GENEX_SOURCE_DIR to a Genex checkout with its pinned Electron and Playwright dependencies.",
	);
const root = path.resolve(import.meta.dirname, "..");
const host = path.resolve(process.env.GENEX_SOURCE_DIR);
const { _electron: electron } = await import(
	pathToFileURL(path.join(host, "node_modules/playwright/index.mjs")).href
);
const { expect } = await import(
	pathToFileURL(path.join(host, "node_modules/@playwright/test/index.mjs")).href
);
const { fixtureElectronArgs, fixtureElectronEnv, resolveElectron } =
	await import(
		pathToFileURL(path.join(host, "scripts/electron-runtime.mjs")).href
	);
const out = path.join(root, ".evidence/panel-ui");
await mkdir(out, { recursive: true });
const profile = await mkdtemp(path.join(out, "profile-"));
const compiled = await build({
	entryPoints: [path.join(root, "src/panel.ts")],
	bundle: true,
	format: "iife",
	platform: "browser",
	write: false,
});
const models = catalog.map((model) => ({
	...model,
	ready: true,
	supported: true,
	state: "sleeping",
	reason: "",
	requirement: "A compatible local GPU is required.",
	runtimeRoot: "C:/Local Models/" + model.id,
	canInstall: true,
}));
if (!models.some((model) => model.id === "qwen-image-2.1-turbo-q8"))
	models.push({
		...models[0],
		id: "qwen-image-2.1-turbo-q8",
		name: "Qwen Image 2.1 Turbo Q8",
		experimental: true,
	});
if (!models.some((model) => model.id === "hunyuan3d-2-mini-turbo"))
	models.push({
		...models.find((model) => model.routes.includes("model")),
		id: "hunyuan3d-2-mini-turbo",
		name: "Hunyuan3D 2 Mini Turbo",
		experimental: true,
	});
const snapshot = {
	project: "Fixture game",
	models,
	assignments: {
		...defaults,
		texture: null,
		sfx: "stable-audio-3-small-sfx",
		model: "hunyuan3d-2-turbo",
	},
	downloadCache: "D:/Genex-Local-Models",
	modelDirectory: "C:/Local Models",
	execution: { active: false, model: null, pending: 0 },
	installation: {
		active: false,
		phase: "idle",
		model: "",
		total: 0,
		completed: 0,
	},
	recent: [],
};
const bridge = `
window.uiFixture = { snapshot: ${JSON.stringify(snapshot)}, calls: [], failSave: false, failStatus: false, theme: { background: '#111111', foreground: '#eeeeee', accent: '#8f9bff' } };
const themeListeners = new Set();
uiFixture.notifyTheme = () => { for (const fn of themeListeners) fn(); };
window.studioPlugin = {
 onContextChanged(fn) { themeListeners.add(fn); return () => themeListeners.delete(fn); },
 async call(method, name, args) {
  uiFixture.calls.push({ method, name, args: structuredClone(args) });
  if (method === 'context') return { theme: structuredClone(uiFixture.theme) };
  if (name === 'status') { if(uiFixture.failStatus) throw Error('Model status is temporarily unavailable. Try again.'); return structuredClone(uiFixture.snapshot); }
  if (name === 'activity') return structuredClone({ execution: uiFixture.snapshot.execution, installation: uiFixture.snapshot.installation });
  if (name === 'assign') { if(uiFixture.failSave) throw Error('Assignments could not be saved. Try again.'); uiFixture.snapshot.assignments=structuredClone(args); return structuredClone(args); }
  if (name === 'restore-assets') return { restored: [], failed: [] };
  if (name === 'discover') return { note: 'Only compatible adapters can be assigned.', found: [] };
  if (name === 'install') { uiFixture.snapshot.installation={active:true,phase:'download',model:args.model,total:1000000000,completed:100000000}; return {}; }
  if (name === 'cancel-install') { uiFixture.snapshot.installation.active=false; return {}; }
  throw Error('Unexpected fixture call: '+method+' '+name);
 }
};`;
const html = `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Local Models</title><style>${await readFile(path.join(root, "src/style.css"), "utf8")}</style><main id="root"></main><script>${bridge}</script><script>${compiled.outputFiles[0].text.replace(/<\/script/gi, "<\\/script")}</script></html>`;
await writeFile(path.join(out, "index.html"), html);
await writeFile(
	path.join(out, "main.cjs"),
	`const{app,BrowserWindow}=require('electron');app.disableHardwareAcceleration();app.setPath('userData',${JSON.stringify(profile)});app.whenReady().then(async()=>{const win=new BrowserWindow({width:1080,height:1000,show:false,x:-4000,focusable:false,skipTaskbar:true,webPreferences:{sandbox:true,contextIsolation:true,backgroundThrottling:false}});win.showInactive();await win.loadFile(${JSON.stringify(path.join(out, "index.html"))});});`,
);
const checks = [];
const check = (name, value = true) => {
	assert.ok(value, name);
	checks.push(name);
	console.log("PASS " + name);
};
let app;
try {
	app = await electron.launch({
		executablePath: resolveElectron(host),
		args: fixtureElectronArgs([path.join(out, "main.cjs")]),
		env: fixtureElectronEnv(),
		timeout: 15000,
	});
	const page = await app.firstWindow();
	page.setDefaultTimeout(5000);
	await expect(
		page.getByRole("heading", { name: "Models for each task" }),
	).toBeVisible();
	check(
		"five task choices are available",
		(await page.locator("[data-route]").count()) === 5,
	);
	await expect(page.locator("[data-route=texture]")).toHaveValue("");
	await expect(page.locator("#save")).toBeDisabled();
	check("disabled routes remain off and unchanged settings need no save");
	await page
		.locator("[data-route=image]")
		.selectOption("qwen-image-2.1-turbo-q8");
	await expect(page.locator("#save")).toBeEnabled();
	await page.getByRole("button", { name: "Refresh", exact: true }).click();
	await expect(page.locator("[data-route=image]")).toHaveValue(
		"qwen-image-2.1-turbo-q8",
	);
	check("refresh preserves unsaved model selections");
	await page.evaluate(() => {
		uiFixture.failSave = true;
	});
	await page.locator("#save").focus();
	await page.keyboard.press("Enter");
	await expect(page.getByRole("alert")).toContainText(
		"Assignments could not be saved",
	);
	await expect(page.locator("[data-route=image]")).toHaveValue(
		"qwen-image-2.1-turbo-q8",
	);
	check("failed keyboard save preserves the draft and exposes an alert");
	await page.evaluate(() => {
		uiFixture.failSave = false;
		uiFixture.failStatus = true;
	});
	await page.getByRole("button", { name: "Refresh", exact: true }).click();
	await expect(page.getByRole("alert")).toContainText(
		"Model status is temporarily unavailable",
	);
	await expect(page.locator("[data-route=image]")).toHaveValue(
		"qwen-image-2.1-turbo-q8",
	);
	check("failed refresh keeps the current controls and draft");
	await page.evaluate(() => {
		uiFixture.failStatus = false;
	});
	await page.locator("#save").focus();
	await page.keyboard.press("Enter");
	await expect(page.locator("#message")).toContainText("Changes saved");
	check(
		"keyboard save persists each task without re-enabling off routes",
		await page.evaluate(
			() =>
				uiFixture.snapshot.assignments.image === "qwen-image-2.1-turbo-q8" &&
				uiFixture.snapshot.assignments.texture === null &&
				uiFixture.snapshot.assignments.music === null,
		),
	);
	await expect(page.locator("#save")).toBeDisabled();
	await page.evaluate(() => {
		uiFixture.snapshot.assignments.model = "hunyuan3d-2-mini-turbo";
		const model = uiFixture.snapshot.models.find(
			(model) => model.id === "hunyuan3d-2-mini-turbo",
		);
		model.ready = false;
		model.supported = false;
		model.state = "unsupported";
	});
	await page.getByRole("button", { name: "Refresh", exact: true }).click();
	await expect(page.locator("[data-route=model]")).toHaveValue(
		"hunyuan3d-2-mini-turbo",
	);
	await expect(
		page.locator("[data-route=model] option:checked"),
	).toBeDisabled();
	await page
		.locator("[data-route=texture]")
		.selectOption("qwen-image-2.1-turbo");
	await page.locator("#save").click();
	check(
		"saving another task preserves an unsupported saved model",
		await page.evaluate(
			() => uiFixture.snapshot.assignments.model === "hunyuan3d-2-mini-turbo",
		),
	);
	await page.evaluate(() => {
		uiFixture.snapshot.models.find(
			(model) => model.id === "qwen-image-2.1-turbo-q8",
		).ready = false;
	});
	await page.getByRole("button", { name: "Refresh", exact: true }).click();
	await expect(page.locator("[data-route=image]")).toHaveValue(
		"qwen-image-2.1-turbo-q8",
	);
	await expect(
		page.locator("[data-route=image] option:checked"),
	).toBeDisabled();
	check("uninstalled saved choices are not silently reset or offered as ready");
	await page.locator("[data-route=texture]").selectOption("");
	const reads = await page.evaluate(
		() => uiFixture.calls.filter((call) => call.name === "status").length,
	);
	await page.evaluate(() => {
		uiFixture.snapshot.execution = {
			active: true,
			model: "hunyuan3d-2-turbo",
			pending: 1,
		};
	});
	await expect(page.locator("#execution-state")).toContainText(
		"Working · Hunyuan3D",
	);
	check(
		"activity polling shows work without probing model readiness",
		(await page.evaluate(
			() => uiFixture.calls.filter((call) => call.name === "status").length,
		)) === reads,
	);
	await expect(page.locator("[data-route=texture]")).toHaveValue("");
	await page.evaluate(() => {
		uiFixture.snapshot.execution = { active: false, model: null, pending: 0 };
	});
	await expect
		.poll(() =>
			page.evaluate(
				() => uiFixture.calls.filter((call) => call.name === "status").length,
			),
		)
		.toBeGreaterThan(reads);
	await expect(page.locator("[data-route=texture]")).toHaveValue("");
	check("completion refresh preserves unsaved choices");
	await page.locator("#discard").click();
	await page.evaluate(() => {
		uiFixture.theme = {
			background: "#ffffff",
			foreground: "#171717",
			accent: "#4658ba",
		};
		uiFixture.notifyTheme();
	});
	await expect(page.locator("html")).toHaveCSS(
		"background-color",
		"rgb(255, 255, 255)",
	);
	await expect(page.locator("html")).toHaveCSS("color-scheme", "light");
	check("SDK context changes update the live light theme");
	await page.screenshot({ path: path.join(out, "panel-light.png") });
	await page.evaluate(() => {
		uiFixture.theme = {
			background: "#111111",
			foreground: "#eeeeee",
			accent: "#8f9bff",
		};
		uiFixture.notifyTheme();
	});
	await expect(page.locator("html")).toHaveCSS(
		"background-color",
		"rgb(17, 17, 17)",
	);
	await expect(page.locator("html")).toHaveCSS("color-scheme", "dark");
	check("SDK context changes update the live dark theme");
	await page.screenshot({ path: path.join(out, "panel-dark.png") });
	await app.evaluate(({ BrowserWindow }) => {
		BrowserWindow.getAllWindows()[0].setContentSize(380, 840);
	});
	await expect.poll(() => page.evaluate(() => innerWidth)).toBe(380);
	check(
		"380px layout has no horizontal overflow",
		await page.evaluate(
			() => document.documentElement.scrollWidth <= innerWidth,
		),
	);
	check(
		"enabled controls use pointer cursors",
		await page
			.locator("#refresh")
			.evaluate((el) => getComputedStyle(el).cursor === "pointer"),
	);
	await page.locator("#manage-models").evaluate((el) => (el.open = true));
	await page.screenshot({ path: path.join(out, "panel-narrow.png") });
	check(
		"model availability and details remain reachable at narrow widths",
		(await page.locator("[data-model]").count()) === models.length,
	);
	await page.locator('[data-install="qwen-image-2.1-turbo-q8"]').click();
	await expect(
		page.getByRole("button", { name: "Cancel download", exact: true }),
	).toBeVisible();
	await page
		.getByRole("button", { name: "Cancel download", exact: true })
		.focus();
	await page.evaluate(() => {
		uiFixture.snapshot.installation.completed = 500000000;
	});
	await expect(
		page.getByRole("progressbar", { name: "Model download" }),
	).toHaveJSProperty("value", 500000000);
	await expect(
		page.getByRole("button", { name: "Cancel download", exact: true }),
	).toBeFocused();
	check("download progress preserves keyboard focus on cancel");
	await page.keyboard.press("Enter");
	await expect(
		page.getByRole("button", { name: "Cancel download", exact: true }),
	).toHaveCount(0);
	check("install and cancel keep their existing host actions");
	check(
		"the panel never launches generation",
		await page.evaluate(
			() =>
				!uiFixture.calls.some(
					(call) => call.method === "tool" || call.name === "native.run",
				),
		),
	);
	await writeFile(
		path.join(out, "report.json"),
		JSON.stringify(
			{
				checks,
				fixture: "isolated plugin panel with synthetic model readiness",
				providerCalls: 0,
				electron: await app.evaluate(() => process.versions.electron),
			},
			null,
			2,
		),
	);
	console.log("Evidence: " + out);
} finally {
	await app?.close();
}
