import { useNavigate } from "react-router-dom";
import styles from "./Menu.module.css";

function Menu() {
    const navigate = useNavigate();

    return (
        <div className={styles.buttonContainer}>
            <button className={styles.button}>
                <span className="material-symbols-outlined">search</span>
            </button>

            <button className={styles.button} onClick={() => navigate("/conta")}>
                <span className="material-symbols-outlined">person</span>
            </button>

            <button className={styles.button} onClick={() => navigate("/")}>
                <span className="material-symbols-outlined">home</span>
            </button>

            <button className={styles.button} onClick={() => navigate("/messages")}>
                <span className="material-symbols-outlined">message</span>
            </button>

            <button className={styles.button} onClick={() => navigate("/ai")}>
                <span className="material-symbols-outlined">
                    network_intelligence
                </span>
            </button>
        </div>
    );
}

export default Menu;
