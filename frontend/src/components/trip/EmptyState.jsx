import { Compass } from "lucide-react";

export default function EmptyState({ children, icon: Icon = Compass }) {
  return (
    <div className="bg-white border border-border rounded-2xl p-8 sm:p-10 text-center flex flex-col items-center justify-center">
      <div className="w-10 h-10 rounded-xl bg-bg border border-border text-muted flex items-center justify-center mb-3">
        <Icon className="w-5 h-5" aria-hidden />
      </div>
      <p className="text-sm text-muted max-w-md leading-relaxed">{children}</p>
    </div>
  );
}
