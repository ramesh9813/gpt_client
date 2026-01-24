import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "../components/Button";
import { Input } from "../components/Input";
import { apiFetch } from "../lib/api";

const schema = z.object({
  name: z.preprocess(
    (value) => {
      if (typeof value !== "string") return value;
      const trimmed = value.trim();
      return trimmed.length === 0 ? undefined : trimmed;
    },
    z.string().min(1).max(80).optional()
  ),
  email: z.string().email(),
  password: z.string().min(8)
});

type FormValues = z.infer<typeof schema>;

const Signup = () => {
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { isSubmitting }
  } = useForm<FormValues>({ resolver: zodResolver(schema) });

  const onSubmit = async (values: FormValues) => {
    setError(null);
    try {
      await apiFetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values)
      });
      navigate("/", { replace: true });
    } catch (err: any) {
      setError(err?.error?.message || err?.message || "Signup failed");
    }
  };

  return (
    <div className="min-h-screen bg-[var(--bg)] text-[var(--text)]">
      <div className="mx-auto flex min-h-screen w-full max-w-md flex-col justify-center px-6">
        <h1 className="mb-2 text-2xl font-semibold">Create your account</h1>
        <p className="mb-6 text-sm text-[var(--muted)]">
          Start chatting with ChatUI.
        </p>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div>
            <label className="mb-1 block text-sm">Name</label>
            <Input type="text" placeholder="Optional" {...register("name")} />
          </div>
          <div>
            <label className="mb-1 block text-sm">Email</label>
            <Input type="email" placeholder="you@example.com" {...register("email")} />
          </div>
          <div>
            <label className="mb-1 block text-sm">Password</label>
            <Input type="password" placeholder="At least 8 characters" {...register("password")} />
          </div>
          {error ? (
            <div className="rounded-lg border border-red-500/40 bg-red-500/10 p-2 text-sm text-red-200">
              {error}
            </div>
          ) : null}
          <Button type="submit" className="w-full" disabled={isSubmitting}>
            {isSubmitting ? "Creating..." : "Create account"}
          </Button>
        </form>
        <p className="mt-4 text-sm text-[var(--muted)]">
          Already have an account?{" "}
          <Link className="text-[var(--accent)]" to="/login">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
};

export default Signup;
