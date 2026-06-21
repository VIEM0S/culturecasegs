import { Component } from "react";
import { getDB, getCurrentUser, addDoc, collection } from "./firebase.js";

// ── Error Boundary ───────────────────────────────────────────────────────────
// Capte les erreurs React non gérées (un composant qui plante) pour éviter
// un écran totalement blanc. Journalise l'erreur dans Firestore (error_logs)
// si un admin est connecté, puis affiche un écran de secours avec bouton reload.
class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error, info) {
    console.error("ErrorBoundary a capté une erreur :", error, info);
    this._logToFirestore(error);
  }

  async _logToFirestore(error) {
    try {
      // error_logs exige request.auth != null à l'écriture (voir firestore.rules) —
      // on ne tente donc d'écrire que si un utilisateur est authentifié.
      if (!getCurrentUser()) return;

      await addDoc(collection(getDB(), "error_logs"), {
        message: String(error?.message || error || "Erreur inconnue").slice(0, 500),
        page: window.location.hash || window.location.pathname,
        userAgent: navigator.userAgent,
        createdAt: new Date().toISOString(),
      });
    } catch (logError) {
      // On ne fait pas planter l'app si même le log échoue.
      console.error("Échec de l'envoi du log d'erreur :", logError);
    }
  }

  render() {
    if (this.state.hasError) {
      return (
        <div
          style={{
            minHeight: "100vh",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: "1rem",
            padding: "2rem",
            textAlign: "center",
            fontFamily: "system-ui, sans-serif",
          }}
        >
          <h1 style={{ fontSize: "1.25rem", margin: 0 }}>
            Une erreur est survenue
          </h1>
          <p style={{ opacity: 0.7, margin: 0 }}>
            Le backoffice a rencontré un problème inattendu. L'erreur a été
            enregistrée.
          </p>
          <button
            onClick={() => window.location.reload()}
            style={{
              padding: "0.6rem 1.2rem",
              borderRadius: "6px",
              border: "none",
              cursor: "pointer",
              fontWeight: 600,
            }}
          >
            Recharger la page
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
