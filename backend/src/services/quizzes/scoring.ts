// Quiz attempt scoring (REFACTORING_PLAN Stage 3). Pure exact-set grading:
// selected options must equal the correct set; foreign/forged option ids are
// dropped and duplicate selections are deduplicated. Kept side-effect free
// so it can be unit-tested directly.
interface ScorableQuestion {
  id: string;
  points?: number | null;
  options: Array<{ id: string; isCorrect: boolean }>;
}

interface SubmittedAnswer {
  questionId: string;
  optionIds?: string[] | string;
}

interface ScoredAnswer {
  attemptId: string;
  questionId: string;
  optionId: string | null;
  selection: string[] | null;
  isCorrect: boolean;
  pointsEarned: number;
}

interface ScoringResult {
  answerData: ScoredAnswer[];
  earned: number;
  total: number;
}

function scoreAttempt(
  attemptId: string,
  questions: ScorableQuestion[],
  answers: SubmittedAnswer[]
): ScoringResult {
  const answerData: ScoredAnswer[] = [];
  let earned = 0;
  let total = 0;

  for (const question of questions) {
    total += Number(question.points || 1);
    const submitted = (answers || []).find((a) => a.questionId === question.id);
    if (!submitted) continue;

    const correctOptionIds = new Set(question.options.filter((o) => o.isCorrect).map((o) => o.id));
    // Only options that actually belong to this question are accepted -
    // anything else (forged or foreign ids) is dropped before scoring.
    // Duplicate selections are deduplicated.
    const optionIdSet = new Set(question.options.map((o) => o.id));
    const selected = [
      ...new Set(
        (Array.isArray(submitted.optionIds)
          ? submitted.optionIds
          : submitted.optionIds
            ? [submitted.optionIds]
            : []
        ).filter((id) => optionIdSet.has(id))
      ),
    ];

    // Determine answer correctness (anti-cheating: selected options must match correct set exactly)
    const isCorrect =
      selected.length === correctOptionIds.size && selected.every((id) => correctOptionIds.has(id));

    const pointsEarned = isCorrect ? Number(question.points || 1) : 0;
    earned += pointsEarned;

    answerData.push({
      attemptId,
      questionId: question.id,
      optionId: selected.length > 0 ? selected[0] : null,
      // Keep the full multi-select selection; optionId stays the primary/first
      selection: selected.length > 0 ? selected : null,
      isCorrect,
      pointsEarned,
    });
  }

  return { answerData, earned, total };
}

export { scoreAttempt };
export type { ScorableQuestion, SubmittedAnswer, ScoredAnswer, ScoringResult };
