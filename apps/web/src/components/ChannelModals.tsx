import { useState, type JSX } from "react";
import {
  validateByCatalog,
  type AgentSummary,
  type Channel,
  type ColleagueSummary,
  type FieldErrorMap
} from "@ade/shared";
import { Button, IconButton, Icon } from "./ui/index.js";

interface CreateChannelModalProps {
  submitting: boolean;
  onClose: () => void;
  onCreate: (input: { name: string; description: string }) => Promise<void>;
}

export function CreateChannelModal({
  submitting,
  onClose,
  onCreate
}: CreateChannelModalProps): JSX.Element {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [fieldErrors, setFieldErrors] = useState<FieldErrorMap>({});

  const submit = async (): Promise<void> => {
    const check = validateByCatalog("chat.channel.create", { name, description });
    if (!check.ok) {
      setFieldErrors(check.fieldErrors);
      return;
    }
    setFieldErrors({});
    await onCreate({
      name: String(check.normalized.name),
      description: String(check.normalized.description ?? "")
    });
  };

  return (
    <div
      className="ade-backdrop ade-backdrop--layer-2"
      role="presentation"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        data-testid="create-channel-modal"
        role="dialog"
        aria-modal="true"
        aria-label="Tạo kênh mới"
        className="ade-panel ade-modal-shell ade-modal-shell--md"
      >
        <div className="ade-modal-header">
          <div className="min-w-0">
            <h2 className="ade-head text-base font-semibold truncate">Tạo kênh mới</h2>
            <p className="text-xs ade-muted m-0 mt-0.5">Tạo kênh thảo luận mới trong dự án hiện tại.</p>
          </div>
          <IconButton
            data-testid="close-channel-settings-btn"
            variant="ghost"
            size={28}
            aria-label="Đóng"
            title="Đóng"
            onClick={onClose}
          >
            <Icon name="close" size={16} />
          </IconButton>
        </div>

        <div className="ade-modal-body text-xs">
          <div className="space-y-4">
            <div className="space-y-1">
              <label htmlFor="create-channel-name" className="block font-medium">
                Tên kênh *
              </label>
              <input
                id="create-channel-name"
                autoFocus
                data-testid="channel-name-input"
                className="ade-input ade-mono"
                value={name}
                placeholder="frontend-ui"
                onChange={(e) => setName(e.target.value)}
              />
              {fieldErrors.name?.[0] && (
                <p className="text-xs mt-1" style={{ color: "var(--color-bad)" }}>
                  {fieldErrors.name[0].message}
                </p>
              )}
            </div>

            <div className="space-y-1">
              <label htmlFor="create-channel-desc" className="block font-medium">
                Mô tả
              </label>
              <textarea
                id="create-channel-desc"
                rows={2}
                data-testid="channel-desc-input"
                className="ade-input"
                value={description}
                placeholder="Mục đích thảo luận của kênh…"
                onChange={(e) => setDescription(e.target.value)}
              />
              {fieldErrors.description?.[0] && (
                <p className="text-xs mt-1" style={{ color: "var(--color-bad)" }}>
                  {fieldErrors.description[0].message}
                </p>
              )}
            </div>

            <div
              className="pt-3 flex items-center justify-end gap-2"
              style={{ borderTop: "var(--rule-hair) solid var(--color-rule)" }}
            >
              <Button type="button" variant="secondary" onClick={onClose} disabled={submitting}>
                Hủy
              </Button>
              <Button
                type="button"
                data-testid="submit-channel-btn"
                variant="primary"
                disabled={submitting}
                onClick={() => {
                  void submit();
                }}
              >
                {submitting ? "Đang tạo…" : "Tạo kênh"}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

interface ChannelSettingsModalProps {
  channel: Channel;
  initialTab: "general" | "members";
  totalActiveChannels: number;
  colleagues: ColleagueSummary[];
  agents: AgentSummary[];
  submitting: boolean;
  onClose: () => void;
  onSave: (input: {
    name: string;
    description: string;
    memberUserIds: string[];
    memberAgentIds: string[];
  }) => Promise<void>;
  onDelete: () => Promise<void>;
}

export function ChannelSettingsModal({
  channel,
  initialTab,
  totalActiveChannels,
  colleagues,
  agents,
  submitting,
  onClose,
  onSave,
  onDelete
}: ChannelSettingsModalProps): JSX.Element {
  const [tab, setTab] = useState<"general" | "members">(initialTab);
  const [name, setName] = useState(channel.name);
  const [description, setDescription] = useState(channel.description);
  const [selectedUsers, setSelectedUsers] = useState<string[]>(
    channel.members.filter((m) => m.memberType === "human").map((m) => m.memberId)
  );
  const [selectedAgents, setSelectedAgents] = useState<string[]>(
    channel.members.filter((m) => m.memberType === "agent").map((m) => m.memberId)
  );
  const [fieldErrors, setFieldErrors] = useState<FieldErrorMap>({});
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  const isLastChannel = totalActiveChannels <= 1;

  const submitChanges = async (): Promise<void> => {
    const check = validateByCatalog("chat.channel.update", {
      name,
      description,
      memberUserIds: selectedUsers,
      memberAgentIds: selectedAgents
    });
    if (!check.ok) {
      setFieldErrors(check.fieldErrors);
      return;
    }
    setFieldErrors({});
    await onSave({
      name: String(check.normalized.name),
      description: String(check.normalized.description ?? ""),
      memberUserIds: selectedUsers,
      memberAgentIds: selectedAgents
    });
  };

  return (
    <div
      className="ade-backdrop ade-backdrop--layer-2"
      role="presentation"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        data-testid="channel-settings-modal"
        role="dialog"
        aria-modal="true"
        aria-label={`Cài đặt kênh #${channel.name}`}
        className="ade-panel ade-modal-shell ade-modal-shell--md"
      >
        <div className="ade-modal-header">
          <div className="min-w-0">
            <h3 className="ade-head text-base font-semibold truncate">Cài đặt kênh #{channel.name}</h3>
            <p className="text-xs ade-muted m-0 mt-0.5">Thiết lập tiêu đề, mô tả hiển thị trên khung chat và thành viên kênh.</p>
          </div>
          <IconButton
            data-testid="close-channel-settings-btn"
            variant="ghost"
            size={28}
            aria-label="Đóng"
            title="Đóng"
            onClick={onClose}
          >
            <Icon name="close" size={16} />
          </IconButton>
        </div>

        <div className="ade-modal-subbar">
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              data-testid="tab-general"
              className={`ade-btn ade-btn--sm ${tab === "general" ? "ade-btn--primary" : ""}`}
              onClick={() => setTab("general")}
            >
              Thông tin chung
            </button>
            <button
              type="button"
              data-testid="tab-members"
              className={`ade-btn ade-btn--sm ${tab === "members" ? "ade-btn--primary" : ""}`}
              onClick={() => setTab("members")}
            >
              Thành viên ({selectedUsers.length + selectedAgents.length})
            </button>
          </div>
        </div>

        <div className="ade-modal-body text-xs">
          {tab === "general" ? (
            <div className="space-y-4">
              <div className="space-y-1">
                <label htmlFor="edit-channel-name" className="block font-medium">
                  Tiêu đề kênh (Title) *
                </label>
                <input
                  id="edit-channel-name"
                  data-testid="edit-channel-name-input"
                  className="ade-input ade-mono"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
                {fieldErrors.name?.[0] && (
                  <p className="text-xs mt-1" style={{ color: "var(--color-bad)" }}>
                    {fieldErrors.name[0].message}
                  </p>
                )}
              </div>

              <div className="space-y-1">
                <label htmlFor="edit-channel-desc" className="block font-medium">
                  Mô tả kênh (Description)
                </label>
                <textarea
                  id="edit-channel-desc"
                  rows={2}
                  data-testid="edit-channel-desc-input"
                  className="ade-input"
                  value={description}
                  placeholder="Hiển thị ở dòng thứ hai ngay dưới tên kênh trên khung chat…"
                  onChange={(e) => setDescription(e.target.value)}
                />
                {fieldErrors.description?.[0] && (
                  <p className="text-xs mt-1" style={{ color: "var(--color-bad)" }}>
                    {fieldErrors.description[0].message}
                  </p>
                )}
              </div>

              <div
                className="pt-3 flex flex-wrap items-center justify-between gap-2"
                style={{ borderTop: "var(--rule-hair) solid var(--color-rule)" }}
              >
                {!confirmingDelete ? (
                  <button
                    type="button"
                    data-testid="delete-channel-btn"
                    className="ade-btn ade-btn--sm ade-btn--danger"
                    disabled={isLastChannel || submitting}
                    onClick={() => setConfirmingDelete(true)}
                  >
                    Xóa kênh
                  </button>
                ) : (
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      data-testid="confirm-delete-channel-btn"
                      className="ade-btn ade-btn--sm ade-btn--danger"
                      disabled={submitting}
                      onClick={() => {
                        void onDelete();
                      }}
                    >
                      Xác nhận xóa
                    </button>
                    <button
                      type="button"
                      className="ade-btn ade-btn--sm"
                      onClick={() => setConfirmingDelete(false)}
                    >
                      Huỷ
                    </button>
                  </div>
                )}

                <div className="flex items-center gap-2">
                  <button type="button" className="ade-btn" onClick={onClose}>
                    Hủy
                  </button>
                  <button
                    type="button"
                    data-testid="save-channel-btn"
                    className="ade-btn ade-btn--primary"
                    disabled={submitting}
                    onClick={() => {
                      void submitChanges();
                    }}
                  >
                    {submitting ? "Đang lưu…" : "Lưu thay đổi"}
                  </button>
                </div>
              </div>

              {isLastChannel && (
                <p className="text-xs ade-muted mt-2">
                  Dự án phải giữ lại ít nhất 1 kênh hoạt động.
                </p>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              <div className="space-y-1.5">
                <div className="ade-muted font-medium">Đồng nghiệp ({selectedUsers.length}/{colleagues.length})</div>
                {colleagues.map((col) => {
                  const joined = selectedUsers.includes(col.id);
                  const isOwner = col.id === "usr_local";
                  return (
                    <div
                      key={col.id}
                      className="p-2.5 rounded flex items-center justify-between gap-2"
                      style={{ background: "var(--color-paper)", border: "var(--rule-hair) solid var(--color-rule)" }}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <span className="ade-avatar ade-avatar--sm ade-avatar--human">{col.name.slice(0, 2).toUpperCase()}</span>
                        <div className="min-w-0">
                          <div className="font-medium truncate">
                            {col.name} <span className="ade-mono ade-muted">{col.handle}</span>
                          </div>
                          <div className="ade-muted">Thành viên</div>
                        </div>
                      </div>
                      <label className="flex items-center gap-1.5 cursor-pointer">
                        <input
                          type="checkbox"
                          data-testid={`member-user-checkbox-${col.id}`}
                          checked={joined}
                          disabled={isOwner}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedUsers((prev) => [...prev, col.id]);
                            } else {
                              setSelectedUsers((prev) => prev.filter((id) => id !== col.id));
                            }
                          }}
                        />
                        <span className="ade-mono text-xs">{joined ? "Đã tham gia" : "Thêm"}</span>
                      </label>
                    </div>
                  );
                })}
              </div>

              <div className="space-y-1.5">
                <div className="ade-muted font-medium">Đội ngũ Agent ({selectedAgents.length}/{agents.length})</div>
                {agents.map((ag) => {
                  const joined = selectedAgents.includes(ag.id);
                  return (
                    <div
                      key={ag.id}
                      className="p-2.5 rounded flex items-center justify-between gap-2"
                      style={{ background: "var(--color-paper)", border: "var(--rule-hair) solid var(--color-rule)" }}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <span className="ade-avatar ade-avatar--sm ade-avatar--agent">{ag.handle.slice(1, 3).toUpperCase()}</span>
                        <div className="min-w-0">
                          <div className="font-medium truncate">
                            <span className="ade-mono">{ag.handle}</span> · {ag.displayName}
                          </div>
                          <div className="ade-mono ade-muted">{ag.role}</div>
                        </div>
                      </div>
                      <label className="flex items-center gap-1.5 cursor-pointer">
                        <input
                          type="checkbox"
                          data-testid={`member-agent-checkbox-${ag.handle.slice(1)}`}
                          checked={joined}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedAgents((prev) => [...prev, ag.id]);
                            } else {
                              setSelectedAgents((prev) => prev.filter((id) => id !== ag.id));
                            }
                          }}
                        />
                        <span className="ade-mono text-xs">{joined ? "Đã tham gia" : "Thêm"}</span>
                      </label>
                    </div>
                  );
                })}
              </div>

              <div
                className="pt-3 flex items-center justify-end gap-2"
                style={{ borderTop: "var(--rule-hair) solid var(--color-rule)" }}
              >
                <button type="button" className="ade-btn" onClick={onClose}>
                  Hủy
                </button>
                <button
                  type="button"
                  data-testid="save-channel-members-btn"
                  className="ade-btn ade-btn--primary"
                  disabled={submitting}
                  onClick={() => {
                    void submitChanges();
                  }}
                >
                  {submitting ? "Đang lưu…" : "Lưu thành viên"}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
