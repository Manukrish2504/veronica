import { renderPdf } from "@/lib/agent/pdf";
import { read } from "@/lib/db";
import { currentUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

/** The tailored CV or cover letter as a PDF, rendered on demand from the current draft. */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string; kind: string }> }) {
  const { id, kind } = await params;
  const user = await currentUser();
  if (!user) return new Response("Unauthorized", { status: 401 });
  const db = read(user.id);
  const draft = db.drafts.find((d) => d.applicationId === id && d.kind === kind);
  const app = db.applications.find((a) => a.id === id);
  const job = app && db.jobs.find((j) => j.id === app.jobId);
  if (!draft || !job || !draft.content) return new Response("Not found", { status: 404 });
  const name = `${db.profile.name} - ${kind === "cv" ? "CV" : "Cover letter"} - ${job.company}`.replace(/[^\w.\- ]+/g, "");
  const pdf = await renderPdf(draft.content, name);
  return new Response(new Uint8Array(pdf), { headers: { "Content-Type": "application/pdf", "Content-Disposition": `inline; filename="${name}.pdf"` } });
}
