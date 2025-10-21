import styles from "./Header.module.css";

function Header() {
    return (
        <header className={styles.glassHeader}>
            <a id="logo-link" href="#">
                <img className={styles.logoImg} src="/soundcircle_logo.png" alt="SoundCircle logo" />
            </a>
        </header>
    );
}

export default Header;