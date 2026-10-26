const Invoice = require('../models/Invoice');
const InvoiceItem = require('../models/InvoiceItem');
const Customer = require('../models/Customer');
const WalletAccount = require('../models/WalletAccount');
const WalletTransaction = require('../models/WalletTransaction');
const sequelize = require('../config/database');
const { Op } = require('sequelize');
const { generateInvoicePDF } = require('../utils/pdfGenerator');
const { loadInvoiceDocumentPolicy } = require('../utils/invoiceDocumentPolicy');
const { invoiceAgingCutoff } = require('../utils/invoiceAging');

/**
 * Sequential Invoice Number Generator: INV-YYYY-XXXX
 */
const getNextInvoiceNumber = async (tenant_id) => {
    const year = new Date().getFullYear();
    const prefix = `INV-${year}-`;
    
    // Find the max invoice number for the current year
    const lastInvoice = await require('../utils/recordAccess').internalRead(() => Invoice.findOne({
        where: {
            tenant_id,
            invoice_number: { [Op.like]: `${prefix}%` }
        },
        order: [['invoice_number', 'DESC']], attributes: ['invoice_number']
    }));

    let nextNumber = 1;
    if (lastInvoice) {
        const lastSerial = parseInt(lastInvoice.invoice_number.split('-')[2]);
        nextNumber = lastSerial + 1;
    }

    return `${prefix}${String(nextNumber).padStart(4, '0')}`;
};

/**
 * List all invoices
 */
exports.listInvoices = async (req, res) => {
    try {
        let { status, customer_id, date_from, date_to, search, aging, page = 1, limit = 10 } = req.query;
        limit = Math.min(parseInt(limit), 100);
        const offset = (page - 1) * limit;

        const whereClause = { tenant_id: req.user.tenant_id };
        if (aging !== undefined && aging !== '') {
            let cutoff;
            try { cutoff = invoiceAgingCutoff(aging); }
            catch (error) { return res.status(400).json({ success: false, message: error.message }); }
            whereClause[Op.and] = [{ created_at: { [Op.lt]: cutoff } }];
        }
        
        if (status) whereClause.status = status;
        if (customer_id) whereClause.customer_id = customer_id;

        // Restrict CustomerPortal users to only their linked customers
        if (req.user && req.user.Role && req.user.Role.type === 'CustomerPortal') {
            const linkedIds = req.user.LinkedCustomers ? req.user.LinkedCustomers.map(c => c.id) : [];
            whereClause.customer_id = { [Op.in]: linkedIds };
        }
        
        if (date_from || date_to) {
            whereClause.created_at = {};
            if (date_from) whereClause.created_at[Op.gte] = new Date(date_from);
            if (date_to) {
                const endDate = new Date(date_to);
                endDate.setHours(23, 59, 59, 999);
                whereClause.created_at[Op.lte] = endDate;
            }
        }

        const include = [
            { model: Customer, attributes: ['id', 'name', 'phone_whatsapp'], where: { tenant_id: req.user.tenant_id }, required: false },
            { model: InvoiceItem, separate: true, where: { tenant_id: req.user.tenant_id } }
        ];

        // Search logic (by invoice number or customer name)
        if (search) {
            whereClause[Op.or] = [
                { invoice_number: { [Op.like]: `%${search}%` } },
                { '$Customer.name$': { [Op.like]: `%${search}%` } }
            ];
        }

        const { count, rows } = await Invoice.findAndCountAll({
            where: whereClause,
            include,
            distinct: true,
            limit: parseInt(limit),
            offset: parseInt(offset),
            order: [['created_at', 'DESC']]
        });

        res.json({ 
            success: true, 
            data: rows,
            meta: {
                total: count,
                page: parseInt(page),
                last_page: Math.ceil(count / limit)
            }
        });
    } catch (err) {
        console.error('List Invoices Error:', err);
        res.status(err.status || 500).json({ success: false, message: err.status && err.status < 500 ? err.message : 'Failed to fetch invoices' });
    }
};

/**
 * Get Single Invoice with Items
 */
