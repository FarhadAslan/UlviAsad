"use client";

import { useState, useEffect, useMemo } from "react";
import { useSession } from "next-auth/react";
import { useToast } from "@/components/ui/toast-1";
import { formatDate } from "@/lib/utils";
import Pagination from "@/components/Pagination";
import {
  Plus, X, Eye, Clock, Loader2,
  CheckCircle2, CircleDot, Trash2, Edit,
} from "lucide-react";

// ── Sabitlər ────────────────────────────────────────────────
const REQUEST_TYPES = [
  { value: "GENERAL",       label: "Ümumi" },
  { value: "ACTIVATE_QUIZ", label: "Quiz aktivləşdirmə" },
  { value: "CHANGE_ROLE",   label: "Rol dəyişikliyi" },
  { value: "OTHER",         label: "Digər" },
];

const STATUSES = [
  { value: "PENDING",     label: "Gözləmədə",   color: "text-amber-600", bg: "bg-amber-50 border-amber-200",   icon: Clock },
  { value: "IN_PROGRESS", label: "Prosesdədir", color: "text-blue-600",  bg: "bg-blue-50 border-blue-200",     icon: CircleDot },
  { value: "RESOLVED",    label: "Həll edildi", color: "text-green-600", bg: "bg-green-50 border-green-200",   icon: CheckCircle2 },
];

const PAGE_SIZE = 10;
const labelCls  = "block text-sm font-medium text-slate-700 mb-1.5";

// ── Köməkçi komponentlər ─────────────────────────────────────
function StatusBadge({ status }: { status: string }) {
  const s = STATUSES.find((x) => x.value === status) ?? STATUSES[0];
  const Icon = s.icon;
  return (
    <span className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full border ${s.bg} ${s.color}`}>
      <Icon size={11} /> {s.label}
    </span>
  );
}

function TypeBadge({ type }: { type: string }) {
  const t = REQUEST_TYPES.find((x) => x.value === type);
  return (
    <span className="inline-flex items-center text-xs font-medium px-2.5 py-1 rounded-full bg-slate-100 text-slate-600 border border-slate-200">
      {t?.label ?? type}
    </span>
  );
}

// ── Sorğu formu (yarat + redaktə) ───────────────────────────
function RequestForm({
  initial,
  onSuccess,
  onCancel,
}: {
  initial?: any;
  onSuccess: () => void;
  onCancel: () => void;
}) {
  const { error, success } = useToast();
  const isEdit = !!initial;
  const [form, setForm] = useState({
    title:   initial?.title   ?? "",
    message: initial?.message ?? "",
    type:    initial?.type    ?? "GENERAL",
  });
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title.trim() || !form.message.trim()) {
      error("Başlıq və mesaj tələb olunur");
      return;
    }
    setSaving(true);
    try {
      const res = isEdit
        ? await fetch(`/api/requests/${initial.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(form),
          })
        : await fetch("/api/requests", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(form),
          });
      const data = await res.json();
      if (res.ok) {
        success(isEdit ? "Sorğu yeniləndi" : "Sorğu göndərildi");
        onSuccess();
      } else {
        error(data.error || "Xəta baş verdi");
      }
    } catch {
      error("Şəbəkə xətası");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="card-static mb-6">
      <div className="flex items-center justify-between mb-5">
        <h2 className="text-lg font-semibold text-slate-800">
          {isEdit ? "Sorğunu Redaktə Et" : "Yeni Sorğu"}
        </h2>
        <button onClick={onCancel}
          className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-all">
          <X size={18} />
        </button>
      </div>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className={labelCls}>Sorğu növü</label>
          <select value={form.type}
            onChange={(e) => setForm((p) => ({ ...p, type: e.target.value }))}
            className="select-field">
            {REQUEST_TYPES.map((t) => (
              <option key={t.value} value={t.value}>{t.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label className={labelCls}>Başlıq *</label>
          <input type="text" value={form.title} required
            onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))}
            className="input-field" placeholder="Sorğunun qısa başlığı" />
        </div>
        <div>
          <label className={labelCls}>Mesaj *</label>
          <textarea value={form.message} required rows={4}
            onChange={(e) => setForm((p) => ({ ...p, message: e.target.value }))}
            className="input-field resize-none"
            placeholder="Sorğunuzu ətraflı izah edin..." />
        </div>
        <div className="flex gap-3 pt-1">
          <button type="submit" disabled={saving} className="btn-primary flex items-center gap-2">
            {saving
              ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              : isEdit ? "Yadda Saxla" : "Göndər"}
          </button>
          <button type="button" onClick={onCancel} className="btn-secondary">Ləğv et</button>
        </div>
      </form>
    </div>
  );
}

