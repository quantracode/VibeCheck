"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import { Lock, UserCheck, AlertTriangle, ChevronRight, CheckCircle, XCircle } from "lucide-react";

export default function AuthorizationPage() {
  return (
    <div className="max-w-4xl">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
            <UserCheck className="w-5 h-5 text-emerald-400" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-zinc-100">Authorization vs Authentication</h1>
            <p className="text-sm text-zinc-500">
              Understanding the critical difference
            </p>
          </div>
        </div>
      </motion.div>

      {/* Introduction */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.1 }}
        className="mb-8"
      >
        <p className="text-zinc-300 leading-relaxed mb-4">
          One of the most common security mistakes in web applications is confusing authentication with authorization.
          While they sound similar, they serve fundamentally different purposes:
        </p>
      </motion.div>

      {/* Comparison Cards */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.15 }}
        className="grid md:grid-cols-2 gap-6 mb-8"
      >
        <div className="p-6 rounded-xl bg-zinc-900/50 border border-zinc-800">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center">
              <Lock className="w-5 h-5 text-blue-400" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-zinc-100">Authentication</h2>
              <p className="text-sm text-blue-400">WHO you are</p>
            </div>
          </div>
          <p className="text-zinc-400 mb-4">
            Verifies the identity of a user. Answers the question: &quot;Is this person who they claim to be?&quot;
          </p>
          <ul className="space-y-2 text-sm text-zinc-400">
            <li className="flex items-start gap-2">
              <CheckCircle className="w-4 h-4 text-blue-400 mt-0.5 shrink-0" />
              Login with username/password
            </li>
            <li className="flex items-start gap-2">
              <CheckCircle className="w-4 h-4 text-blue-400 mt-0.5 shrink-0" />
              OAuth/SSO sign-in
            </li>
            <li className="flex items-start gap-2">
              <CheckCircle className="w-4 h-4 text-blue-400 mt-0.5 shrink-0" />
              Session/JWT validation
            </li>
            <li className="flex items-start gap-2">
              <CheckCircle className="w-4 h-4 text-blue-400 mt-0.5 shrink-0" />
              Multi-factor authentication
            </li>
          </ul>
        </div>

        <div className="p-6 rounded-xl bg-zinc-900/50 border border-zinc-800">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-lg bg-emerald-500/10 flex items-center justify-center">
              <UserCheck className="w-5 h-5 text-emerald-400" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-zinc-100">Authorization</h2>
              <p className="text-sm text-emerald-400">WHAT you can do</p>
            </div>
          </div>
          <p className="text-zinc-400 mb-4">
            Determines what actions a verified user can perform. Answers: &quot;Does this person have permission to do this?&quot;
          </p>
          <ul className="space-y-2 text-sm text-zinc-400">
            <li className="flex items-start gap-2">
              <CheckCircle className="w-4 h-4 text-emerald-400 mt-0.5 shrink-0" />
              Role-based access control (RBAC)
            </li>
            <li className="flex items-start gap-2">
              <CheckCircle className="w-4 h-4 text-emerald-400 mt-0.5 shrink-0" />
              Resource ownership verification
            </li>
            <li className="flex items-start gap-2">
              <CheckCircle className="w-4 h-4 text-emerald-400 mt-0.5 shrink-0" />
              Permission checks
            </li>
            <li className="flex items-start gap-2">
              <CheckCircle className="w-4 h-4 text-emerald-400 mt-0.5 shrink-0" />
              Tenant isolation
            </li>
          </ul>
        </div>
      </motion.div>

      {/* The Problem */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.2 }}
        className="mb-8"
      >
        <h2 className="text-xl font-semibold text-zinc-100 mb-4 flex items-center gap-2">
          <AlertTriangle className="w-5 h-5 text-orange-400" />
          The Common Mistake
        </h2>
        <div className="p-6 rounded-xl bg-orange-500/5 border border-orange-500/20">
          <p className="text-zinc-300 mb-4">
            Many developers assume that having authentication is enough. They add <code className="text-emerald-400">getServerSession()</code> to
            their routes and consider them &quot;secure.&quot; But authentication alone doesn&apos;t prevent:
          </p>
          <ul className="space-y-3 text-sm text-zinc-400">
            <li className="flex items-start gap-2">
              <XCircle className="w-4 h-4 text-orange-400 mt-0.5 shrink-0" />
              <span><strong className="text-zinc-300">Regular users accessing admin routes</strong> - Without role checks, any logged-in user can access admin functionality</span>
            </li>
            <li className="flex items-start gap-2">
              <XCircle className="w-4 h-4 text-orange-400 mt-0.5 shrink-0" />
              <span><strong className="text-zinc-300">Users modifying other users&apos; data</strong> - Without ownership verification, User A can edit User B&apos;s posts</span>
            </li>
            <li className="flex items-start gap-2">
              <XCircle className="w-4 h-4 text-orange-400 mt-0.5 shrink-0" />
              <span><strong className="text-zinc-300">Cross-tenant data access</strong> - Without tenant isolation, users can access data from other organizations</span>
            </li>
          </ul>
        </div>
      </motion.div>

      {/* Code Examples */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.25 }}
        className="mb-8"
      >
        <h2 className="text-xl font-semibold text-zinc-100 mb-4">Code Examples</h2>

        {/* Vulnerable Example */}
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-2">
            <XCircle className="w-4 h-4 text-red-400" />
            <span className="text-sm font-medium text-red-400">Vulnerable: Authentication Only</span>
          </div>
          <pre className="p-4 rounded-xl bg-zinc-900 border border-zinc-800 overflow-x-auto text-sm">
            <code className="text-zinc-300">{`// api/admin/users/route.ts
export async function DELETE(request: Request) {
  const session = await getServerSession();
  if (!session) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  // VULNERABLE: Any authenticated user can delete users!
  const { userId } = await request.json();
  await prisma.user.delete({ where: { id: userId } });
  return Response.json({ success: true });
}`}</code>
          </pre>
        </div>

        {/* Safe Example */}
        <div>
          <div className="flex items-center gap-2 mb-2">
            <CheckCircle className="w-4 h-4 text-emerald-400" />
            <span className="text-sm font-medium text-emerald-400">Safe: Authentication + Authorization</span>
          </div>
          <pre className="p-4 rounded-xl bg-zinc-900 border border-zinc-800 overflow-x-auto text-sm">
            <code className="text-zinc-300">{`// api/admin/users/route.ts
export async function DELETE(request: Request) {
  const session = await getServerSession();
  if (!session) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  // AUTHORIZATION: Check user has admin role
  if (!["admin", "superuser"].includes(session.user.role)) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  const { userId } = await request.json();
  await prisma.user.delete({ where: { id: userId } });
  return Response.json({ success: true });
}`}</code>
          </pre>
        </div>
      </motion.div>

      {/* Authorization Rules */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.3 }}
        className="mb-8"
      >
        <h2 className="text-xl font-semibold text-zinc-100 mb-4">VibeCheck Authorization Rules</h2>
        <p className="text-zinc-400 mb-4">
          VibeCheck includes 4 rules specifically designed to detect missing authorization:
        </p>
        <div className="space-y-3">
          <RuleCard
            id="VC-AUTHZ-001"
            title="Admin Route Lacks Role Guard"
            severity="high"
            description="Detects admin routes with authentication but no role verification"
          />
          <RuleCard
            id="VC-AUTHZ-002"
            title="Ownership Check Missing"
            severity="critical"
            description="Detects IDOR vulnerabilities where userId is used without ownership verification"
          />
          <RuleCard
            id="VC-AUTHZ-003"
            title="Role Declared But Not Enforced"
            severity="medium"
            description="Detects when role types exist but handlers don't check them"
          />
          <RuleCard
            id="VC-AUTHZ-004"
            title="Server Trusts Client-Provided User ID"
            severity="critical"
            description="Detects handlers that use userId from request body instead of session"
          />
        </div>
      </motion.div>

      {/* Best Practices */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.35 }}
        className="mb-8"
      >
        <h2 className="text-xl font-semibold text-zinc-100 mb-4">Best Practices</h2>
        <div className="p-6 rounded-xl bg-zinc-900/50 border border-zinc-800">
          <ul className="space-y-4 text-zinc-400">
            <li className="flex items-start gap-3">
              <div className="w-6 h-6 rounded-full bg-emerald-500/10 flex items-center justify-center shrink-0 mt-0.5">
                <span className="text-emerald-400 text-xs font-bold">1</span>
              </div>
              <div>
                <strong className="text-zinc-200">Always derive user identity from the session</strong>
                <p className="text-sm mt-1">Never trust userId, tenantId, or ownerId from request body for write operations. Use session.user.id instead.</p>
              </div>
            </li>
            <li className="flex items-start gap-3">
              <div className="w-6 h-6 rounded-full bg-emerald-500/10 flex items-center justify-center shrink-0 mt-0.5">
                <span className="text-emerald-400 text-xs font-bold">2</span>
              </div>
              <div>
                <strong className="text-zinc-200">Add role checks to admin routes</strong>
                <p className="text-sm mt-1">Routes with &quot;admin&quot;, &quot;staff&quot;, or &quot;internal&quot; in the path should verify the user&apos;s role.</p>
              </div>
            </li>
            <li className="flex items-start gap-3">
              <div className="w-6 h-6 rounded-full bg-emerald-500/10 flex items-center justify-center shrink-0 mt-0.5">
                <span className="text-emerald-400 text-xs font-bold">3</span>
              </div>
              <div>
                <strong className="text-zinc-200">Verify ownership in database queries</strong>
                <p className="text-sm mt-1">Include authorId: session.user.id in WHERE clauses to ensure users can only access their own resources.</p>
              </div>
            </li>
            <li className="flex items-start gap-3">
              <div className="w-6 h-6 rounded-full bg-emerald-500/10 flex items-center justify-center shrink-0 mt-0.5">
                <span className="text-emerald-400 text-xs font-bold">4</span>
              </div>
              <div>
                <strong className="text-zinc-200">Create reusable authorization middleware</strong>
                <p className="text-sm mt-1">Build helper functions like requireRole() or checkOwnership() to ensure consistent authorization across routes.</p>
              </div>
            </li>
          </ul>
        </div>
      </motion.div>

      {/* CTA */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.4 }}
      >
        <Link
          href="/docs/rules"
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 hover:bg-emerald-500/20 transition-colors"
        >
          View All Security Rules
          <ChevronRight className="w-4 h-4" />
        </Link>
      </motion.div>
    </div>
  );
}

function RuleCard({
  id,
  title,
  severity,
  description,
}: {
  id: string;
  title: string;
  severity: string;
  description: string;
}) {
  const severityColors = {
    critical: "bg-red-500/10 text-red-400 border-red-500/20",
    high: "bg-orange-500/10 text-orange-400 border-orange-500/20",
    medium: "bg-yellow-500/10 text-yellow-400 border-yellow-500/20",
  };

  return (
    <div className="p-4 rounded-lg bg-zinc-900/50 border border-zinc-800/50">
      <div className="flex items-center gap-2 mb-2">
        <code className="text-sm text-emerald-400 font-mono">{id}</code>
        <span className={`px-2 py-0.5 rounded-full text-xs font-medium border ${severityColors[severity as keyof typeof severityColors]}`}>
          {severity}
        </span>
      </div>
      <h3 className="font-medium text-zinc-200 mb-1">{title}</h3>
      <p className="text-sm text-zinc-500">{description}</p>
    </div>
  );
}
