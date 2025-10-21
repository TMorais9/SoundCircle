import styles from "./Menu.module.css";

function Menu() {
    return (
        <div className={styles.buttonContainer}>
            <button className={styles.button}>
                <span className="material-symbols-outlined">home</span>
            </button>

            <button className={styles.button}>
                <span className="material-symbols-outlined">search</span>
            </button>

            <button className={styles.button}>
                <span className="material-symbols-outlined">person</span>
            </button>

            <button className={styles.button}>
                <span className="material-symbols-outlined">message</span>
            </button>

            <button className={styles.button}>
                <span className="material-symbols-outlined">
                    network_intelligence
                </span>
            </button>
        </div>
    );
}

export default Menu;
