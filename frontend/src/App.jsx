// Libraries
import { HashRouter, Navigate, Route, Routes } from "react-router-dom";
import AuthProvider from "react-auth-kit";
import createAuthStore from "react-auth-kit/store/createAuthStore";
import Home from "./pages/home";
import Info from "./pages/info";
import Messages from "./pages/Messages";
import Ai from "./pages/Ai";
import Conta from "./pages/Conta";

const store = createAuthStore("cookie", {
    authName: "_auth",
    cookieDomain: window.location.hostname,
    cookieSecure: window.location.protocol === "https:",
    cookieSameSite: "lax",
    cookiePath: "/",
});

const App = () => (
    <AuthProvider store={store}>
        <HashRouter>
            <Routes>
                <Route path="/" element={<Home />} />
                <Route path="/info/:id?" element={<Info />} />
                <Route path="/messages" element={<Messages />} />
                <Route path="/ai" element={<Ai />} />
                <Route path="/conta" element={<Conta />} />
                <Route path="*" element={<Navigate to="/" />} />
            </Routes>
        </HashRouter>
    </AuthProvider>
);

export default App;
