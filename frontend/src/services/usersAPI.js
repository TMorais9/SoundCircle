export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:3000";

async function handleResponse(response) {
    const data = await response.json().catch(() => null);
    if (!response.ok) {
        const message =
            data?.message ||
            data?.error ||
            `Erro ao comunicar com o servidor (${response.status})`;
        throw new Error(message);
    }
    return data;
}

async function request(path, { method = "GET", body } = {}) {
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
}

const UsersAPI = {
    login: (credentials) => request("/users/login", { method: "POST", body: credentials }),
    register: (payload) => request("/users", { method: "POST", body: payload }),
    listUsers: () => request("/users"),
    getProfile: (id) => request(`/users/${id}/profile`),
    updateProfile: (id, payload) => request(`/users/${id}`, { method: "PUT", body: payload }),
    updatePassword: (id, password) =>
        request(`/users/${id}/password`, { method: "PUT", body: { password } }),
    uploadPhoto: (id, file) => {
        const formData = new FormData();
        formData.append("photo", file);
        return request(`/users/${id}/photo`, { method: "POST", body: formData });
    },
};

export default UsersAPI;
