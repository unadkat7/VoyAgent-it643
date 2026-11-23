export default function Skeleton({ className = "" }) {
  return <div className={`skeleton-shimmer max-w-full min-w-0 rounded-2xl ${className}`} aria-hidden="true" />;
}
