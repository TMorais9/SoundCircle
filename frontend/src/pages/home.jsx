import Header from "../components/Header";
import Menu from "../components/Menu";
import styles from "./Home.module.css";

function Home() {
    return (
        <>
            <Header />
            <section className={styles.cardSection}>
                <div className={styles.card}>
                    <div className={styles.cardBorderTop}></div>
                    <div className={styles.person}>
                        <img src="" alt="Foto de Perfil" />
                    </div>
                    <div className={styles.cardInfo}>
                        <span className={styles.name}>Miguel Dias</span>
                        <div className={styles.infoDetails}>
                            <span className={styles.job}>Guitarrista</span>
                            <span className={styles.age}>,21 anos</span>
                        </div>
                        <p className={styles.description}>A musica é o meu escape! </p>
                    </div>
                    <button>Ver Perfil</button>
                </div>
            </section>
            <Menu />
        </>
    );
}

export default Home;
