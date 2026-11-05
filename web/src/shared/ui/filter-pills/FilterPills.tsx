import { useITAppearance, ITText } from "@axzydev/axzy_ui_system";
import { TabBar, type TabBarItem } from "../tab-bar";

export type FilterPillItem<T extends string> = Pick<TabBarItem<T>, "id" | "label" | "count" | "icon">;

interface Props<T extends string> {
  items: readonly FilterPillItem<T>[];
  value: T;
  onChange: (id: T) => void;
  className?: string;
}

/**
 * Filtros en píldora (listas, reportes, feeds). En bento reutiliza `TabBar`
 * (neutras y la activa en tinta, mismos tokens); en flat/soft es un control
 * segmentado neutro con la opción activa elevada.
 */
export default function FilterPills<T extends string>({ items, value, onChange, className = "" }: Props<T>) {
  const bento = useITAppearance() === "bento";

  if (bento) {
    return (
      <div className={className}>
        <TabBar items={items} value={value} onChange={onChange} size="sm" />
      </div>
    );
  }

  return (
    <div
      role="group"
      className={`inline-flex max-w-full gap-0.5 overflow-x-auto rounded-full bg-slate-100 p-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden ${className}`}
    >
      {items.map((item) => {
        const active = item.id === value;
        return (
          <button
            key={item.id}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(item.id)}
            className={`flex shrink-0 cursor-pointer items-center gap-1.5 rounded-full !border-0 px-3 py-1.5 text-[12px] font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--color-primary)] ${
              active ? "!bg-white !text-slate-800 shadow-sm" : "!bg-transparent !text-slate-500 hover:!text-slate-700"
            }`}
          >
            {item.icon}
            {item.label}
            {item.count !== undefined && <ITText as="span" className="text-[10px] tabular-nums opacity-70">{item.count}</ITText>}
          </button>
        );
      })}
    </div>
  );
}
