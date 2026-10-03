export type JournalRankScore = {
  score: number | null | undefined;
  maxScore?: number | null | undefined;
};

export type JournalRankInput = {
  studentId: string;
  scores: JournalRankScore[];
};

export type JournalRankResult = {
  studentId: string;
  average: number | null;
  rank: number | null;
  scoredCount: number;
};

function round1(value: number) {
  return Math.round(value * 10) / 10;
}

export function computeJournalRankings(rows: JournalRankInput[]): JournalRankResult[] {
  const summaries: JournalRankResult[] = rows.map((row) => {
    const validScores = row.scores
      .map((item) => {
        const score = item.score == null ? null : Number(item.score);
        const maxScore = item.maxScore == null ? 10 : Number(item.maxScore);
        if (score == null || !Number.isFinite(score) || !Number.isFinite(maxScore) || maxScore <= 0) return null;
        if (score < 0 || score > maxScore) return null;
        return (score / maxScore) * 10;
      })
      .filter((value): value is number => value !== null);

    return {
      studentId: row.studentId,
      average: validScores.length ? round1(validScores.reduce((sum, score) => sum + score, 0) / validScores.length) : null,
      rank: null,
      scoredCount: validScores.length,
    };
  });

  const ranked = summaries
    .filter((item) => item.average !== null)
    .sort((left, right) => (right.average as number) - (left.average as number));

  let previousAverage: number | null = null;
  let previousRank = 0;
  ranked.forEach((item, index) => {
    const rank = previousAverage === item.average ? previousRank : index + 1;
    item.rank = rank;
    previousRank = rank;
    previousAverage = item.average;
  });

  const rankByStudent = new Map(ranked.map((item) => [item.studentId, item.rank]));
  return summaries.map((item) => ({ ...item, rank: rankByStudent.get(item.studentId) ?? null }));
}

export function formatJournalAverage(value: number | null | undefined) {
  return value == null ? "" : value.toLocaleString("vi-VN", { minimumFractionDigits: value % 1 === 0 ? 0 : 1, maximumFractionDigits: 1 });
}
