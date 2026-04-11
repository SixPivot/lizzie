import { useEffect, useState } from "react";
import { toast } from "sonner";
import { useAppStore } from "../store/appStore";

type SettingsSection = "azure-devops";

function EyeIcon({ visible }: { visible: boolean }) {
    if (visible) {
        return (
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
            </svg>
        );
    }
    return (
        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
        </svg>
    );
}

function SpinnerIcon() {
    return (
        <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
    );
}

function AzureDevOpsSection() {
    const setAzDoCredentials = useAppStore((s) => s.setAzDoCredentials);

    const [orgUrl, setOrgUrl] = useState("");
    const [pat, setPat] = useState("");
    const [patVisible, setPatVisible] = useState(false);
    const [loading, setLoading] = useState(false);
    const [orgUrlError, setOrgUrlError] = useState<string | null>(null);
    const [patError, setPatError] = useState<string | null>(null);
    const [azDoCredentialsValid, setAzDoCredentialsValid] = useState(false);

    useEffect(() => {
        window.electron.loadSettings().then(({ orgUrl: savedUrl, pat: savedPat }) => {
            if (savedUrl) setOrgUrl(savedUrl);
            if (savedPat) setPat(savedPat);
        });
    }, []);

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();

        // Client-side validation
        let hasError = false;
        if (!orgUrl.trim()) {
            setOrgUrlError("Organisation URL is required.");
            hasError = true;
        } else {
            setOrgUrlError(null);
        }
        if (!pat.trim()) {
            setPatError("Personal Access Token is required.");
            hasError = true;
        } else {
            setPatError(null);
        }
        if (hasError) return;

        setLoading(true);
        setOrgUrlError(null);
        setPatError(null);

        try {
            const result = await window.electron.saveAndTestSettings({ orgUrl: orgUrl.trim(), pat: pat.trim() });

            if (result.success) {
                toast.success("Connected to Azure DevOps successfully.");
                setAzDoCredentials(orgUrl.trim(), pat.trim());
                setAzDoCredentialsValid(true);
            } else {
                toast.error("Connection failed.");
                if (result.errorField === "orgUrl") {
                    setOrgUrlError(result.error ?? "An error occurred.");
                } else {
                    setPatError(result.error ?? "An error occurred.");
                }
            }
        } finally {
            setLoading(false);
        }
    }

    return (
        <form onSubmit={handleSubmit} className="max-w-lg space-y-6">
            <h2 className="text-xl font-semibold">Azure DevOps</h2>

            <div className="space-y-1">
                <label htmlFor="orgUrl" className="block text-sm font-medium">
                    Organisation URL
                </label>
                <input
                    id="orgUrl"
                    type="text"
                    value={orgUrl}
                    onChange={(e) => setOrgUrl(e.target.value)}
                    placeholder="https://dev.azure.com/your-organisation"
                    className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-800"
                    disabled={loading}
                />
                {orgUrlError && (
                    <p className="text-sm text-red-600 dark:text-red-400">{orgUrlError}</p>
                )}
            </div>

            <div className="space-y-1">
                <label htmlFor="pat" className="block text-sm font-medium">
                    Personal Access Token
                </label>
                <div className="flex items-center gap-2">
                    <input
                        id="pat"
                        type={patVisible ? "text" : "password"}
                        value={pat}
                        onChange={(e) => setPat(e.target.value)}
                        placeholder="Paste your PAT here"
                        className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-800"
                        disabled={loading}
                    />
                    <button
                        type="button"
                        onClick={() => setPatVisible((v) => !v)}
                        className="shrink-0 rounded-md p-2 text-gray-500 hover:bg-gray-100 hover:text-gray-700 dark:hover:bg-gray-700 dark:hover:text-gray-300"
                        aria-label={patVisible ? "Hide PAT" : "Show PAT"}
                    >
                        <EyeIcon visible={patVisible} />
                    </button>
                </div>
                {patError && (
                    <p className="text-sm text-red-600 dark:text-red-400">{patError}</p>
                )}
            </div>

            {azDoCredentialsValid && (
                <p className="text-sm text-green-600 dark:text-green-400">
                    Azure DevOps credentials are valid.
                </p>
            )}

            <button
                type="submit"
                disabled={loading}
                className="inline-flex items-center gap-2 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
                {loading && <SpinnerIcon />}
                {loading ? "Testing..." : "Apply and test"}
            </button>
        </form>
    );
}

const sections: { id: SettingsSection; label: string }[] = [
    { id: "azure-devops", label: "Azure DevOps" },
];

export function SettingsPage() {
    const [activeSection, setActiveSection] = useState<SettingsSection>("azure-devops");

    return (
        <div className="flex h-full">
            {/* Sidebar */}
            <nav className="w-52 shrink-0 border-r border-gray-200 dark:border-gray-700 p-4">
                <h1 className="mb-4 text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                    Settings
                </h1>
                <ul className="space-y-1">
                    {sections.map((section) => (
                        <li key={section.id}>
                            <button
                                type="button"
                                onClick={() => setActiveSection(section.id)}
                                className={`w-full rounded-md px-3 py-2 text-left text-sm font-medium transition-colors ${
                                    activeSection === section.id
                                        ? "bg-blue-50 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300"
                                        : "text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800"
                                }`}
                            >
                                {section.label}
                            </button>
                        </li>
                    ))}
                </ul>
            </nav>

            {/* Content area */}
            <main className="flex-1 overflow-auto p-8">
                {activeSection === "azure-devops" && <AzureDevOpsSection />}
            </main>
        </div>
    );
}

