import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { MaterialIcon } from "../../components/ui/MaterialIcon";
import { api, type BranchDto, type TeacherContentItemDto } from "../../lib/api-client";
import { ContentListPanel } from "./ContentListPanel";

/** No matching Stitch design — built from tokens (WEB-T04 dépôt d'anciens sujets). */
export function PastPapersEditorPage() {
  const { t } = useTranslation();
  const [branches, setBranches] = useState<BranchDto[]>([]);
  const [papers, setPapers] = useState<TeacherContentItemDto[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    branchId: "",
    title: "",
    schoolName: "",
    year: String(new Date().getFullYear()),
    paperUrl: "",
    correctionText: "",
    correctionUrl: "",
  });
  const [error, setError] = useState<string | null>(null);

  function refresh() {
    api.teacherContent().then((res) => setPapers(res.items.filter((i) => i.type === "past_paper")));
  }

  useEffect(() => {
    refresh();
    api.branches().then((res) => setBranches(res.branches));
  }, []);

  async function create() {
    setError(null);
    if (!form.branchId || !form.title || !form.schoolName || !form.paperUrl) {
      setError(t("pastPapersEditor.validationRequired"));
      return;
    }
    if (!form.correctionText && !form.correctionUrl) {
      setError(t("pastPapersEditor.correctionRequired"));
      return;
    }
    try {
      await api.createPastPaper({
        branchId: form.branchId,
        title: form.title,
        schoolName: form.schoolName,
        year: Number(form.year),
        paperUrl: form.paperUrl,
        correctionText: form.correctionText || undefined,
        correctionUrl: form.correctionUrl || undefined,
      });
      setShowForm(false);
      setForm({ branchId: "", title: "", schoolName: "", year: String(new Date().getFullYear()), paperUrl: "", correctionText: "", correctionUrl: "" });
      refresh();
    } catch {
      setError(t("pastPapersEditor.submitError"));
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-lg">
        <h1 className="font-headline-lg text-headline-lg text-excellence-blue">{t("pastPapers.title")}</h1>
        <button
          type="button"
          onClick={() => setShowForm((s) => !s)}
          className="bg-excellence-blue text-white px-md py-sm rounded-xl font-label-lg text-label-lg flex items-center gap-xs"
        >
          <MaterialIcon name="add" className="text-[16px]" />
          {t("pastPapersEditor.newPaper")}
        </button>
      </div>

      {showForm && (
        <div className="bg-surface-container-lowest border border-outline-variant rounded-xl p-md mb-lg space-y-sm">
          <select
            value={form.branchId}
            onChange={(e) => setForm({ ...form, branchId: e.target.value })}
            className="w-full px-md py-sm bg-surface-container rounded-xl border-none text-body-md font-body-md"
          >
            <option value="">{t("pastPapersEditor.selectBranch")}</option>
            {branches.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
          <input
            placeholder={t("pastPapersEditor.titlePlaceholder")}
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
            className="w-full px-md py-sm bg-surface-container rounded-xl border-none text-body-md font-body-md"
          />
          <div className="flex gap-sm">
            <input
              placeholder={t("pastPapersEditor.schoolPlaceholder")}
              value={form.schoolName}
              onChange={(e) => setForm({ ...form, schoolName: e.target.value })}
              className="flex-1 px-md py-sm bg-surface-container rounded-xl border-none text-body-md font-body-md"
            />
            <input
              type="number"
              placeholder={t("pastPapersEditor.yearPlaceholder")}
              value={form.year}
              onChange={(e) => setForm({ ...form, year: e.target.value })}
              className="w-32 px-md py-sm bg-surface-container rounded-xl border-none text-body-md font-body-md"
            />
          </div>
          <input
            placeholder={t("pastPapersEditor.paperUrlPlaceholder")}
            value={form.paperUrl}
            onChange={(e) => setForm({ ...form, paperUrl: e.target.value })}
            className="w-full px-md py-sm bg-surface-container rounded-xl border-none text-body-md font-body-md"
          />
          <textarea
            placeholder={t("pastPapersEditor.correctionTextPlaceholder")}
            value={form.correctionText}
            onChange={(e) => setForm({ ...form, correctionText: e.target.value })}
            rows={3}
            className="w-full px-md py-sm bg-surface-container rounded-xl border-none text-body-md font-body-md"
          />
          <input
            placeholder={t("pastPapersEditor.correctionUrlPlaceholder")}
            value={form.correctionUrl}
            onChange={(e) => setForm({ ...form, correctionUrl: e.target.value })}
            className="w-full px-md py-sm bg-surface-container rounded-xl border-none text-body-md font-body-md"
          />
          {error && <p className="font-label-md text-label-md text-error-red">{error}</p>}
          <button type="button" onClick={create} className="bg-excellence-blue text-white px-md py-sm rounded-xl font-label-lg text-label-lg">
            {t("common.saveAsDraft")}
          </button>
        </div>
      )}

      <ContentListPanel items={papers} titleOf={(item) => String(item.title ?? "")} onSubmitted={refresh} />
    </div>
  );
}
