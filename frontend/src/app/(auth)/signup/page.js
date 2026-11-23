"use client";

import React, { useState } from "react";
import Link from "next/link";
import { Check, Eye, EyeOff, Lock, Mail, User } from "lucide-react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";

import AuthShell from "@/components/layout/AuthShell";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import { signup } from "@/services/auth.service";

// Must match the backend's signup rule.
const MIN_PASSWORD_LENGTH = 8;

export default function SignupPage() {
  const router = useRouter();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);

  const meetsLength = password.length >= MIN_PASSWORD_LENGTH;
  const passwordsMatch = Boolean(confirmPassword) && password === confirmPassword;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name || !email || !password || !confirmPassword)
      return toast.error("Please fill all fields");
    if (password.length < MIN_PASSWORD_LENGTH)
      return toast.error(`Password must be at least ${MIN_PASSWORD_LENGTH} characters`);
    if (password !== confirmPassword)
      return toast.error("Passwords do not match");

    try {
      setLoading(true);
      const sourceParam =
        typeof window !== "undefined"
          ? new URLSearchParams(window.location.search).get("source")
          : null;
      const signupSource = sourceParam === "share" ? "share_link" : undefined;
      const data = await signup({
        name,
        email,
        password,
        ...(signupSource ? { signupSource } : {}),
      });
      toast.success(data.message);
      // Signup already sets the session cookie, so go straight in.
      router.push("/dashboard");
    } catch (error) {
      const fieldErrors = error.response?.data?.errors;
      const firstFieldError = fieldErrors && Object.values(fieldErrors)[0]?.[0];
      toast.error(firstFieldError || error.response?.data?.message || "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell
      eyebrow="Start Your Atlas"
      headline="Three specialists. One feasible"
      accentWord="Trip Plan."
      description="Describe your destination, days, party size, and INR Budget in plain English—or build a guided Trip Brief in seconds."
      title="Create your account"
      subtitle="Free to use. Save and revisit every Trip Plan you create."
      footer={
        <p className="text-center text-sm text-[#73685E]">
          Already have an account?{" "}
          <Link href="/login" className="text-[#CE532D] font-semibold hover:underline">
            Sign in
          </Link>
        </p>
      }
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-3.5">
        <Input
          label="Full Name"
          id="name"
          type="text"
          autoComplete="name"
          placeholder="Aarav Mehta"
          value={name}
          onChange={(e) => setName(e.target.value)}
          icon={User}
          required
        />

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

        <div className="space-y-2">
          <Input
            label="Password"
            id="password"
            type={showPassword ? "text" : "password"}
            autoComplete="new-password"
            aria-describedby="password-rule"
            placeholder="Min. 8 characters"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            icon={Lock}
            required
            rightElement={
              <button
                type="button"
                aria-label={showPassword ? "Hide password" : "Show password"}
                onClick={() => setShowPassword(!showPassword)}
                className="text-[#73685E] hover:text-[#181411] transition-colors inline-grid size-11 place-items-center rounded-lg"
              >
                {showPassword ? <EyeOff size={16} aria-hidden /> : <Eye size={16} aria-hidden />}
              </button>
            }
          />
          <p id="password-rule"
              className={`text-xs flex items-center gap-1.5 ${
                meetsLength ? "text-[#15803D]" : "text-[#73685E]"
              }`}
            >
              <Check className={`w-3.5 h-3.5 ${meetsLength ? "opacity-100" : "opacity-30"}`} aria-hidden />
              At least {MIN_PASSWORD_LENGTH} characters
          </p>
        </div>

        <Input
          label="Confirm Password"
          id="confirmPassword"
          type={showConfirm ? "text" : "password"}
          autoComplete="new-password"
          placeholder="Repeat your password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          icon={Lock}
          error={
            confirmPassword.length > 0 && !passwordsMatch ? "Passwords do not match" : undefined
          }
          required
          rightElement={
            <button
              type="button"
              aria-label={showConfirm ? "Hide confirm password" : "Show confirm password"}
              onClick={() => setShowConfirm(!showConfirm)}
              className="text-[#73685E] hover:text-[#181411] transition-colors inline-grid size-11 place-items-center rounded-lg"
            >
              {showConfirm ? <EyeOff size={16} aria-hidden /> : <Eye size={16} aria-hidden />}
            </button>
          }
        />

        <Button type="submit" loading={loading} disabled={loading} className="mt-2">
          {loading ? "Creating account..." : "Create Account"}
        </Button>
        <p className="text-[11px] text-[#73685E] text-center">
          We record your country, device type and the pages you use to measure usage. We never
          store your full IP address.
        </p>
      </form>
    </AuthShell>
  );
}
