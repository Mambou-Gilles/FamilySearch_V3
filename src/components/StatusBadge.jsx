const STATUS_STYLES = {
  available: "bg-slate-100 text-slate-600",
  assigned: "bg-blue-100 text-blue-700",
  completed: "bg-amber-100 text-amber-700",
  in_review: "bg-purple-100 text-purple-700",
  needs_correction: "bg-red-100 text-red-700",
  reviewed: "bg-green-100 text-green-700",
  active: "bg-green-100 text-green-700",
  paused: "bg-amber-100 text-amber-700",
  completed_proj: "bg-slate-100 text-slate-600",
  attrited: "bg-red-100 text-red-700",
  transferred: "bg-blue-100 text-blue-700"
};

export default function StatusBadge({ status }) {
  const style = STATUS_STYLES[status] || "bg-slate-100 text-slate-600";
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium capitalize ${style}`}>
      {status?.replace(/_/g, " ")}
    </span>
  );
}