// src/services/documentService.js
//
// Retailer ERP — the document repository: a free-form store (GST certificate,
// purchase / sales bills, catalogues, price lists) with typed filter tabs.
// Mirrors wholesalerapp/src/services/documentService.js.
//
// Distinct from profileService.getKycDocuments / authService.uploadDocs, which
// feed the company's verification record and are reviewed by the CRM.
import api from './api';

const ERP = '/erp';

export const documentService = {
  /** params: { doc_type } */
  list:   (params = {}) => api.get(`${ERP}/documents`, { params }),
  delete: (id)          => api.delete(`${ERP}/documents/${id}`),

  /**
   * Upload one document. `file` is a picker result: { uri, type, name }.
   * The backend multer field is literally "file" (see `uploadDocs` in
   * middleware/upload.js) — renaming it 400s with "No files uploaded.".
   * `entity_type` is required by the controller and groups the file under the
   * company's document set; `doc_type` is the free-text tag shown in the tabs.
   */
  upload(file, docType = 'Other') {
    const form = new FormData();
    form.append('file', {
      uri:  file.uri,
      type: file.type || 'application/octet-stream',
      name: file.name || `doc_${Date.now()}`,
    });
    form.append('entity_type', 'company');
    form.append('doc_type', docType);
    return api.upload(`${ERP}/documents`, form);
  },
};

export default documentService;
