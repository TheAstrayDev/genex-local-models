import { routes, type Assignments, type Route } from "./catalog.ts";

declare const studioPlugin: {
	call(method: string, name?: string, args?: unknown): Promise<any>;
	onContextChanged?(callback: () => void): () => void;
};
interface Model {
	id: string;
	name: string;
	routes: readonly string[];
	ready: boolean;
	supported: boolean;
	state: string;
	reason: string;
	requirement: string;
	detail: string;
	license: string;
	bytes: number;
	experimental: boolean;
	url: string;
	runtimeRoot?: string;
	canInstall: boolean;
}
interface Installation {
	active: boolean;
	phase: string;
	model: string;
	completed: number;
	total: number;
	error?: string;
}
interface Snapshot {
	project: string | null;
	models: Model[];
	assignments: Assignments;
	downloadCache: string;
	modelDirectory: string;
	execution: { active: boolean; model: string | null; pending: number };
	installation: Installation;
	recent: Array<{ task: Route; model: string; seconds: number }>;
}
const root = document.getElementById("root");
if (!root) throw Error("Local Models panel is missing its root.");
const panel = root;
const labels: Record<Route, string> = {
	image: "Images",
	texture: "Textures",
	sfx: "Sound effects",
	music: "Music",
	model: "3D objects",
};
let snapshot: Snapshot | undefined;
let draft: Record<Route, string | null> | undefined;
let busy = false;
let polling = false;
let readVersion = 0;
let themeVersion = 0;
let notice = { text: "", error: false };
const escape = (value: unknown) =>
	String(value ?? "").replace(
		/[&<>"']/g,
		(c) =>
			({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
				c
			] ?? c,
	);
const dirty = () =>
	Boolean(
		snapshot &&
			draft &&
			routes.some((route) => draft?.[route] !== snapshot?.assignments[route]),
	);

function message(text: string, error = false) {
	notice = { text, error };
	const box = document.getElementById("message");
	if (!box) return;
	box.setAttribute("role", error ? "alert" : "status");
	box.classList.toggle("error", error);
	box.textContent = text;
}
function selectedModel(route: Route) {
	return snapshot?.models.find((model) => model.id === draft?.[route]);
}
function modelState(model: Model) {
	if (!model.supported) return "Unavailable here";
	if (model.state === "working") return "Working";
	return model.ready ? "Installed" : "Not installed";
}
function routeHint(route: Route) {
	const model = selectedModel(route);
	if (!draft?.[route]) return "Your AI will not generate this type locally.";
	if (!model)
		return "Saved model is unavailable. Choose another model or turn this task off.";
	if (!model.supported)
		return model.requirement || "This model cannot run on this computer.";
	if (!model.ready)
		return model.canInstall
			? "Install this model below before asking your AI to use it."
			: "Needs separate local setup. Open its model details below.";
	return model.experimental
		? "Experimental model. Used for new requests after saving."
		: "Used automatically when your AI needs this type of asset.";
}
function routeRow(route: Route) {
	const selected = draft?.[route];
	const models =
		snapshot?.models.filter((model) => model.routes.includes(route)) ?? [];
	const missing = selected && !models.some((model) => model.id === selected);
	return `<div class="route"><div class="route-label"><label for="route-${route}">${labels[route]}</label><p id="hint-${route}" data-route-hint="${route}">${escape(routeHint(route))}</p></div><select id="route-${route}" data-route="${route}" aria-label="${labels[route]} model" aria-describedby="hint-${route}"><option value="" ${selected == null ? "selected" : ""}>Off</option>${missing ? `<option value="${escape(selected)}" selected disabled>Unavailable saved model</option>` : ""}${models.map((model) => `<option value="${escape(model.id)}" ${selected === model.id ? "selected" : ""} ${!model.supported || !model.ready ? "disabled" : ""}>${escape(model.name)}${model.experimental ? " · Experimental" : ""}${!model.supported ? " · Unavailable here" : !model.ready ? " · Not installed" : ""}</option>`).join("")}</select></div>`;
}
function modelRow(model: Model) {
	return `<article data-model="${escape(model.id)}"><div class="model-row"><div><h3>${escape(model.name)}</h3><p>${escape(modelState(model))}${model.experimental ? " · Experimental" : ""}</p></div>${!model.ready && model.supported && model.canInstall ? `<button type="button" data-install="${escape(model.id)}">Install</button>` : ""}</div><details class="model-details"><summary>Model details</summary><div><p>${escape(model.detail)}</p><p>${escape(model.requirement)}</p>${!model.ready ? `<p>${escape(model.reason)}</p>` : ""}<p>${escape(model.license)}${model.bytes ? ` · ${(model.bytes / 1e9).toFixed(1)} GB of model files` : ""}</p>${model.runtimeRoot ? `<p class="path">Runtime: <code>${escape(model.runtimeRoot)}</code></p>` : ""}<a href="${escape(model.url)}" target="_blank" rel="noreferrer">About ${escape(model.name)} ↗</a></div></details></article>`;
}
function execution() {
	if (!snapshot) return "";
	const state = snapshot.execution;
	const model = snapshot.models.find((entry) => entry.id === state.model);
	const text = state.active
		? `Working${model ? ` · ${model.name}` : ""}`
		: snapshot.models.some((entry) => entry.ready)
			? "Ready for AI tasks"
			: "Install a model to begin";
	return `<div id="execution-state" class="execution" role="status"><span class="dot ${state.active ? "working" : ""}" aria-hidden="true"></span><span>${escape(text)}</span><span class="execution-hint">One model at a time</span></div>`;
}
function render() {
	if (!snapshot || !draft) return;
	const empty = !snapshot.models.some((model) => model.ready);
	const changes = dirty();
	panel.innerHTML = `<header><div><h1>Local Models</h1><p>Choose the models your AI uses.</p></div><button type="button" id="refresh" class="quiet">Refresh</button></header>${execution()}
  <form id="assignments"><section class="assignment-section" aria-labelledby="choose-models"><div class="section-heading"><h2 id="choose-models">Models for each task</h2></div><div class="routes">${routes.map(routeRow).join("")}</div><div class="save-row"><button id="save" type="submit" class="primary">Save changes</button><button id="discard" type="button" ${changes ? "" : "hidden"}>Discard changes</button><span class="save-hint">${changes ? "Unsaved changes" : "Applies to new requests"}</span></div></section></form>
  <p id="message" role="${notice.error ? "alert" : "status"}" aria-live="polite" class="${notice.error ? "error" : ""}">${escape(notice.text)}</p>
  <details id="manage-models" class="section-disclosure" ${empty || snapshot.installation.active ? "open" : ""}><summary>Manage models <span>${snapshot.models.filter((model) => model.ready).length} installed</span></summary><div class="disclosure-body"><p>Installing a model asks for confirmation. Choosing a model downloads nothing.</p><div id="installation" aria-live="polite"></div><div class="models">${snapshot.models.map(modelRow).join("")}</div><details class="storage-details"><summary>Storage and existing models</summary><div><p>Download cache: <code>${escape(snapshot.downloadCache)}</code></p><p>Working models: <code>${escape(snapshot.modelDirectory)}</code></p><button id="discover" type="button">Find existing models</button><div id="discovery"></div></div></details></div></details>
  <details class="section-disclosure"><summary>Saved assets</summary><div class="disclosure-body"><p>${snapshot.project ? `Restore retained results to <strong data-analytics-mask>${escape(snapshot.project)}</strong> without generating them again.` : "Open a game to restore its saved assets."}</p><button id="restore-assets" type="button" ${snapshot.project ? "" : "disabled"}>Restore assets</button></div></details>
  <details class="section-disclosure"><summary>Recent generations</summary><div class="disclosure-body">${
		snapshot.recent.length
			? `<div class="history">${snapshot.recent
					.slice(0, 5)
					.map(
						(job) =>
							`<div><strong>${escape(labels[job.task] ?? job.task)}</strong><span>${escape(snapshot?.models.find((model) => model.id === job.model)?.name ?? job.model)}</span><span>${Number(job.seconds).toFixed(1)} s</span></div>`,
					)
					.join("")}</div>`
			: "<p>No generations yet. Ask your AI for an asset after choosing an installed model.</p>"
	}</div></details>
  <footer><p>Models run locally and release their memory after each task. Paid tools are never used as a fallback.</p></footer>`;
	document
		.getElementById("refresh")
		?.addEventListener("click", () => void refresh());
	document
		.getElementById("assignments")
		?.addEventListener("submit", (event) => {
			event.preventDefault();
			void save();
		});
	document.getElementById("discard")?.addEventListener("click", () => {
		if (snapshot) draft = { ...snapshot.assignments };
		message("");
		render();
	});
	for (const select of panel.querySelectorAll<HTMLSelectElement>(
		"[data-route]",
	))
		select.addEventListener("change", () => {
			const route = select.dataset.route as Route;
			if (draft) draft[route] = select.value || null;
			const hint = document.getElementById(`hint-${route}`);
			if (hint) hint.textContent = routeHint(route);
			message("");
			controls();
		});
	for (const button of panel.querySelectorAll<HTMLButtonElement>(
		"[data-install]",
	))
		button.addEventListener(
			"click",
			() =>
				void operation(async () => {
					await studioPlugin.call("action", "install", {
						model: button.dataset.install,
					});
					await readSnapshot();
				}),
		);
	document.getElementById("restore-assets")?.addEventListener(
		"click",
		() =>
			void operation(async () => {
				const result = await studioPlugin.call("action", "restore-assets", {});
				message(
					`${result.restored.length} saved jobs restored.${result.failed.length ? ` ${result.failed.length} could not be restored: ${result.failed.map((failure: { error: string }) => failure.error).join("; ")}` : ""}`,
					result.failed.length > 0,
				);
			}),
	);
	document.getElementById("discover")?.addEventListener(
		"click",
		() =>
			void operation(async () => {
				const result = await studioPlugin.call("action", "discover", {});
				const target = document.getElementById("discovery");
				if (target)
					target.innerHTML = `<p>${escape(result.note)}</p>${result.found.map((model: { id: string }) => `<div class="found">${escape(model.id)}<span>Adapter not installed</span></div>`).join("") || "<p>No additional model caches found.</p>"}`;
			}, false),
	);
	showInstallation();
	controls();
}
function controls() {
	for (const element of panel.querySelectorAll<
		HTMLSelectElement | HTMLButtonElement
	>("button, select"))
		element.disabled = busy;
	const save = document.getElementById("save") as HTMLButtonElement | null;
	if (save) save.disabled = busy || !dirty();
	const discard = document.getElementById(
		"discard",
	) as HTMLButtonElement | null;
	if (discard) discard.hidden = !dirty();
	const hint = panel.querySelector(".save-hint");
	if (hint)
		hint.textContent = busy
			? "Please wait…"
			: dirty()
				? "Unsaved changes"
				: "Applies to new requests";
	const restore = document.getElementById(
		"restore-assets",
	) as HTMLButtonElement | null;
	if (restore) restore.disabled = busy || !snapshot?.project;
	for (const element of panel.querySelectorAll<HTMLButtonElement>(
		"[data-install]",
	))
		element.disabled = busy || Boolean(snapshot?.installation.active);
	panel.setAttribute("aria-busy", String(busy));
}
async function readSnapshot() {
	const version = ++readVersion;
	const next = (await studioPlugin.call("action", "status", {})) as Snapshot;
	if (version !== readVersion) return;
	const keepDraft = dirty();
	snapshot = next;
	if (!keepDraft) draft = { ...next.assignments };
}
async function operation(work: () => Promise<void>, redraw = true) {
	if (busy) return;
	busy = true;
	readVersion++;
	controls();
	message("");
	try {
		await work();
	} catch (error) {
		message(String(error), true);
	} finally {
		busy = false;
		if (redraw) render();
		else controls();
	}
}
async function save() {
	if (!draft || !snapshot || !dirty()) return;
	const changes = { ...draft };
	await operation(async () => {
		const saved = (await studioPlugin.call(
			"action",
			"assign",
			changes,
		)) as Assignments;
		if (snapshot) snapshot.assignments = saved;
		draft = { ...saved };
		message("Changes saved. Your AI will use these models for new requests.");
	});
}
async function refresh() {
	if (busy) return;
	busy = true;
	controls();
	try {
		await readSnapshot();
		render();
	} catch (error) {
		if (snapshot) message(String(error), true);
		else {
			panel.innerHTML = `<h1>Local Models</h1><p class="error" role="alert">${escape(error)}</p><button id="retry" type="button">Try again</button>`;
			document
				.getElementById("retry")
				?.addEventListener("click", () => void refresh());
		}
	} finally {
		busy = false;
		controls();
	}
}
function showInstallation() {
	const element = document.getElementById("installation"),
		setup = snapshot?.installation;
	if (!element || !setup) return;
	if (!setup.active) {
		element.textContent =
			setup.error ??
			(setup.phase === "ready" ? "Model installed and verified." : "");
		element.classList.toggle("error", Boolean(setup.error));
		return;
	}
	element.classList.remove("error");
	if (!element.querySelector("progress")) {
		element.innerHTML =
			'<p></p><progress aria-label="Model download"></progress><span></span><button type="button" id="cancel-install">Cancel download</button>';
		document.getElementById("cancel-install")?.addEventListener(
			"click",
			() =>
				void operation(async () => {
					await studioPlugin.call("action", "cancel-install", {});
					await readSnapshot();
				}),
		);
	}
	const label = element.querySelector("p"),
		progress = element.querySelector("progress"),
		amount = element.querySelector("span");
	if (label)
		label.textContent = `${snapshot?.models.find((model) => model.id === setup.model)?.name ?? setup.model} · ${setup.phase}`;
	if (progress) {
		progress.max = Math.max(1, setup.total);
		progress.value = setup.completed;
	}
	if (amount)
		amount.textContent = `${(setup.completed / 1e9).toFixed(2)} / ${(setup.total / 1e9).toFixed(2)} GB`;
}
async function applyTheme() {
	const version = ++themeVersion;
	try {
		const context = await studioPlugin.call("context");
		if (version !== themeVersion) return;
		const theme = context?.theme;
		if (
			!theme ||
			![theme.background, theme.foreground, theme.accent].every(
				(value) => typeof value === "string" && CSS.supports("color", value),
			)
		)
			return;
		const style = document.documentElement.style;
		style.setProperty("--background", theme.background);
		style.setProperty("--foreground", theme.foreground);
		style.setProperty("--accent", theme.accent);
		// Canvas resolves any CSS color the host supports before choosing native control appearance.
		const canvas = document.createElement("canvas").getContext("2d");
		if (canvas) {
			canvas.fillStyle = theme.background;
			const color = String(canvas.fillStyle);
			const rgb = /^#([a-f\d]{6})$/i.exec(color);
			if (rgb) {
				const value = Number.parseInt(rgb[1] ?? "0", 16);
				document.documentElement.style.colorScheme =
					(value >> 16) + ((value >> 8) & 255) + (value & 255) > 384
						? "light"
						: "dark";
			}
		}
	} catch {
		/* Older hosts keep the neutral fallback palette. */
	}
}
void applyTheme();
studioPlugin.onContextChanged?.(() => void applyTheme());
panel.innerHTML =
	'<p class="loading" role="status" aria-busy="true">Loading models…</p>';
void refresh();
const poll = setInterval(() => {
	if (!snapshot || document.hidden || busy || polling) return;
	polling = true;
	const version = readVersion;
	void studioPlugin
		.call("action", "activity", {})
		.then(async (activity: Pick<Snapshot, "execution" | "installation">) => {
			if (!snapshot || busy || version !== readVersion) return;
			const settled =
				(snapshot.installation.active && !activity.installation.active) ||
				(snapshot.execution.active && !activity.execution.active);
			snapshot.execution = activity.execution;
			snapshot.installation = activity.installation;
			if (settled) {
				await readSnapshot();
				if (!busy) render();
				return;
			}
			const current = document.getElementById("execution-state");
			const nextExecution = execution();
			if (current && current.outerHTML !== nextExecution)
				current.outerHTML = nextExecution;
			showInstallation();
			controls();
		})
		.catch(() => {})
		.finally(() => {
			polling = false;
		});
}, 1500);
window.addEventListener("pagehide", () => clearInterval(poll), { once: true });
