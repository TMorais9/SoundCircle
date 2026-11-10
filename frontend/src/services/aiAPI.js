// Serviço do frontend que fala com a parte de AI do backend.
import { API_BASE_URL } from "./usersAPI";

// Lê a resposta e transforma os erros do servidor numa exceção com uma mensagem legível.
async function handleResponse(response) {
    const data = await response.json().catch(() => null);
    if (!response.ok) {
        const message = data?.message || data?.error || `Erro ao comunicar com o servidor (${response.status})`;
        throw new Error(message);
    }
    return data;
}

// Pedido genérico ao backend, sempre em JSON.
async function request(path, { method = "GET", body } = {}) {
    const headers = { "Content-Type": "application/json" };
    const options = { method, headers, credentials: "include" };
    if (body) options.body = JSON.stringify(body);
    const response = await fetch(`${API_BASE_URL}${path}`, options);
    return handleResponse(response);
}

// POST /ai/chat: envia o texto, os chips, o utilizador e o contexto da conversa. É o backend que corre o CSP.
const AiAPI = {
    chatMusicos: (payload) => request("/ai/chat", { method: "POST", body: payload }),
};

export default AiAPI;
