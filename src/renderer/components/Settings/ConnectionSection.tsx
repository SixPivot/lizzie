import { toast } from "sonner";
import { EyeIcon } from "../Shared/EyeIcon";
import { SpinnerIcon } from "../Shared/SpinnerIcon";
import { useEffect, useState } from "react";
import { useAppStore } from "../../store/appStore";

export function ConnectionSection() {
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
            <h2 className="text-xl font-semibold">Connection</h2>

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

