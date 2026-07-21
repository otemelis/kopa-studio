import Link from "next/link";
export default function UnauthorizedPage() { return <main className="login"><section className="login-card"><p className="eyebrow">Kopa Tools</p><h1>Access not approved</h1><p>Your account is signed in but is not approved for this internal tool.</p><Link className="primary" href="/login">Return to sign in</Link></section></main>; }
