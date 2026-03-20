// Scoring logic for Hints and Duplicates

export const HINTS_RESULT_OPTIONS = [
  "1- I attached",
  "2- Already Attached, No work needed",
  "3- Not attached, record is not for the persons or insufficient information",
  "4- Not attached, needs review, profile issue needs to be corrected before attaching (Escalation)",
  "5- Error Loading Source/Cannot Access",
  "6- Revised Contribution (Add Notes)"
];

export const HINTS_TREE_WORK_OPTIONS = [
  "1- All tree work done correctly",
  "2- Hint attached incorrectly",
  "3- Hint attached correctly, profile Issue",
  "4- Hint attached incorrectly and profile issues present/missed",
  "5- Hint skipped (no work needed or further research needed)",
  "6- FamilySearch Escalation"
];

export const HINTS_DOC_OPTIONS = [
  "1- Data entries are correct",
  "2- Data entries partially correct",
  "3- Data entry is incorrect"
];

export const DUPLICATES_DATA_CONFLICTS_OPTIONS = [
  "1- all vital details and relationships match",
  "2- most vital information and relationships match, no data conflicts",
  "3- most vital information and relationships match, minor data conflicts",
  "4- Significant data conflicts, not the same person",
  "5- Error loading source/cannot access",
  "6- Merge already completed",
  "7- Revised contribution (add notes)"
];

export const DUPLICATES_RESULT_OPTIONS = [
  "1- Merge(s) completed",
  "2- Duplicate(s) not merged/skipped (Add note)",
  "3- Escalate (profile issue, profiles are not the same)"
];

export const DUPLICATES_QUALIFICATION_OPTIONS = [
  "1- qualification created, no further duplicates remain and tree profile has required data",
  "2- qualification not created, no further duplicates but tree profile lacks needed info",
  "3- N/A (merge not completed)"
];

export const DUPLICATES_RESOLVED_OPTIONS = ["0", "1", "2", "3", "4+"];

export const DUPLICATES_TREE_REVIEW_OPTIONS = [
  "1- Merge completed correctly",
  "2- Merge completed incorrectly",
  "3- Merge completed, tree profile needs further adjustments",
  "4- Escalation to FS Needed, Other Issue"
];

export const DUPLICATES_DOC_OPTIONS = [
  "1- Data entries are correct",
  "2- Data Entry is partially correct",
  "3- Data entry is incorrect"
];

export const TIME_CONTRIBUTOR_OPTIONS_HINTS = [
  { value: "lt_5", label: "< 5 min" },
  { value: "lt_10", label: "< 10 min" },
  { value: "gt_10", label: "> 10 min" }
];

export const TIME_CONTRIBUTOR_OPTIONS_DUPS = [
  { value: "lt_10", label: "< 10 min" },
  { value: "lt_20", label: "< 20 min" },
  { value: "gt_20", label: "> 20 min" }
];

export const TIME_REVIEWER_OPTIONS = [
  { value: "lt_10", label: "< 10 min" },
  { value: "lt_20", label: "< 20 min" },
  { value: "gt_20", label: "> 20 min" }
];

export function calcHintsScoreTree(treeWorkReview) {
  if (!treeWorkReview) return 0;
  const n = parseInt(treeWorkReview[0]);
  const map = { 1: 80, 2: 0, 3: 50, 4: 0, 5: 80, 6: 80 };
  return map[n] ?? 0;
}

export function calcHintsScoreDoc(docResults) {
  if (!docResults) return 0;
  const n = parseInt(docResults[0]);
  const map = { 1: 20, 2: 10, 3: 0 };
  return map[n] ?? 0;
}

export function calcDuplicatesScoreTree(treeWorkReview) {
  if (!treeWorkReview) return 0;
  const n = parseInt(treeWorkReview[0]);
  const map = { 1: 80, 2: 0, 3: 50, 4: 80 };
  return map[n] ?? 0;
}

export function calcDuplicatesScoreDoc(docResults) {
  if (!docResults) return 0;
  const n = parseInt(docResults[0]);
  const map = { 1: 20, 2: 10, 3: 0 };
  return map[n] ?? 0;
}

export function calcScores(task) {
  if (task.project_type === "hints") {
    const tree = calcHintsScoreTree(task.tree_work_review);
    const doc = calcHintsScoreDoc(task.doc_results);
    return { quality_score_tree: tree, quality_score_doc: doc, total_quality_score: tree + doc };
  } else {
    const tree = calcDuplicatesScoreTree(task.tree_work_review);
    const doc = calcDuplicatesScoreDoc(task.doc_results);
    return { quality_score_tree: tree, quality_score_doc: doc, total_quality_score: tree + doc };
  }
}

export function isEscalation(task) {
  if (task.project_type === "hints") {
    return task.hint_result?.startsWith("4-") || task.tree_work_review?.startsWith("6-");
  } else {
    return task.duplicate_result?.startsWith("3-") || task.tree_work_review?.startsWith("4-");
  }
}