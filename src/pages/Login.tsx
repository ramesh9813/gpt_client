import "./Login.css";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
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
  const queryClient = useQueryClient();
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
      await queryClient.invalidateQueries({ queryKey: ["me"] });
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
      await queryClient.invalidateQueries({ queryKey: ["me"] });
      const redirect = (location.state as any)?.from?.pathname || "/";
      navigate(redirect, { replace: true });
    } catch (err: any) {
      setError(err?.error?.message || err?.message || "Google sign-in failed");
    } finally {
      setGoogleLoading(false);
    }
  };

  return (
    <div className="login-page">
      <div className="login-container">
        <h1 className="login-title">Welcome back</h1>
        <p className="login-subtitle">
          Sign in to continue to ChatUI.
        </p>
        <form onSubmit={handleSubmit(onSubmit)} className="login-form">
          <div>
            <label className="login-label">Email</label>
            <Input type="email" placeholder="you@example.com" {...register("email")} />
          </div>
          <div>
            <label className="login-label">Password</label>
            <Input type="password" placeholder="Password" {...register("password")} />
          </div>
          {error ? (
            <div className="login-error">
              {error}
            </div>
          ) : null}
          <Button type="submit" className="login-submit" disabled={isSubmitting}>
            {isSubmitting ? "Signing in..." : "Sign in"}
          </Button>
        </form>
        <div className="login-alt-wrap">
          <Button
            variant="outline"
            className="login-google-btn"
            onClick={onGoogleLogin}
            disabled={googleLoading}
          >
            {googleLoading ? "Connecting..." : "Continue with Google"}
          </Button>
        </div>
        <p className="login-footer">
          No account?{" "}
          <Link className="login-link" to="/signup">
            Create one
          </Link>
        </p>
      </div>
    </div>
  );
};

export default Login;
