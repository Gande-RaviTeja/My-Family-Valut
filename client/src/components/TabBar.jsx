import { HomeIcon, VaultIcon, RupeeIcon, AIIcon, GroceryIcon, ProfileIcon } from "./icons.jsx";

const TABS = [
  { key: "dashboard", screen: "dashboard", label: "Home", Icon: HomeIcon },
  { key: "documents", screen: "profile", label: "Documents", Icon: VaultIcon },
  { key: "bills", screen: "expenses", label: "Bills", Icon: RupeeIcon },
  { key: "grocery", screen: "grocery", label: "Grocery", Icon: GroceryIcon },
  { key: "ai", screen: "ai", label: "Family AI", Icon: AIIcon },
  { key: "account", screen: "account", label: "Profile", Icon: ProfileIcon },
];

export default function TabBar({ active, onChange, variant = "bottom" }) {
  // Mobile bottom navigation: filter out "ai" to keep 5 clean tabs without crowding
  const displayTabs = variant === "bottom"
    ? TABS.filter((t) => t.key !== "ai")
    : TABS;

  return (
    <nav className={`tabbar tabbar-${variant}`}>
      {displayTabs.map(({ key, screen, label, Icon }) => (
        <button
          key={key}
          className={`tabbar-item${active === screen ? " active" : ""}`}
          onClick={() => onChange(screen)}
        >
          <Icon />
          <span>{label}</span>
        </button>
      ))}
    </nav>
  );
}