exports.getInvoice = async (req, res) => {
    try {
        const invoice = await Invoice.findOne({
            where: { id: req.params.id, tenant_id: req.user.tenant_id },
            include: [
                { model: Customer },
                { model: InvoiceItem }
            ]
        });

        if (!invoice) { if (typeof transaction !== 'undefined') await transaction.rollback(); return res.status(404).json({ success: false, message: 'Invoice not found' }); }
        const data=invoice.toJSON();
        if(req.user.Role?.type!=='CustomerPortal')data.recorded_net_profit=await require('../utils/invoiceRecordedProfit')(invoice);
        res.json({ success: true, data });
    } catch (err) {
        res.status(err.status || 500).json({ success: false, message: err.status && err.status < 500 ? err.message : 'Failed to fetch invoice' });
    }
};

/**
 * Create Manual Invoice
 */
exports.createInvoice = async (req, res) => {
    const transaction = await sequelize.transaction({ isolationLevel: 'READ COMMITTED' });
    try {
        await require('../utils/commissionFeature').lockTenant(req.user.tenant_id,transaction);
        const costDeductionPoint=await require('../utils/serviceCompletionCost').deductionPoint(req.user.tenant_id,transaction);
        const { customer_id, service_order_ids, items, discount, tax, due_date, notes, status } = req.body;
        // Keep backwards compatibility for service_order_id
        const orderIds = Array.isArray(service_order_ids) ? [...service_order_ids] : (req.body.service_order_id ? [req.body.service_order_id] : []);
        
        // Collect order IDs from items as well
        if (items && Array.isArray(items)) {
            items.forEach(i => {
                const sId = i.service_order_id || i._service_order_id;
                if (sId && !orderIds.includes(sId)) {
                    orderIds.push(sId);
                }
            });
        }
        
        if (!items || items.length === 0) {
            await transaction.rollback();
            return res.status(400).json({ success: false, message: 'Invoice must have at least one item' });
        }

        const invoiceNumber = await getNextInvoiceNumber(req.user.tenant_id);
        
        // Fetch all related service orders to check cost deductions
        const ServiceOrder = require('../models/ServiceOrder');
        const orders = orderIds.length > 0 
            ? await ServiceOrder.findAll({ where: { id: { [Op.in]: orderIds }, tenant_id: req.user.tenant_id }, transaction, lock:transaction.LOCK.UPDATE })
            : [];
        
        // Map of service_order_id to is_cost_deducted
        const costDeductedMap = {};
        orders.forEach(o => {
            costDeductedMap[o.id] = o.is_cost_deducted || costDeductionPoint === 'service_completion';
        });

        // Calculate Totals
        let subtotal = 0;
        let costTotal = 0;
        
        const invoice = await Invoice.create({
            invoice_number: invoiceNumber,
            customer_id,
            service_order_id: null, // deprecated, using ServiceOrder.invoice_id
            discount: discount || 0,
            tax: tax || 0,
            due_date,
            notes,
            status: status || 'Draft',
            tenant_id: req.user.tenant_id
        }, { transaction });

        const itemRecords = items.map(item => {
            const listPrice = parseFloat(item.list_price || 0);
            const costPrice = parseFloat(item.cost_price || 0);
            const serviceCharge = parseFloat(item.service_charge || 0);
            const sellingPrice = parseFloat(item.selling_price || (costPrice + serviceCharge));
            const vatPercentage = parseFloat(item.vat_percentage || 0);
            const vatAmount = parseFloat(item.vat_amount || 0);
            const quantity = parseFloat(item.quantity || 1);
            
            const itemTotal = parseFloat(item.total || 0) || (sellingPrice + vatAmount) * quantity;
            const unitPrice = parseFloat(item.unit_price || 0) || (sellingPrice + vatAmount);

            subtotal += itemTotal;
            costTotal += (quantity * costPrice);
            
            const sOrderId = item.service_order_id || item._service_order_id || null;

            return {
                invoice_id: invoice.id,
                service_order_id: sOrderId,
                description: item.description || (typeof item.selectedItem === 'string' ? item.selectedItem : (item.selectedItem?.name || 'Custom Service')),
                quantity: quantity,
                list_price: listPrice,
                cost_price: costPrice,
                service_charge: serviceCharge,
                selling_price: sellingPrice,
                vat_percentage: vatPercentage,
                vat_amount: vatAmount,
                unit_price: unitPrice,
                total: itemTotal,
                wallet_id: item.wallet_id || null,
                cost_type: item.cost_type || null,
                cost_supplier_id: item.cost_supplier_id || null,
                tenant_id: req.user.tenant_id,
                // Passing this internally for cost deduction logic
                _service_order_id: sOrderId
            };
        });

        const createdItems = await InvoiceItem.bulkCreate(itemRecords, { transaction });

        if (invoice.status === 'Issued') {
            const { WalletTransaction, WalletAccount, SupplierPurchase, ServiceOrder } = require('../models');
            for (let i = 0; i < itemRecords.length; i++) {
                const item = itemRecords[i];
                // Check if this specific item's service order already had its cost deducted
                const skipCostDeduction = item._service_order_id ? costDeductedMap[item._service_order_id] : false;

                if (!skipCostDeduction && item.cost_price > 0 && (item.wallet_id || item.cost_supplier_id)) {
                    const totalCost = parseFloat(item.cost_price) * parseInt(item.quantity);
                    if (totalCost > 0) {
                        if (item.cost_type === 'Supplier' && item.cost_supplier_id) {
                            await SupplierPurchase.create({
                                tenant_id: req.user.tenant_id,
                                supplier_id: item.cost_supplier_id,
                                reference_type: 'InvoiceItem',
                                reference_id: createdItems[i].id,
                                amount: totalCost,
                                description: `Cost for Invoice #${invoice.invoice_number} - ${item.description}`
                            }, { transaction });
                        } else if (item.wallet_id) {
                            await WalletTransaction.create({
                                account_id: item.wallet_id,
                                type: 'Expense',
                                direction: 'Out',
                                amount: totalCost,
                                reference_id: invoice.id,
                                reference_type: 'InvoiceCost',
                                description: `Cost payment for Invoice #${invoice.invoice_number} - ${item.description}`,
                                tenant_id: invoice.tenant_id
                            }, { transaction });
                            await WalletAccount.decrement('balance', {
                                by: totalCost,
                                where: { id: item.wallet_id },
                                transaction
                            });
                        }

                        // Mark linked service order as cost deducted so it never deducts twice
                        if (item._service_order_id) {
                            await ServiceOrder.update({
                                is_cost_deducted: true,
                                cost_type: item.cost_type || (item.wallet_id ? 'Wallet' : null),
                                cost_supplier_id: item.cost_supplier_id || null
                            }, {
                                where: { id: item._service_order_id, tenant_id: req.user.tenant_id },
                                transaction
                            });
                            costDeductedMap[item._service_order_id] = true;
                        }
                    }
                }
            }
        }

        // Update main total
        const finalTotal = subtotal - (parseFloat(discount) || 0); 
        await invoice.update({ 
            subtotal, 
            total: finalTotal + (parseFloat(tax) || 0),
            cost_total: costTotal
        }, { transaction });

        // Link orders to the invoice and promote status
        if (orders.length > 0) {
            const SalesOrderItem = require('../models/SalesOrderItem');
            for (const order of orders) {
                await order.update({
                    invoice_id: invoice.id,
                    status: order.status === 'CompletedInvoicePending' ? 'CompletedInvoiceCreated' : order.status
                }, { transaction });

                if (order.status === 'CompletedInvoicePending') {
                    const salesOrderItem = await SalesOrderItem.findOne({
                        where: { service_order_id: order.id, tenant_id: req.user.tenant_id },
                        transaction
                    });
                    if (salesOrderItem) {
                        await salesOrderItem.update({ status: 'CompletedInvoiceCreated' }, { transaction });
                    }
                }
            }
        }

        await require('../utils/commissionEngine').syncInvoice(invoice, transaction);
        await transaction.commit();
        res.status(201).json({ success: true, data: invoice, message: `Invoice ${invoiceNumber} created` });
    } catch (err) {
        await transaction.rollback();
        console.error('Create Invoice Error:', err);
        res.status(err.status || 500).json({ success: false, message: err.status && err.status < 500 ? err.message : 'Failed to create invoice' });
    }
};

