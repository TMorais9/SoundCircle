// Libraries
import { HashRouter, Navigate, Route, Routes } from "react-router-dom";
import { AuthProvider } from "react-auth-kit";
import { createStore, useIsAuthenticated } from "react-auth-kit";

// Components
import Home from "./pages/home";
import Info from "./pages/info";
import Messages from "./pages/Messages";
import Ai from "./pages/Ai";
import Conta from "./pages/Conta";

const Private = ({ Component }) => {
    // This component is used to check if the user is logged in, if not, it will redirect the user to the login page
    const auth = useIsAuthenticated()();
    return auth ? <Component /> : <Navigate to="/" />;
};

const store = createStore({
    authName: '_auth',
    authType: 'cookie',
    cookieDomain: window.location.hostname,
    cookieSecure: window.location.protocol === 'https:',
});

const routes = [
    { path: "/", element: <Home /> },
    { path: "/info", element: <Info /> },
    { path: "/messages", element: <Messages /> },
    { path: "/ai", element: <Ai /> },
    { path: "/conta", element: <Conta /> },
    { path: "/inicio", element: <Private Component={Home} /> },
    { path: "/utilizadores", element: <Private Component={Conta} /> },
    // { path: "/materiais", element: <Private Component={Material} /> },
    { path: "/logout", element: <Private Component={Conta} /> },
    { path: "*", element: <Navigate to="/" /> },
];

const App = () => (
    <AuthProvider store={store}>
        <HashRouter>
            <Routes>
                <Route path="/" element={<Home />} />
                <Route path="/info" element={<Info />} />
                <Route path="/messages" element={<Private Component={Messages} />} />
                <Route path="/ai" element={<Private Component={Ai} />} />
                <Route path="/conta" element={<Private Component={Conta} />} />
                <Route path="*" element={<Navigate to="/" />} />
            </Routes>
        </HashRouter>
    </AuthProvider>
);

export default App;
