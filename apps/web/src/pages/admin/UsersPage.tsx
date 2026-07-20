import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { MaterialIcon } from "../../components/ui/MaterialIcon";
import { api, type AdminUserDto } from "../../lib/api-client";

/** No matching Stitch design — built from tokens (WEB-A04 gestion des utilisateurs). */
export function UsersPage() {
  const { t } = useTranslation();
  const roleLabels: Record<string, string> = {
    student: t("usersAdmin.role.student"),
    teacher: t("usersAdmin.role.teacher"),
    admin: t("usersAdmin.role.admin"),
  };
  const [users, setUsers] = useState<AdminUserDto[]>([]);
  const [search, setSearch] = useState("");
  const [role, setRole] = useState("");
  const [loading, setLoading] = useState(true);

  function refresh() {
    setLoading(true);
    api.adminUsers({ ...(search ? { search } : {}), ...(role ? { role } : {}) }).then((res) => {
      setUsers(res.users);
      setLoading(false);
    });
  }

  useEffect(refresh, [role]); // eslint-disable-line react-hooks/exhaustive-deps

  async function deactivate(id: string) {
    await api.deactivateUser(id);
    refresh();
  }

  async function changeRole(id: string, newRole: string) {
    await api.changeUserRole(id, newRole);
    refresh();
  }

  return (
    <div>
      <h1 className="font-headline-lg text-headline-lg text-excellence-blue mb-lg">{t("usersAdmin.title")}</h1>

      <div className="flex gap-sm mb-lg">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && refresh()}
          placeholder={t("usersAdmin.searchPlaceholder")}
          className="flex-1 px-md py-sm bg-surface-container rounded-xl border-none text-body-md font-body-md"
        />
        <select value={role} onChange={(e) => setRole(e.target.value)} className="px-md py-sm bg-surface-container rounded-xl border-none text-body-md font-body-md">
          <option value="">{t("usersAdmin.allRoles")}</option>
          <option value="student">{t("usersAdmin.role.student")}</option>
          <option value="teacher">{t("usersAdmin.role.teacher")}</option>
          <option value="admin">{t("usersAdmin.role.admin")}</option>
        </select>
        <button type="button" onClick={refresh} className="px-md py-sm bg-excellence-blue text-white rounded-xl font-label-lg text-label-lg">
          {t("usersAdmin.search")}
        </button>
      </div>

      {loading ? null : users.length === 0 ? (
        <p className="font-body-md text-body-md text-text-secondary text-center py-xl">{t("usersAdmin.empty")}</p>
      ) : (
        <div className="bg-surface-container-lowest rounded-xl border border-outline-variant overflow-hidden overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-surface-container border-b border-outline-variant">
                <th className="px-md py-3 font-label-lg text-label-lg text-text-secondary">{t("usersAdmin.colName")}</th>
                <th className="px-md py-3 font-label-lg text-label-lg text-text-secondary">{t("usersAdmin.colRole")}</th>
                <th className="px-md py-3 font-label-lg text-label-lg text-text-secondary">{t("usersAdmin.colContact")}</th>
                <th className="px-md py-3 font-label-lg text-label-lg text-text-secondary">{t("usersAdmin.colStatus")}</th>
                <th className="px-md py-3 font-label-lg text-label-lg text-text-secondary">{t("common.actions")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-variant">
              {users.map((u) => (
                <tr key={u.id}>
                  <td className="px-md py-3 font-body-md text-body-md">{u.first_name ?? "—"}</td>
                  <td className="px-md py-3">
                    <select
                      value={u.role}
                      onChange={(e) => changeRole(u.id, e.target.value)}
                      className="text-label-md font-label-md bg-surface-container-low rounded px-2 py-1 border-none"
                    >
                      {Object.entries(roleLabels).map(([value, label]) => (
                        <option key={value} value={value}>
                          {label}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="px-md py-3 text-body-sm text-body-sm text-text-secondary">{u.email ?? u.phone ?? "—"}</td>
                  <td className="px-md py-3">
                    <span
                      className={`px-2 py-1 rounded-full text-label-md font-label-md ${
                        u.is_active ? "bg-success-green/10 text-success-green" : "bg-error-red/10 text-error-red"
                      }`}
                    >
                      {u.is_active ? t("usersAdmin.active") : t("usersAdmin.inactive")}
                    </span>
                  </td>
                  <td className="px-md py-3">
                    {u.is_active && (
                      <button type="button" onClick={() => deactivate(u.id)} title={t("usersAdmin.deactivateTitle")}>
                        <MaterialIcon name="block" className="text-text-secondary hover:text-error-red transition-colors" />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
