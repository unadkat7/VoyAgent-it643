"use client";

import React, { useState } from "react";
import Link from "next/link";
import { Eye, EyeOff, Lock, Mail } from "lucide-react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";

import AuthShell from "@/components/layout/AuthShell";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import { login } from "@/services/auth.service";

export default function LoginPage() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const [formError, setFormError] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email || !password) return toast.error("Please fill all fields");

    setFormError("");
    try {
      setLoading(true);
      const data = await login({ email, password });
      toast.success(data.message);
      router.push("/dashboard");
    } catch (error) {
      setFormError(error.response?.data?.message || "Could not sign in. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell
      eyebrow="Your Personal Travel Desk"
      headline="Your AI travel team, working"
      accentWord="in parallel."
      description="Stays, flights, day-by-day itineraries, and an interactive OpenStreetMap Trip Map—checked against your INR Budget before you ever leave."
      title="Welcome back"
      subtitle="Sign in to access your saved Trip Plans and drafts."
      footer={
        <p className="text-center text-sm text-muted">
          No account yet?{" "}
          <Link href="/signup" className="text-primary font-semibold hover:underline">
            Create one
          </Link>
        </p>
      }
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <Input
          label="Email"
          id="email"
          type="email"
          autoComplete="email"
          placeholder="you@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          icon={Mail}
          required
        />

        <Input
          label="Password"
          id="password"
          type={showPassword ? "text" : "password"}
          autoComplete="current-password"
          placeholder="••••••••"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          icon={Lock}
          required
          rightElement={
            <button
              type="button"
              aria-label={showPassword ? "Hide password" : "Show password"}
              onClick={() => setShowPassword(!showPassword)}
              className="text-muted hover:text-ink transition-colors inline-grid size-11 place-items-center rounded-lg"
            >
              {showPassword ? <EyeOff size={16} aria-hidden /> : <Eye size={16} aria-hidden />}
            </button>
          }
        />

        {formError && <p role="alert" className="text-sm text-danger">{formError}</p>}
        <Button type="submit" loading={loading} disabled={loading} className="mt-2">
          {loading ? "Signing in..." : "Sign In"}
        </Button>
      </form>
    </AuthShell>
  );
}