// ── Müəllim: Sorğu detay modalu (oxu + PENDING-dirsə redaktə) ──
function TeacherDetailModal({
  request,
  onClose,
  onEdit,
}: {
  request: any;
  onClose: () => void;
  onEdit: () => void;
}) {
  const isPending = request.status === "PENDING";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.4)", backdropFilter: "blur(4px)" }}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-slate-100">
          <h3 className="text-lg font-bold text-slate-900">Sorğu Detayı</h3>
          <button onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-all">
            <X size={18} />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {/* Növ + Status */}
          <div className="flex items-center gap-2 flex-wrap">
            <TypeBadge type={request.type} />
            <StatusBadge status={request.status} />
          </div>

          {/* Başlıq */}
          <div>
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">Başlıq</p>
            <p className="text-sm font-semibold text-slate-800">{request.title}</p>
          </div>

          {/* Mesaj */}
          <div>
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">Mesaj</p>
            <p className="text-sm text-slate-600 leading-relaxed whitespace-pre-wrap bg-slate-50 rounded-xl p-3 border border-slate-100">
              {request.message}
            </p>
          </div>

          {/* Admin qeydi */}
          {request.adminNote && (
            <div className="rounded-xl p-3 border"
              style={{ background: "rgba(147,204,255,0.08)", borderColor: "rgba(147,204,255,0.3)" }}>
              <p className="text-xs font-semibold text-[#1a7fe0] mb-1">💬 Admin cavabı</p>
              <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-wrap">
                {request.adminNote}
              </p>
            </div>
          )}

          <p className="text-xs text-slate-400">Göndərildi: {formatDate(request.createdAt)}</p>

          {/* PENDING deyilsə xəbərdarlıq */}
          {!isPending && (
            <div className="rounded-xl p-3 bg-slate-50 border border-slate-200 text-xs text-slate-500">
              ℹ️ Bu sorğu artıq işlənməyə başlanıb və ya həll edilib — redaktə edilə bilməz.
            </div>
          )}
        </div>

        <div className="flex gap-3 p-5 border-t border-slate-100">
          {isPending && (
            <button onClick={onEdit} className="btn-primary flex items-center gap-2 flex-1 justify-center">
              <Edit size={14} /> Redaktə Et
            </button>
          )}
          <button onClick={onClose} className={isPending ? "btn-secondary px-6" : "btn-primary flex-1"}>
            Bağla
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Admin: Sorğu detay / status dəyişdirmə ──────────────────
function AdminDetailModal({
  request,
  onClose,
  onUpdated,
}: {
  request: any;
  onClose: () => void;
  onUpdated: () => void;
}) {
  const { success, error } = useToast();
  const [status,    setStatus]    = useState(request.status);
  const [adminNote, setAdminNote] = useState(request.adminNote ?? "");
  const [saving,    setSaving]    = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch(`/api/requests/${request.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status, adminNote }),
      });
      if (res.ok) {
        success("Sorğu yeniləndi");
        onUpdated();
        onClose();
      } else {
        const d = await res.json();
        error(d.error || "Xəta baş verdi");
      }
    } catch {
      error("Şəbəkə xətası");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.4)", backdropFilter: "blur(4px)" }}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-5 border-b border-slate-100">
          <h3 className="text-lg font-bold text-slate-900">Sorğu Detayı</h3>
          <button onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-all">
            <X size={18} />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {/* Müəllim məlumatı */}
          <div className="flex items-center gap-3 p-3 rounded-xl bg-slate-50 border border-slate-100">
            <div className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold text-white flex-shrink-0"
              style={{ background: "linear-gradient(135deg,#1a7fe0,rgb(147,204,255))" }}>
              {request.teacher?.name?.[0]?.toUpperCase() ?? "M"}
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-800">{request.teacher?.name}</p>
              <p className="text-xs text-slate-400">{request.teacher?.email}</p>
            </div>
            <div className="ml-auto"><TypeBadge type={request.type} /></div>
          </div>

          {/* Başlıq */}
          <div>
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">Başlıq</p>
            <p className="text-sm font-semibold text-slate-800">{request.title}</p>
          </div>

          {/* Mesaj */}
          <div>
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">Mesaj</p>
            <p className="text-sm text-slate-600 leading-relaxed whitespace-pre-wrap bg-slate-50 rounded-xl p-3 border border-slate-100">
              {request.message}
            </p>
          </div>

          <p className="text-xs text-slate-400">Göndərildi: {formatDate(request.createdAt)}</p>

          {/* Status seçimi */}
          <div className="border-t border-slate-100 pt-4">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Status</p>
            <div className="flex gap-2 flex-wrap">
              {STATUSES.map((s) => {
                const Icon = s.icon;
                return (
                  <button key={s.value} type="button" onClick={() => setStatus(s.value)}
                    className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold border transition-all ${
                      status === s.value
                        ? `${s.bg} ${s.color} shadow-sm`
                        : "bg-white border-slate-200 text-slate-500 hover:border-slate-300"
                    }`}>
                    <Icon size={12} /> {s.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Admin qeydi */}
          <div>
            <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
              Admin qeydi (isteğe bağlı)
            </label>
            <textarea value={adminNote} rows={3}
              onChange={(e) => setAdminNote(e.target.value)}
              className="input-field resize-none text-sm"
              placeholder="Müəllimə cavab və ya qeyd..." />
          </div>
        </div>

        <div className="flex gap-3 p-5 border-t border-slate-100">
          <button onClick={handleSave} disabled={saving}
            className="btn-primary flex-1 flex items-center justify-center gap-2">
            {saving
              ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              : "Yadda Saxla"}
          </button>
          <button onClick={onClose} className="btn-secondary px-6">Bağla</button>
        </div>
      </div>
    </div>
  );
}

