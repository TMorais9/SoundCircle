import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import styles from "./conta.module.css";
import useSignIn from "react-auth-kit/hooks/useSignIn";
import useSignOut from "react-auth-kit/hooks/useSignOut";
import useIsAuthenticated from "react-auth-kit/hooks/useIsAuthenticated";
import useAuthUser from "react-auth-kit/hooks/useAuthUser";
import UsersAPI, { API_BASE_URL } from "../services/usersAPI";

const PLACEHOLDER_PHOTO =
    "https://upload.wikimedia.org/wikipedia/commons/8/89/Portrait_Placeholder.png";

const DEFAULT_TRAITS = ["Extrovertido", "Criativo", "Dedicado"];

const INITIAL_PERFIL_STATE = {
    nome: "",
    email: "",
    idade: "",
    dataNascimento: "",
    localizacao: "",
    sexo: "",
    tipo: "solo",
    instrumento: "",
    anosExperiencia: "",
    inicioExperiencia: "",
    descricao: "",
    foto: PLACEHOLDER_PHOTO,
};

const INITIAL_REGISTER_STATE = {
    nome: "",
    email: "",
    dataNascimento: "",
    localizacao: "",
    inicioExperiencia: "",
    sexo: "",
    instrumento: "",
    anosExperiencia: "",
    descricao: "",
    foto: "",
    password: "",
    confirmPassword: "",
};

const INITIAL_LOGIN_STATE = {
    email: "",
    password: "",
};

const DISTRICTS = [
    "Aveiro",
    "Beja",
    "Braga",
    "Bragança",
    "Castelo Branco",
    "Coimbra",
    "Évora",
    "Faro",
    "Guarda",
    "Leiria",
    "Lisboa",
    "Portalegre",
    "Porto",
    "Santarém",
    "Setúbal",
    "Viana do Castelo",
    "Vila Real",
    "Viseu",
];

const INSTRUMENTS = [
    "Guitarrista",
    "Baixista",
    "Baterista",
    "Pianista",
    "Vocalista",
];

const toDateInputValue = (value) => {
    if (!value) return "";
    return value.split("T")[0];
};

const parseDateOnly = (value) => {
    if (!value) return null;
    const [year, month, day] = toDateInputValue(value).split("-").map(Number);
    if (!year || !month || !day) return null;
    return new Date(Date.UTC(year, month, day));
};

const calcularIdade = (dataNascimento) => {
    const nascimento = parseDateOnly(dataNascimento);
    if (!nascimento) return "";
    const diferenca = Date.now() - nascimento.getTime();
    const idadeData = new Date(diferenca);
    return Math.abs(idadeData.getUTCFullYear() - 1970);
};

const experienciaParaNivel = (anos) => {
    const valor = Number(anos);
    if (Number.isNaN(valor)) return "intermedio";
    if (valor < 2) return "iniciante";
    if (valor < 5) return "intermedio";
    if (valor < 10) return "avancado";
    return "profissional";
};

const formatMonthValue = (year, monthIndexZeroBased) => {
    const safeYear = year ?? "";
    const safeMonth = (monthIndexZeroBased ?? 0) + 1;
    const paddedMonth = String(safeMonth).padStart(2, "0");
    return `${safeYear}-${paddedMonth}`;
};

const aproxInicioPorAnos = (anos) => {
    const parsed = Number(anos);
    if (!Number.isFinite(parsed) || parsed < 0) return "";
    const agora = new Date();
    const ano = agora.getFullYear() - Math.floor(parsed);
    const mes = agora.getMonth();
    return formatMonthValue(ano, mes);
};

const anosDesdeInicio = (inicio) => {
    if (!inicio) return null;
    const [anoStr, mesStr] = inicio.split("-");
    const ano = Number(anoStr);
    const mes = Number(mesStr);
    if (!Number.isFinite(ano) || !Number.isFinite(mes)) return null;
    const agora = new Date();
    const mesesTotais = (agora.getFullYear() - ano) * 12 + (agora.getMonth() + 1 - mes);
    if (!Number.isFinite(mesesTotais) || mesesTotais < 0) return null;
    return Math.floor(mesesTotais / 12);
};

