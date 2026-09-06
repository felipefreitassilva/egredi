export function SignInButton() {
  return (
    <a
      href="/api/auth/login"
      className="inline-flex items-center gap-2 rounded-lg bg-linkedin px-4 py-2 font-semibold text-white transition-colors hover:bg-linkedin-hover"
    >
      Entrar com LinkedIn
    </a>
  );
}
