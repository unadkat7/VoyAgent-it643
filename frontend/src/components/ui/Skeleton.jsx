export default function Skeleton({ className = "" }) {
  return <div className={`skeleton-shimmer rounded-2xl ${className}`} aria-hidden="true" />;
}
