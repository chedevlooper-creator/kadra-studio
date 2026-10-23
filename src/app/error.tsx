"use client";

export default function ErrorPage({ reset }: { reset: () => void }) {
  return <main className="error-page"><div className="brand-mark">k</div><p className="eyebrow">KADRA STUDIO</p><h1>Bir şeyler yolunda gitmedi.</h1><p>Çalışma alanı yüklenemedi. Yerel veri klasörünün erişilebilir olduğundan emin ol ve yeniden dene.</p><button className="btn btn-primary" onClick={reset}>Yeniden dene</button></main>;
}
