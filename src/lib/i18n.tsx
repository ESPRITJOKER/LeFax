import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";

export type Lang = "fr" | "en";

const dict = {
  fr: {
    appName: "Lefax Course",
    lang_heading: "Choisissez votre langue",
    lang_sub: "Vous pourrez changer à tout moment",
    lang_continue: "Continuer",

    reg_title: "Créer un compte",
    reg_sub: "Rejoignez des milliers d'étudiants",
    reg_firstname: "Prénom",
    reg_lastname: "Nom",
    reg_fullname: "Nom complet",
    reg_phone: "Numéro de téléphone",
    reg_region: "Région",
    reg_town: "Ville",
    reg_password: "Mot de passe",
    reg_confirmPassword: "Confirmation du mot de passe",
    reg_terms: "J'accepte les Conditions Générales d'Utilisation",
    reg_cta: "Créer mon compte",
    reg_haveaccount: "Déjà un compte ?",
    reg_login: "Se connecter",
    reg_selectPlaceholder: "Sélectionner",
    reg_otp_title: "Vérification du numéro",
    reg_otp_sub: "Un code a été envoyé par SMS au",
    reg_otp_cta: "Vérifier",
    reg_otp_resend: "Renvoyer le code",

    login_title: "Se connecter",
    login_sub: "Contente de vous revoir",
    login_cta: "Se connecter",
    login_noaccount: "Pas encore de compte ?",
    login_signup: "Créer un compte",
    login_forgot: "Mot de passe oublié ?",

    track_title: "Choisissez votre parcours",
    track_sub: "6 filières prévues, plus à venir",
    track_select: "Sélectionner",
    track_soon: "Bientôt",

    dash_hello: "Bonjour",
    dash_streakLabel: "jours de suite",
    dash_progressTitle: "Ma progression",
    dash_quickAccess: "Accès rapides",
    dash_recentActivity: "Activité récente",
    dash_nextMock: "Prochain concours blanc",
    dash_lastLesson: "Dernière leçon consultée",

    chap_progressLabel: "Progression globale",
    chap_lessonsCount: "leçons",

    lesson_objectives: "Objectifs",
    lesson_summary: "Résumé",
    lesson_keypoints: "Points clés",
    lesson_diagramPlaceholder: "[ illustration / schéma à intégrer ]",
    lesson_favorite: "Ajouter aux favoris",
    lesson_unfavorite: "Retirer des favoris",
    lesson_duration: "Durée estimée",
    lesson_difficulty: "Difficulté",
    lesson_difficulty_easy: "Facile",
    lesson_difficulty_medium: "Intermédiaire",
    lesson_difficulty_hard: "Difficile",

    quiz_question: "Question",
    previous: "Précédent",
    next: "Suivant",
    quiz_locked: "Terminez la leçon pour débloquer le test",
    quiz_finish: "Terminer",

    result_congrats: "Félicitations !",
    result_score: "Votre score",
    result_earned: "Vous gagnez",
    result_seeCorrection: "Voir le corrigé",
    result_backHome: "Retour à l'accueil",
    result_badge: "Badge débloqué",

    corr_title: "Corrigé",
    corr_yourAnswer: "Votre réponse",
    corr_correctAnswer: "Bonne réponse",
    corr_explanation: "Explication",

    shop_title: "Boutique FaxCoins",
    shop_balance: "Solde",
    shop_empty: "Aucun article disponible pour le moment",

    tasks_title: "Tâches quotidiennes",
    tasks_limit: "complétées aujourd'hui",

    lead_title: "Classement",
    lead_you: "Vous",
    lead_regional: "Régional",
    lead_national: "National",
    lead_weekly: "Hebdo",

    mock_title: "Concours blanc",
    mock_opensIn: "Ouverture dans",
    mock_duration: "Durée",
    mock_questions: "Questions",
    mock_passing: "Score de passage",
    mock_instructions: "Instructions",
    mock_start: "Commencer",
    mock_none: "Aucun concours blanc programmé pour le moment",

    mockres_title: "Résultats Mock Exam",
    mockres_national: "Classement national",
    mockres_regional: "Classement régional",
    mockres_breakdown: "Répartition par matière",

    nav_home: "Accueil",
    nav_courses: "Cours",
    nav_shop: "Boutique",
    nav_leaderboard: "Classement",
    nav_profile: "Profil",
    nav_notifications: "Notifications",
    nav_search: "Recherche",
    nav_tasks: "Tâches",
    nav_mockExam: "Concours blanc",

    profile_title: "Profil",
    profile_editPhoto: "Changer la photo",
    profile_region: "Région",
    profile_town: "Ville",
    profile_password: "Changer le mot de passe",
    profile_notifPrefs: "Préférences de notification",
    profile_language: "Langue",
    profile_darkMode: "Mode sombre",
    profile_save: "Enregistrer",
    profile_logout: "Se déconnecter",
    profile_level: "Niveau",
    profile_rank: "Rang",

    notif_title: "Notifications",
    notif_empty: "Aucune notification pour le moment",
    notif_markAllRead: "Tout marquer comme lu",

    search_title: "Recherche",
    search_placeholder: "Rechercher une leçon, un chapitre, un sujet...",
    search_empty: "Aucun résultat",
    search_recent: "Recherches récentes",

    backend_banner: "Backend non configuré : connectez un projet Supabase (voir README) pour activer les données réelles.",

    common_loading: "Chargement...",
    common_error: "Une erreur est survenue",
    common_retry: "Réessayer",
    common_save: "Enregistrer",
    common_cancel: "Annuler",
    common_edit: "Modifier",
    common_delete: "Supprimer",
    common_back: "Retour",
    common_seeAll: "Voir tout",

    // Admin
    admin_overview: "Vue d'ensemble",
    admin_students: "Étudiants",
    admin_content: "Contenus",
    admin_ai: "Génération IA",
    admin_mocks: "Mock Exams",
    admin_admins: "Administrateurs",
    admin_logs: "Journal d'audit",
    admin_settings: "Paramètres",
    admin_searchStudents: "Rechercher un étudiant...",
    admin_allRegions: "Toutes les régions",
    admin_addChapter: "Ajouter un chapitre",
    admin_save: "Enregistrer",
    admin_cancel: "Annuler",
    admin_edit: "Modifier",
    admin_aiExplain: "Questions générées automatiquement à partir des contenus. Validez, modifiez ou rejetez avant publication.",
    admin_approve: "Approuver",
    admin_modify: "Modifier",
    admin_reject: "Rejeter",
    admin_queueEmpty: "Aucune question en attente",
    admin_scheduleNew: "Planifier un nouveau mock exam",
    admin_schedule: "Planifier",
    admin_participants: "participants",
    admin_avgScore: "Moy.",
    admin_exportCsv: "Exporter en CSV",
    admin_suspend: "Suspendre",
    admin_activate: "Activer",
    admin_resetPassword: "Réinitialiser le mot de passe",
    admin_inviteAdmin: "Inviter un administrateur",

    // Teacher
    teacher_dashboard: "Tableau de bord enseignant",
    teacher_myContent: "Mes contenus",
    teacher_uploadContent: "Déposer un contenu",
    teacher_createQuiz: "Créer un quiz",
    teacher_aiAssist: "Génération assistée par IA",
    teacher_performance: "Performance des étudiants",
    teacher_reviewQueue: "File de relecture",
    teacher_submitForApproval: "Soumettre pour approbation",
    teacher_uploadSource: "Déposer un document source (PDF, Word, slides, Markdown, texte)",
    teacher_generate: "Générer avec l'IA",
  },
  en: {
    appName: "Lefax Course",
    lang_heading: "Choose your language",
    lang_sub: "You can change this anytime",
    lang_continue: "Continue",

    reg_title: "Create an account",
    reg_sub: "Join thousands of students",
    reg_firstname: "First name",
    reg_lastname: "Last name",
    reg_fullname: "Full name",
    reg_phone: "Phone number",
    reg_region: "Region",
    reg_town: "Town",
    reg_password: "Password",
    reg_confirmPassword: "Confirm password",
    reg_terms: "I accept the Terms of Use",
    reg_cta: "Create my account",
    reg_haveaccount: "Already have an account?",
    reg_login: "Log in",
    reg_selectPlaceholder: "Select",
    reg_otp_title: "Verify your number",
    reg_otp_sub: "A code was sent by SMS to",
    reg_otp_cta: "Verify",
    reg_otp_resend: "Resend code",

    login_title: "Log in",
    login_sub: "Welcome back",
    login_cta: "Log in",
    login_noaccount: "Don't have an account?",
    login_signup: "Create an account",
    login_forgot: "Forgot password?",

    track_title: "Choose your track",
    track_sub: "6 tracks planned, more coming soon",
    track_select: "Select",
    track_soon: "Coming soon",

    dash_hello: "Hello",
    dash_streakLabel: "day streak",
    dash_progressTitle: "My progress",
    dash_quickAccess: "Quick access",
    dash_recentActivity: "Recent activity",
    dash_nextMock: "Next mock exam",
    dash_lastLesson: "Last lesson viewed",

    chap_progressLabel: "Overall progress",
    chap_lessonsCount: "lessons",

    lesson_objectives: "Objectives",
    lesson_summary: "Summary",
    lesson_keypoints: "Key points",
    lesson_diagramPlaceholder: "[ diagram / illustration goes here ]",
    lesson_favorite: "Add to favorites",
    lesson_unfavorite: "Remove from favorites",
    lesson_duration: "Estimated duration",
    lesson_difficulty: "Difficulty",
    lesson_difficulty_easy: "Easy",
    lesson_difficulty_medium: "Intermediate",
    lesson_difficulty_hard: "Hard",

    quiz_question: "Question",
    previous: "Previous",
    next: "Next",
    quiz_locked: "Finish the lesson to unlock the quiz",
    quiz_finish: "Finish",

    result_congrats: "Congratulations!",
    result_score: "Your score",
    result_earned: "You earn",
    result_seeCorrection: "View correction",
    result_backHome: "Back to home",
    result_badge: "Badge unlocked",

    corr_title: "Correction",
    corr_yourAnswer: "Your answer",
    corr_correctAnswer: "Correct answer",
    corr_explanation: "Explanation",

    shop_title: "FaxCoin Shop",
    shop_balance: "Balance",
    shop_empty: "No items available yet",

    tasks_title: "Daily tasks",
    tasks_limit: "completed today",

    lead_title: "Leaderboard",
    lead_you: "You",
    lead_regional: "Regional",
    lead_national: "National",
    lead_weekly: "Weekly",

    mock_title: "Mock exam",
    mock_opensIn: "Opens in",
    mock_duration: "Duration",
    mock_questions: "Questions",
    mock_passing: "Passing score",
    mock_instructions: "Instructions",
    mock_start: "Start",
    mock_none: "No mock exam scheduled yet",

    mockres_title: "Mock exam results",
    mockres_national: "National rank",
    mockres_regional: "Regional rank",
    mockres_breakdown: "Score by subject",

    nav_home: "Home",
    nav_courses: "Courses",
    nav_shop: "Shop",
    nav_leaderboard: "Leaderboard",
    nav_profile: "Profile",
    nav_notifications: "Notifications",
    nav_search: "Search",
    nav_tasks: "Tasks",
    nav_mockExam: "Mock exam",

    profile_title: "Profile",
    profile_editPhoto: "Change photo",
    profile_region: "Region",
    profile_town: "Town",
    profile_password: "Change password",
    profile_notifPrefs: "Notification preferences",
    profile_language: "Language",
    profile_darkMode: "Dark mode",
    profile_save: "Save",
    profile_logout: "Log out",
    profile_level: "Level",
    profile_rank: "Rank",

    notif_title: "Notifications",
    notif_empty: "No notifications yet",
    notif_markAllRead: "Mark all as read",

    search_title: "Search",
    search_placeholder: "Search a lesson, chapter, subject...",
    search_empty: "No results",
    search_recent: "Recent searches",

    backend_banner: "Backend not configured: connect a Supabase project (see README) to enable real data.",

    common_loading: "Loading...",
    common_error: "Something went wrong",
    common_retry: "Retry",
    common_save: "Save",
    common_cancel: "Cancel",
    common_edit: "Edit",
    common_delete: "Delete",
    common_back: "Back",
    common_seeAll: "See all",

    // Admin
    admin_overview: "Overview",
    admin_students: "Students",
    admin_content: "Content",
    admin_ai: "AI Generation",
    admin_mocks: "Mock Exams",
    admin_admins: "Administrators",
    admin_logs: "Audit log",
    admin_settings: "Settings",
    admin_searchStudents: "Search students...",
    admin_allRegions: "All regions",
    admin_addChapter: "Add chapter",
    admin_save: "Save",
    admin_cancel: "Cancel",
    admin_edit: "Edit",
    admin_aiExplain: "Questions auto-generated from lesson content. Approve, modify, or reject before publishing.",
    admin_approve: "Approve",
    admin_modify: "Modify",
    admin_reject: "Reject",
    admin_queueEmpty: "No questions pending",
    admin_scheduleNew: "Schedule a new mock exam",
    admin_schedule: "Schedule",
    admin_participants: "participants",
    admin_avgScore: "Avg.",
    admin_exportCsv: "Export CSV",
    admin_suspend: "Suspend",
    admin_activate: "Activate",
    admin_resetPassword: "Reset password",
    admin_inviteAdmin: "Invite an administrator",

    // Teacher
    teacher_dashboard: "Teacher dashboard",
    teacher_myContent: "My content",
    teacher_uploadContent: "Upload content",
    teacher_createQuiz: "Create quiz",
    teacher_aiAssist: "AI-assisted generation",
    teacher_performance: "Student performance",
    teacher_reviewQueue: "Review queue",
    teacher_submitForApproval: "Submit for approval",
    teacher_uploadSource: "Upload a source document (PDF, Word, slides, Markdown, text)",
    teacher_generate: "Generate with AI",
  },
} as const;

export type DictKey = keyof (typeof dict)["fr"];

interface I18nContextValue {
  lang: Lang;
  setLang: (l: Lang) => void;
  t: (key: DictKey) => string;
}

const I18nContext = createContext<I18nContextValue | null>(null);

const STORAGE_KEY = "lefax.lang";

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(() => {
    if (typeof window === "undefined") return "fr";
    const stored = window.localStorage.getItem(STORAGE_KEY);
    return stored === "en" ? "en" : "fr";
  });

  const setLang = useCallback((l: Lang) => {
    setLangState(l);
    if (typeof window !== "undefined") window.localStorage.setItem(STORAGE_KEY, l);
    document.documentElement.lang = l;
  }, []);

  const t = useCallback((key: DictKey) => dict[lang][key] ?? String(key), [lang]);

  const value = useMemo(() => ({ lang, setLang, t }), [lang, setLang, t]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error("useI18n must be used within I18nProvider");
  return ctx;
}

/** Pick the localized string out of a bilingual {fr, en} record. */
export function pickLang<T extends { fr: string; en: string }>(obj: T, lang: Lang): string {
  return lang === "fr" ? obj.fr : obj.en;
}
