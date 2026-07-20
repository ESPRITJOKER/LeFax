import type { StaffNavItem } from "./StaffAppShell";

export const STAFF_NAV_TEACHER: StaffNavItem[] = [
  { to: "/teacher", icon: "dashboard", labelKey: "staffNav.dashboard", end: true },
  { to: "/teacher/lessons", icon: "menu_book", labelKey: "staffNav.lessons" },
  { to: "/teacher/qcms", icon: "quiz", labelKey: "staffNav.qcms" },
  { to: "/teacher/past-papers", icon: "description", labelKey: "staffNav.pastPapers" },
  { to: "/teacher/feedback", icon: "chat_bubble", labelKey: "staffNav.feedback" },
  { to: "/teacher/performance", icon: "insights", labelKey: "staffNav.performance" },
];

export const STAFF_NAV_ADMIN: StaffNavItem[] = [
  { to: "/admin", icon: "dashboard", labelKey: "staffNav.dashboard", end: true },
  { to: "/admin/review-queue", icon: "fact_check", labelKey: "staffNav.reviewQueue" },
  { to: "/admin/exams", icon: "quiz", labelKey: "staffNav.exams" },
  { to: "/admin/users", icon: "group", labelKey: "staffNav.users" },
  { to: "/admin/schools", icon: "school", labelKey: "staffNav.schools" },
  { to: "/admin/payments", icon: "payments", labelKey: "staffNav.payments" },
  { to: "/admin/analytics", icon: "analytics", labelKey: "staffNav.analytics" },
];
