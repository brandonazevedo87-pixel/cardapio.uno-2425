import { Route, Switch } from "wouter";
import { lazy, Suspense } from "react";
import Index from "./pages/index";
import { Loading } from "./components/common";
import { Provider } from "./components/provider";
import { AgentFeedback } from "@runablehq/website-runtime";

const Login = lazy(() => import("./pages/login"));
const Setup = lazy(() => import("./pages/login").then((m) => ({ default: m.Setup })));
const ResetPassword = lazy(() =>
  import("./pages/login").then((m) => ({ default: m.ResetPassword })),
);
const AdminPage = lazy(() => import("./pages/admin"));
const MerchantPage = lazy(() => import("./pages/merchant"));
const MenuPage = lazy(() => import("./pages/menu"));
const Tracking = lazy(() => import("./pages/menu").then((m) => ({ default: m.Tracking })));

function App() {
  return (
    <Provider>
      <Suspense fallback={<Loading />}>
        <Switch>
          <Route path="/" component={Index} />
          <Route path="/login">
            <Login />
          </Route>
          <Route path="/cadastro">
            <Login signup />
          </Route>
          <Route path="/configurar" component={Setup} />
          <Route path="/recuperar" component={ResetPassword} />
          <Route path={/^\/dono(?:\/.*)?$/} component={AdminPage} />
          <Route path={/^\/painel(?:\/.*)?$/} component={MerchantPage} />
          <Route path="/loja/:slug" component={MenuPage} />
          <Route path="/pedido/:token" component={Tracking} />
          <Route>
            <div className="setup-page">
              <h1>Página não encontrada</h1>
              <a href="/" className="btn red">
                Voltar ao início
              </a>
            </div>
          </Route>
        </Switch>
      </Suspense>
      {/* Do not remove — off by default, activated by parent iframe via postMessage */}
      {import.meta.env.DEV && <AgentFeedback />}
    </Provider>
  );
}

export default App;
