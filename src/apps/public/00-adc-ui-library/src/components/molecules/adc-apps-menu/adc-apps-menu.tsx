import { Component, Prop, State, Element, h, Host, Listen } from "@stencil/core";
import { IS_DEV } from "../../../utils/url.js";

export interface AppMenuItem {
	id: string;
	name: string;
	url: string;
	icon?: string;
}

const host = () => globalThis.location?.hostname ?? "localhost";
const proto = () => globalThis.location?.protocol ?? "http:";

function appUrl(devPort: number, prodHostname: string): string {
	return IS_DEV ? `${proto()}//${host()}:${devPort}` : `${proto()}//${prodHostname}`;
}

/** Icon tag name from app id: "community" → "adc-icon-app-community" */
function iconTag(id: string): string {
	return `adc-icon-app-${id}`;
}

/** Built-in app definitions */
const DEFAULT_APPS: AppMenuItem[] = [
	{ id: "community", name: "Community", url: appUrl(3010, "s-community.adigitalcafe.com") },
	{ id: "identity", name: "Identity", url: appUrl(3014, "identity.adigitalcafe.com") },
];

@Component({
	tag: "adc-apps-menu",
	styleUrl: "adc-apps-menu.css",
	shadow: true,
})
export class AdcAppsMenu {
	@Element() el!: HTMLElement;

	/** Override default apps list (JSON array of AppMenuItem) */
	@Prop() apps?: string;

	@State() open = false;

	private get appList(): AppMenuItem[] {
		if (this.apps) {
			try {
				return JSON.parse(this.apps);
			} catch {
				return DEFAULT_APPS;
			}
		}
		return DEFAULT_APPS;
	}

	@Listen("mousedown", { target: "document" })
	handleOutsideClick(e: MouseEvent) {
		if (this.open && !this.el.contains(e.target as Node)) {
			this.open = false;
		}
	}

	private readonly toggle = () => {
		this.open = !this.open;
	};

	private readonly isCurrent = (url: string): boolean => {
		const origin = globalThis.location?.origin;
		return origin === url || origin + "/" === url + "/";
	};

	render() {
		const apps = this.appList;

		return (
			<Host>
				<button class="apps-trigger" onClick={this.toggle} aria-label="Apps" aria-expanded={String(this.open)} title="Apps">
					<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" width="20" height="20">
						<circle cx="6" cy="6" r="1.8" />
						<circle cx="12" cy="6" r="1.8" />
						<circle cx="18" cy="6" r="1.8" />
						<circle cx="6" cy="12" r="1.8" />
						<circle cx="12" cy="12" r="1.8" />
						<circle cx="18" cy="12" r="1.8" />
						<circle cx="6" cy="18" r="1.8" />
						<circle cx="12" cy="18" r="1.8" />
						<circle cx="18" cy="18" r="1.8" />
					</svg>
				</button>

				{this.open && (
					<div class="apps-dropdown">
						{apps.map((app) => {
							const IconTag = iconTag(app.id);
							return (
								<a key={app.id} href={app.url} class="app-link" {...(this.isCurrent(app.url) ? { "data-active": "" } : {})}>
									<IconTag size="1.75rem"></IconTag>
									<span class="app-label">{app.name}</span>
								</a>
							);
						})}
					</div>
				)}
			</Host>
		);
	}
}
