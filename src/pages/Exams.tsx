import { useProfile } from '../hooks/hooks'
import { Card, PageTitle, Notice } from '../components/ui'
import formats from '../content/data/exam-formats.json'

interface Section { name: string; summary: string }
interface Format { id: string; name: string; verifiedOn: string; source: string; sections: Section[]; scoring: string }

/**
 * Phase 3. The exam formats are stored as configuration (exam-formats.json), never hard-coded,
 * so a format change only needs a content update. The practice / timed / mock-exam modes are not built yet,
 * so this page says so instead of showing fake features.
 */
export default function Exams() {
  const exam = useProfile()?.exam ?? 'none'
  const list = (formats as Format[]).sort((a) => (a.id === exam ? -1 : 1))
  return (
    <div className="space-y-4">
      <PageTitle title="Exams" subtitle="IELTS Academic & TOEFL iBT preparation" />
      <Notice tone="info">
        The exam module (practice mode, timed mode, full mock exams and band-score estimates) is planned for <b>Phase 3</b>. It is not available yet.
        Until then, the A2/B1 path, reading, listening and writing practice build exactly the skills both exams test.
      </Notice>
      {list.map((f) => (
        <Card key={f.id}>
          <div className="flex items-center justify-between"><h2 className="text-lg font-bold">{f.name}</h2>{f.id === exam && <span className="chip bg-brand-100 text-brand-800 dark:bg-brand-900/40 dark:text-brand-200">your exam</span>}</div>
          <ul className="mt-2 space-y-1.5 text-sm">{f.sections.map((s) => <li key={s.name}><b>{s.name}</b> — {s.summary}</li>)}</ul>
          <p className="mt-2 text-sm text-ink-500">{f.scoring}</p>
          <p className="mt-2 text-xs text-ink-400">Format summary as of {f.verifiedOn}. Always confirm the current format on the official site: {f.source}</p>
        </Card>
      ))}
      <p className="text-xs text-ink-400">All future practice tests will be original. Scores will be pedagogical estimates, never official results.</p>
    </div>
  )
}
