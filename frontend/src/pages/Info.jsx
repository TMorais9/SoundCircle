import { useState } from "react";
import { useNavigate } from "react-router-dom";
import styles from "./Info.module.css";
import Header from "../components/Header";
import Menu from "../components/Menu";

function Info() {
    const navigate = useNavigate();
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [fadeOut, setFadeOut] = useState(false);
    
    const handleBack = () => {
        setFadeOut(true);
        setTimeout(() => {
            navigate("/");
        }, 500); // Duração da animação de fade-out
    };

    const person = {
        nome: "Miguel Dias",
        idade: 21,
        instrumento: "Guitarra",
        anosExperiencia: 7,
        descricao:
            "Músico apaixonado por sonoridades modernas e clássicas. Atua em concertos locais e colaborações criativas. O seu estilo combina influências do jazz, rock e música tradicional portuguesa, criando uma sonoridade envolvente e autêntica. Acredita que a música é uma ponte entre emoções e culturas, e está sempre à procura de novas oportunidades para partilhar essa paixão.",
        foto: "https://upload.wikimedia.org/wikipedia/commons/8/89/Portrait_Placeholder.png",
        caracteristicas: [
            "Extrovertido",
            "Experiente",
            "Criativo",
            "Colaborativo",
            "Apaixonado",
            "Dedicado",
            "Versátil",
            "Inovador",
        ],
    };

    return (
        <>
            <Header />
            <main
                className={`${styles.infoPage} ${fadeOut ? styles.fadeOut : ""}`}
            >
                <button
                    className={styles.backButton}
                    onClick={handleBack}
                    aria-label="Voltar à Home"
                >
                    <span className="material-symbols-outlined">arrow_back</span>
                </button>

                <div className={styles.profileContainer}>
                    <div className={styles.leftSection}>
                        <img
                            className={styles.photo}
                            src={person.foto}
                            alt={`Foto de ${person.nome}`}
                            onClick={() => setIsModalOpen(true)}
                        />
                        <h1 className={styles.name}>{person.nome}</h1>
                        <p className={styles.basicInfo}>
                            {person.idade} anos · {person.instrumento}
                        </p>
                        <p className={styles.experience}>
                            A tocar há {person.anosExperiencia} anos
                        </p>
                    </div>
                    <div className={styles.description}>
                        <h2>Sobre</h2>
                        <p>{person.descricao}</p>
                        <div className={styles.buttonArea}>
                            <button className={styles.messageButton}>
                                <span className="material-symbols-outlined">
                                    message
                                </span>
                            </button>
                        </div>
                    </div>
                </div>

                <section className={styles.traitsSection}>
                    <div className={styles.traitsGrid}>
                        {person.caracteristicas.map((trait, index) => (
                            <div key={index} className={styles.traitCard}>
                                <span>{trait}</span>
                            </div>
                        ))}
                    </div>
                </section>
            </main>
            <Menu />

            {isModalOpen && (
                <div
                    className={styles.modalOverlay}
                    onClick={() => setIsModalOpen(false)}
                >
                    <div
                        className={styles.modalContent}
                        onClick={(e) => e.stopPropagation()}
                    >
                        <button
                            className={styles.closeButton}
                            onClick={() => setIsModalOpen(false)}
                            aria-label="Fechar imagem"
                        >
                            ✕
                        </button>
                        <img
                            src={person.foto}
                            alt={`Foto de ${person.nome}`}
                            className={styles.modalImage}
                        />
                    </div>
                </div>
            )}
        </>
    );
}

export default Info;
