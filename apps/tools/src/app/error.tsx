"use client";
export default function ErrorPage({ reset }: { reset: () => void }) { return <div className="login"><section className="login-card"><p className="eyebrow">Kopa Tools</p><h1>Data could not be loaded.</h1><p>Check the server environment and Supabase connection, then try again.</p><button className="primary" onClick={reset}>Try again</button></section></div>; }