// ── Əsas səhifə ─────────────────────────────────────────────
export default function RequestsPage() {
  const { data: session, status } = useSession();
  const currentRole = (session?.user as any)?.role;
  const isTeacher   = currentRole === "TEACHER";

  // Session yüklənənə qədər heç nə göstərmə
  if (status === "loading" || !currentRole) {
    return (
      <div className="space-y-4">
        <div className="h-10 w-48 rounded-xl animate-pulse" style={{ background: "rgba(147,204,255,0.1)" }} />
        <div className="card-static space-y-3">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-12 rounded-xl animate-pulse" style={{ background: "rgba(147,204,255,0.08)" }} />
          ))}
        </div>
      </div>
    );
  }

  const { error } = useToast();
  const [requests,     setRequests]     = useState<any[]>([]);
  const [loading,      setLoading]      = useState(true);
  const [showForm,     setShowForm]     = useState(false);
  const [editingReq,   setEditingReq]   = useState<any>(null);   // müəllim redaktə
  const [viewingReq,   setViewingReq]   = useState<any>(null);   // müəllim detay
  const [selectedReq,  setSelectedReq]  = useState<any>(null);   // admin detay
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [page,         setPage]         = useState(1);
  const [deletingId,   setDeletingId]   = useState<string | null>(null);

  useEffect(() => { fetchRequests(); }, [statusFilter]);

  const fetchRequests = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (statusFilter !== "ALL") params.set("status", statusFilter);
      const res  = await fetch(`/api/requests?${params}`);
      const data = await res.json();
      setRequests(Array.isArray(data) ? data : []);
    } catch {
      error("Xəta baş verdi");
    } finally {
      setLoading(false);
    }
  };

  const deleteRequest = async (id: string) => {
    if (!confirm("Bu sorğunu silmək istədiyinizə əminsiniz?")) return;
    setDeletingId(id);
    try {
      const res = await fetch(`/api/requests/${id}`, { method: "DELETE" });
      if (res.ok) setRequests((prev) => prev.filter((r) => r.id !== id));
      else error("Silinmədi");
    } catch {
      error("Şəbəkə xətası");
    } finally {
      setDeletingId(null);
    }
  };

  const totalPages   = Math.ceil(requests.length / PAGE_SIZE);
  const paginated    = useMemo(
    () => requests.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE),
    [requests, page]
  );
  const pendingCount = requests.filter((r) => r.status === "PENDING").length;

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">
            {isTeacher ? "Sorğularım" : "Sorğular"}
          </h1>
          {!isTeacher && pendingCount > 0 && (
            <p className="text-sm text-amber-600 font-medium mt-1">
              {pendingCount} gözləyən sorğu var
            </p>
          )}
        </div>
        {isTeacher && !showForm && !editingReq && (
          <button onClick={() => setShowForm(true)} className="btn-primary flex items-center gap-2">
            <Plus size={16} /> Yeni Sorğu
          </button>
        )}
      </div>

      {/* Müəllim: Yeni sorğu formu */}
      {isTeacher && showForm && (
        <RequestForm
          onSuccess={() => { setShowForm(false); fetchRequests(); }}
          onCancel={() => setShowForm(false)}
        />
      )}

      {/* Müəllim: Redaktə formu */}
      {isTeacher && editingReq && (
        <RequestForm
          initial={editingReq}
          onSuccess={() => { setEditingReq(null); fetchRequests(); }}
          onCancel={() => setEditingReq(null)}
        />
      )}

      {/* Status filter */}
      {!showForm && !editingReq && (
        <div className="flex items-center gap-2 mb-5 flex-wrap">
          {[{ value: "ALL", label: "Hamısı" }, ...STATUSES.map((s) => ({ value: s.value, label: s.label }))].map((f) => (
            <button key={f.value}
              onClick={() => { setStatusFilter(f.value); setPage(1); }}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all ${
                statusFilter === f.value
                  ? "bg-[#1a7fe0] text-white border-[#1a7fe0] shadow-sm"
                  : "bg-white text-slate-600 border-slate-200 hover:border-[rgb(147,204,255)]"
              }`}>
              {f.label}
              {f.value === "PENDING" && pendingCount > 0 && !isTeacher && (
                <span className="ml-1.5 bg-amber-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                  {pendingCount}
                </span>
              )}
            </button>
          ))}
        </div>
      )}

      {/* Cədvəl */}
      {!showForm && !editingReq && (
        <div className="card-static overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 size={28} className="text-[#1a7fe0] animate-spin" />
            </div>
          ) : paginated.length === 0 ? (
            <div className="text-center py-16 text-slate-400">
              <div className="text-5xl mb-3">📭</div>
              <p className="font-medium">
                {isTeacher ? "Hələ sorğu göndərməmisiniz" : "Sorğu tapılmadı"}
              </p>
              {isTeacher && (
                <button onClick={() => setShowForm(true)}
                  className="mt-4 btn-primary text-sm px-5 py-2">
                  İlk sorğunu yarat
                </button>
              )}
            </div>
          ) : (
            <>
              <div className="table-scroll">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-slate-100">
                      {[
                        ...(isTeacher ? [] : ["Müəllim"]),
                        "Başlıq", "Növ", "Status", "Tarix", "Əməliyyatlar",
                      ].map((h) => (
                        <th key={h} className="text-left text-xs font-semibold text-slate-400 uppercase tracking-wider pb-3 pr-4">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {paginated.map((req) => (
                      <tr key={req.id}
                        className="hover:bg-slate-50 transition-colors cursor-pointer"
                        onClick={() => isTeacher ? setViewingReq(req) : setSelectedReq(req)}>

                        {/* Müəllim sütunu — yalnız admin */}
                        {!isTeacher && (
                          <td className="py-3 pr-4">
                            <div className="flex items-center gap-2">
                              <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0"
                                style={{ background: "linear-gradient(135deg,#1a7fe0,rgb(147,204,255))" }}>
                                {req.teacher?.name?.[0]?.toUpperCase() ?? "M"}
                              </div>
                              <span className="text-sm font-medium text-slate-700">{req.teacher?.name}</span>
                            </div>
                          </td>
                        )}

                        <td className="py-3 pr-4">
                          <p className="text-sm font-medium text-slate-800 max-w-[200px] truncate">{req.title}</p>
                          <p className="text-xs text-slate-400 mt-0.5 max-w-[200px] truncate">{req.message}</p>
                        </td>

                        <td className="py-3 pr-4"><TypeBadge type={req.type} /></td>

                        <td className="py-3 pr-4">
                          <StatusBadge status={req.status} />
                          {req.adminNote && (
                            <p className="text-xs text-slate-400 mt-1 max-w-[160px] truncate">
                              💬 {req.adminNote}
                            </p>
                          )}
                        </td>

                        <td className="py-3 pr-4 text-sm text-slate-400 whitespace-nowrap">
                          {formatDate(req.createdAt)}
                        </td>

                        <td className="py-3" onClick={(e) => e.stopPropagation()}>
                          <div className="flex items-center gap-1.5">
                            {/* Müəllim: bax + PENDING-dirsə redaktə */}
                            {isTeacher && (
                              <>
                                <button onClick={() => setViewingReq(req)}
                                  className="p-1.5 text-[#1a7fe0] hover:bg-blue-50 rounded-lg transition-all"
                                  title="Bax">
                                  <Eye size={14} />
                                </button>
                                {req.status === "PENDING" && (
                                  <button onClick={() => setEditingReq(req)}
                                    className="p-1.5 text-slate-500 hover:bg-slate-100 rounded-lg transition-all"
                                    title="Redaktə et">
                                    <Edit size={14} />
                                  </button>
                                )}
                              </>
                            )}

                            {/* Admin: detay */}
                            {!isTeacher && (
                              <button onClick={() => setSelectedReq(req)}
                                className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium text-[#1a7fe0] hover:bg-blue-50 border border-[rgba(147,204,255,0.4)] transition-all">
                                <Eye size={12} /> Detay
                              </button>
                            )}

                            <button onClick={() => deleteRequest(req.id)}
                              disabled={deletingId === req.id}
                              className="p-1.5 text-red-400 hover:bg-red-50 rounded-lg transition-all disabled:opacity-50"
                              title="Sil">
                              {deletingId === req.id
                                ? <div className="w-3.5 h-3.5 border-2 border-red-200 border-t-red-400 rounded-full animate-spin" />
                                : <Trash2 size={13} />}
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <Pagination page={page} totalPages={totalPages}
                onPageChange={(p) => { setPage(p); window.scrollTo({ top: 0, behavior: "smooth" }); }} />
            </>
          )}
        </div>
      )}

      {/* Müəllim: Detay modalu */}
      {isTeacher && viewingReq && (
        <TeacherDetailModal
          request={viewingReq}
          onClose={() => setViewingReq(null)}
          onEdit={() => { setEditingReq(viewingReq); setViewingReq(null); }}
        />
      )}

      {/* Admin: Detay modalu */}
      {!isTeacher && selectedReq && (
        <AdminDetailModal
          request={selectedReq}
          onClose={() => setSelectedReq(null)}
          onUpdated={fetchRequests}
        />
      )}
    </div>
  );
}
