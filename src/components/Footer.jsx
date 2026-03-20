export default function Footer() {
  return (
    <footer className="border-t border-slate-200 bg-white px-6 py-4 mt-8">
      <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-slate-400">
        <span>© {new Date().getFullYear()} FamilySearch Project Hub. All rights reserved.</span>
        <span>Built for FamilySearch Operations</span>
      </div>
    </footer>
  );
}