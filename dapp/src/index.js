
import React from "react";
import ReactDOM from "react-dom";
import App from "./App";
import { DrizzleProvider } from "./drizzle/drizzleContext";
import { Provider as ReduxProvider } from "react-redux";
import options from "./drizzle/drizzleOptions";
import { Drizzle, generateStore } from "@drizzle/store";
import logger from "redux-logger";
import './index.css';

const store = generateStore({
  drizzleOptions: options,
  appMiddlewares: [logger],
});

const drizzle = new Drizzle(options, store);

ReactDOM.render(
<React.StrictMode>
<ReduxProvider store={drizzle.store}>
    <DrizzleProvider drizzle={drizzle}>
    <App />
    </DrizzleProvider>
    </ReduxProvider>
    </React.StrictMode>,
document.getElementById("root")
);

<LoadingContainer>
    <App/>
</LoadingContainer>