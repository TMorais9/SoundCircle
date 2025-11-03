import styles from "./Header.module.css";

function Header() {
    const scrollToTop = () => {
        window.scrollTo({
            top: 0,
            behavior: "smooth",
        });
    };

    return (
        <header className={styles.glassHeader}>
            <a id="logo-link" href="#"
                onClick={(e) => {
                    e.preventDefault();
                    scrollToTop();
                }}
            >
                <img
                    className={styles.logoImg}
                    src="/sound_circle_white.png"
                    alt="SoundCircle logo"
                />
            </a>
        </header>
    );
}

export default Header;