/**
 * Update Invoice
 */
exports.updateInvoice = async (req, res) => {
    const transaction = await sequelize.transaction({ isolationLevel: 'READ COMMITTED' });
    try {
        await require('../utils/commissionFeature').lockTenant(req.user.tenant_id,transaction);
        const costDeductionPoint=await require('../utils/serviceCompletionCost').deductionPoint(req.user.tenant_id,transaction);
        const { customer_id, service_order_ids, service_order_id, items, discount, tax, due_date, notes, status } = req.body;
        const invoice = await Invoice.findOne({ where: { id: req.params.id, tenant_id: req.user.tenant_id }, transaction, lock: transaction.LOCK.UPDATE });

        if (!invoice) { await transaction.rollback(); return res.status(404).json({ success: false, message: 'Invoice not found' }); }
        if (Number(invoice.paid_amount) > 0) {
            await transaction.rollback();
            return res.status(400).json({ success: false, message: 'Invoices with payments cannot be edited.' });
        }
        if (['Issued', 'Overdue'].includes(invoice.status)) {
            await require('../utils/invoiceEditing').updateUnpaidIssued(invoice, req.body, transaction);
            await transaction.commit();
            return res.json({ success: true, data: invoice, message: 'Invoice updated successfully' });
        }
        if (invoice.status !== 'Draft' && invoice.status !== 'Pending Approval') {
            await transaction.rollback();
            return res.status(400).json({ success: false, message: 'Only draft, pending approval or unpaid issued invoices can be edited.' });
        }
        if (status && !['Draft', 'Pending Approval'].includes(status)) throw Object.assign(new Error('Use Issue Invoice to issue a draft after saving its changes.'), { status: 400 });

        // Remove existing items
        await InvoiceItem.destroy({ where: { invoice_id: invoice.id }, transaction });
        
        // Map of service_order_id to is_cost_deducted
        const costDeductedMap = {};
        const orderIds = Array.isArray(service_order_ids) ? [...service_order_ids] : (service_order_id ? [service_order_id] : []);
        
        // Add IDs from items if present
        if (items && Array.isArray(items)) {
            items.forEach(i => {
                const sId = i.service_order_id || i._service_order_id;
                if (sId && !orderIds.includes(sId)) {
                    orderIds.push(sId);
                }
            });
        }

        if (orderIds.length > 0) {
            const ServiceOrder = require('../models/ServiceOrder');
            const orders = await ServiceOrder.findAll({
                where: { id: orderIds, tenant_id: req.user.tenant_id },
                transaction, lock:transaction.LOCK.UPDATE
            });
            orders.forEach(o => {
                costDeductedMap[o.id] = o.is_cost_deducted || costDeductionPoint === 'service_completion';
            });
        }

        // Calculate Totals
        let subtotal = 0;
        let costTotal = 0;

        const itemRecords = items.map(item => {
            const listPrice = parseFloat(item.list_price || 0);
            const costPrice = parseFloat(item.cost_price || 0);
            const serviceCharge = parseFloat(item.service_charge || 0);
            const sellingPrice = parseFloat(item.selling_price || (costPrice + serviceCharge));
            const vatPercentage = parseFloat(item.vat_percentage || 0);
            const vatAmount = parseFloat(item.vat_amount || 0);
            const quantity = parseFloat(item.quantity || 1);
            
            const itemTotal = parseFloat(item.total || 0) || (sellingPrice + vatAmount) * quantity;
            const unitPrice = parseFloat(item.unit_price || 0) || (sellingPrice + vatAmount);

            subtotal += itemTotal;
            costTotal += (quantity * costPrice);
            
            return {
                invoice_id: invoice.id,
                description: item.description || (typeof item.selectedItem === 'string' ? item.selectedItem : (item.selectedItem?.name || 'Custom Service')),
                quantity: quantity,
                list_price: listPrice,
                cost_price: costPrice,
                service_charge: serviceCharge,
                selling_price: sellingPrice,
                vat_percentage: vatPercentage,
                vat_amount: vatAmount,
                unit_price: unitPrice,
                total: itemTotal,
                wallet_id: item.wallet_id || null,
                cost_type: item.cost_type || null,
                cost_supplier_id: item.cost_supplier_id || null,
                service_order_id: item.service_order_id || item._service_order_id || null,
                _service_order_id: item.service_order_id || item._service_order_id || null,
                tenant_id: req.user.tenant_id
            };
        });

        const createdItems = await InvoiceItem.bulkCreate(itemRecords, { transaction });

        if (invoice.status === 'Issued') {
            const { WalletTransaction, WalletAccount, SupplierPurchase, ServiceOrder } = require('../models');
            for (let i = 0; i < itemRecords.length; i++) {
                const item = itemRecords[i];
                const skipCostDeduction = item._service_order_id ? costDeductedMap[item._service_order_id] : false;
                
                if (!skipCostDeduction && item.cost_price > 0 && (item.wallet_id || item.cost_supplier_id)) {
                    const totalCost = parseFloat(item.cost_price) * parseInt(item.quantity);
                    if (totalCost > 0) {
                        if (item.cost_type === 'Supplier' && item.cost_supplier_id) {
                            await SupplierPurchase.create({
                                tenant_id: req.user.tenant_id,
                                supplier_id: item.cost_supplier_id,
                                reference_type: 'InvoiceItem',
                                reference_id: createdItems[i].id,
                                amount: totalCost,
                                description: `Cost for Invoice #${invoice.invoice_number} - ${item.description}`
                            }, { transaction });
                        } else if (item.wallet_id) {
                            await WalletTransaction.create({
                                account_id: item.wallet_id,
                                type: 'Expense',
                                direction: 'Out',
                                amount: totalCost,
                                reference_id: invoice.id,
                                reference_type: 'InvoiceCost',
                                description: `Cost payment for Invoice #${invoice.invoice_number} - ${item.description}`,
                                tenant_id: invoice.tenant_id
                            }, { transaction });
                            await WalletAccount.decrement('balance', {
                                by: totalCost,
                                where: { id: item.wallet_id },
                                transaction
                            });
                        }

                        // Mark linked service order as cost deducted
                        if (item._service_order_id) {
                            await ServiceOrder.update({
                                is_cost_deducted: true,
                                cost_type: item.cost_type || (item.wallet_id ? 'Wallet' : null),
                                cost_supplier_id: item.cost_supplier_id || null
                            }, {
                                where: { id: item._service_order_id, tenant_id: req.user.tenant_id },
                                transaction
                            });
                            costDeductedMap[item._service_order_id] = true;
                        }
                    }
                }
            }
        }

        // Update main total
        const finalTotal = subtotal - (parseFloat(discount) || 0) + (parseFloat(tax) || 0);
        await invoice.update({ 
            customer_id,
            service_order_id: null, // Deprecated, using invoice_id on ServiceOrder
            discount: discount || 0,
            tax: tax || 0,
            due_date,
            notes,
            status: status || invoice.status,
            subtotal, 
            total: finalTotal,
            cost_total: costTotal
        }, { transaction });

        // If services were waiting for an invoice (CompletedInvoicePending), promote them to CompletedInvoiceCreated
        if (orderIds.length > 0) {
            const ServiceOrder = require('../models/ServiceOrder');
            const orders = await ServiceOrder.findAll({
                where: { id: orderIds, tenant_id: req.user.tenant_id },
                transaction
            });
            
            const SalesOrderItem = require('../models/SalesOrderItem');
            
            for (const order of orders) {
                // Ensure link is maintained
                await order.update({ invoice_id: invoice.id }, { transaction });

                if (order.status === 'CompletedInvoicePending') {
                    await order.update({ status: 'CompletedInvoiceCreated' }, { transaction });

                    // Sync status to SalesOrderItem
                    const salesOrderItem = await SalesOrderItem.findOne({
                        where: { service_order_id: order.id, tenant_id: req.user.tenant_id },
                        transaction
                    });
                    if (salesOrderItem) {
                        await salesOrderItem.update({ status: 'CompletedInvoiceCreated' }, { transaction });
                    }
                }
            }
        }

        await require('../utils/commissionEngine').syncInvoice(invoice, transaction);
        await transaction.commit();
        res.json({ success: true, data: invoice, message: 'Invoice updated successfully' });
    } catch (err) {
        await transaction.rollback();
        console.error('Update Invoice Error:', err);
        res.status(err.status || 500).json({ success: false, message: err.status && err.status < 500 ? err.message : 'Failed to update invoice' });
    }
};

