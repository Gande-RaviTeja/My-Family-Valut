import { useState, useRef } from "react";
import { FolderIcon, FileIcon } from "../components/icons.jsx";
import { api } from "../api.js";
import { downloadDocumentFile } from "../utils/downloadHelper.js";

const SAMPLE_FILES = {
  Identity: ["Aadhaar.pdf", "PAN.pdf", "VoterID.jpg"],
  Banking: ["SBI Passbook.pdf", "Union Bank Statement.pdf", "APGVB Account.pdf", "Loan Statement.pdf"],
  Education: ["10th Memo.pdf", "Inter Memo.pdf", "Degree Certificate.pdf"],
  Medical: ["Health Card.pdf", "Blood Reports.pdf", "Prescription — Jan.pdf", "Prescription — Mar.pdf", "X-Ray.pdf"],
  Property: ["Land Registration.pdf", "Tax Receipts.pdf"],
};

export default function Folder({ folder, onBack, user }) {
  if (!folder) return null;
  // Start fresh and empty for real registered families until files are uploaded
  const initialFiles = folder.files || (user?.isGuest ? (SAMPLE_FILES[folder.name] || []) : []);
  const [files, setFiles] = useState(initialFiles);
  const [selectedFile, setSelectedFile] = useState(null);
  const [newFileName, setNewFileName] = useState("");
  const [uploadedFileObj, setUploadedFileObj] = useState(null);
  const [uploadedFileDataUrl, setUploadedFileDataUrl] = useState("");
  const [showAddFileModal, setShowAddFileModal] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  const fileInputRef = useRef(null);

  function handleFileSelect(e) {
    const file = e.target.files?.[0];
    if (file) {
      setUploadedFileObj(file);
      setNewFileName(file.name);
      const reader = new FileReader();
      reader.onload = (evt) => setUploadedFileDataUrl(evt.target.result);
      reader.readAsDataURL(file);
    }
  }

  function handleDragOver(e) {
    e.preventDefault();
    setIsDragging(true);
  }

  function handleDragLeave(e) {
    e.preventDefault();
    setIsDragging(false);
  }

  function handleDrop(e) {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      setUploadedFileObj(file);
      setNewFileName(file.name);
      const reader = new FileReader();
      reader.onload = (evt) => setUploadedFileDataUrl(evt.target.result);
      reader.readAsDataURL(file);
    }
  }

  async function handleAddFile(e) {
    e.preventDefault();
    if (!newFileName.trim()) return;
    const nameWithExt = newFileName.includes(".") ? newFileName.trim() : `${newFileName.trim()}.pdf`;

    if (user?.familyId && !user.isGuest) {
      try {
        await api.uploadDocument({
          name: nameWithExt,
          category: folder.name,
          member: user?.name || "Member",
          familyId: user.familyId,
          privacy: folder.sharedWith || "Shared with family",
          fileSize: uploadedFileObj ? `${(uploadedFileObj.size / 1024).toFixed(1)} KB` : "1.2 MB",
          fileUrl: uploadedFileDataUrl || "",
          uploadedBy: user?.name || "User",
        });
      } catch (err) {
        console.log("Error persisting document to DB:", err);
      }
    }

    setFiles((prev) => [nameWithExt, ...prev]);
    setNewFileName("");
    setUploadedFileObj(null);
    setUploadedFileDataUrl("");
    setShowAddFileModal(false);
  }

  const [fileObjectsState, setFileObjectsState] = useState(folder.fileObjects || []);

  const [docToDelete, setDocToDelete] = useState(null);

  async function confirmDeleteFile() {
    if (!docToDelete) return;
    const fileItem = docToDelete;
    const fileName = typeof fileItem === "string" ? fileItem : fileItem?.name;
    if (!fileName) {
      setDocToDelete(null);
      return;
    }

    const matchedObj = fileObjectsState.find((f) => f.name === fileName || f.id === fileItem?.id);

    if (matchedObj && matchedObj.id) {
      try {
        await api.deleteDocument(matchedObj.id);
      } catch (err) {
        console.log("Error deleting document from DB:", err);
      }
    } else if (user?.familyId && !user.isGuest) {
      try {
        const dbDocs = await api.getFamilyDocuments(user.familyId);
        const match = dbDocs.find((d) => d.name === fileName && d.category === folder.name);
        if (match && match._id) {
          await api.deleteDocument(match._id);
        }
      } catch (err) {
        console.log("Error querying doc for delete:", err);
      }
    }

    setFiles((prev) => prev.filter((f) => f !== fileName));
    setFileObjectsState((prev) => prev.filter((f) => f.name !== fileName));
    setSelectedFile(null);
    setDocToDelete(null);
  }

  const isViewOnly = user?.permission === "View Only" && user?.role !== "admin";

  return (
    <div className="folder-view">
      <div className="top-row">
        <div>
          <div className="greet-label back-link" onClick={onBack}>
            ← DOCUMENTS
          </div>
          <div className="greet-name">{folder.name} Documents</div>
        </div>
        {isViewOnly ? (
          <div className="folder-share" style={{ background: "var(--amber-tint)", color: "#B45309", fontWeight: 700, padding: "8px 16px", borderRadius: 8 }}>
            👁️ View Only Access
          </div>
        ) : (
          <button className="add-bill-btn" onClick={() => setShowAddFileModal(true)}>
            + Add File
          </button>
        )}
      </div>

      <div className="folder-header-row card">
        <div className="folder-icon header-folder-icon" style={{ background: "var(--purple-tint)" }}>
          <FolderIcon color="#7C3AED" />
        </div>
        <div>
          <h2 className="folder-title">{folder.name}</h2>
          <div className="file-meta">
            {files.length} files · Shared with {folder.sharedWith?.toLowerCase() || "family"}
          </div>
        </div>
      </div>

      <div className="card folder-files-card">
        {files.length === 0 ? (
          <div className="grocery-empty">No files in this folder.</div>
        ) : (
          files.map((f) => {
            const fileObj = fileObjectsState.find((fo) => fo.name === f);
            const memberName = fileObj?.member || folder.member || user?.name || "Family Member";
            const uploaderName = fileObj?.uploadedBy || memberName;

            return (
              <div className="file-row" key={f} onClick={() => setSelectedFile(f)} style={{ cursor: "pointer" }}>
                <div className="file-ico" style={{ background: "var(--purple-tint)" }}>
                  <FileIcon color="#7C3AED" />
                </div>
                <div className="file-details">
                  <p className="file-name">{f}</p>
                  <div className="file-meta" style={{ display: "flex", gap: 10, flexWrap: "wrap", fontSize: 12 }}>
                    <span>👤 <strong>Belongs to:</strong> <span style={{ color: "var(--purple)", fontWeight: 700 }}>{memberName}</span></span>
                    <span>📤 <strong>Uploaded by:</strong> <strong>{uploaderName}</strong></span>
                    <span>🔒 {fileObj?.privacy || folder.sharedWith || "Shared with family"}</span>
                  </div>
                </div>
                <div className="file-actions-desktop" style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <button className="file-action-btn" onClick={(e) => { e.stopPropagation(); setSelectedFile(f); }}>
                    Preview
                  </button>
                  {!isViewOnly && (
                    <button
                      className="file-action-btn"
                      onClick={(e) => {
                        e.stopPropagation();
                        setDocToDelete(f);
                      }}
                      style={{ color: "#DC2626", borderColor: "#FCA5A5", background: "#FEF2F2", fontWeight: 700 }}
                      title="Delete document"
                    >
                      🗑️ Delete
                    </button>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Preview Modal */}
      {selectedFile && (
        <div className="modal-overlay" onClick={() => setSelectedFile(null)}>
          <div className="modal-card card" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>{selectedFile}</h3>
              <button className="close-btn" onClick={() => setSelectedFile(null)}>✕</button>
            </div>
            <div className="preview-body">
              <div className="preview-placeholder">
                <FileIcon size={48} color="#7C3AED" />
                <p style={{ marginTop: 12, fontWeight: 700 }}>Document Preview</p>
                <span style={{ fontSize: 12, color: "var(--ink-soft)" }}>
                  Verified digital copy stored in encrypted family storage.
                </span>
              </div>
              <div className="modal-actions" style={{ marginTop: 20 }}>
                <button className="btn-secondary" style={{ color: "var(--coral)", borderColor: "#FCA5A5" }} onClick={() => setDocToDelete(selectedFile)}>
                  Delete File
                </button>
                <button
                  className="btn-primary"
                  onClick={() => {
                    const matchedObj = fileObjectsState.find((fo) => fo.name === selectedFile);
                    downloadDocumentFile(matchedObj || selectedFile, matchedObj?.fileUrl);
                  }}
                >
                  Download PDF
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Add File Modal */}
      {showAddFileModal && (
        <div className="modal-overlay" onClick={() => setShowAddFileModal(false)}>
          <div className="modal-card card" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Add File to {folder.name}</h3>
              <button className="close-btn" onClick={() => setShowAddFileModal(false)}>✕</button>
            </div>
            <form onSubmit={handleAddFile} className="modal-form">
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileSelect}
                style={{ display: "none" }}
                accept=".pdf,.jpg,.jpeg,.png,.docx,.doc"
              />
              <div
                className={`file-dropzone${isDragging ? " dropzone-active" : ""}`}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
              >
                <div className="dropzone-icon">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--purple)" strokeWidth="2">
                    <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M17 8l-5-5-5 5M12 3v12" />
                  </svg>
                </div>
                {uploadedFileObj ? (
                  <div className="file-selected-info">
                    <strong>{uploadedFileObj.name}</strong>
                    <span>{(uploadedFileObj.size / 1024).toFixed(1)} KB · Selected</span>
                  </div>
                ) : (
                  <div className="dropzone-prompt">
                    <strong>Drag & drop file here</strong>
                    <span>or <span className="browse-link">browse files</span> from device</span>
                  </div>
                )}
              </div>

              <label>
                File Name
                <input
                  type="text"
                  placeholder="e.g. Receipt_2024.pdf"
                  value={newFileName}
                  onChange={(e) => setNewFileName(e.target.value)}
                  required
                />
              </label>
              <div className="modal-actions">
                <button type="button" className="btn-secondary" onClick={() => setShowAddFileModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn-primary">
                  Add File
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {docToDelete && (
        <div className="modal-overlay" onClick={() => setDocToDelete(null)}>
          <div className="modal-card card" style={{ maxWidth: 420, textAlign: "center" }} onClick={(e) => e.stopPropagation()}>
            <div style={{ background: "#FEF2F2", width: 56, height: 56, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px", color: "#DC2626", fontSize: 26 }}>
              🗑️
            </div>
            <h3 style={{ margin: "0 0 8px", color: "var(--ink)", fontSize: 18, fontWeight: 700 }}>
              Delete Document?
            </h3>
            <p style={{ margin: "0 0 20px", color: "var(--ink-soft)", fontSize: 13.5, lineHeight: 1.5 }}>
              Are you sure you want to delete <strong>"{typeof docToDelete === "string" ? docToDelete : docToDelete?.name}"</strong>? This document will be permanently removed from your family's vault.
            </p>
            <div className="modal-actions" style={{ justifyContent: "center", gap: 12 }}>
              <button type="button" className="btn-secondary" onClick={() => setDocToDelete(null)}>
                Cancel
              </button>
              <button type="button" className="btn-primary" style={{ background: "#DC2626", borderColor: "#DC2626", color: "#FFF" }} onClick={confirmDeleteFile}>
                Delete Document
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
