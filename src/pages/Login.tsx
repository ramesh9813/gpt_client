import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Button } from "../components/Button";
import { Input } from "../components/Input";
import { apiFetch } from "../lib/api";
import { signInWithGoogle } from "../lib/firebase";

const schema = z.object({
  email: z.string().email(),
  password: z.string().min(8)
});

type FormValues = z.infer<typeof schema>;

const Login = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [error, setError] = useState<string | null>(null);
  const [googleLoading, setGoogleLoading] = useState(false);
  const {
    register,
    handleSubmit,
    formState: { isSubmitting }
  } = useForm<FormValues>({ resolver: zodResolver(schema) });

  const onSubmit = async (values: FormValues) => {
    setError(null);
    try {
      await apiFetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values)
      });
      const redirect = (location.state as any)?.from?.pathname || "/";
      navigate(redirect, { replace: true });
    } catch (err: any) {
      setError(err?.error?.message || err?.message || "Login failed");
    }
  };

  const onGoogleLogin = async () => {
    setError(null);
    setGoogleLoading(true);
    try {
      const user = await signInWithGoogle();
      const token = await user.getIdToken();
      await apiFetch("/api/auth/google", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` }
      });
      const redirect = (location.state as any)?.from?.pathname || "/";
      navigate(redirect, { replace: true });
    } catch (err: any) {
      setError(err?.error?.message || err?.message || "Google sign-in failed");
    } finally {
      setGoogleLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[var(--bg)] text-[var(--text)]">
      <div className="mx-auto flex min-h-screen w-full max-w-md flex-col justify-center px-6">
        <h1 className="mb-2 text-2xl font-semibold">Welcome back</h1>
        <p className="mb-6 text-sm text-[var(--muted)]">
          Sign in to continue to ChatUI.
        </p>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div>
            <label className="mb-1 block text-sm">Email</label>
            <Input type="email" placeholder="you@example.com" {...register("email")} />
          </div>
          <div>
            <label className="mb-1 block text-sm">Password</label>
            <Input type="password" placeholder="Password" {...register("password")} />
          </div>
          {error ? (
            <div className="rounded-lg border border-red-500/40 bg-red-500/10 p-2 text-sm text-red-200">
              {error}
            </div>
          ) : null}
          <Button type="submit" className="w-full" disabled={isSubmitting}>
            {isSubmitting ? "Signing in..." : "Sign in"}
          </Button>
        </form>
        <div className="mt-4">
          <Button
            variant="outline"
            className="w-full"
            onClick={onGoogleLogin}
            disabled={googleLoading}
          >
            {googleLoading ? "Connecting..." : "Continue with Google"}
          </Button>
        </div>
        <p className="mt-4 text-sm text-[var(--muted)]">
          No account?{" "}
          <Link className="text-[var(--accent)]" to="/signup">
            Create one
          </Link>
        </p>
      </div>
    </div>
  );
};

export default Login;
