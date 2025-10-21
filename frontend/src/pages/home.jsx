import Header from "../components/Header";
import Menu from "../components/Menu";
import styles from "./Home.module.css";
import { useNavigate } from "react-router-dom";

function Home() {
    const navigate = useNavigate();

    const handleProfileClick = () => {
        navigate("/info");
    };
    return (
        <>
            <Header />
            <section className={styles.cardSection}>
                <div className={styles.card}>
                    <div className={styles.cardBorderTop}></div>
                    <div className={styles.person}>
                        <img src="https://upload.wikimedia.org/wikipedia/commons/8/89/Portrait_Placeholder.png" alt="Foto de Perfil" />
                    </div>
                    <div className={styles.cardInfo}>
                        <span className={styles.name}>Miguel Dias</span>
                        <div className={styles.infoDetails}>
                            <span className={styles.job}>Guitarrista, 21 anos</span>
                        </div>
                    </div>
                    <button onClick={handleProfileClick}>Ver Perfil</button>
                </div>

                <div className={styles.card}>
                    <div className={styles.cardBorderTop}></div>
                    <div className={styles.person}>
                        <img src="https://upload.wikimedia.org/wikipedia/commons/8/89/Portrait_Placeholder.png" alt="Foto de Perfil" />
                    </div>
                    <div className={styles.cardInfo}>
                        <span className={styles.name}>Miguel Dias</span>
                        <div className={styles.infoDetails}>
                            <span className={styles.job}>Guitarrista, 21 anos</span>
                        </div>
                    </div>
                    <button onClick={handleProfileClick}>Ver Perfil</button>
                </div>

                <div className={styles.card}>
                    <div className={styles.cardBorderTop}></div>
                    <div className={styles.person}>
                        <img src="https://upload.wikimedia.org/wikipedia/commons/8/89/Portrait_Placeholder.png" alt="Foto de Perfil" />
                    </div>
                    <div className={styles.cardInfo}>
                        <span className={styles.name}>Miguel Dias</span>
                        <div className={styles.infoDetails}>
                            <span className={styles.job}>Guitarrista, 21 anos</span>
                        </div>
                    </div>
                    <button onClick={handleProfileClick}>Ver Perfil</button>
                </div>

                <div className={styles.card}>
                    <div className={styles.cardBorderTop}></div>
                    <div className={styles.person}>
                        <img src="https://upload.wikimedia.org/wikipedia/commons/8/89/Portrait_Placeholder.png" alt="Foto de Perfil" />
                    </div>
                    <div className={styles.cardInfo}>
                        <span className={styles.name}>Miguel Dias</span>
                        <div className={styles.infoDetails}>
                            <span className={styles.job}>Guitarrista, 21 anos</span>
                        </div>
                    </div>
                    <button onClick={handleProfileClick}>Ver Perfil</button>
                </div>

                                <div className={styles.card}>
                    <div className={styles.cardBorderTop}></div>
                    <div className={styles.person}>
                        <img src="https://upload.wikimedia.org/wikipedia/commons/8/89/Portrait_Placeholder.png" alt="Foto de Perfil" />
                    </div>
                    <div className={styles.cardInfo}>
                        <span className={styles.name}>Miguel Dias</span>
                        <div className={styles.infoDetails}>
                            <span className={styles.job}>Guitarrista, 21 anos</span>
                        </div>
                    </div>
                    <button onClick={handleProfileClick}>Ver Perfil</button>
                </div>

                <div className={styles.card}>
                    <div className={styles.cardBorderTop}></div>
                    <div className={styles.person}>
                        <img src="https://upload.wikimedia.org/wikipedia/commons/8/89/Portrait_Placeholder.png" alt="Foto de Perfil" />
                    </div>
                    <div className={styles.cardInfo}>
                        <span className={styles.name}>Miguel Dias</span>
                        <div className={styles.infoDetails}>
                            <span className={styles.job}>Guitarrista, 21 anos</span>
                        </div>
                    </div>
                    <button onClick={handleProfileClick}>Ver Perfil</button>
                </div>

                <div className={styles.card}>
                    <div className={styles.cardBorderTop}></div>
                    <div className={styles.person}>
                        <img src="https://upload.wikimedia.org/wikipedia/commons/8/89/Portrait_Placeholder.png" alt="Foto de Perfil" />
                    </div>
                    <div className={styles.cardInfo}>
                        <span className={styles.name}>Miguel Dias</span>
                        <div className={styles.infoDetails}>
                            <span className={styles.job}>Guitarrista, 21 anos</span>
                        </div>
                    </div>
                    <button onClick={handleProfileClick}>Ver Perfil</button>
                </div>

                <div className={styles.card}>
                    <div className={styles.cardBorderTop}></div>
                    <div className={styles.person}>
                        <img src="https://upload.wikimedia.org/wikipedia/commons/8/89/Portrait_Placeholder.png" alt="Foto de Perfil" />
                    </div>
                    <div className={styles.cardInfo}>
                        <span className={styles.name}>Miguel Dias</span>
                        <div className={styles.infoDetails}>
                            <span className={styles.job}>Guitarrista, 21 anos</span>
                        </div>
                    </div>
                    <button onClick={handleProfileClick}>Ver Perfil</button>
                </div>

                                <div className={styles.card}>
                    <div className={styles.cardBorderTop}></div>
                    <div className={styles.person}>
                        <img src="https://upload.wikimedia.org/wikipedia/commons/8/89/Portrait_Placeholder.png" alt="Foto de Perfil" />
                    </div>
                    <div className={styles.cardInfo}>
                        <span className={styles.name}>Miguel Dias</span>
                        <div className={styles.infoDetails}>
                            <span className={styles.job}>Guitarrista, 21 anos</span>
                        </div>
                    </div>
                    <button onClick={handleProfileClick}>Ver Perfil</button>
                </div>

                <div className={styles.card}>
                    <div className={styles.cardBorderTop}></div>
                    <div className={styles.person}>
                        <img src="https://upload.wikimedia.org/wikipedia/commons/8/89/Portrait_Placeholder.png" alt="Foto de Perfil" />
                    </div>
                    <div className={styles.cardInfo}>
                        <span className={styles.name}>Miguel Dias</span>
                        <div className={styles.infoDetails}>
                            <span className={styles.job}>Guitarrista, 21 anos</span>
                        </div>
                    </div>
                    <button onClick={handleProfileClick}>Ver Perfil</button>
                </div>

                <div className={styles.card}>
                    <div className={styles.cardBorderTop}></div>
                    <div className={styles.person}>
                        <img src="https://upload.wikimedia.org/wikipedia/commons/8/89/Portrait_Placeholder.png" alt="Foto de Perfil" />
                    </div>
                    <div className={styles.cardInfo}>
                        <span className={styles.name}>Miguel Dias</span>
                        <div className={styles.infoDetails}>
                            <span className={styles.job}>Guitarrista, 21 anos</span>
                        </div>
                    </div>
                    <button onClick={handleProfileClick}>Ver Perfil</button>
                </div>

                <div className={styles.card}>
                    <div className={styles.cardBorderTop}></div>
                    <div className={styles.person}>
                        <img src="https://upload.wikimedia.org/wikipedia/commons/8/89/Portrait_Placeholder.png" alt="Foto de Perfil" />
                    </div>
                    <div className={styles.cardInfo}>
                        <span className={styles.name}>Miguel Dias</span>
                        <div className={styles.infoDetails}>
                            <span className={styles.job}>Guitarrista, 21 anos</span>
                        </div>
                    </div>
                    <button onClick={handleProfileClick}>Ver Perfil</button>
                </div>

                                <div className={styles.card}>
                    <div className={styles.cardBorderTop}></div>
                    <div className={styles.person}>
                        <img src="https://upload.wikimedia.org/wikipedia/commons/8/89/Portrait_Placeholder.png" alt="Foto de Perfil" />
                    </div>
                    <div className={styles.cardInfo}>
                        <span className={styles.name}>Miguel Dias</span>
                        <div className={styles.infoDetails}>
                            <span className={styles.job}>Guitarrista, 21 anos</span>
                        </div>
                    </div>
                    <button onClick={handleProfileClick}>Ver Perfil</button>
                </div>

                <div className={styles.card}>
                    <div className={styles.cardBorderTop}></div>
                    <div className={styles.person}>
                        <img src="https://upload.wikimedia.org/wikipedia/commons/8/89/Portrait_Placeholder.png" alt="Foto de Perfil" />
                    </div>
                    <div className={styles.cardInfo}>
                        <span className={styles.name}>Miguel Dias</span>
                        <div className={styles.infoDetails}>
                            <span className={styles.job}>Guitarrista, 21 anos</span>
                        </div>
                    </div>
                    <button onClick={handleProfileClick}>Ver Perfil</button>
                </div>

                <div className={styles.card}>
                    <div className={styles.cardBorderTop}></div>
                    <div className={styles.person}>
                        <img src="https://upload.wikimedia.org/wikipedia/commons/8/89/Portrait_Placeholder.png" alt="Foto de Perfil" />
                    </div>
                    <div className={styles.cardInfo}>
                        <span className={styles.name}>Miguel Dias</span>
                        <div className={styles.infoDetails}>
                            <span className={styles.job}>Guitarrista, 21 anos</span>
                        </div>
                    </div>
                    <button onClick={handleProfileClick}>Ver Perfil</button>
                </div>

                <div className={styles.card}>
                    <div className={styles.cardBorderTop}></div>
                    <div className={styles.person}>
                        <img src="https://upload.wikimedia.org/wikipedia/commons/8/89/Portrait_Placeholder.png" alt="Foto de Perfil" />
                    </div>
                    <div className={styles.cardInfo}>
                        <span className={styles.name}>Miguel Dias</span>
                        <div className={styles.infoDetails}>
                            <span className={styles.job}>Guitarrista, 21 anos</span>
                        </div>
                    </div>
                    <button onClick={handleProfileClick}>Ver Perfil</button>
                </div>
            </section>
            <Menu />
        </>
    );
}

export default Home;
