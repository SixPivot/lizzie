export default function HamburgerIcon(props: React.SVGProps<SVGSVGElement>) {
    return (
        <svg
            xmlns="http://www.w3.org/2000/svg"
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            {...props}
        >
            <line x1="3" y1="8" x2="21" y2="8" />
            <line x1="3" y1="12" x2="21" y2="12" />
            <line x1="3" y1="16" x2="21" y2="16" />
        </svg>
    );
}
