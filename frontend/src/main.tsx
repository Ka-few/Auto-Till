import React from "react";
import ReactDOM from "react-dom/client";
import "./styles.css";

function App() {
  return (
    <main className="shell">
      <section className="intro">
        <p className="eyebrow">AutoTill MVP</p>
        <h1>Foundation Ready</h1>
        <p>
          Phase 1 scaffolds the React frontend, Express backend, Prisma data model, and validation
          schemas. Dashboard workflows begin after the backend ledger and payout phases are complete.
        </p>
      </section>
    </main>
  );
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
