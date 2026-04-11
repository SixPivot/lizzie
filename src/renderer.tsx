import { createRoot } from "react-dom/client";
import "./index.css";

function App() {
    return (
        <div className="p-4">
            <h1 className="text-2xl font-bold">AzDO Project Management</h1>
        </div>
    );
}

const root = document.getElementById("root");
if (!root) {
    throw new Error("Root element not found");
}

createRoot(root).render(<App />);

console.log(
  '👋 This message is being logged by "renderer.ts", included via Vite',
);
