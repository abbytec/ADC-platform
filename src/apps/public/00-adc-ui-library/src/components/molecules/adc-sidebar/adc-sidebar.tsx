import { Component, Prop, h, Event, EventEmitter, State, Element } from "@stencil/core";

export interface SidebarItem {
	label: string;
	icon?: any;
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

	@State() activeItem: string | null = null;

	@Element() el!: HTMLElement;

	@Event() adcSidebarItemClick!: EventEmitter<SidebarItem>;

	private handleItemClick = (item: SidebarItem) => {
		this.activeItem = item.label;
		this.adcSidebarItemClick.emit(item);
	};

	render() {
		void h;
		const sidebarClass = this.collapsed ? "w-20" : "w-64";
		const uuid = crypto.randomUUID();

		return (
			<aside
				class={`fixed left-0 top-0 h-screen bg-primary text-tprimary transition-all duration-300 shadow-lg z-40 ${sidebarClass}`}
				role="complementary"
			>
				{/* Header */}
				<div class="px-4 py-6 border-b border-accent">{!this.collapsed && <h2 class="text-lg font-bold">Menu</h2>}</div>

				{/* Items */}
				<nav class="flex flex-col gap-2 p-4">
					{this.items.map((item, index) => (
						<div key={uuid + "-item-" + index}>
							{item.to ? (
								<a
									href={item.to}
									class={`flex items-center gap-3 px-4 py-3 rounded transition-colors ${
										this.activeItem === item.label
											? "bg-accent text-accent-content"
											: "hover:bg-accent hover:text-accent-content"
									}`}
									role="menuitem"
									onClick={() => this.handleItemClick(item)}
									title={this.collapsed ? item.label : ""}
								>
									{item.icon && <span class="flex-shrink-0">{item.icon}</span>}
									{!this.collapsed && (
										<span class="flex-1 flex items-center justify-between">
											{item.label}
											{item.badge && <span class="badge badge-sm">{item.badge}</span>}
										</span>
									)}
								</a>
							) : (
								<button
									type="button"
									class={`flex w-full items-center gap-3 px-4 py-3 rounded transition-colors ${
										this.activeItem === item.label
											? "bg-accent text-accent-content"
											: "hover:bg-accent hover:text-accent-content"
									}`}
									role="menuitem"
									onClick={() => this.handleItemClick(item)}
									title={this.collapsed ? item.label : ""}
								>
									{item.icon && <span class="flex-shrink-0">{item.icon}</span>}
									{!this.collapsed && (
										<span class="flex-1 flex items-center justify-between">
											{item.label}
											{item.badge && <span class="badge badge-sm">{item.badge}</span>}
										</span>
									)}
								</button>
							)}
						</div>
					))}
				</nav>
			</aside>
		);
	}
}
