// src/services/erpService.js
//
// Facade over the retailer ERP services.
//
// WHY THIS FILE EXISTS: the wholesaler splits its ERP surface across ten
// single-purpose services (salesService, expenseService, purchaseService,
// inventoryService, dispatchService, accountsService, leadService,
// documentService, reportsService, …). That split is the architecture this app
// now mirrors. But the retailer's screens were written against one flat `erpApi`
// object, so this facade keeps every existing call site
// (`erpService.listSales(...)`) working while delegating to the mirrored
// services underneath.
//
// New code should import the specific domain service directly
// (`import { salesService } from '../services/salesService'`) and this facade
// can then be retired.
import api from './api';

import salesService from './salesService';
import expenseService from './expenseService';
import purchaseService from './purchaseService';
import inventoryService from './inventoryService';
import dispatchService from './dispatchService';
import accountsService from './accountsService';
import leadService, { followupService } from './leadService';
import documentService from './documentService';
import sellerOrderService from './sellerOrderService';
import erpCustomerService from './erpCustomerService';
import reportsService, { reportExportUrl } from './reportsService';

export const erpService = {
  // ── Dashboard ──
  // One aggregated payload: KPI cards, this-month P&L, stock buckets, totals,
  // recent enquiries/orders and the 6-month trend. Replaces the wholesaler's
  // five-call fan-out, which a retailer token cannot reach.
  erpDashboard: () => api.get('/erp/dashboard'),

  // ── Sales ──
  listSales:         salesService.list,
  getSale:           salesService.get,
  createSale:        salesService.create,
  recordSalePayment: salesService.recordPayment,
  salesReport:       salesService.report,

  // ── Expenses ──
  listExpenses:  expenseService.list,
  createExpense: expenseService.create,
  updateExpense: expenseService.update,
  deleteExpense: expenseService.delete,
  expenseReport: expenseService.report,

  // ── Profit & Loss ──
  profitLoss: accountsService.profitLoss,

  // ── Purchases & suppliers ──
  listPurchases:   purchaseService.list,
  getPurchase:     purchaseService.get,
  createPurchase:  purchaseService.create,
  updatePurchase:  purchaseService.update,
  deletePurchase:  purchaseService.delete,
  purchaseStatus:  purchaseService.status,
  purchasePayment: purchaseService.payment,
  listSuppliers:   purchaseService.listSuppliers,
  createSupplier:  purchaseService.createSupplier,
  updateSupplier:  purchaseService.updateSupplier,
  deleteSupplier:  purchaseService.deleteSupplier,

  // ── Inventory ──
  listInventory:      inventoryService.list,
  getInventoryItem:   inventoryService.get,
  inventorySummary:   inventoryService.summary,
  inventoryMovements: inventoryService.movements,
  adjustStock:        inventoryService.adjust,
  blockStock:         inventoryService.block,

  // ── Warehouses ──
  listWarehouses:  inventoryService.listWarehouses,
  createWarehouse: inventoryService.createWarehouse,
  updateWarehouse: inventoryService.updateWarehouse,
  deleteWarehouse: inventoryService.deleteWarehouse,
  warehouseStock:  inventoryService.warehouseStock,

  // ── Stock transfers ──
  listTransfers:  inventoryService.listTransfers,
  createTransfer: inventoryService.createTransfer,
  transferStatus: inventoryService.transferStatus,

  // ── Payments ──
  listReceivables:   accountsService.listReceivables,
  listPayables:      accountsService.listPayables,
  listTransactions:  accountsService.listTransactions,
  collectReceivable: accountsService.collectReceivable,
  payPayable:        accountsService.payPayable,

  // ── Accounts / ledgers ──
  companyLedger:  accountsService.companyLedger,
  cashBook:       accountsService.cashBook,
  bankBook:       accountsService.bankBook,
  customerLedger: accountsService.customerLedger,
  supplierLedger: accountsService.supplierLedger,

  // ── Leads ──
  listLeads:   leadService.list,
  createLead:  leadService.create,
  updateLead:  leadService.update,
  convertLead: leadService.convert,
  deleteLead:  leadService.remove,

  // ── Lead follow-ups ──
  listFollowups:  followupService.list,
  createFollowup: followupService.create,
  updateFollowup: followupService.update,
  deleteFollowup: followupService.remove,

  // ── ERP customers (distinct from customerService) ──
  listErpCustomers:  erpCustomerService.list,
  createErpCustomer: erpCustomerService.create,
  updateErpCustomer: erpCustomerService.update,
  deleteErpCustomer: erpCustomerService.remove,

  // ── Seller orders (fulfilment) ──
  listSellerOrders:        sellerOrderService.list,
  getSellerOrder:          sellerOrderService.get,
  updateSellerOrderStatus: sellerOrderService.updateStatus,
  packOrder:               sellerOrderService.pack,

  // ── Dispatch ──
  listDispatches:    dispatchService.list,
  getDispatch:       dispatchService.get,
  dispatchableOrders: dispatchService.dispatchableOrders,
  createDispatch:    dispatchService.create,
  dispatchInTransit: dispatchService.markInTransit,
  dispatchDeliver:   dispatchService.markDelivered,
  updateDispatch:    dispatchService.update,
  uploadDispatchPod: dispatchService.uploadPod,

  // ── Documents (repository) ──
  listDocuments:  documentService.list,
  deleteDocument: documentService.delete,
  uploadDocument: documentService.upload,

  // ── Reports ──
  reportSales:     reportsService.sales,
  reportPurchases: reportsService.purchases,
  reportCustomers: reportsService.customers,
  reportSuppliers: reportsService.suppliers,
  reportInventory: reportsService.inventory,
  analytics:       reportsService.analytics,
  reportExportUrl,
};

export default erpService;