const resolvePhotoUrl = (value) => {
    if (!value) return PLACEHOLDER_PHOTO;
    if (value.startsWith("data:") || value.startsWith("http://") || value.startsWith("https://"))
        return value;
    if (value.startsWith("/")) return `${API_BASE_URL}${value}`;
    return value;
};

const mapPerfilFromResponse = (payload) => {
    if (!payload) return { ...INITIAL_PERFIL_STATE };
    const user = payload.user || payload;
    const instrumento = payload.instrumentos?.[0];
    const anosExperienciaValue =
        instrumento?.anos_experiencia ?? instrumento?.anosExperiencia ?? null;
    const caracteristicasIds = (payload.caracteristicas || []).map((c) => c.id);
    const inicioExperiencia = aproxInicioPorAnos(anosExperienciaValue);

    return {
        nome: user?.nome ?? "",
        email: user?.email ?? "",
        sexo: user?.sexo || "",
        idade: user?.data_nascimento ? calcularIdade(user.data_nascimento) : "",
        dataNascimento: toDateInputValue(user?.data_nascimento),
        localizacao: user?.localizacao || "",
        tipo: user?.tipo || "solo",
        instrumento: instrumento?.instrumento_nome || "",
        anosExperiencia:
            anosExperienciaValue === null || anosExperienciaValue === undefined
                ? ""
                : String(anosExperienciaValue),
        inicioExperiencia,
        caracteristicasIds,
        descricao: user?.descricao || "",
        foto: resolvePhotoUrl(user?.foto_url),
    };
};

