import React from "react";
import type { HarnessItem } from "@ade/shared";

export interface HarnessesTabProps {
  harnesses: HarnessItem[];
}

export const HarnessesTab: React.FC<HarnessesTabProps> = ({ harnesses }) => {
  return (
    <div className="space-y-3 text-xs">
      <span className="ade-muted">Harness và hồ sơ đăng nhập phát hiện trên máy local:</span>
      <div className="border rounded overflow-hidden">
        <table className="w-full text-left">
          <thead className="bg-muted/10 border-b">
            <tr>
              <th className="p-2">Harness</th>
              <th className="p-2">Trạng thái</th>
              <th className="p-2">Phiên bản</th>
              <th className="p-2">Hồ sơ</th>
              <th className="p-2">Thư mục cấu hình</th>
            </tr>
          </thead>
          <tbody>
            {harnesses.map((h) => (
              <tr key={h.id} className="border-b">
                <td className="p-2 font-medium">{h.displayName}</td>
                <td className="p-2">
                  {h.detected ? (
                    <span className="text-green-600 font-semibold">✓ Đã phát hiện</span>
                  ) : (
                    <span className="ade-muted">Chưa phát hiện</span>
                  )}
                </td>
                <td className="p-2 font-mono">{h.version ?? "1.0.0"}</td>
                <td className="p-2 font-mono">
                  {h.profiles.map((p) => p.name).join(", ")}
                </td>
                <td className="p-2 font-mono text-xs ade-muted">{h.configDir}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
