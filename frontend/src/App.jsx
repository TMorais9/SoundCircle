// Libraries
import { HashRouter, Navigate, Route, Routes } from "react-router-dom";
import AuthProvider from "react-auth-kit";
import useIsAuthenticated from "react-auth-kit/hooks/useIsAuthenticated";
import createAuthStore from "react-auth-kit/store/createAuthStore";
import Home from "./pages/home";
import Info from "./pages/info";
import Messages from "./pages/messages";
import Ai from "./pages/ai";
import Conta from "./pages/conta";
import Search from "./pages/search";

const store = createAuthStore("cookie", {
    authName: "_auth",
    cookieDomain: window.location.hostname,
    cookieSecure: window.location.protocol === "https:",
    cookieSameSite: "lax",
    cookiePath: "/",
});

const RequireAuth = ({ children }) => {
    const authed = useIsAuthenticated();
    const hasUserId =
        typeof window !== "undefined" ? window.localStorage.getItem("userId") : null;
    if (!authed && !hasUserId) {
        return <Navigate to="/conta" replace />;
    }
    return children;
};

const App = () => (
    <AuthProvider store={store}>
        <HashRouter>
            <Routes>
                <Route path="/" element={<Home />} />
                <Route path="/conta" element={<Conta />} />
                <Route
                    path="/info/:id?"
                    element={
                        <RequireAuth>
                            <Info />
                        </RequireAuth>
                    }
                />
                <Route
                    path="/search"
                    element={
                        <RequireAuth>
                            <Search />
                        </RequireAuth>
                    }
                />
                <Route
                    path="/messages"
                    element={
                        <RequireAuth>
                            <Messages />
                        </RequireAuth>
                    }
                />
                <Route
                    path="/ai"
                    element={
                        <RequireAuth>
                            <Ai />
                        </RequireAuth>
                    }
                />
                <Route path="*" element={<Navigate to="/" />} />
            </Routes>
        </HashRouter>
    </AuthProvider>
);

export default App;
