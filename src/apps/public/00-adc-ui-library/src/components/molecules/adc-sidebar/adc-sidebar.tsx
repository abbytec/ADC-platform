import { Component, Prop, h, Event, EventEmitter, State, Element } from "@stencil/core";

export interface SidebarItem {
	label: string;
	iconSvg?: string;
	to?: string;
	action?: string;
	children?: SidebarItem[];
	badge?: string;
}

@Component({
	tag: "adc-sidebar",
	shadow: false,
})
export class AdcSidebar {
	@Prop() items: SidebarItem[] = [];
	@Prop() collapsed: boolean = false;
	@Prop() activeItem: string | null = null;

	@State() internalActiveItem: string | null = null;

	@Element() el!: HTMLElement;

	@Event() adcSidebarItemClick!: EventEmitter<SidebarItem>;

	private handleItemClick = (item: SidebarItem) => {
		this.adcSidebarItemClick.emit(item);
	};

	render() {
		const sidebarClass = this.collapsed ? "w-17 lg:w-64" : "w-64";

		return (
			<aside
				class={`fixed pt-5 left-0 top-auto h-full bg-background text-primary transition-all duration-300 shadow-[0_5px_20px_rgba(0,0,0,0.15)] overflow-hidden ${sidebarClass}`}
				role="complementary"
			>
				<nav class="flex flex-col gap-4 p-2">
					{this.items.map((item) => {
						return (
							<div key={item.label}>
								<a
									href={item.to}
									class={`flex gap-2 transition-all duration-300 py-3 rounded w-full items-center ${
										this.collapsed ? "justify-center px-0" : "justify-start gap-3 px-3"
									} ${this.activeItem === item.action ? "bg-primary text-tprimary" : "hover:bg-primary hover:text-tprimary"}`}
									onClick={() => this.handleItemClick(item)}
									title={this.collapsed ? item.label : ""}
								>
									{item.iconSvg && (
										<span
											class="flex items-center justify-center flex-shrink-0 w-adc-xl h-adc-xl"
											innerHTML={item.iconSvg}
										></span>
									)}

									<span
										class={`flex-1 overflow-hidden transition-all duration-300 ${this.collapsed ? "max-w-0 opacity-0" : "max-w-[160px] opacity-100"} lg:max-w-[160px] lg:opacity-100`}
									>
										<span class="text-left whitespace-nowrap">{item.label}</span>

										{item.badge && <span class="ml-auto badge badge-sm">{item.badge}</span>}
									</span>
								</a>
							</div>
						);
					})}
				</nav>
			</aside>
		);
	}
}
