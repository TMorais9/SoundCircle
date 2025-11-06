import { useNavigate } from "react-router-dom";
import { useState, useEffect } from "react";
import Header from "../components/Header";
import Menu from "../components/Menu";
import styles from "./Home.module.css";

function Home() {
    const navigate = useNavigate();
    const [fadeOut, setFadeOut] = useState(false);
    const [mostrarModal, setMostrarModal] = useState(false);
    const [naoMostrarNovamente, setNaoMostrarNovamente] = useState(false);
    const [paginaAtual, setPaginaAtual] = useState(0);

    useEffect(() => {
        const skipModal = localStorage.getItem("skipInfoModal");
        const isLoggedIn = localStorage.getItem("isLoggedIn");
        if (!isLoggedIn && !skipModal) setMostrarModal(true);
    }, []);

    const handleProfileClick = () => {
        setFadeOut(true);
        setTimeout(() => navigate("/info"), 300);
    };

    const fecharModal = () => {
        if (naoMostrarNovamente) {
            localStorage.setItem("skipInfoModal", "true");
        }
        setMostrarModal(false);
    };

    const paginas = [
        {
            titulo: "Bem-vindo ao SoundCircle 🎵",
            texto:
                "Liga-te a outros músicos, descobre novos estilos e colabora em projetos criativos. O SoundCircle é o teu espaço para expandir a tua rede musical e encontrar oportunidades únicas.",
            imagem: "/banner.png",
        },
        {
            titulo: "Explora Músicos e Perfis 👥",
            texto:
                "Na página inicial, encontras músicos recomendados com base no teu perfil. Clica em 'Ver Perfil' para conhecer mais sobre o artista, o instrumento que toca e o seu estilo musical.",
            imagem: "/banner.png",
        },
        {
            titulo: "Perfil e Características 🎸",
            texto:
                "Cada músico tem um espaço personalizado com a sua história, talentos e características únicas. Essas tags ajudam-te a encontrar pessoas com quem tenhas mais afinidade musical.",
            imagem: "/banner.png",
        },
        {
            titulo: "Mensagens e Colaboração 💬",
            texto:
                "Usa o chat integrado para conversar, planear ensaios ou partilhar ideias criativas. Podes trocar mensagens diretamente com outros artistas e fortalecer a tua rede de contactos.",
            imagem: "/banner.png",
        },
        {
            titulo: "A tua IA Musical 🤖",
            texto:
                "O SoundCircle inclui uma assistente virtual inteligente que aprende com as tuas características musicais. Ela sugere músicos compatíveis, ideias criativas e até colaborações ideais!",
            imagem: "/banner.png",
        },
    ];

    const proximaPagina = () => {
        if (paginaAtual < paginas.length - 1) setPaginaAtual(paginaAtual + 1);
        else fecharModal();
    };

    const anteriorPagina = () => {
        if (paginaAtual > 0) setPaginaAtual(paginaAtual - 1);
    };

    const saltarTutorial = () => {
        setMostrarModal(false);
        if (naoMostrarNovamente) {
            localStorage.setItem("skipInfoModal", "true");
        }
    };

    return (
        <>
            <Header />
            <section
                className={`${styles.cardSection} ${fadeOut ? styles.fadeOut : ""}`}>
                <div className={styles.card}>
                    <div className={styles.cardBorderTop}></div>
                    <div className={styles.person}>
                        <img
                            src="https://upload.wikimedia.org/wikipedia/commons/8/89/Portrait_Placeholder.png"
                            alt="Foto de Perfil"
                        />
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
                        <img
                            src="https://upload.wikimedia.org/wikipedia/commons/8/89/Portrait_Placeholder.png"
                            alt="Foto de Perfil"
                        />
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
                        <img
                            src="https://upload.wikimedia.org/wikipedia/commons/8/89/Portrait_Placeholder.png"
                            alt="Foto de Perfil"
                        />
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
                        <img
                            src="https://upload.wikimedia.org/wikipedia/commons/8/89/Portrait_Placeholder.png"
                            alt="Foto de Perfil"
                        />
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
                        <img
                            src="https://upload.wikimedia.org/wikipedia/commons/8/89/Portrait_Placeholder.png"
                            alt="Foto de Perfil"
                        />
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
                        <img
                            src="https://upload.wikimedia.org/wikipedia/commons/8/89/Portrait_Placeholder.png"
                            alt="Foto de Perfil"
                        />
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
                        <img
                            src="https://upload.wikimedia.org/wikipedia/commons/8/89/Portrait_Placeholder.png"
                            alt="Foto de Perfil"
                        />
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
                        <img
                            src="https://upload.wikimedia.org/wikipedia/commons/8/89/Portrait_Placeholder.png"
                            alt="Foto de Perfil"
                        />
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
                        <img
                            src="https://upload.wikimedia.org/wikipedia/commons/8/89/Portrait_Placeholder.png"
                            alt="Foto de Perfil"
                        />
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
                        <img
                            src="https://upload.wikimedia.org/wikipedia/commons/8/89/Portrait_Placeholder.png"
                            alt="Foto de Perfil"
                        />
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
                        <img
                            src="https://upload.wikimedia.org/wikipedia/commons/8/89/Portrait_Placeholder.png"
                            alt="Foto de Perfil"
                        />
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
                        <img
                            src="https://upload.wikimedia.org/wikipedia/commons/8/89/Portrait_Placeholder.png"
                            alt="Foto de Perfil"
                        />
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
                        <img
                            src="https://upload.wikimedia.org/wikipedia/commons/8/89/Portrait_Placeholder.png"
                            alt="Foto de Perfil"
                        />
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
                        <img
                            src="https://upload.wikimedia.org/wikipedia/commons/8/89/Portrait_Placeholder.png"
                            alt="Foto de Perfil"
                        />
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
                        <img
                            src="https://upload.wikimedia.org/wikipedia/commons/8/89/Portrait_Placeholder.png"
                            alt="Foto de Perfil"
                        />
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
                        <img
                            src="https://upload.wikimedia.org/wikipedia/commons/8/89/Portrait_Placeholder.png"
                            alt="Foto de Perfil"
                        />
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
            {mostrarModal && (
                <div className={styles.modalOverlay}>
                    <div className={styles.tutorialModal}>
                        <div className={styles.modalLeft}>
                            <img
                                src={paginas[paginaAtual].imagem}
                                alt="Ilustração do tutorial"
                            />
                        </div>

                        <div className={styles.modalRight}>
                            <h2>{paginas[paginaAtual].titulo}</h2>
                            <p>{paginas[paginaAtual].texto}</p>

                            <div className={styles.checkboxArea}>
                                <label>
                                    <input
                                        type="checkbox"
                                        checked={naoMostrarNovamente}
                                        onChange={(e) =>
                                            setNaoMostrarNovamente(e.target.checked)
                                        }
                                    />
                                    Não mostrar novamente
                                </label>
                            </div>

                            <div className={styles.modalFooter}>
                                <div className={styles.modalButtons}>
                                    {paginaAtual > 0 && (
                                        <button className={styles.secondaryButton} onClick={anteriorPagina}>
                                            Anterior
                                        </button>
                                    )}
                                    {paginaAtual < paginas.length - 1 ? (
                                        <button className={styles.primaryButton} onClick={proximaPagina}>
                                            Próximo
                                        </button>
                                    ) : (
                                        <button className={styles.primaryButton} onClick={fecharModal}>
                                            Concluir
                                        </button>
                                    )}
                                    <button className={styles.skipButton} onClick={saltarTutorial}>
                                        Saltar <span className="material-symbols-outlined">arrow_forward</span>
                                    </button>
                                </div>
                            </div>

                        </div>
                    </div>
                </div>
            )}
        </>
    );
}

export default Home;
