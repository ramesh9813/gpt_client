import "./Signup.css";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Link, useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
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
  const queryClient = useQueryClient();
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
      await queryClient.invalidateQueries({ queryKey: ["me"] });
      navigate("/", { replace: true });
    } catch (err: any) {
      setError(err?.error?.message || err?.message || "Signup failed");
    }
  };

  return (
    <div className="signup-page">
      <div className="signup-container">
        <h1 className="signup-title">Create your account</h1>
        <p className="signup-subtitle">
          Start chatting with ChatUI.
        </p>
        <form onSubmit={handleSubmit(onSubmit)} className="signup-form">
          <div>
            <label className="signup-label">Name</label>
            <Input type="text" placeholder="Optional" {...register("name")} />
          </div>
          <div>
            <label className="signup-label">Email</label>
            <Input type="email" placeholder="you@example.com" {...register("email")} />
          </div>
          <div>
            <label className="signup-label">Password</label>
            <Input type="password" placeholder="At least 8 characters" {...register("password")} />
          </div>
          {error ? (
            <div className="signup-error">
              {error}
            </div>
          ) : null}
          <Button type="submit" className="signup-submit" disabled={isSubmitting}>
            {isSubmitting ? "Creating..." : "Create account"}
          </Button>
        </form>
        <p className="signup-footer">
          Already have an account?{" "}
          <Link className="signup-link" to="/login">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
};

export default Signup;
