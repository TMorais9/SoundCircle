import { API_BASE_URL } from "./usersAPI";

async function handleResponse(response) {
    const data = await response.json().catch(() => null);
    if (!response.ok) {
        const message = data?.message || data?.error || `Erro ao comunicar com o servidor (${response.status})`;
        throw new Error(message);
    }
    return data;
}

async function request(path, { method = "GET", body } = {}) {
    const headers = { "Content-Type": "application/json" };
    const options = { method, headers, credentials: "include" };
    if (body) options.body = JSON.stringify(body);
    const response = await fetch(`${API_BASE_URL}${path}`, options);
    return handleResponse(response);
}

const AiAPI = {
    matchMusicos: (payload) => request("/ai/match", { method: "POST", body: payload }),
};

export default AiAPI;
