import { useState, type JSX } from "react";
import {
  validateByCatalog,
  type AgentSummary,
  type Channel,
  type ColleagueSummary,
  type FieldErrorMap
} from "@ade/shared";

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
    <div className="ade-backdrop" role="presentation">
      <div
        data-testid="create-channel-modal"
        role="dialog"
        aria-modal="true"
        aria-label="Tạo kênh mới"
        className="ade-modal"
      >
        <div className="ade-modal-head">
          <h2 className="ade-head">Tạo kênh mới</h2>
          <button
            type="button"
            className="ade-btn ade-btn--icon ade-icon-btn"
            aria-label="Đóng"
            onClick={onClose}
          >
            ×
          </button>
        </div>

        <div className="ade-field">
          <label htmlFor="create-channel-name">Tên kênh</label>
          <input
            id="create-channel-name"
            autoFocus
            data-testid="channel-name-input"
            className="ade-input"
            value={name}
            placeholder="frontend-ui"
            onChange={(e) => setName(e.target.value)}
          />
          {fieldErrors.name?.[0] && (
            <p className="ade-field-error">{fieldErrors.name[0].message}</p>
          )}
        </div>

        <div className="ade-field">
          <label htmlFor="create-channel-desc">Mô tả</label>
          <input
            id="create-channel-desc"
            data-testid="channel-desc-input"
            className="ade-input"
            value={description}
            placeholder="Mục đích thảo luận của kênh"
            onChange={(e) => setDescription(e.target.value)}
          />
          {fieldErrors.description?.[0] && (
            <p className="ade-field-error">{fieldErrors.description[0].message}</p>
          )}
        </div>

        <div className="ade-mode-group">
          <button type="button" className="ade-btn" onClick={onClose}>
            Hủy
          </button>
          <button
            type="button"
            data-testid="submit-channel-btn"
            className="ade-btn ade-btn--primary"
            disabled={submitting}
            onClick={() => {
              void submit();
            }}
          >
            Tạo kênh
          </button>
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
    <div className="ade-backdrop" role="presentation">
      <div
        data-testid="channel-settings-modal"
        role="dialog"
        aria-modal="true"
        aria-label={`Cài đặt kênh #${channel.name}`}
        className="ade-modal"
      >
        <div className="ade-modal-head">
          <h2 className="ade-head">Cài đặt kênh #{channel.name}</h2>
          <button
            type="button"
            className="ade-btn ade-btn--icon ade-icon-btn"
            aria-label="Đóng"
            onClick={onClose}
          >
            ×
          </button>
        </div>

        <div className="ade-mode-group" style={{ marginBottom: "var(--space-md)" }}>
          <button
            type="button"
            data-testid="tab-general"
            className={tab === "general" ? "ade-btn ade-btn--primary" : "ade-btn"}
            onClick={() => setTab("general")}
          >
            Thông tin chung
          </button>
          <button
            type="button"
            data-testid="tab-members"
            className={tab === "members" ? "ade-btn ade-btn--primary" : "ade-btn"}
            onClick={() => setTab("members")}
          >
            Thành viên
          </button>
        </div>

        {tab === "general" ? (
          <div>
            <div className="ade-field">
              <label htmlFor="edit-channel-name">Tên kênh</label>
              <input
                id="edit-channel-name"
                data-testid="edit-channel-name-input"
                className="ade-input"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
              {fieldErrors.name?.[0] && (
                <p className="ade-field-error">{fieldErrors.name[0].message}</p>
              )}
            </div>

            <div className="ade-field">
              <label htmlFor="edit-channel-desc">Mô tả</label>
              <input
                id="edit-channel-desc"
                data-testid="edit-channel-desc-input"
                className="ade-input"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
              {fieldErrors.description?.[0] && (
                <p className="ade-field-error">{fieldErrors.description[0].message}</p>
              )}
            </div>

            <div className="ade-mode-group" style={{ marginBottom: "var(--space-lg)" }}>
              <button
                type="button"
                data-testid="save-channel-btn"
                className="ade-btn ade-btn--primary"
                disabled={submitting}
                onClick={() => {
                  void submitChanges();
                }}
              >
                Lưu thay đổi
              </button>
            </div>

            <div style={{ borderTop: "var(--rule-hair) solid var(--color-rule)", paddingTop: "var(--space-md)" }}>
              {isLastChannel && (
                <p className="ade-field-error" style={{ marginBottom: "var(--space-xs)" }}>
                  Dự án phải giữ lại ít nhất 1 kênh hoạt động.
                </p>
              )}
              {!confirmingDelete ? (
                <button
                  type="button"
                  data-testid="delete-channel-btn"
                  className="ade-btn ade-btn--danger"
                  disabled={isLastChannel || submitting}
                  onClick={() => setConfirmingDelete(true)}
                >
                  Xóa kênh
                </button>
              ) : (
                <button
                  type="button"
                  data-testid="confirm-delete-channel-btn"
                  className="ade-btn ade-btn--danger"
                  disabled={submitting}
                  onClick={() => {
                    void onDelete();
                  }}
                >
                  Xác nhận xóa #{channel.name}
                </button>
              )}
            </div>
          </div>
        ) : (
          <div>
            <div className="ade-field">
              <strong>Đồng nghiệp</strong>
              {colleagues.map((col) => (
                <label key={col.id} className="ade-mode-group">
                  <input
                    type="checkbox"
                    data-testid={`member-user-checkbox-${col.id}`}
                    checked={selectedUsers.includes(col.id)}
                    disabled={col.id === "usr_local"}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setSelectedUsers((prev) => [...prev, col.id]);
                      } else {
                        setSelectedUsers((prev) => prev.filter((id) => id !== col.id));
                      }
                    }}
                  />
                  <span>
                    {col.name} ({col.handle})
                  </span>
                </label>
              ))}
            </div>

            <div className="ade-field">
              <strong>Bot / Agent</strong>
              {agents.map((ag) => (
                <label key={ag.id} className="ade-mode-group">
                  <input
                    type="checkbox"
                    data-testid={`member-agent-checkbox-${ag.handle.slice(1)}`}
                    checked={selectedAgents.includes(ag.id)}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setSelectedAgents((prev) => [...prev, ag.id]);
                      } else {
                        setSelectedAgents((prev) => prev.filter((id) => id !== ag.id));
                      }
                    }}
                  />
                  <span>
                    {ag.displayName} ({ag.handle})
                  </span>
                </label>
              ))}
            </div>

            <button
              type="button"
              data-testid="save-channel-members-btn"
              className="ade-btn ade-btn--primary"
              disabled={submitting}
              onClick={() => {
                void submitChanges();
              }}
            >
              Lưu thành viên
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
