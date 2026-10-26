const { Op } = require('sequelize');
const { Customer, Supplier, Document, DocumentType, Invoice, Expense, ServiceOrder, ServiceType, WalletAccount, sequelize } = require('../models');

/**
 * Get Aggregated Dashboard Statistics
 */
exports.getStats = async (req, res) => {
  try {
    const range = require('../utils/dashboardPeriod')(req.query.period || req.query.interval);
    const {period,start:startDate,end:endDate} = range;

    const thirtyDaysFromNow = new Date();
    thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);

    const sevenDaysFromNow = new Date();
    sevenDaysFromNow.setDate(sevenDaysFromNow.getDate() + 7);

    const tenantId = req.user.tenant_id;
    const { customer_id } = req.query;
    
    const whereDoc = { tenant_id: tenantId };
    const whereInvoiceAll = { tenant_id: tenantId, status: { [Op.ne]: 'Cancelled' }, created_at: { [Op.gte]: startDate, [Op.lt]: endDate } };
    const whereInvoicePaid = { tenant_id: tenantId, status: { [Op.in]: ['Paid', 'Partially Paid'] }, created_at: { [Op.gte]: startDate, [Op.lt]: endDate } };
    const whereExpense = { tenant_id: tenantId, status: { [Op.in]: ['Paid', 'Partially Paid'] }, created_at: { [Op.gte]: startDate, [Op.lt]: endDate } };
    const whereServiceAll = { tenant_id: tenantId };
    const whereServiceActive = { tenant_id: tenantId, status: { [Op.in]: ['Pending', 'In Progress'] } };
    const whereInvoiceAged = {
      tenant_id: tenantId,
      created_at: { [Op.lt]: require('../utils/invoiceAging').invoiceAgingCutoff('30') }
    };

    if (customer_id) {
      whereDoc.customer_id = customer_id;
      whereInvoiceAll.customer_id = customer_id;
      whereInvoicePaid.customer_id = customer_id;
      whereExpense.customer_id = customer_id;
      whereServiceAll.customer_id = customer_id;
      whereServiceActive.customer_id = customer_id;
      whereInvoiceAged.customer_id = customer_id;
    }

    if (req.user?.Role?.type === 'CustomerPortal') {
      const userCustomerIds = req.user.LinkedCustomers?.map(c => c.id) || [];
      if (customer_id && !userCustomerIds.includes(parseInt(customer_id))) {
        whereDoc.customer_id = { [Op.in]: [] };
        whereInvoiceAll.customer_id = { [Op.in]: [] };
        whereInvoicePaid.customer_id = { [Op.in]: [] };
        whereServiceAll.customer_id = { [Op.in]: [] };
        whereServiceActive.customer_id = { [Op.in]: [] };
        whereInvoiceAged.customer_id = { [Op.in]: [] };
      } else if (!customer_id) {
        whereDoc.customer_id = { [Op.in]: userCustomerIds };
        whereInvoiceAll.customer_id = { [Op.in]: userCustomerIds };
        whereInvoicePaid.customer_id = { [Op.in]: userCustomerIds };
        whereServiceAll.customer_id = { [Op.in]: userCustomerIds };
        whereServiceActive.customer_id = { [Op.in]: userCustomerIds };
        whereInvoiceAged.customer_id = { [Op.in]: userCustomerIds };
      }
    }

    // Parallel execution for performance
    const [
      totalCustomers,
      totalAllCustomers,
      totalSuppliers,
      activeDocuments,
      expiringSoon,
      criticalDocuments,
      monthlyPaid,
      monthlyReceivable,
      monthlyCost,
      activeServiceOrders,
      serviceCounts,
      wallets,
      agedInvoices,
      profitTotals
    ] = await Promise.all([
      Customer.count({ where: { tenant_id: tenantId, is_active: true } }),
      Customer.count({ where: { tenant_id: tenantId } }),
      Supplier.count({ where: { tenant_id: tenantId } }),
      Document.count({ where: whereDoc }),
      Document.count({ where: { ...whereDoc, expiry_date: { [Op.between]: [new Date(), thirtyDaysFromNow] } } }),
      Document.count({ where: { ...whereDoc, expiry_date: { [Op.between]: [new Date(), sevenDaysFromNow] } } }),
      Invoice.sum('paid_amount', { where: whereInvoicePaid }),
      Invoice.sum('total', { where: whereInvoiceAll }),
      Expense.sum('paid_amount', { where: whereExpense }),
      ServiceOrder.count({ where: whereServiceActive }),
      ServiceOrder.findAll({
        where: whereServiceAll,
        attributes: ['status', [sequelize.fn('COUNT', sequelize.col('id')), 'count']],
        group: ['status']
      }),
      WalletAccount.findAll({
        where: { tenant_id: tenantId, is_active: true },
        attributes: ['id', 'name', 'balance', 'currency']
      }),
      Invoice.count({ where: whereInvoiceAged }),
      require('../utils/profitTotals')(whereInvoiceAll, {tenant_id:tenantId,...(customer_id ? {customer_id} : {}),created_at:{[Op.gte]:startDate,[Op.lt]:endDate}})
    ]);

    const revenuePaid = parseFloat(monthlyPaid || 0);
    const revenueTotal = parseFloat(monthlyReceivable || 0);
    const cost = parseFloat(monthlyCost || 0);
    
    // Map service counts to a simple object
    const serviceOverview = {
      'Pending': 0,
      'In Progress': 0,
      'CompletedInvoicePending': 0,
      'CompletedInvoiceCreated': 0,
      'Cancelled': 0
    };
    serviceCounts.forEach(s => {
      const status = s.get('status');
      if (serviceOverview[status] !== undefined) {
        serviceOverview[status] = parseInt(s.get('count') || 0);
      }
    });

    res.json({
      success: true,
      data: {
        total_customers: totalAllCustomers,
        total_suppliers: totalSuppliers,
        active_customers: totalCustomers,
        active_documents: activeDocuments,
        expiring_soon: expiringSoon,
        critical_count: criticalDocuments,
        period,
        date_range: { from:range.from, to:range.to, timezone:'Asia/Dubai' },
        monthly_revenue: revenuePaid,
        monthly_receivable: revenueTotal,
        monthly_cost: cost,
        monthly_service_charges: profitTotals.service_charges,
        monthly_expenses: profitTotals.expenses,
        monthly_profit: profitTotals.net_profit,
        active_service_orders: activeServiceOrders,
        aged_invoices: agedInvoices || 0,
        service_overview: serviceOverview,
        wallet_balances: wallets
      }
    });
  } catch (err) {
    console.error('Dashboard Stats Error:', err);
    res.status(500).json({ success: false, message: 'Failed to fetch dashboard statistics' });
  }
};

