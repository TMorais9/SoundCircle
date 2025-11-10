import { useState } from "react";
import { useNavigate } from "react-router-dom";
import Header from "../components/Header";
import Menu from "../components/Menu";
import styles from "./Conta.module.css";
import { useSignIn } from "react-auth-kit";
import { useSignOut } from "react-auth-kit";



function Conta() {
    const navigate = useNavigate();
    const [modoEdicao, setModoEdicao] = useState(false);
    const [mostrarLogin, setMostrarLogin] = useState(false);
    const [modoRegisto, setModoRegisto] = useState(false);
    const [mostrarPass, setMostrarPass] = useState(false);

    const [perfil, setPerfil] = useState({
        nome: "Miguel Dias",
        email: "miguel@email.com",
        idade: 21,
        instrumento: "Guitarra",
        anosExperiencia: 7,
        descricao:
            "Músico apaixonado por sonoridades modernas e clássicas. Atua em concertos locais e colaborações criativas. O seu estilo combina influências do jazz, rock e música tradicional portuguesa.",
        foto: "https://upload.wikimedia.org/wikipedia/commons/8/89/Portrait_Placeholder.png",
    });

    const [password, setPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");

    const [perfilOriginal, setPerfilOriginal] = useState(perfil);
    const [caracteristicas, setCaracteristicas] = useState(["Extrovertido", "Criativo", "Dedicado"]);
    const [caracteristicasOriginais, setCaracteristicasOriginais] = useState(caracteristicas);
    const [mostrarOpcoes, setMostrarOpcoes] = useState(false);

    const opcoesPredefinidas = [
        "Criativo", "Disciplinado", "Comunicativo", "Empático",
        "Perfeccionista", "Colaborativo", "Inovador", "Pontual",
        "Motivado", "Resiliente", "Amigável", "Líder nato",
    ];

    const validarEmail = (email) => /\S+@\S+\.\S+/.test(email);

    const handleAddTrait = (trait) => {
        if (!caracteristicas.includes(trait)) setCaracteristicas([...caracteristicas, trait]);
        setMostrarOpcoes(false);
    };

    const handleRemoveTrait = (trait) => setCaracteristicas(caracteristicas.filter((t) => t !== trait));

    const handleEditChange = (campo, valor) => setPerfil({ ...perfil, [campo]: valor });

    const handleToggleEdicao = () => {
        if (modoEdicao) {
            if (!validarEmail(perfil.email)) {
                alert("Email inválido");
                return;
            }
            if (password && password !== confirmPassword) {
                alert("As passwords não coincidem!");
                return;
            }
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
        setPassword("");
        setConfirmPassword("");
    };

    const handleSignOut = () => {
        signOut();
        localStorage.removeItem("userId");
        setMostrarLogin(true);
    };


    const [novoPerfil, setNovoPerfil] = useState({
        nome: "",
        email: "",
        idade: "",
        sexo: "Masculino",
        instrumento: "",
        anosExperiencia: "",
        descricao: "",
        foto: "",
        password: "",
        confirmPassword: "",
    });

    const [loginData, setLoginData] = useState({
        email: "",
        password: "",
    });

    const handleLogin = async () => {
        try {
            const res = await UsersAPI.login({ email: loginData.email, password: loginData.password });

            signIn({
                token: "fake_token_apenas_teste", // ⚠️ mais tarde substituímos por JWT real
                expiresIn: 60, // 60 minutos
                tokenType: "Bearer",
                authState: { email: res.email, id: res.id },
            });

            setMostrarLogin(false);
            localStorage.setItem("userId", res.id);
        } catch (err) {
            alert(err.body?.message || "Credenciais inválidas");
        }
    };


    const handleRegisto = () => {
        if (!validarEmail(novoPerfil.email)) return alert("Email inválido");
        if (novoPerfil.password !== novoPerfil.confirmPassword) return alert("As passwords não coincidem!");

        setPerfil({
            nome: novoPerfil.nome,
            email: novoPerfil.email,
            idade: novoPerfil.idade,
            sexo: novoPerfil.sexo,
            instrumento: novoPerfil.instrumento,
            anosExperiencia: novoPerfil.anosExperiencia,
            descricao: novoPerfil.descricao,
            foto: novoPerfil.foto || "https://upload.wikimedia.org/wikipedia/commons/8/89/Portrait_Placeholder.png"
        });

        setMostrarLogin(false);
        setModoRegisto(false);
    };

    return (
        <>
            <Header />
            <main className={styles.infoPage}>
                <button className={styles.backButton} onClick={() => navigate("/")}>
                    <span className="material-symbols-outlined">arrow_back</span>
                </button>

                <div className={styles.profileContainer}>
                    <div className={styles.leftSection}>
                        <div className={styles.photoWrapper}>
                            <img className={styles.photo} src={perfil.foto} alt="Foto de perfil" />

                            {modoEdicao && (
                                <div className={styles.photoButtons}>
                                    <button
                                        className={styles.removePhotoButton}
                                        onClick={() => setPerfil({ ...perfil, foto: "https://upload.wikimedia.org/wikipedia/commons/8/89/Portrait_Placeholder.png" })}
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
                                                    reader.onloadend = () => setPerfil({ ...perfil, foto: reader.result });
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
                                <input className={styles.inputText} value={perfil.nome} onChange={(e) => handleEditChange("nome", e.target.value)} />
                                <input className={styles.inputText} value={perfil.email} type="email" onChange={(e) => handleEditChange("email", e.target.value)} placeholder="Email" />
                                <input className={styles.inputText} value={perfil.idade} type="number" onChange={(e) => handleEditChange("idade", e.target.value)} />
                                <input className={styles.inputText} value={perfil.instrumento} onChange={(e) => handleEditChange("instrumento", e.target.value)} />
                                <input className={styles.inputText} value={perfil.anosExperiencia} type="number" onChange={(e) => handleEditChange("anosExperiencia", e.target.value)} />

                                {/* PASSWORD */}
                                <div className={styles.passwordGroup}>
                                    <input
                                        className={styles.inputText}
                                        type={mostrarPass ? "text" : "password"}
                                        value={password}
                                        placeholder="Nova palavra-passe"
                                        onChange={(e) => setPassword(e.target.value)}
                                    />
                                    <button type="button" className={styles.showPass} onClick={() => setMostrarPass(!mostrarPass)}>
                                        <span className="material-symbols-outlined">{mostrarPass ? "visibility_off" : "visibility"}</span>
                                    </button>
                                </div>

                                <input
                                    className={styles.inputText}
                                    type="password"
                                    placeholder="Confirmar palavra-passe"
                                    value={confirmPassword}
                                    onChange={(e) => setConfirmPassword(e.target.value)}
                                />

                            </>
                        ) : (
                            <>
                                <h1 className={styles.name}>{perfil.nome}</h1>
                                <p className={styles.basicInfo}>{perfil.idade} anos · {perfil.instrumento}</p>
                                <p className={styles.experience}>A tocar há {perfil.anosExperiencia} anos</p>
                                <p className={styles.basicInfo}>{perfil.email}</p>
                            </>
                        )}
                    </div>

                    {/* DESCRIÇÃO */}
                    <div className={styles.description}>
                        <h2>Sobre</h2>
                        {modoEdicao ? (
                            <textarea className={styles.inputArea} value={perfil.descricao} onChange={(e) => handleEditChange("descricao", e.target.value)} />
                        ) : (
                            <p>{perfil.descricao}</p>
                        )}

                        <div className={styles.editButtonArea}>
                            {modoEdicao ? (
                                <>
                                    <button className={`${styles.editButton} ${styles.active}`} onClick={handleToggleEdicao}>Guardar</button>
                                    <button className={styles.cancelButton} onClick={handleCancelar}>Cancelar</button>
                                </>
                            ) : (
                                <button className={styles.editButton} onClick={() => setModoEdicao(true)}>Editar Perfil</button>
                            )}
                        </div>
                    </div>
                </div>

                {/* CARACTERÍSTICAS */}
                <section className={styles.traitsSection}>
                    <div className={styles.traitsGrid}>
                        {caracteristicas.map((t, i) => (
                            <div key={i} className={styles.traitCard}>
                                <span>{t}</span>
                                {modoEdicao && <button className={styles.removeButton} onClick={() => handleRemoveTrait(t)}>✕</button>}
                            </div>
                        ))}

                        {modoEdicao && (
                            <button className={`${styles.addButton} ${mostrarOpcoes && styles.addButtonActive}`} onClick={() => setMostrarOpcoes(!mostrarOpcoes)}>
                                <span className="material-symbols-outlined">{mostrarOpcoes ? "close" : "add"}</span>
                            </button>
                        )}
                    </div>

                    {mostrarOpcoes && (
                        <div className={styles.traitOptions}>
                            {opcoesPredefinidas.map((o, i) => (
                                <button key={i} className={styles.optionButton} onClick={() => handleAddTrait(o)}>{o}</button>
                            ))}
                        </div>
                    )}
                </section>

                {/* SIGN OUT */}
                <div className={styles.signOutArea}>
                    <button className={styles.signOutButton} onClick={handleSignOut}>
                        <span className="material-symbols-outlined">logout</span>Sair da Conta
                    </button>
                </div>
            </main>

            <Menu />

            {mostrarLogin && (
                <div className={styles.loginModalOverlay}>
                    <div className={styles.loginModal}>

                        {!modoRegisto ? (
                            <>
                                <h2>Iniciar Sessão</h2>
                                <input
                                    className={styles.loginInput}
                                    placeholder="Email"
                                    value={loginData.email}
                                    onChange={(e) => setLoginData({ ...loginData, email: e.target.value })}
                                />
                                <input
                                    className={styles.loginInput}
                                    placeholder="Password"
                                    type={mostrarPass ? "text" : "password"}
                                    value={loginData.password}
                                    onChange={(e) => setLoginData({ ...loginData, password: e.target.value })}
                                />

                                <div className={styles.loginButtons}>
                                    <button className={styles.loginConfirm} onClick={handleLogin}>Entrar</button>
                                    <button className={styles.loginCancel} onClick={() => setMostrarLogin(false)}>Cancelar</button>
                                </div>

                                <p className={styles.registarLink} onClick={() => setModoRegisto(true)}>
                                    Registar
                                </p>
                            </>
                        ) : (
                            <>
                                <h2>Criar Conta</h2>

                                {/* UPLOAD + PREVIEW FOTO */}
                                <div className={styles.registoFotoWrapper}>
                                    <img
                                        className={styles.registoFotoPreview}
                                        src={novoPerfil.foto || "https://upload.wikimedia.org/wikipedia/commons/8/89/Portrait_Placeholder.png"}
                                        alt="preview"
                                    />

                                    <label htmlFor="registoFotoInput" className={styles.registoFotoButton}>
                                        <span className="material-symbols-outlined">photo_camera</span>
                                        Alterar Foto
                                    </label>
                                    <input
                                        id="registoFotoInput"
                                        type="file"
                                        accept="image/*"
                                        className={styles.registoFotoInput}
                                        onChange={(e) => {
                                            const file = e.target.files[0];
                                            if (file) {
                                                const reader = new FileReader();
                                                reader.onloadend = () => setNovoPerfil({ ...novoPerfil, foto: reader.result });
                                                reader.readAsDataURL(file);
                                            }
                                        }}
                                    />
                                </div>
                                <input className={styles.loginInput} placeholder="Nome" onChange={e => setNovoPerfil({ ...novoPerfil, nome: e.target.value })} />
                                <input className={styles.loginInput} placeholder="Email" onChange={e => setNovoPerfil({ ...novoPerfil, email: e.target.value })} />
                                <input className={styles.loginInput} placeholder="Idade" type="number" onChange={e => setNovoPerfil({ ...novoPerfil, idade: e.target.value })} />

                                <select className={styles.loginInput} onChange={e => setNovoPerfil({ ...novoPerfil, sexo: e.target.value })}>
                                    <option value="Masculino">Masculino</option>
                                    <option value="Feminino">Feminino</option>
                                </select>

                                <input className={styles.loginInput} placeholder="Instrumento" onChange={e => setNovoPerfil({ ...novoPerfil, instrumento: e.target.value })} />
                                <input className={styles.loginInput} placeholder="Anos de Experiência" type="number" onChange={e => setNovoPerfil({ ...novoPerfil, anosExperiencia: e.target.value })} />
                                <textarea className={styles.loginInput} placeholder="Descrição" onChange={e => setNovoPerfil({ ...novoPerfil, descricao: e.target.value })} />

                                <input className={styles.loginInput} type="password" placeholder="Password" onChange={e => setNovoPerfil({ ...novoPerfil, password: e.target.value })} />
                                <input className={styles.loginInput} type="password" placeholder="Confirmar Password" onChange={e => setNovoPerfil({ ...novoPerfil, confirmPassword: e.target.value })} />

                                <div className={styles.loginButtons}>
                                    <button className={styles.loginConfirm} onClick={handleRegisto}>Criar Conta</button>
                                    <button className={styles.loginCancel} onClick={() => setMostrarLogin(false)}>Cancelar</button>
                                </div>

                                <p className={styles.registarLink} onClick={() => setModoRegisto(false)}>
                                    Já tenho conta
                                </p>
                            </>
                        )}

                    </div>
                </div>
            )}
        </>
    );
}

export default Conta;