/**
 * Update Status & Wallet Integration
 */
exports.updateStatus = async (req, res) => {
    const transaction = await sequelize.transaction({ isolationLevel: 'READ COMMITTED' });
    try {
        await require('../utils/commissionFeature').lockTenant(req.user.tenant_id,transaction);
        const costDeductionPoint=await require('../utils/serviceCompletionCost').deductionPoint(req.user.tenant_id,transaction);
        const { status, account_id, amount } = req.body; 
        const invoice = await Invoice.findOne({
            where: { id: req.params.id, tenant_id: req.user.tenant_id },
            include: [{ model: InvoiceItem }],
            transaction, lock: transaction.LOCK.UPDATE
        });

        if (!invoice) { await transaction.rollback(); return res.status(404).json({ success: false, message: 'Invoice not found' }); }
        
        // 1. Wallet Deduction & Supplier Billing Logic for Cost Price
        // Happens when an invoice transitions to Issued for the first time
        if (status === 'Issued' && invoice.status !== 'Issued' && invoice.status !== 'Paid' && invoice.status !== 'Partially Paid') {
            const { SupplierPurchase, ServiceOrder, WalletTransaction, WalletAccount } = require('../models');
            
            // Collect linked service order IDs
            const sOrderIds = invoice.InvoiceItems
                .map(i => i.service_order_id)
                .filter(Boolean);
            
            const linkedOrders = sOrderIds.length > 0
                ? await ServiceOrder.findAll({
                    where: { id: sOrderIds, tenant_id: req.user.tenant_id },
                    transaction, lock:transaction.LOCK.UPDATE
                  })
                : [];
            
            const costDeductedMap = {};
            linkedOrders.forEach(o => {
                costDeductedMap[o.id] = o.is_cost_deducted || costDeductionPoint === 'service_completion';
            });

            for (const item of invoice.InvoiceItems) {
                const skipCostDeduction = item.service_order_id ? costDeductedMap[item.service_order_id] : false;

                if (!skipCostDeduction && item.cost_price > 0 && (item.wallet_id || item.cost_supplier_id)) {
                    const totalCost = parseFloat(item.cost_price) * parseInt(item.quantity);
                    if (totalCost > 0) {
                        if (item.cost_type === 'Supplier' && item.cost_supplier_id) {
                            await SupplierPurchase.create({
                                tenant_id: req.user.tenant_id,
                                supplier_id: item.cost_supplier_id,
                                reference_type: 'InvoiceItem',
                                reference_id: item.id,
                                amount: totalCost,
                                description: `Cost for Invoice #${invoice.invoice_number} - ${item.description}`
                            }, { transaction });
                        } else if (item.wallet_id) {
                            // Create negative WalletTransaction (Expense)
                            await WalletTransaction.create({
                                account_id: item.wallet_id,
                                type: 'Expense',
                                direction: 'Out',
                                amount: totalCost,
                                reference_id: invoice.id,
                                reference_type: 'InvoiceCost',
                                description: `Cost payment for Invoice #${invoice.invoice_number} - ${item.description}`,
                                tenant_id: invoice.tenant_id
                            }, { transaction });

                            // Deduct from wallet balance
                            await WalletAccount.decrement('balance', {
                                by: totalCost,
                                where: { id: item.wallet_id },
                                transaction
                            });
                        }

                        // Mark linked service order as cost deducted so it never deducts twice
                        if (item.service_order_id) {
                            await ServiceOrder.update({
                                is_cost_deducted: true,
                                cost_type: item.cost_type || (item.wallet_id ? 'Wallet' : null),
                                cost_supplier_id: item.cost_supplier_id || null
                            }, {
                                where: { id: item.service_order_id, tenant_id: req.user.tenant_id },
                                transaction
                            });
                            costDeductedMap[item.service_order_id] = true;
                        }
                    }
                }
            }
        }

        // Transition Logic: Reversing Issued -> Draft/Cancelled
        if ((status === 'Draft' || status === 'Cancelled' || status === 'Pending Approval') && 
            (invoice.status === 'Issued' || invoice.status === 'Paid' || invoice.status === 'Partially Paid')) {
            const { ServiceOrder } = require('../models');
            // Revert is_cost_deducted on linked service orders that had their costs deducted by this invoice
            const sOrderIds = invoice.InvoiceItems
                .map(i => i.service_order_id)
                .filter(Boolean);
            if (sOrderIds.length > 0) {
                await ServiceOrder.update({
                    is_cost_deducted: false,
                    cost_type: null,
                    cost_supplier_id: null
                }, {
                    where: { id: sOrderIds, tenant_id: req.user.tenant_id },
                    transaction
                });
            }

            // Find ALL cost transactions for this invoice
            const costTransactions = await WalletTransaction.findAll({
                where: { reference_id: invoice.id, reference_type: 'InvoiceCost', type: 'Expense', tenant_id: req.user.tenant_id },
                transaction
            });

            for (const tx of costTransactions) {
                // Revert deduction (Add back to balance)
                await WalletAccount.increment('balance', {
                    by: tx.amount,
                    where: { id: tx.account_id },
                    transaction
                });
                await tx.destroy({ transaction });
            }

            // Find and destroy all SupplierPurchases related to these invoice items
            const { SupplierPurchase } = require('../models');
            const itemIds = invoice.InvoiceItems.map(i => i.id);
            if (itemIds.length > 0) {
                await SupplierPurchase.destroy({
                    where: {
                        reference_type: 'InvoiceItem',
                        reference_id: { [Op.in]: itemIds },
                        tenant_id: req.user.tenant_id
                    },
                    transaction
                });
            }
        }

        // 2. Income Logic for Payments
        // Transition Logic: Adding Payment (Moving TO Paid or Partially Paid)
        if ((status === 'Paid' || status === 'Partially Paid') && (invoice.status !== 'Paid' || status === 'Partially Paid')) {
            if (!account_id && invoice.status !== 'Issued' && invoice.status !== 'Approved' && invoice.status !== 'Draft') {
                // If it's just transitioning to Paid from Draft without setting account_id, we should block if amount > 0 and no account.
                // But actually, we need an account to receive money.
                if (!account_id) {
                    await transaction.rollback();
                    return res.status(400).json({ success: false, message: 'Please select a Wallet Account to receive funds' });
                }
            }

            if (account_id) {
                const paymentAmount = parseFloat(amount) || (parseFloat(invoice.total) - parseFloat(invoice.paid_amount));
                
                if (paymentAmount <= 0) {
                    await transaction.rollback();
                    return res.status(400).json({ success: false, message: 'Invalid payment amount' });
                }

                await WalletTransaction.create({
                    account_id,
                    type: 'Income',
                    direction: 'In',
                    amount: paymentAmount,
                    reference_id: invoice.id,
                    reference_type: 'Invoice',
                    description: `Payment for Invoice #${invoice.invoice_number}`,
                    tenant_id: invoice.tenant_id
                }, { transaction });

                await WalletAccount.increment('balance', { 
                    by: paymentAmount, 
                    where: { id: account_id }, 
                    transaction 
                });

                const newPaidAmount = parseFloat(invoice.paid_amount) + paymentAmount;
                const finalStatus = newPaidAmount >= parseFloat(invoice.total) ? 'Paid' : 'Partially Paid';
                const finalPaymentStatus = newPaidAmount >= parseFloat(invoice.total) ? 'Paid' : 'Partial';

                await invoice.update({ 
                    status: finalStatus,
                    payment_status: finalPaymentStatus,
                    paid_amount: newPaidAmount,
                    paid_at: finalStatus === 'Paid' ? new Date() : invoice.paid_at 
                }, { transaction });
            } else {
                await invoice.update({ status }, { transaction });
            }
        } 
        // Transition Logic: Full Reversal of Payments (Moving to Draft/Cancelled)
        else if ((status === 'Draft' || status === 'Cancelled') && (invoice.status === 'Paid' || invoice.status === 'Partially Paid')) {
            // Find ALL income transactions for this invoice
            const incomeTransactions = await WalletTransaction.findAll({
                where: { reference_id: invoice.id, reference_type: 'Invoice', type: 'Income', tenant_id: req.user.tenant_id },
                transaction
            });

            for (const tx of incomeTransactions) {
                await WalletAccount.decrement('balance', {
                    by: tx.amount,
                    where: { id: tx.account_id },
                    transaction
                });
                await tx.destroy({ transaction });
            }

            await invoice.update({ status, payment_status: 'Unpaid', paid_amount: 0, paid_at: null }, { transaction });
        }
        // General Status Change
        else {
            await invoice.update({ status }, { transaction });
        }

        await require('../utils/commissionEngine').syncInvoice(invoice, transaction);
        await transaction.commit();
        res.json({ success: true, message: `Invoice status updated to ${status}` });
    } catch (err) {
        await transaction.rollback();
        console.error('Update Status Error:', err);
        res.status(err.status || 500).json({ success: false, message: err.status && err.status < 500 ? err.message : 'Failed to update status', error: err.message });
    }
};