/**
 * Get Recent Activity (Invoices, Expiring Docs, Recent Services)
 */
exports.getRecentActivity = async (req, res) => {
  try {
    const thirtyDaysFromNow = new Date();
    thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);
    thirtyDaysFromNow.setHours(23, 59, 59, 999);

    const tenantId = req.user.tenant_id;
    const { customer_id } = req.query;
    
    const whereInvoice = { tenant_id: tenantId };
    const whereDoc = { tenant_id: tenantId, expiry_date: { [Op.lte]: thirtyDaysFromNow } };
    const whereService = { tenant_id: tenantId, status: { [Op.in]: ['Pending', 'In Progress'] } };

    if (customer_id) {
      whereInvoice.customer_id = customer_id;
      whereDoc.customer_id = customer_id;
      whereService.customer_id = customer_id;
    }

    if (req.user?.Role?.type === 'CustomerPortal') {
      const userCustomerIds = req.user.LinkedCustomers?.map(c => c.id) || [];
      if (customer_id && !userCustomerIds.includes(parseInt(customer_id))) {
        whereInvoice.customer_id = { [Op.in]: [] };
        whereDoc.customer_id = { [Op.in]: [] };
        whereService.customer_id = { [Op.in]: [] };
      } else if (!customer_id) {
        whereInvoice.customer_id = { [Op.in]: userCustomerIds };
        whereDoc.customer_id = { [Op.in]: userCustomerIds };
        whereService.customer_id = { [Op.in]: userCustomerIds };
      }
    }

    const [recentInvoices, expiringDocuments, recentServices] = await Promise.all([
      Invoice.findAll({
        limit: 5,
        where: whereInvoice,
        order: [['created_at', 'DESC']],
        include: [{ model: Customer, attributes: ['name', 'phone_whatsapp'] }]
      }),
      Document.findAll({
        where: whereDoc,
        order: [['expiry_date', 'ASC']],
        include: [
          { model: Customer, attributes: ['name', 'phone_whatsapp'] },
          { model: DocumentType, attributes: ['name'] }
        ]
      }),
      ServiceOrder.findAll({
        limit: 5,
        where: whereService,
        order: [['created_at', 'DESC']],
        include: [
          { model: Customer, attributes: ['name'] },
          { model: ServiceType, attributes: ['name'] }
        ]
      })
    ]);

    // Format expiring docs to include days remaining
    const formattedExpiring = expiringDocuments.map(doc => {
        const diff = new Date(doc.expiry_date) - new Date();
        const days = Math.ceil(diff / (1000 * 60 * 60 * 24));
        return {
            ...doc.toJSON(),
            days_remaining: days
        };
    });

    res.json({
      success: true,
      data: {
        recent_invoices: recentInvoices,
        expiring_documents: formattedExpiring,
        recent_services: recentServices
      }
    });
  } catch (err) {
    console.error('Recent Activity Error:', err);
    res.status(500).json({ success: false, message: 'Failed to fetch recent activity' });
  }
};
