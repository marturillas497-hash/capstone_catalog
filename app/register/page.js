"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { ArrowLeft, Eye, EyeOff, FileText, X } from "lucide-react";

function capitalizeName(value) {
  return value
    .split(" ")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

const ROLE_OPTIONS = [
  { value: "student", label: "Student" },
  { value: "capstone_adviser", label: "Capstone Adviser" },
];

function TermsModal({ onClose }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm animate-fade-in" onClick={onClose} />
      <div className="relative bg-background shadow-xl rounded-2xl w-full max-w-lg max-h-[80vh] flex flex-col animate-modal-in">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <h2 className="font-sans font-semibold text-base text-foreground flex items-center gap-2">
            <FileText className="w-4 h-4 text-slate-500" strokeWidth={1.75} />
            Terms and Conditions
          </h2>
          <button
            onClick={onClose}
            className="text-slate-500 hover:text-foreground transition"
          >
            <X className="w-5 h-5" strokeWidth={1.75} />
          </button>
        </div>
        <div className="overflow-y-auto px-6 py-5 text-sm text-slate-600 space-y-4">

          <p>
            By creating an account on Capstone Library, you agree to use this
            system solely for academic purposes related to the BSIS program at
            Makilala Institute of Science and Technology (MIST).
          </p>
          <p>
            Your personal information, including your name, email address, and
            student ID, is collected and stored in accordance with Republic Act
            No. 10173, the Data Privacy Act of 2012. Your data will only be used
            to operate and improve this system and will not be shared with third
            parties without your consent, except as required by law.
          </p>
          <p>
            Similarity scan results and AI-generated advisory content are
            provided for informational purposes only. They do not constitute
            academic evaluation or formal assessment. All final decisions
            regarding capstone topic selection remain with the student, their
            assigned adviser, and the institution.
          </p>
          <p>
            Certain activities within the system, such as the similarity
            checks you submit, are recorded to help maintain the integrity
            and quality of the capstone library.
          </p>
          <p>
            These terms are subject to change. Continued use of the system
            following any update constitutes acceptance of the revised terms.
          </p>
        </div>
        <div className="px-6 py-4 border-t border-slate-100">
          <button
            onClick={onClose}
            className="w-full bg-navy text-white text-sm font-medium py-2.5 rounded-lg hover:bg-navy-light transition"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

function IdentityConfirmModal({ match, onConfirm, onReject, onClose }) {
  const alreadyRegistered = match?.alreadyRegistered;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm animate-fade-in" onClick={onClose} />
      <div className="relative bg-background shadow-xl rounded-2xl w-full max-w-sm p-6 animate-modal-in">
        <h2 className="font-display text-xl text-navy mb-1">
          {alreadyRegistered ? "Already Registered" : "Confirm Your Identity"}
        </h2>

        {alreadyRegistered ? (
          <>
            <p className="text-sm text-slate-600 mb-5">
              This student ID is already tied to an account under the name on
              file below. If this is you, sign in instead. If you believe
              this is a mistake, contact the librarian.
            </p>
            <div className="bg-navy/5 rounded-lg px-4 py-3 mb-5 text-sm">
              <p className="text-slate-500">
                Full name: <span className="text-foreground font-medium">{match.fullName}</span>
              </p>
              <p className="text-slate-500 mt-1">
                Student ID: <span className="text-foreground font-medium">{match.idNumber}</span>
              </p>
            </div>
            <button
              onClick={onClose}
              className="w-full bg-navy text-white text-sm font-medium py-2.5 rounded-lg hover:bg-navy-light transition"
            >
              Close
            </button>
          </>
        ) : (
          <>
            <p className="text-sm text-slate-600 mb-5">
              This is the name on file with the registrar for the student ID
              you entered.
            </p>
            <div className="bg-navy/5 rounded-lg px-4 py-3 mb-5 text-sm">
              <p className="text-slate-500">
                Full name: <span className="text-foreground font-medium">{match.fullName}</span>
              </p>
              <p className="text-slate-500 mt-1">
                Student ID: <span className="text-foreground font-medium">{match.idNumber}</span>
              </p>
            </div>
            <p className="text-sm font-medium text-foreground mb-4">Is this you?</p>
            <div className="flex gap-3">
              <button
                onClick={onConfirm}
                className="flex-1 bg-navy text-white text-sm font-medium py-2 rounded-lg hover:bg-navy-light transition"
              >
                Yes, this is me
              </button>
              <button
                onClick={onReject}
                className="flex-1 bg-slate-100 text-slate-600 text-sm font-medium py-2 rounded-lg hover:bg-slate-200 transition"
              >
                No, that's not me
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default function RegisterPage() {
  const router = useRouter();

  const [role, setRole] = useState("student");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [studentId, setStudentId] = useState("");
  const [adviserId, setAdviserId] = useState("");
  const [advisers, setAdvisers] = useState([]);
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [showTermsModal, setShowTermsModal] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Identity confirmation (student registration only). `verifiedId` tracks
  // which exact ID string the confirmation applies to, so editing the ID
  // field after confirming forces a fresh lookup rather than silently
  // reusing a stale "yes, that's me."
  const [checkingId, setCheckingId] = useState(false);
  const [idMatch, setIdMatch] = useState(null);
  const [verifiedId, setVerifiedId] = useState(null);

  useEffect(() => {
    async function fetchAdvisers() {
      const supabase = createClient();
      const { data } = await supabase
        .from("profiles")
        .select("id, full_name")
        .eq("role", "capstone_adviser")
        .eq("status", "active")
        .order("full_name");
      setAdvisers(data ?? []);
    }
    fetchAdvisers();
  }, []);

  function handleStudentIdChange(value) {
    setStudentId(value);
    // Any edit to the ID invalidates a prior "yes, that's me" confirmation.
    if (verifiedId !== null) setVerifiedId(null);
    if (idMatch) setIdMatch(null);
  }

  async function submitRegistration() {
    setLoading(true);

    const res = await fetch("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        role,
        fullName,
        email,
        password,
        studentId: role === "student" ? studentId : undefined,
        adviserId: role === "student" && adviserId ? adviserId : undefined,
        agreedToTerms,
      }),
    });

    const data = await res.json();

    if (!res.ok) {
      setError(data.error ?? "Something went wrong. Please try again.");
      setLoading(false);
      return;
    }

    router.push(
      role === "student" ? "/login?status=registered" : "/login?status=pending"
    );
  }

  async function handleRegister(e) {
    e.preventDefault();
    setError("");

    if (!agreedToTerms) {
      setError("You must accept the Terms and Conditions to register.");
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }

    // Capstone advisers have no whitelist ID to confirm — proceed directly.
    if (role !== "student") {
      submitRegistration();
      return;
    }

    // Already confirmed this exact ID via the modal — submit directly.
    if (verifiedId === studentId.trim()) {
      submitRegistration();
      return;
    }

    // Look up the ID and surface the "Is this you?" confirmation instead of
    // creating the account immediately.
    setCheckingId(true);
    try {
      const res = await fetch("/api/auth/register/verify-id", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ studentId: studentId.trim() }),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error ?? "Could not verify your student ID. Please try again.");
        return;
      }

      if (!data.found) {
        setError("Your student ID was not found in the system.");
        return;
      }

      setIdMatch(data);
    } finally {
      setCheckingId(false);
    }
  }

  function handleConfirmIdentity() {
    setVerifiedId(studentId.trim());
    setIdMatch(null);
    submitRegistration();
  }

  function handleRejectIdentity() {
    setIdMatch(null);
    setStudentId("");
  }

  const inputClass =
    "w-full px-3 py-2 rounded-lg bg-background shadow-neo-inset border-none text-sm text-foreground placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-navy/20 neo-transition";

  const passwordInputClass =
    "w-full px-3 py-2 pr-10 rounded-lg bg-background shadow-neo-inset border-none text-sm text-foreground placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-navy/20 neo-transition";

  return (
    <>
      {showTermsModal && <TermsModal onClose={() => setShowTermsModal(false)} />}

      {idMatch && (
        <IdentityConfirmModal
          match={idMatch}
          onConfirm={handleConfirmIdentity}
          onReject={handleRejectIdentity}
          onClose={() => setIdMatch(null)}
        />
      )}

      <div className="min-h-screen bg-background flex items-center justify-center px-4 py-10">
        <div className="w-full max-w-md animate-page-ease-in">

          {/* Back link */}
          <Link
            href="/login"
            className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-foreground mb-6 transition"
          >
            <ArrowLeft className="w-4 h-4" strokeWidth={1.75} />
            Back to sign in
          </Link>

          {/* Header */}
          <div className="mb-6">
            <h1 className="font-display text-3xl text-navy mb-1">Create an account</h1>
            <p className="text-sm text-slate-600">
              MIST, Bachelor of Science in Information Systems
            </p>
          </div>

          {/* Card */}
          <div className="bg-background shadow-neo neo-transition rounded-2xl overflow-hidden">

            {/* Orange accent strip */}
            <div className="h-1 bg-orange" />

            <div className="p-8">
              <form onSubmit={handleRegister} className="space-y-4">

                {/* Role selector */}
                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">
                    Registering as
                  </label>
                  <div className="relative flex bg-slate-100 rounded-lg p-1">
                    <div
                      className="absolute top-1 bottom-1 rounded-md bg-navy transition-transform duration-300 ease-in-out"
                      style={{
                        width: "calc(50% - 4px)",
                        marginLeft: "4px",
                        transform: `translateX(${ROLE_OPTIONS.findIndex((o) => o.value === role) * 100}%)`,
                      }}
                    />
                    {ROLE_OPTIONS.map((opt) => (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => setRole(opt.value)}
                        className={`relative z-10 flex-1 py-2 px-3 rounded-md text-sm font-medium transition-colors duration-300 ${
                          role === opt.value ? "text-white" : "text-slate-600 hover:text-navy"
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Full name */}
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">
                    Full name
                  </label>
                  <input
                    type="text"
                    value={fullName}
                    onChange={(e) => setFullName(capitalizeName(e.target.value))}
                    required
                    placeholder="Juan Dela Cruz"
                    className={inputClass}
                  />
                </div>

                {/* Email */}
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">
                    Email address
                  </label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    placeholder="you@example.com"
                    className={inputClass}
                  />
                </div>

                {/* Password */}
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">
                    Password
                  </label>
                  <div className="relative">
                    <input
                      type={showPassword ? "text" : "password"}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      placeholder="Min. 8 characters"
                      className={passwordInputClass}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((v) => !v)}
                      className="absolute inset-y-0 right-0 flex items-center px-3 text-slate-400 hover:text-slate-600 transition"
                      tabIndex={-1}
                    >
                      {showPassword ? (
                        <EyeOff className="w-4 h-4" strokeWidth={1.75} />
                      ) : (
                        <Eye className="w-4 h-4" strokeWidth={1.75} />
                      )}
                    </button>
                  </div>
                </div>

                {/* Confirm password */}
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">
                    Confirm password
                  </label>
                  <div className="relative">
                    <input
                      type={showConfirmPassword ? "text" : "password"}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      required
                      placeholder="••••••••"
                      className={passwordInputClass}
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword((v) => !v)}
                      className="absolute inset-y-0 right-0 flex items-center px-3 text-slate-400 hover:text-slate-600 transition"
                      tabIndex={-1}
                    >
                      {showConfirmPassword ? (
                        <EyeOff className="w-4 h-4" strokeWidth={1.75} />
                      ) : (
                        <Eye className="w-4 h-4" strokeWidth={1.75} />
                      )}
                    </button>
                  </div>
                </div>

                {/* Student-only fields */}
                {role === "student" && (
                  <>
                    <div>
                      <label className="block text-sm font-medium text-foreground mb-1">
                        Student ID
                      </label>
                      <input
                        type="text"
                        value={studentId}
                        onChange={(e) => handleStudentIdChange(e.target.value)}
                        required
                        placeholder="e.g. 2316075"
                        className={inputClass}
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-foreground mb-1">
                        Capstone Adviser{" "}
                        <span className="text-slate-500 font-normal">
                          (optional, you can set this later)
                        </span>
                      </label>
                      <select
                        value={adviserId}
                        onChange={(e) => setAdviserId(e.target.value)}
                        className={inputClass}
                      >
                        <option value="">No adviser selected</option>
                        {advisers.map((a) => (
                          <option key={a.id} value={a.id}>
                            {a.full_name}
                          </option>
                        ))}
                      </select>
                    </div>
                  </>
                )}

                {/* Terms and Conditions checkbox */}
                <div className="flex items-start gap-2.5 pt-1">
                  <input
                    id="terms"
                    type="checkbox"
                    checked={agreedToTerms}
                    onChange={(e) => setAgreedToTerms(e.target.checked)}
                    className="mt-0.5 h-4 w-4 rounded border-slate-300 accent-navy cursor-pointer"
                  />
                  <label htmlFor="terms" className="text-sm text-slate-600 leading-snug cursor-pointer">
                    I have read and agree to the{" "}
                    <button
                      type="button"
                      onClick={() => setShowTermsModal(true)}
                      className="text-orange font-medium hover:underline"
                    >
                      Terms and Conditions
                    </button>
                  </label>
                </div>

                {/* Inline error */}
                {error && <p className="text-sm text-red-600">{error}</p>}

                <button
                  type="submit"
                  disabled={loading || checkingId || !agreedToTerms}
                  className="w-full bg-navy text-white text-sm font-medium py-2.5 rounded-lg hover:bg-navy-light transition disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading
                    ? "Creating account…"
                    : checkingId
                    ? "Checking student ID…"
                    : "Create account"}
                </button>
              </form>

              <p className="mt-5 text-center text-sm text-slate-600">
                Already have an account?{" "}
                <a href="/login" className="text-orange font-medium hover:underline">
                  Sign in
                </a>
              </p>
            </div>
          </div>

          {/* Adviser pending note */}
          {role === "capstone_adviser" && (
            <p className="mt-4 text-center text-xs text-slate-500 px-4">
              Adviser accounts require admin approval before access is granted.
              You will receive an email notification once your application is reviewed.
            </p>
          )}
        </div>
      </div>
    </>
  );
}