/**
 * Delete Invoice (Draft only)
 */
exports.deleteInvoice = async (req, res) => {
    try {
        const invoice = await Invoice.findOne({ where: { id: req.params.id, tenant_id: req.user.tenant_id } });
        if (!invoice) return res.status(404).json({ success: false, message: 'Invoice not found' });
        
        if (invoice.status !== 'Draft' && invoice.status !== 'Pending Approval') {
            return res.status(400).json({ success: false, message: 'Only Draft/Pending invoices can be deleted' });
        }

        const { sequelize, InvoiceItem } = require('../models');
        const t = await sequelize.transaction({ isolationLevel: 'READ COMMITTED' });
        try {
            await require('../utils/commissionFeature').lockTenant(req.user.tenant_id,t);
            await invoice.reload({ transaction: t, lock: t.LOCK.UPDATE });
            if (!['Draft','Pending Approval'].includes(invoice.status)) throw Object.assign(new Error('Only Draft/Pending invoices can be deleted'), { status: 400 });
            await require('../utils/commissionEngine').syncInvoice(invoice, t, 'Invoice deleted');
            await InvoiceItem.destroy({ where: { invoice_id: invoice.id, tenant_id: req.user.tenant_id }, transaction: t });
            await invoice.destroy({ transaction: t });
            await t.commit();
            res.json({ success: true, message: 'Invoice deleted successfully' });
        } catch (dbErr) {
            await t.rollback();
            throw dbErr;
        }
    } catch (err) {
        res.status(err.status || 500).json({ success: false, message: err.status && err.status < 500 ? err.message : 'Failed to delete invoice' });
    }
};

/**
 * Generate PDF
 */
exports.downloadPDF = async (req, res) => {
    try {
        const invoice = await Invoice.findOne({
            where: { id: req.params.id, tenant_id: req.user.tenant_id },
            include: [
                { model: Customer },
                { model: InvoiceItem }
            ]
        });

        if (!invoice) return res.status(404).json({ success: false, message: 'Invoice not found' });

        const policy = await loadInvoiceDocumentPolicy(req.user.tenant_id);
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename=${policy.type === 'tax_invoice' ? 'TaxInvoice' : 'Invoice'}_${invoice.invoice_number}.pdf`);

        await generateInvoicePDF(invoice, res, policy);
    } catch (err) {
        console.error('PDF Generation Error:', err);
        res.status(err.status || 500).json({ success: false, message: err.status && err.status < 500 ? err.message : 'Failed to generate PDF' });
    }
};
