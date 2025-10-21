// Libraries
import { HashRouter, Navigate, Route, Routes } from "react-router-dom";
// import { AuthProvider, useIsAuthenticated } from "react-auth-kit";

// Components
import Home from "./pages/home";

// const Private = ({ Component }: { Component: React.FC }) => {
//     // This component is used to check if the user is logged in, if not, it will redirect the user to the login page
//     const auth = useIsAuthenticated()();
//     return auth ? <Component /> : <Navigate to="/" />;
// };

const routes = [
    { path: "/", element: <Home /> },
    // { path: "/inicio", element: <Private Component={Home} /> },
    // { path: "/utilizadores", element: <Private Component={Users} /> },
    // { path: "/materiais", element: <Private Component={Material} /> },
    // { path: "/logout", element: <Private Component={Logout} /> },
    { path: "*", element: <Navigate to="/" /> },
];

const App = () => (
    // <AuthProvider authType="localstorage" authName="_auth">
    <HashRouter basename="">
        <Routes>
            {routes.map((route, index) => (
                <Route key={index} path={route.path} element={route.element} />
            ))}
        </Routes>
    </HashRouter>
    // </AuthProvider>
);

export default App;
