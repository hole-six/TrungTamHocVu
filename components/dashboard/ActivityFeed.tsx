"use client";

type Activity = {
  id: string;
  type: "create" | "update" | "delete" | "payment" | "enrollment" | "other";
  title: string;
  description: string;
  timestamp: Date;
  user?: {
    name: string;
    avatar?: string;
  };
  metadata?: Record<string, any>;
};

type ActivityFeedProps = {
  activities: Activity[];
  maxItems?: number;
  loading?: boolean;
  onLoadMore?: () => void;
  hasMore?: boolean;
};

const activityIcons = {
  create: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-emerald-600">
      <line x1="12" y1="5" x2="12" y2="19" />
      <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  ),
  update: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-blue-600">
      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
    </svg>
  ),
  delete: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-red-600">
      <polyline points="3 6 5 6 21 6" />
      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
    </svg>
  ),
  payment: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-amber-600">
      <line x1="12" y1="1" x2="12" y2="23" />
      <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
    </svg>
  ),
  enrollment: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-purple-600">
      <path d="M22 10v6M2 10l10-5 10 5-10 5z" />
      <path d="M6 12v5c3 3 9 3 12 0v-5" />
    </svg>
  ),
  other: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-gray-600">
      <circle cx="12" cy="12" r="10" />
      <line x1="12" y1="16" x2="12" y2="12" />
      <line x1="12" y1="8" x2="12.01" y2="8" />
    </svg>
  ),
};

const activityColors = {
  create: "bg-emerald-50 border-emerald-200",
  update: "bg-blue-50 border-blue-200",
  delete: "bg-red-50 border-red-200",
  payment: "bg-amber-50 border-amber-200",
  enrollment: "bg-purple-50 border-purple-200",
  other: "bg-gray-50 border-gray-200",
};

function formatRelativeTime(date: Date): string {
  const now = new Date();
  const diff = now.getTime() - new Date(date).getTime();
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (minutes < 1) return "Vừa xong";
  if (minutes < 60) return `${minutes} phút trước`;
  if (hours < 24) return `${hours} giờ trước`;
  if (days < 7) return `${days} ngày trước`;
  return new Date(date).toLocaleDateString("vi-VN");
}

export default function ActivityFeed({
  activities,
  maxItems = 10,
  loading = false,
  onLoadMore,
  hasMore = false,
}: ActivityFeedProps) {
  const displayedActivities = maxItems ? activities.slice(0, maxItems) : activities;

  if (loading) {
    return (
      <div className="rounded-xl border border-[#e8edf5] bg-white p-6">
        <div className="space-y-4">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="flex gap-3 animate-pulse">
              <div className="h-10 w-10 rounded-full bg-gray-200" />
              <div className="flex-1 space-y-2">
                <div className="h-4 w-3/4 rounded bg-gray-200" />
                <div className="h-3 w-1/2 rounded bg-gray-200" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-[#e8edf5] bg-white overflow-hidden">
      {/* Header */}
      <div className="border-b border-[#e8edf5] px-6 py-4">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-primary">
              <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
            </svg>
          </div>
          <h3 className="text-sm font-bold text-ink">Hoạt động gần đây</h3>
        </div>
      </div>

      {/* Activities */}
      <div className="divide-y divide-[#e8edf5]">
        {displayedActivities.length === 0 ? (
          <div className="px-6 py-12 text-center">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="mx-auto text-ink-muted48/40">
              <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
            </svg>
            <p className="mt-3 text-sm font-medium text-ink-muted48">Chưa có hoạt động nào</p>
          </div>
        ) : (
          displayedActivities.map((activity) => (
            <div key={activity.id} className="px-6 py-4 hover:bg-[#fafbff] transition-colors">
              <div className="flex gap-3">
                {/* Icon */}
                <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full border ${activityColors[activity.type]}`}>
                  {activityIcons[activity.type]}
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-ink line-clamp-1">
                        {activity.title}
                      </p>
                      <p className="mt-0.5 text-xs text-ink-muted64 line-clamp-2">
                        {activity.description}
                      </p>
                      {activity.user && (
                        <p className="mt-1 text-xs text-ink-muted48">
                          Bởi <span className="font-medium">{activity.user.name}</span>
                        </p>
                      )}
                    </div>
                    <span className="shrink-0 text-xs text-ink-muted48 whitespace-nowrap">
                      {formatRelativeTime(activity.timestamp)}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Load More */}
      {hasMore && onLoadMore && (
        <div className="border-t border-[#e8edf5] px-6 py-3">
          <button
            onClick={onLoadMore}
            className="w-full text-sm font-medium text-primary hover:text-primary/80 transition-colors"
          >
            Xem thêm
          </button>
        </div>
      )}
    </div>
  );
}
