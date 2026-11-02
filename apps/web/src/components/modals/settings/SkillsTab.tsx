import React from "react";
import type { SkillItem } from "@ade/shared";

export interface SkillsTabProps {
  skills: SkillItem[];
  openNewSkillModal: () => void;
  openEditSkillModal: (sk: SkillItem) => void;
  handleDeleteSkill: (sk: SkillItem) => void;
  isSkillModalOpen: boolean;
  setIsSkillModalOpen: (open: boolean) => void;
  editingSkillName: string | null;
  skillError: string | null;
  handleSaveSkill: (e: React.FormEvent) => void;
  skillNameInput: string;
  setSkillNameInput: (name: string) => void;
  skillContentInput: string;
  setSkillContentInput: (content: string) => void;
  isSavingSkill: boolean;
}

export const SkillsTab: React.FC<SkillsTabProps> = ({
  skills,
  openNewSkillModal,
  openEditSkillModal,
  handleDeleteSkill,
  isSkillModalOpen,
  setIsSkillModalOpen,
  editingSkillName,
  skillError,
  handleSaveSkill,
  skillNameInput,
  setSkillNameInput,
  skillContentInput,
  setSkillContentInput,
  isSavingSkill
}) => {
  return (
    <div className="space-y-3 text-xs">
      <div className="flex items-center justify-between">
        <span className="ade-muted">
          Các Skill được nạp từ <code>.ade/skills/</code> (dự án) và <code>~/.ade/skills/</code> (toàn cục)
        </span>
        <button
          type="button"
          data-testid="create-skill-btn"
          onClick={openNewSkillModal}
          className="ade-btn ade-btn--primary ade-btn--sm"
        >
          + Tạo skill mới
        </button>
      </div>

      <div className="border rounded overflow-hidden">
        <table className="w-full text-left">
          <thead className="bg-muted/10 border-b">
            <tr>
              <th className="p-2">Tên Skill</th>
              <th className="p-2">Phạm vi</th>
              <th className="p-2">Mô tả</th>
              <th className="p-2">Script</th>
              <th className="p-2 text-right">Hành động</th>
            </tr>
          </thead>
          <tbody>
            {skills.length === 0 ? (
              <tr>
                <td colSpan={5} className="p-3 text-center ade-muted">
                  Chưa có skill nào
                </td>
              </tr>
            ) : (
              skills.map((sk) => (
                <tr key={sk.name} className="border-b hover:bg-muted/5">
                  <td className="p-2 font-mono font-medium">{sk.name}</td>
                  <td className="p-2">
                    <span className={sk.scope === "project" ? "ade-chip ade-chip--agent" : "ade-chip"}>
                      {sk.scope}
                    </span>
                  </td>
                  <td className="p-2">{sk.description}</td>
                  <td className="p-2">
                    {sk.hasShellScript ? <span className="text-amber-600 font-semibold">có shell</span> : <span className="ade-muted">không</span>}
                  </td>
                  <td className="p-2 text-right space-x-1">
                    {sk.scope === "project" && (
                      <>
                        <button
                          type="button"
                          data-testid={`edit-skill-btn-${sk.name}`}
                          onClick={() => openEditSkillModal(sk)}
                          className="ade-btn ade-btn--sm"
                        >
                          Sửa
                        </button>
                        <button
                          type="button"
                          data-testid={`delete-skill-btn-${sk.name}`}
                          onClick={() => handleDeleteSkill(sk)}
                          className="ade-btn ade-btn--sm ade-btn--danger"
                        >
                          Xóa
                        </button>
                      </>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Skill Modal */}
      {isSkillModalOpen && (
        <div className="ade-modal-backdrop" style={{ zIndex: 10000 }}>
          <div className="ade-modal-shell ade-panel p-5 space-y-3" style={{ maxWidth: "600px", width: "100%" }}>
            <div className="flex items-center justify-between border-b pb-2">
              <strong className="text-sm font-bold">
                {editingSkillName ? `Sửa Skill: ${editingSkillName}` : "Tạo Skill mới"}
              </strong>
              <button
                type="button"
                onClick={() => setIsSkillModalOpen(false)}
                className="ade-icon-btn"
                aria-label="Đóng"
              >
                ✕
              </button>
            </div>

            {skillError && (
              <div
                role="alert"
                data-testid="skill-error"
                className="ade-panel ade-panel--bad p-2 text-xs"
              >
                {skillError}
              </div>
            )}

            <form onSubmit={handleSaveSkill} className="space-y-2.5 text-xs">
              <div>
                <label className="block font-medium mb-1">Tên Skill (*)</label>
                <input
                  type="text"
                  data-testid="skill-name-input"
                  value={skillNameInput}
                  disabled={Boolean(editingSkillName)}
                  onChange={(e) => setSkillNameInput(e.target.value)}
                  placeholder="my-skill"
                  className={`ade-input w-full ${editingSkillName ? "bg-muted/20 cursor-not-allowed" : ""}`}
                  required
                />
              </div>

              <div>
                <label className="block font-medium mb-1">Nội dung SKILL.md (*)</label>
                <textarea
                  data-testid="skill-content-input"
                  value={skillContentInput}
                  onChange={(e) => setSkillContentInput(e.target.value)}
                  rows={8}
                  className="ade-input w-full font-mono text-xs"
                  required
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t">
                <button
                  type="button"
                  onClick={() => setIsSkillModalOpen(false)}
                  className="ade-btn"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  data-testid="save-skill-btn"
                  disabled={isSavingSkill}
                  className="ade-btn ade-btn--primary"
                >
                  {isSavingSkill ? "Đang lưu..." : "Lưu skill"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
