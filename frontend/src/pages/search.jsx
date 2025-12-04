import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import useAuthUser from "react-auth-kit/hooks/useAuthUser";
import styles from "./home.module.css";
import UsersAPI, { API_BASE_URL } from "../services/usersAPI";

const PLACEHOLDER =
    "https://upload.wikimedia.org/wikipedia/commons/8/89/Portrait_Placeholder.png";

const resolvePhotoUrl = (value) => {
    if (!value) return PLACEHOLDER;
    if (value.startsWith("data:") || value.startsWith("http://") || value.startsWith("https://"))
        return value;
    if (value.startsWith("/")) return `${API_BASE_URL}${value}`;
    return value;
};

const toDateInputValue = (value) => {
    if (!value) return "";
    return value.split("T")[0];
};

const parseDateOnly = (value) => {
    if (!value) return null;
    const [year, month, day] = toDateInputValue(value).split("-").map(Number);
    if (!year || !month || !day) return null;
    return new Date(Date.UTC(year, month - 1, day));
};

const calcularIdade = (data) => {
    const nascimento = parseDateOnly(data);
    if (!nascimento) return null;
    const diff = Date.now() - nascimento.getTime();
    return new Date(diff).getUTCFullYear() - 1970;
};

function Search() {
    const navigate = useNavigate();
    const authUser = useAuthUser();
    const [fadeOut, setFadeOut] = useState(false);
    const [users, setUsers] = useState([]);
    const [usersLoading, setUsersLoading] = useState(true);
    const [usersError, setUsersError] = useState("");
    const [searchTerm, setSearchTerm] = useState("");

    useEffect(() => {
        let mounted = true;
        (async () => {
            try {
                setUsersLoading(true);
                const data = await UsersAPI.listUsers();
                if (!mounted) return;
                setUsers(Array.isArray(data) ? data : []);
                setUsersError("");
            } catch (error) {
                if (!mounted) return;
                setUsersError(error.message || "Não foi possível carregar os utilizadores");
            } finally {
                if (mounted) setUsersLoading(false);
            }
        })();
        return () => {
            mounted = false;
        };
    }, []);

    const currentUserId =
        authUser?.id ||
        (typeof window !== "undefined" ? window.localStorage.getItem("userId") : null);

    const filteredUsers = useMemo(() => {
        const term = searchTerm.trim().toLowerCase();
        return users
            .filter((user) => Number(user.id) !== Number(currentUserId))
            .filter((user) => {
                if (!term) return true;
                return (user.nome || "").toLowerCase().includes(term);
            });
    }, [users, currentUserId, searchTerm]);

    const handleViewProfile = (userId) => {
        if (!userId) return;
        setFadeOut(true);
        setTimeout(() => navigate(`/info/${userId}`), 300);
    };

    const handleSubmit = (event) => {
        event.preventDefault();
    };

    const renderPlaceholderItems = (count = 6) =>
        Array.from({ length: count }).map((_, index) => (
            <li className={styles.searchListItem} key={`placeholder-${index}`}>
                <div className={styles.searchAvatarSkeleton}></div>
                <div className={styles.searchMeta}>
                    <div className={styles.searchName}>Utilizador</div>
                    <div className={styles.searchInfo}>Instrumento · Idade</div>
                </div>
                <button className={styles.searchAction} disabled>
                    Ver Perfil
                </button>
            </li>
        ));

    const renderUserRows = () => {
        if (usersLoading) return renderPlaceholderItems();
        if (usersError) {
            return (
                <li className={styles.statusMessage}>
                    Erro a carregar utilizadores. Tenta novamente mais tarde.
                </li>
            );
        }
        if (!filteredUsers.length) {
            return (
                <li className={styles.statusMessage}>
                    {searchTerm
                        ? "Nenhum músico encontrado com esse nome."
                        : "Sem utilizadores disponíveis de momento."}
                </li>
            );
        }

        return filteredUsers.map((user) => {
            const idade = calcularIdade(user.data_nascimento);
            const instrumentoLabel = user.instrumento_nome || user.instrumento || "";
            const localizacao = user.localizacao || "";
            const linha1 = [instrumentoLabel || "Instrumento não definido", idade ? `${idade} anos` : null, localizacao].filter(Boolean).join(" · ");
            return (
                <li className={styles.searchListItem} key={user.id}>
                    <img
                        className={styles.searchAvatar}
                        src={resolvePhotoUrl(user.foto_url)}
                        alt={`Foto de ${user.nome}`}
                    />
                    <div className={styles.searchMeta}>
                        <div className={styles.searchName}>{user.nome}</div>
                        {linha1 && <div className={styles.searchInfo}>{linha1}</div>}
                    </div>
                    <button className={styles.searchAction} onClick={() => handleViewProfile(user.id)}>
                        Ver Perfil
                    </button>
                </li>
            );
        });
    };

    return (
        <>
            <div className={styles.searchOverlay}>
                <div className={styles.searchModal}>
                    <div className={styles.searchModalHeader}>
                        <div>
                            <p className={styles.searchEyebrow}>Descobre músicos</p>
                            <h1 className={styles.searchTitle}>Pesquisa rápida pelo nome</h1>
                        </div>
                        <button
                            className={styles.searchClose}
                            type="button"
                            onClick={() => navigate(-1)}>
                            <span className="material-symbols-outlined">close</span>
                        </button>
                    </div>

                    <form className={styles.searchForm} onSubmit={handleSubmit}>
                        <span className="material-symbols-outlined">search</span>
                        <input
                            type="text"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            placeholder="Pesquise pelo nome do músico"
                            aria-label="Pesquisar músico pelo nome"
                        />
                        {searchTerm ? (
                            <button
                                type="button"
                                className={styles.searchClear}
                                onClick={() => setSearchTerm("")}>
                                <span className="material-symbols-outlined">close</span>
                            </button>
                        ) : null}
                    </form>
                    <div className={styles.searchResultsShell}>
                        <ul
                            className={`${styles.searchList} ${fadeOut ? styles.fadeOut : ""}`}
                            aria-live="polite">
                            {renderUserRows()}
                        </ul>
                    </div>
                </div>
            </div>
        </>
    );
}

export default Search;
