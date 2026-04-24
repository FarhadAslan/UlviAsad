import Link from "next/link";

export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="text-center">
        <div className="text-8xl font-extrabold text-[#1a7fe0] mb-4">404</div>
        <h1 className="text-3xl font-bold text-slate-900 mb-4">Səhifə Tapılmadı</h1>
        <p className="text-slate-500 mb-8">Axtardığınız səhifə mövcud deyil və ya silinib.</p>
        <Link href="/" className="btn-primary">Ana Səhifəyə Qayıt</Link>
      </div>
    </div>
  );
}