const base64UrlEncode = (obj) =>
    window
        .btoa(JSON.stringify(obj))
        .replace(/=+$/, "")
        .replace(/\+/g, "-")
        .replace(/\//g, "_");

const gerarSessaoToken = (user, expiresInSeconds = 60 * 60) => {
    const header = { alg: "HS256", typ: "JWT" };
    const payload = {
        sub: user.id,
        email: user.email,
        exp: Math.floor(Date.now() / 1000) + expiresInSeconds,
    };
    return `${base64UrlEncode(header)}.${base64UrlEncode(payload)}.signature`;
};

function Conta() {
    const navigate = useNavigate();
    const signIn = useSignIn();
    const signOut = useSignOut();
    const isAuthenticated = useIsAuthenticated();
    const authUser = useAuthUser();
    const [modoEdicao, setModoEdicao] = useState(false);
    const [modoRegisto, setModoRegisto] = useState(false);
    const [mostrarPass, setMostrarPass] = useState(false);

    const [perfil, setPerfil] = useState({ ...INITIAL_PERFIL_STATE });

    const [password, setPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");

    const [perfilOriginal, setPerfilOriginal] = useState({ ...INITIAL_PERFIL_STATE });
    const [caracteristicasDisponiveis, setCaracteristicasDisponiveis] = useState([]);
    const [caracteristicasOriginais, setCaracteristicasOriginais] = useState([]);
    const [mostrarOpcoes, setMostrarOpcoes] = useState(false);
    const [authError, setAuthError] = useState("");
    const [isAuthLoading, setIsAuthLoading] = useState(false);
    const [isRegistering, setIsRegistering] = useState(false);
    const [perfilCarregado, setPerfilCarregado] = useState(false);
    const [perfilErro, setPerfilErro] = useState("");
    const [perfilMensagem, setPerfilMensagem] = useState("");
    const [isSavingProfile, setIsSavingProfile] = useState(false);
    const currentUserId = authUser?.id || (typeof window !== "undefined" ? window.localStorage.getItem("userId") : null);
    const [caracteristicasSelecionadas, setCaracteristicasSelecionadas] = useState([]);
    const [novoPerfilCaracteristicas, setNovoPerfilCaracteristicas] = useState([]);
    const [perfilFotoFile, setPerfilFotoFile] = useState(null);
    const [novoPerfilFotoFile, setNovoPerfilFotoFile] = useState(null);

    const [novoPerfil, setNovoPerfil] = useState({ ...INITIAL_REGISTER_STATE });
    const [loginData, setLoginData] = useState({ ...INITIAL_LOGIN_STATE });

    const fetchPerfil = useCallback(async (userId) => {
        const response = await UsersAPI.getProfile(userId);
        const perfilMapeado = mapPerfilFromResponse(response);
        setPerfil(perfilMapeado);
        setPerfilOriginal(perfilMapeado);
        setCaracteristicasSelecionadas(perfilMapeado.caracteristicasIds || []);
        setCaracteristicasOriginais(perfilMapeado.caracteristicasIds || []);
        setPerfilCarregado(true);
        return perfilMapeado;
    }, []);

    const uploadPhoto = useCallback(async (userId, file) => {
        if (!file) return null;
        const response = await UsersAPI.uploadPhoto(userId, file);
        return response?.url;
    }, []);

    const authenticateUser = useCallback(
        async (email, passwordValue) => {
            const user = await UsersAPI.login({ email, password: passwordValue });
            try {
                await fetchPerfil(user.id);
            } catch {
                const fallbackPerfil = mapPerfilFromResponse({ user });
                setPerfil(fallbackPerfil);
                setPerfilOriginal(fallbackPerfil);
                setPerfilCarregado(true);
            }

            const signedIn = signIn({
                auth: {
                    token: gerarSessaoToken(user),
                    type: "Bearer",
                },
                userState: { email: user.email, id: user.id, nome: user.nome },
            });
            if (!signedIn) {
                throw new Error("Não foi possível iniciar sessão");
            }
            if (typeof window !== "undefined") {
                window.localStorage.setItem("userId", user.id);
            }
            setModoEdicao(false);
            setPassword("");
            setConfirmPassword("");
            setAuthError("");
            return user;
        },
        [fetchPerfil, signIn]
    );

    useEffect(() => {
        if (!isAuthenticated) {
            setModoRegisto(false);
            setPerfil({ ...INITIAL_PERFIL_STATE });
            setPerfilOriginal({ ...INITIAL_PERFIL_STATE });
            setPerfilCarregado(false);
            return;
        }

        if (typeof window === "undefined") return;
        const storedUserId = window.localStorage.getItem("userId");
        if (storedUserId && !perfilCarregado) {
            fetchPerfil(storedUserId).catch(() => {
                setPerfilCarregado(true);
            });
        }
    }, [fetchPerfil, isAuthenticated, perfilCarregado]);

    useEffect(() => {
        setAuthError("");
    }, [modoRegisto]);

    useEffect(() => {
        UsersAPI.listCaracteristicas()
            .then((lista) => {
                if (Array.isArray(lista)) {
                    const normalizados = lista.map((c) => ({ id: Number(c.id), nome: c.nome }));
                    setCaracteristicasDisponiveis(normalizados);
                }
            })
            .catch(() => {});
    }, []);

    const opcoesPredefinidas = caracteristicasDisponiveis;

    const validarEmail = (email) => /\S+@\S+\.\S+/.test(email);

    const getCaracteristicaNome = (id) =>
        caracteristicasDisponiveis.find((c) => c.id === Number(id))?.nome || "Característica";

    const handleAddTrait = (id) => {
        if (!caracteristicasSelecionadas.includes(id)) {
            setCaracteristicasSelecionadas([...caracteristicasSelecionadas, id]);
        }
    };

    const handleRemoveTrait = (id) => setCaracteristicasSelecionadas(caracteristicasSelecionadas.filter((t) => t !== id));

    const handleEditChange = (campo, valor) => setPerfil({ ...perfil, [campo]: valor });

    const handleDataNascimentoChange = (valor) => {
        setPerfil({
            ...perfil,
            dataNascimento: valor,
            idade: valor ? calcularIdade(valor) : "",
        });
    };

    const handleInicioExperienciaChange = (valor) => {
        const anosCalc = anosDesdeInicio(valor);
        setPerfil({
            ...perfil,
            inicioExperiencia: valor,
            anosExperiencia: anosCalc === null ? "" : String(anosCalc),
        });
    };

    const toggleNovoPerfilTrait = (traitId) => {
        setNovoPerfilCaracteristicas((prev) =>
            prev.includes(traitId) ? prev.filter((item) => item !== traitId) : [...prev, traitId]
        );
    };

    const handleNovoInicioExperiencia = (valor) => {
        const anosCalc = anosDesdeInicio(valor);
        setNovoPerfil({
            ...novoPerfil,
            inicioExperiencia: valor,
            anosExperiencia: anosCalc === null ? "" : String(anosCalc),
        });
    };

    const resetRegisterForm = () => {
        setNovoPerfil({ ...INITIAL_REGISTER_STATE });
        setNovoPerfilCaracteristicas([]);
        setNovoPerfilFotoFile(null);
        setAuthError("");
    };

    const persistProfileChanges = async () => {
        if (!currentUserId) {
            throw new Error("Sessão inválida. Inicia novamente.");
        }
        let fotoUrlPayload =
            perfil.foto && perfil.foto.startsWith("http") ? perfil.foto : PLACEHOLDER_PHOTO;

        if (perfilFotoFile && currentUserId) {
            const uploadedUrl = await uploadPhoto(currentUserId, perfilFotoFile);
            if (uploadedUrl) {
                fotoUrlPayload = uploadedUrl;
                setPerfil((prev) => ({ ...prev, foto: resolvePhotoUrl(uploadedUrl) }));
            }
            setPerfilFotoFile(null);
        }

        const anosFromInicio = anosDesdeInicio(perfil.inicioExperiencia);
        const anosExperienciaValue =
            anosFromInicio !== null
                ? anosFromInicio
                : perfil.anosExperiencia === ""
                    ? null
                    : Number(perfil.anosExperiencia);
        const safeAnosExperiencia =
            Number.isFinite(anosExperienciaValue) && anosExperienciaValue >= 0
                ? anosExperienciaValue
                : null;

        const payload = {
            nome: perfil.nome.trim(),
            email: perfil.email.trim(),
            tipo: perfil.tipo || "solo",
            sexo: perfil.sexo,
            localizacao: perfil.localizacao.trim() || null,
            descricao: perfil.descricao,
            foto_url: fotoUrlPayload,
            data_nascimento: perfil.dataNascimento || null,
            instrumento: perfil.instrumento,
            instrumentoNivel:
                safeAnosExperiencia !== null ? experienciaParaNivel(safeAnosExperiencia) : null,
            anosExperiencia: safeAnosExperiencia,
        };

        await UsersAPI.updateProfile(currentUserId, payload);
        await UsersAPI.updateUserCaracteristicas(currentUserId, caracteristicasSelecionadas);

        if (password) {
            await UsersAPI.updatePassword(currentUserId, password);
            setPassword("");
            setConfirmPassword("");
        }

        setPerfilOriginal({ ...perfil });
        setCaracteristicasOriginais([...caracteristicasSelecionadas]);
    };

    const handleToggleEdicao = async () => {
        if (modoEdicao) {
            if (!validarEmail(perfil.email)) {
                setPerfilErro("Email inválido");
                return;
            }
            if (password && password !== confirmPassword) {
                setPerfilErro("As passwords não coincidem!");
                return;
            }
            try {
                setIsSavingProfile(true);
                await persistProfileChanges();
                setPerfilErro("");
                setPerfilMensagem("Perfil atualizado com sucesso!");
                setModoEdicao(false);
                setMostrarOpcoes(false);
            } catch (error) {
                setPerfilErro(error.message || "Não foi possível atualizar o perfil");
            } finally {
                setIsSavingProfile(false);
            }
            return;
        }
        setPerfilErro("");
        setPerfilMensagem("");
        setModoEdicao(true);
        setMostrarOpcoes(false);
    };

    const handleCancelar = () => {
        setPerfil({ ...perfilOriginal });
        setCaracteristicasSelecionadas([...caracteristicasOriginais]);
        setModoEdicao(false);
        setPassword("");
        setConfirmPassword("");
        setPerfilErro("");
        setPerfilMensagem("");
        setPerfilFotoFile(null);
    };

    const handleSignOut = () => {
        signOut();
        if (typeof window !== "undefined") {
            window.localStorage.removeItem("userId");
        }
        setPerfil({ ...INITIAL_PERFIL_STATE });
        setPerfilOriginal({ ...INITIAL_PERFIL_STATE });
        setCaracteristicasSelecionadas([]);
        setCaracteristicasOriginais([]);
        setPerfilCarregado(false);
        setModoEdicao(false);
        setPassword("");
        setConfirmPassword("");
        setPerfilErro("");
        setPerfilMensagem("");
        setPerfilFotoFile(null);
        setNovoPerfilFotoFile(null);
    };

    const handleLogin = async () => {
        const email = loginData.email.trim();
        const passwordValue = loginData.password.trim();

        if (!validarEmail(email)) {
            setAuthError("Email inválido");
            return;
        }
        if (!passwordValue) {
            setAuthError("Introduz a tua palavra-passe");
            return;
        }

        setIsAuthLoading(true);
        try {
            await authenticateUser(email, passwordValue);
            setLoginData({ ...INITIAL_LOGIN_STATE });
        } catch (err) {
            setAuthError(err.message || "Credenciais inválidas");
        } finally {
            setIsAuthLoading(false);
        }
    };

    const handleRegisto = async () => {
        if (!novoPerfil.nome.trim()) {
            setAuthError("O nome é obrigatório");
            return;
        }
        if (!validarEmail(novoPerfil.email)) {
            setAuthError("Email inválido");
            return;
        }
        if (!novoPerfil.dataNascimento) {
            setAuthError("Data de nascimento é obrigatória");
            return;
        }
        if (!novoPerfil.password || !novoPerfil.confirmPassword) {
            setAuthError("Introduz e confirma a palavra-passe");
            return;
        }
        if (novoPerfil.password !== novoPerfil.confirmPassword) {
            setAuthError("As passwords não coincidem");
            return;
        }

        setIsRegistering(true);
        try {
            const fotoUrlPayload =
                novoPerfil.foto && novoPerfil.foto.startsWith("http")
                    ? novoPerfil.foto
                    : PLACEHOLDER_PHOTO;

            const anosExperienciaValueFromInicio = anosDesdeInicio(novoPerfil.inicioExperiencia);
            const anosExperienciaValue =
                anosExperienciaValueFromInicio !== null
                    ? anosExperienciaValueFromInicio
                    : novoPerfil.anosExperiencia === ""
                        ? null
                        : Number(novoPerfil.anosExperiencia);
            const safeAnosExperiencia =
                Number.isFinite(anosExperienciaValue) && anosExperienciaValue >= 0
                    ? anosExperienciaValue
                    : null;

            await UsersAPI.register({
                nome: novoPerfil.nome,
                email: novoPerfil.email,
                password: novoPerfil.password,
                tipo: "solo",
                sexo: novoPerfil.sexo,
                localizacao: novoPerfil.localizacao.trim() || null,
                descricao: novoPerfil.descricao,
                foto_url: fotoUrlPayload,
                data_nascimento: novoPerfil.dataNascimento || null,
                instrumento: novoPerfil.instrumento,
                instrumentoNivel:
                    safeAnosExperiencia !== null ? experienciaParaNivel(safeAnosExperiencia) : null,
                anosExperiencia: safeAnosExperiencia,
            });
            const loggedUser = await authenticateUser(novoPerfil.email, novoPerfil.password);
            if (novoPerfilFotoFile && loggedUser?.id) {
                await uploadPhoto(loggedUser.id, novoPerfilFotoFile);
                setNovoPerfilFotoFile(null);
                await fetchPerfil(loggedUser.id);
            }
            if (novoPerfilCaracteristicas.length && loggedUser?.id) {
                await UsersAPI.updateUserCaracteristicas(loggedUser.id, novoPerfilCaracteristicas);
                setCaracteristicasSelecionadas([...novoPerfilCaracteristicas]);
                setCaracteristicasOriginais([...novoPerfilCaracteristicas]);
            }
            setNovoPerfilCaracteristicas([]);
            setNovoPerfilFotoFile(null);
            setNovoPerfil({ ...INITIAL_REGISTER_STATE });
        } catch (err) {
            setAuthError(err.message || "Não foi possível criar a conta");
        } finally {
            setIsRegistering(false);
        }
    };

    const renderAuthModal = () => (
        <div className={styles.loginModalOverlay}>
            <div className={styles.loginModal}>
                {!modoRegisto ? (
                    <>
                        <h2>Iniciar Sessão</h2>
                        {authError && <p className={styles.authError}>{authError}</p>}
                        <input
                            className={styles.loginInput}
                            placeholder="Email"
                            value={loginData.email}
                            onChange={(e) => {
                                setLoginData({ ...loginData, email: e.target.value });
                                setAuthError("");
                            }}
                        />
                        <input
                            className={styles.loginInput}
                            placeholder="Password"
                            type="password"
                            value={loginData.password}
                            onChange={(e) => {
                                setLoginData({ ...loginData, password: e.target.value });
                                setAuthError("");
                            }}
                        />

                        <div className={styles.loginButtons}>
                            <button
                                type="button"
                                className={styles.loginConfirm}
                                onClick={handleLogin}
                                disabled={isAuthLoading}
                            >
                                {isAuthLoading ? "A entrar..." : "Entrar"}
                            </button>
                            <button
                                type="button"
                                className={styles.loginCancel}
                                onClick={() => navigate("/")}
                            >
                                Cancelar
                            </button>
                        </div>

                        <p
                            className={styles.registarLink}
                            onClick={() => {
                                setModoRegisto(true);
                                resetRegisterForm();
                            }}>
                            Criar nova conta
                        </p>
                    </>
                ) : (
                    <>
                        <h2>Criar Conta</h2>
                        {authError && <p className={styles.authError}>{authError}</p>}

                        <div className={styles.registoFotoWrapper}>
                            <img
                                className={styles.registoFotoPreview}
                                src={novoPerfil.foto || PLACEHOLDER_PHOTO}
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
                                        setNovoPerfilFotoFile(file);
                                        const reader = new FileReader();
                                        reader.onloadend = () => setNovoPerfil({ ...novoPerfil, foto: reader.result });
                                        reader.readAsDataURL(file);
                                    }
                                    setAuthError("");
                                }}
                            />
                        </div>

                        <input
                            className={styles.loginInput}
                            placeholder="Nome"
                            value={novoPerfil.nome}
                            onChange={(e) => {
                                setNovoPerfil({ ...novoPerfil, nome: e.target.value });
                                setAuthError("");
                            }}
                        />
                        <input
                            className={styles.loginInput}
                            placeholder="Email"
                            value={novoPerfil.email}
                            onChange={(e) => {
                                setNovoPerfil({ ...novoPerfil, email: e.target.value });
                                setAuthError("");
                            }}
                        />
                        <input
                            className={styles.loginInput}
                            placeholder="Data de nascimento"
                            type={novoPerfil.dataNascimento ? "date" : "text"}
                            value={novoPerfil.dataNascimento}
                            onChange={(e) => {
                                setNovoPerfil({ ...novoPerfil, dataNascimento: e.target.value });
                                setAuthError("");
                            }}
                            onFocus={(e) => { e.target.type = "date"; }}
                            onBlur={(e) => { if (!e.target.value) e.target.type = "text"; }}
                        />

                        <select
                            className={`${styles.loginInput} ${!novoPerfil.sexo ? styles.loginInputPlaceholder : ""}`}
                            value={novoPerfil.sexo}
                            onChange={(e) => {
                                setNovoPerfil({ ...novoPerfil, sexo: e.target.value });
                                setAuthError("");
                            }}
                        >
                            <option value="" disabled>Sexo</option>
                            <option value="Masculino">Masculino</option>
                            <option value="Feminino">Feminino</option>
                            <option value="Outro">Outro</option>
                        </select>

                        <select
                            className={`${styles.loginInput} ${!novoPerfil.instrumento ? styles.loginInputPlaceholder : ""}`}
                            value={novoPerfil.instrumento}
                            onChange={(e) => {
                                setNovoPerfil({ ...novoPerfil, instrumento: e.target.value });
                                setAuthError("");
                            }}
                        >
                            <option value="" disabled>Instrumento</option>
                            {INSTRUMENTS.map((instrumento) => (
                                <option key={instrumento} value={instrumento}>{instrumento}</option>
                            ))}
                        </select>

                        <input
                            className={styles.loginInput}
                            placeholder="Experiência"
                            type={novoPerfil.inicioExperiencia ? "date" : "text"}
                            value={novoPerfil.inicioExperiencia}
                            onChange={(e) => {
                                handleNovoInicioExperiencia(e.target.value);
                                setAuthError("");
                            }}
                            onFocus={(e) => { e.target.type = "date"; }}
                            onBlur={(e) => { if (!e.target.value) e.target.type = "text"; }}
                        />
                        <textarea
                            className={styles.loginInput}
                            placeholder="Descrição"
                            value={novoPerfil.descricao}
                            onChange={(e) => {
                                setNovoPerfil({ ...novoPerfil, descricao: e.target.value });
                                setAuthError("");
                            }}
                        />
                        <select
                            className={`${styles.loginInput} ${!novoPerfil.localizacao ? styles.loginInputPlaceholder : ""}`}
                            value={novoPerfil.localizacao}
                            onChange={(e) => {
                                setNovoPerfil({ ...novoPerfil, localizacao: e.target.value });
                                setAuthError("");
                            }}
                        >
                            <option value="" disabled>Localização</option>
                            {DISTRICTS.map((distrito) => (
                                <option key={distrito} value={distrito}>{distrito}</option>
                            ))}
                        </select>

                        <div className={styles.registerTraits}>
                            <p>Características (opcional)</p>
                            <div className={styles.registerTraitsOptions}>
                                {opcoesPredefinidas.map((trait) => (
                                    <button
                                        type="button"
                                        key={trait.id}
                                        className={`${styles.traitChip} ${novoPerfilCaracteristicas.includes(trait.id)
                                            ? styles.traitChipActive
                                            : ""
                                            }`}
                                        onClick={() => {
                                            toggleNovoPerfilTrait(trait.id);
                                            setAuthError("");
                                        }}
                                    >
                                        {trait.nome}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <input
                            className={styles.loginInput}
                            type="password"
                            placeholder="Password"
                            value={novoPerfil.password}
                            onChange={(e) => {
                                setNovoPerfil({ ...novoPerfil, password: e.target.value });
                                setAuthError("");
                            }}
                        />
                        <input
                            className={styles.loginInput}
                            type="password"
                            placeholder="Confirmar Password"
                            value={novoPerfil.confirmPassword}
                            onChange={(e) => {
                                setNovoPerfil({ ...novoPerfil, confirmPassword: e.target.value });
                                setAuthError("");
                            }}
                        />

                        <div className={styles.loginButtons}>
                            <button
                                type="button"
                                className={styles.loginConfirm}
                                onClick={handleRegisto}
                                disabled={isRegistering}
                            >
                                {isRegistering ? "A criar..." : "Criar Conta"}
                            </button>
                            <button
                                type="button"
                                className={styles.loginCancel}
                                onClick={() => {
                                    setModoRegisto(false);
                                    resetRegisterForm();
                                }}
                            >
                                Cancelar
                            </button>
                        </div>

                        <p
                            className={styles.registarLink}
                            onClick={() => {
                                setModoRegisto(false);
                                resetRegisterForm();
                            }}>
                            Já tenho conta
                        </p>
                    </>
                )}
            </div>
        </div>
    );

    if (!isAuthenticated) {
        return renderAuthModal();
    }

    if (!perfilCarregado) {
        return (
            <main className={styles.infoPage}>
                <p>A carregar o teu perfil...</p>
            </main>
        );
    }

    return (
        <>
            <main className={styles.infoPage}>
                <div className={styles.profileContainer}>
                    <div className={styles.leftSection}>
                        <div className={styles.photoWrapper}>
                            <img className={styles.photo} src={perfil.foto} alt="Foto de perfil" />

                            {modoEdicao && (
                                <div className={styles.photoButtons}>
                                    <button
                                        className={styles.removePhotoButton}
                                        onClick={() => {
                                            setPerfil({ ...perfil, foto: PLACEHOLDER_PHOTO });
                                            setPerfilFotoFile(null);
                                        }}
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
                                                    setPerfilFotoFile(file);
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
                                <input
                                    className={styles.inputText}
                                    placeholder="Data de Nascimento"
                                    value={perfil.dataNascimento || ""}
                                    type={perfil.dataNascimento ? "date" : "text"}
                                    onChange={(e) => handleDataNascimentoChange(e.target.value)}
                                    onFocus={(e) => { e.target.type = "date"; }}
                                    onBlur={(e) => { if (!e.target.value) e.target.type = "text"; }}
                                />
                                <select
                                    className={`${styles.inputText} ${!perfil.sexo ? styles.loginInputPlaceholder : ""}`}
                                    value={perfil.sexo}
                                    onChange={(e) => handleEditChange("sexo", e.target.value)}
                                >
                                    <option value="" disabled>Sexo</option>
                                    <option value="Masculino">Masculino</option>
                                    <option value="Feminino">Feminino</option>
                                    <option value="Outro">Outro</option>
                                </select>
                                <select
                                    className={`${styles.inputText} ${!perfil.localizacao ? styles.loginInputPlaceholder : ""}`}
                                    value={perfil.localizacao}
                                    onChange={(e) => handleEditChange("localizacao", e.target.value)}
                                >
                                    <option value="" disabled>Localização</option>
                                    {DISTRICTS.map((distrito) => (
                                        <option key={distrito} value={distrito}>{distrito}</option>
                                    ))}
                                </select>
                                <input className={styles.inputText} value={perfil.instrumento} onChange={(e) => handleEditChange("instrumento", e.target.value)} />
                                <input
                                    className={styles.inputText}
                                    placeholder="Experiência"
                                    value={perfil.inicioExperiencia}
                                    type={perfil.inicioExperiencia ? "date" : "text"}
                                    onChange={(e) => handleInicioExperienciaChange(e.target.value)}
                                    onFocus={(e) => { e.target.type = "date"; }}
                                    onBlur={(e) => { if (!e.target.value) e.target.type = "text"; }}
                                />

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
                                {perfil.localizacao && <p className={styles.basicInfo}>{perfil.localizacao}</p>}
                                {perfil.anosExperiencia !== "" && perfil.anosExperiencia !== null && (
                                    <p className={styles.experience}>
                                        A tocar há {perfil.anosExperiencia} ano(s)
                                    </p>
                                )}
                                <p className={styles.basicInfo}>{perfil.email}</p>
                            </>
                        )}
                    </div>

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
                                    <button
                                        className={`${styles.editButton} ${styles.active}`}
                                        onClick={handleToggleEdicao}
                                        disabled={isSavingProfile}
                                    >
                                        {isSavingProfile ? "A guardar..." : "Guardar"}
                                    </button>
                                    <button className={styles.cancelButton} onClick={handleCancelar}>Cancelar</button>
                                </>
                            ) : (
                                <button className={styles.editButton} onClick={handleToggleEdicao}>Editar Perfil</button>
                            )}
                        </div>
                        {(perfilErro || perfilMensagem) && (
                            <p className={perfilErro ? styles.profileError : styles.profileSuccess}>
                                {perfilErro || perfilMensagem}
                            </p>
                        )}
                    </div>
                </div>

                <section className={styles.traitsSection}>
                    <div className={styles.traitsGrid}>
                        {caracteristicasSelecionadas.length === 0 && !modoEdicao && (
                            <p className={styles.basicInfo} style={{ textAlign: "center", width: "100%" }}>
                                Ainda não tens características atribuídas
                            </p>
                        )}

                        {caracteristicasSelecionadas.map((id) => (
                            <div key={id} className={styles.traitCard}>
                                <span>{getCaracteristicaNome(id)}</span>
                                {modoEdicao && <button className={styles.removeButton} onClick={() => handleRemoveTrait(id)}>✕</button>}
                            </div>
                        ))}

                        {modoEdicao && (
                            <button className={`${styles.addButton} ${mostrarOpcoes && styles.addButtonActive}`} onClick={() => setMostrarOpcoes(!mostrarOpcoes)}>
                                <span className="material-symbols-outlined">{mostrarOpcoes ? "close" : "add"}</span>
                            </button>
                        )}
                    </div>

                    {modoEdicao && mostrarOpcoes && (
                        <div className={styles.traitOptions}>
                            {opcoesPredefinidas.length === 0 ? (
                                <p className={styles.basicInfo}>Sem características disponíveis</p>
                            ) : (
                                opcoesPredefinidas
                                    .filter((o) => !caracteristicasSelecionadas.includes(o.id))
                                    .map((o) => (
                                        <button
                                            key={o.id}
                                            className={styles.optionButton}
                                            onClick={() => handleAddTrait(o.id)}
                                        >
                                            {o.nome}
                                        </button>
                                    ))
                            )}
                        </div>
                    )}
                </section>

                <div className={styles.signOutArea}>
                    <button className={styles.signOutButton} onClick={handleSignOut}>
                        <span className="material-symbols-outlined">logout</span>Sair da Conta
                    </button>
                </div>
            </main>
        </>
    );
}

export default Conta;
