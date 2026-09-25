import Link from "next/link";
import { notFound } from "next/navigation";
import { Role } from "@/generated/prisma/client";
import { updateLessonDraft } from "@/lib/actions";
import { db } from "@/lib/db";
import { requireRole } from "@/lib/session";

export default async function LessonEditorPage({ params }: { params: Promise<{ id: string }> }) {
  await requireRole(Role.ADMIN);
  const { id } = await params;
  const lesson = await db.lesson.findUnique({ where: { id } });
  if (!lesson) notFound();

  return <main>
    <section className="section">
      <p><Link className="button" href="/dashboard/admin">← Owner dashboard</Link></p>
      <div className="kicker">Content workshop</div>
      <h2>{String(lesson.order).padStart(2,"0")} — {lesson.title}</h2>
      <p className="muted">Editing resets this lesson to DRAFT and clears prior release timestamps. It must pass review again before publication.</p>
      <form className="card editorForm" action={updateLessonDraft.bind(null, lesson.id)}>
        <label>Title<input name="title" defaultValue={lesson.title} required maxLength={140}/></label>
        <label>Summary<textarea name="summary" defaultValue={lesson.summary} rows={3} required maxLength={500}/></label>
        <label>Lesson content<textarea name="contentMd" defaultValue={lesson.contentMd ?? ""} rows={20} required maxLength={30000}/></label>
        <label>Source / review notes<textarea name="sourceNotes" defaultValue={lesson.sourceNotes ?? ""} rows={8} required maxLength={8000}/></label>
        <button className="primary" type="submit">Save as DRAFT • force re-review</button>
      </form>
    </section>
  </main>;
}
