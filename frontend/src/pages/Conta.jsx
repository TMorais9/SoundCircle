import { useState } from "react";
import { useNavigate } from "react-router-dom";
import Header from "../components/Header";
import Menu from "../components/Menu";
import styles from "./Conta.module.css";

function Conta() {
    const navigate = useNavigate();
    const [modoEdicao, setModoEdicao] = useState(false);
    const [mostrarLogin, setMostrarLogin] = useState(false);

    const [perfil, setPerfil] = useState({
        nome: "Miguel Dias",
        idade: 21,
        instrumento: "Guitarra",
        anosExperiencia: 7,
        descricao:
            "Músico apaixonado por sonoridades modernas e clássicas. Atua em concertos locais e colaborações criativas. O seu estilo combina influências do jazz, rock e música tradicional portuguesa.",
        foto: "https://upload.wikimedia.org/wikipedia/commons/8/89/Portrait_Placeholder.png",
    });

    const [perfilOriginal, setPerfilOriginal] = useState(perfil);
    const [caracteristicas, setCaracteristicas] = useState([
        "Extrovertido",
        "Criativo",
        "Dedicado",
    ]);
    const [caracteristicasOriginais, setCaracteristicasOriginais] = useState(caracteristicas);


    const [mostrarOpcoes, setMostrarOpcoes] = useState(false);

    const opcoesPredefinidas = [
        "Criativo",
        "Disciplinado",
        "Comunicativo",
        "Empático",
        "Perfeccionista",
        "Colaborativo",
        "Inovador",
        "Pontual",
        "Motivado",
        "Resiliente",
        "Amigável",
        "Líder nato",
    ];

    const handleAddTrait = (trait) => {
        if (!caracteristicas.includes(trait)) {
            setCaracteristicas([...caracteristicas, trait]);
        }
        setMostrarOpcoes(false);
    };

    const handleRemoveTrait = (trait) => {
        setCaracteristicas(caracteristicas.filter((t) => t !== trait));
    };

    const handleEditChange = (campo, valor) => {
        setPerfil({ ...perfil, [campo]: valor });
    };

    const handleToggleEdicao = () => {
        if (modoEdicao) {
            setPerfilOriginal(perfil);
            setCaracteristicasOriginais(caracteristicas);
        } else {
            setPerfilOriginal(perfil);
            setCaracteristicasOriginais(caracteristicas);
        }
        setModoEdicao(!modoEdicao);
        setMostrarOpcoes(false);
    };

    const handleCancelar = () => {
        setPerfil(perfilOriginal);
        setCaracteristicas(caracteristicasOriginais);
        setModoEdicao(false);
        setMostrarOpcoes(false);
    };

    const handleSignOut = () => {
        // Limpa perfil e características
        setPerfil({
            nome: "",
            idade: "",
            instrumento: "",
            anosExperiencia: "",
            descricao: "",
            foto: "https://upload.wikimedia.org/wikipedia/commons/8/89/Portrait_Placeholder.png",
        });
        setCaracteristicas([]);
        // Mostra o modal de login
        setMostrarLogin(true);
    };

    const handleLogin = () => {
        // Fechar modal e simular login
        setMostrarLogin(false);
        setPerfil({
            nome: "Miguel Dias",
            idade: 21,
            instrumento: "Guitarra",
            anosExperiencia: 7,
            descricao:
                "Músico apaixonado por sonoridades modernas e clássicas. Atua em concertos locais e colaborações criativas.",
            foto: "https://upload.wikimedia.org/wikipedia/commons/8/89/Portrait_Placeholder.png",
        });
        setCaracteristicas(["Extrovertido", "Criativo", "Dedicado"]);
    };

    return (
        <>
            <Header />
            <main className={styles.infoPage}>
                <button
                    className={styles.backButton}
                    onClick={() => navigate("/")}
                    aria-label="Voltar à Home"
                >
                    <span className="material-symbols-outlined">arrow_back</span>
                </button>

                <div className={styles.profileContainer}>
                    <div className={styles.leftSection}>
                        <div className={styles.photoWrapper}>
                            <img
                                className={styles.photo}
                                src={perfil.foto}
                                alt={`Foto de ${perfil.nome}`}
                            />
                            {modoEdicao && (
                                <div className={styles.photoButtons}>
                                    <button
                                        className={styles.removePhotoButton}
                                        onClick={() =>
                                            setPerfil({
                                                ...perfil,
                                                foto: "https://upload.wikimedia.org/wikipedia/commons/8/89/Portrait_Placeholder.png",
                                            })
                                        }
                                    >
                                        <span className="material-symbols-outlined">delete</span>
                                    </button>

                                    <label htmlFor="fotoInput" className={styles.editPhotoLabel}>
                                        <span className="material-symbols-outlined">photo_camera</span>
                                        <input
                                            id="fotoInput"
                                            type="file"
                                            accept="image/*"
                                            className={styles.fileInput}
                                            onChange={(e) => {
                                                const file = e.target.files[0];
                                                if (file) {
                                                    const reader = new FileReader();
                                                    reader.onloadend = () => {
                                                        setPerfil({ ...perfil, foto: reader.result });
                                                    };
                                                    reader.readAsDataURL(file);
                                                }
                                            }}
                                        />
                                    </label>
                                </div>
                            )}
                        </div>

                        {modoEdicao ? (
                            <>
                                <input
                                    className={styles.inputText}
                                    value={perfil.nome}
                                    onChange={(e) => handleEditChange("nome", e.target.value)}
                                />
                                <input
                                    className={styles.inputText}
                                    value={perfil.idade}
                                    onChange={(e) => handleEditChange("idade", e.target.value)}
                                    type="number"
                                />
                                <input
                                    className={styles.inputText}
                                    value={perfil.instrumento}
                                    onChange={(e) => handleEditChange("instrumento", e.target.value)}
                                />
                                <input
                                    className={styles.inputText}
                                    value={perfil.anosExperiencia}
                                    onChange={(e) => handleEditChange("anosExperiencia", e.target.value)}
                                    type="number"
                                />
                            </>
                        ) : (
                            <>
                                <h1 className={styles.name}>{perfil.nome}</h1>
                                <p className={styles.basicInfo}>
                                    {perfil.idade} anos · {perfil.instrumento}
                                </p>
                                <p className={styles.experience}>
                                    A tocar há {perfil.anosExperiencia} anos
                                </p>
                            </>
                        )}
                    </div>


                    <div className={styles.description}>
                        <h2>Sobre</h2>
                        {modoEdicao ? (
                            <textarea
                                className={styles.inputArea}
                                value={perfil.descricao}
                                onChange={(e) => handleEditChange("descricao", e.target.value)}
                            />
                        ) : (
                            <p>{perfil.descricao}</p>
                        )}

                        <div className={styles.editButtonArea}>
                            {modoEdicao ? (
                                <>
                                    <button
                                        className={`${styles.editButton} ${styles.active}`}
                                        onClick={handleToggleEdicao}
                                    >
                                        Guardar
                                    </button>
                                    <button
                                        className={styles.cancelButton}
                                        onClick={handleCancelar}
                                    >
                                        Cancelar
                                    </button>
                                </>
                            ) : (
                                <button
                                    className={styles.editButton}
                                    onClick={handleToggleEdicao}
                                >
                                    Editar Perfil
                                </button>
                            )}
                        </div>

                    </div>
                </div>

                <section className={styles.traitsSection}>
                    <div className={styles.traitsGrid}>
                        {caracteristicas.map((trait, index) => (
                            <div key={index} className={styles.traitCard}>
                                <span>{trait}</span>
                                {modoEdicao && (
                                    <button
                                        className={styles.removeButton}
                                        onClick={() => handleRemoveTrait(trait)}
                                    >
                                        ✕
                                    </button>
                                )}
                            </div>
                        ))}

                        {modoEdicao && (
                            <button
                                className={`${styles.addButton} ${mostrarOpcoes ? styles.addButtonActive : ""
                                    }`}
                                onClick={() => setMostrarOpcoes(!mostrarOpcoes)}
                            >
                                <span className="material-symbols-outlined">
                                    {mostrarOpcoes ? "close" : "add"}
                                </span>
                            </button>
                        )}
                    </div>

                    {mostrarOpcoes && modoEdicao && (
                        <div className={styles.traitOptions}>
                            {opcoesPredefinidas.map((opt, i) => (
                                <button
                                    key={i}
                                    className={styles.optionButton}
                                    onClick={() => handleAddTrait(opt)}
                                >
                                    {opt}
                                </button>
                            ))}
                        </div>
                    )}
                </section>

                <div className={styles.signOutArea}>
                    <button
                        className={styles.signOutButton}
                        onClick={handleSignOut}
                    >
                        <span className="material-symbols-outlined">logout</span>
                        Sair da Conta
                    </button>
                </div>
            </main>
            <Menu />

            {mostrarLogin && (
                <div className={styles.loginModalOverlay}>
                    <div className={styles.loginModal}>
                        <h2>Iniciar Sessão</h2>
                        <input
                            type="text"
                            placeholder="Email"
                            className={styles.loginInput}
                        />
                        <input
                            type="password"
                            placeholder="Password"
                            className={styles.loginInput}
                        />
                        <div className={styles.loginButtons}>
                            <button
                                className={styles.loginConfirm}
                                onClick={handleLogin}
                            >
                                Entrar
                            </button>
                            <button
                                className={styles.loginCancel}
                                onClick={() => setMostrarLogin(false)}
                            >
                                Cancelar
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}

export default Conta;