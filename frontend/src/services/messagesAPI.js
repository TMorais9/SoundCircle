import { API_BASE_URL } from "./usersAPI";

const handleResponse = async (response) => {
    const data = await response.json().catch(() => null);
    if (!response.ok) {
        const message = data?.message || data?.error || `Erro ao comunicar com o servidor (${response.status})`;
        throw new Error(message);
    }
    return data;
};

const request = async (path, { method = "GET", body } = {}) => {
    const isFormData = typeof FormData !== "undefined" && body instanceof FormData;
    const headers = isFormData ? {} : { "Content-Type": "application/json" };

    const options = {
        method,
        headers,
        credentials: "include",
    };

    if (body) {
        options.body = isFormData ? body : JSON.stringify(body);
    }

    const response = await fetch(`${API_BASE_URL}${path}`, options);
    return handleResponse(response);
};

const MessagesAPI = {
    listByUser: (userId) => request(`/mensagens/user/${userId}`),
    getConversation: (a, b) => request(`/mensagens/${a}/${b}`),
    send: (payload) => request(`/mensagens`, { method: "POST", body: payload }),
    delete: (id) => request(`/mensagens/${id}`, { method: "DELETE" }),
};

export default MessagesAPI;
