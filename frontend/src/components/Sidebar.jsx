import { NavLink, useNavigate } from "react-router-dom";
import styles from "./Sidebar.module.css";

const NAV_ITEMS = [
    { label: "Home", icon: "home", to: "/", end: true },
    { label: "Pesquisar", icon: "search", to: "/search" },
    { label: "Mensagens", icon: "forum", to: "/messages" },
    { label: "AI", icon: "network_intelligence", to: "/ai" },
    { label: "Conta", icon: "person", to: "/conta" },
];

function Sidebar() {
    const navigate = useNavigate();

    return (
        <aside className={styles.sidebar}>

            <button
                type="button"
                className={styles.logoArea}
                aria-label="SoundCircle"
            >
                <div className={`${styles.logo} ${styles.logoCollapsed}`}>
                    <img
                        src="/sound_circle_symbol.png"
                        alt="SoundCircle"
                        className={styles.logoImg}
                    />
                </div>
                <div className={`${styles.logo} ${styles.logoExpanded}`}>
                    <img
                        src="/sound_circle_white.png"
                        alt="SoundCircle"
                        className={`${styles.logoImg} ${styles.logoImgActive}`}
                    />
                </div>
            </button>

            <nav className={styles.nav} aria-label="Navegação principal">
                {NAV_ITEMS.map((item) => (
                    <NavLink
                        key={item.to}
                        to={item.to}
                        end={item.end}
                        className={({ isActive }) =>
                            `${styles.navItem} ${isActive ? styles.active : ""}`
                        }
                    >
                        <span
                            className={`material-symbols-outlined ${styles.navIcon}`}
                            aria-hidden="true"
                        >
                            {item.icon}
                        </span>
                        <span className={styles.navLabel}>{item.label}</span>
                    </NavLink>
                ))}
            </nav>

        </aside>
    );
}

export default Sidebar;
