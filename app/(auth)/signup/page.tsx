import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { SignUpForm } from "@/components/SignUpForm";

export const metadata = {
  title: "Create account — TripForge",
};

export default async function SignUpPage() {
  const session = await getServerSession(authOptions);
  if (session) redirect("/dashboard");

  return (
    <div className="flex min-h-dvh items-center justify-center bg-cream px-4 py-12">
      <div className="w-full max-w-sm">
        {/* Branding */}
        <div className="mb-8 text-center">
          <h1 className="font-serif text-3xl font-semibold text-ink">TripForge</h1>
          <p className="mt-1 text-sm text-muted">Create your account to get started</p>
        </div>

        {/* Form card */}
        <div className="rounded-2xl bg-parchment p-8 shadow-card">
          <SignUpForm />
        </div>
      </div>
    </div>
  );
}
