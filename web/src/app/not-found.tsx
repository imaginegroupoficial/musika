import Link from 'next/link';

export default function NotFound() {
  return (
    <section className="py-16">
      <h1 className="titulo-xl">Essa página saiu do ar.</h1>
      <p className="mt-4 text-lg text-nevoa">O link pode ter mudado ou o lançamento foi removido pelo artista.</p>
      <Link href="/" className="mt-8 inline-flex h-12 items-center rounded-full bg-sol px-6 font-semibold text-noite">Voltar ao início</Link>
    </section>
  );
}
