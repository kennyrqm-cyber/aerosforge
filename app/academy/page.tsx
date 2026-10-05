import Link from "next/link";
import { ContentStatus, ProgressStatus, Role } from "@/generated/prisma/client";
import { completeLesson } from "@/lib/actions";
import { db } from "@/lib/db";
import { requireRole } from "@/lib/session";

export default async function AcademyPage() {
  const session = await requireRole(Role.STUDENT);
  const lessons = await db.lesson.findMany({
    where: { status: ContentStatus.PUBLISHED },
    orderBy: { order: "asc" },
    include: {
      progress: { where: { userId: session.user.id }, select: { status: true, xpAwarded: true } }
    }
  });

  return <main>
    <section className="section">
      <div className="kicker">AEROSFORGE Academy</div>
      <h2>Instructor-reviewed vertical-flight curriculum</h2>
      <p className="muted">Only content that has passed the review gate appears here. Prototype drafts stay hidden.</p>
      <div className="grid lessonGrid">
        {lessons.length === 0 ? <article className="card"><h3>Review gate active</h3><p className="muted">No lessons have cleared qualified review yet. That is intentional—AEROSFORGE will not turn placeholders into training material just to make the dashboard look full.</p></article> : lessons.map((lesson) => {
          const progress = lesson.progress[0];
          const done = progress?.status === ProgressStatus.COMPLETED;
          return <article className="card lessonCard" key={lesson.id}>
            <div><span className="badge">{lesson.category}</span><h3>{String(lesson.order).padStart(2, "0")} — {lesson.title}</h3><p>{lesson.summary}</p>{lesson.contentMd && <div className="lessonBody">{lesson.contentMd}</div>}</div>
            <div className="lessonFooter"><span className="muted">Version {lesson.version} • {lesson.status}</span>{done ? <span className="badge success">Completed +{progress.xpAwarded} XP</span> : <form action={completeLesson.bind(null, lesson.id)}><button className="primary" type="submit">Complete lesson +250 XP</button></form>}</div>
          </article>;
        })}
      </div>
      <p style={{marginTop:24}}><Link className="button" href="/dashboard/student">← Mission Control</Link></p>
    </section>
  </main>;
}
