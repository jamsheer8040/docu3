const { Op } = require('sequelize');
const { Customer, Document, Invoice, ServiceOrder, ServiceType, DocumentType, SalesOrder } = require('../models');
const { validationResult } = require('express-validator');

/**
 * Get all customers with pagination and search
 */
exports.getCustomers = async (req, res) => {
  let { page = 1, limit = 10, search = '', is_active } = req.query;
  limit = Math.min(parseInt(limit), 1000);
  const offset = (page - 1) * limit;

  const where = { tenant_id: req.user.tenant_id };
  if (is_active !== undefined) {
    where.is_active = is_active === 'true';
  }
  
  if (search) {
    where[Op.or] = [
      { name: { [Op.like]: `%${search}%` } },
      { email: { [Op.like]: `%${search}%` } },
      { phone_whatsapp: { [Op.like]: `%${search}%` } },
      { city: { [Op.like]: `%${search}%` } }
    ];
  }

  // Restrict CustomerPortal users to only their linked customers
  if (req.user && req.user.Role && req.user.Role.type === 'CustomerPortal') {
    const linkedIds = req.user.LinkedCustomers ? req.user.LinkedCustomers.map(c => c.id) : [];
    where.id = { [Op.in]: linkedIds };
  }

  try {
    const { count, rows } = await Customer.findAndCountAll({
      where,
      limit: parseInt(limit),
      offset: parseInt(offset),
      order: [['name', 'ASC']]
      ,include: [{ model: require('../models').User, as: 'AssignedSalesStaff', attributes: ['id', 'name'], required: false }]
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
    res.status(500).json({ success: false, message: 'Error fetching customers.' });
  }
};

/**
 * Get single customer by ID
 */
exports.getCustomerById = async (req, res) => {
  try {
    const customer = await Customer.findOne({
      where: { id: req.params.id, tenant_id: req.user.tenant_id },
      include: [
        { model: require('../models').User, as: 'AssignedSalesStaff', attributes: ['id', 'name'], required: false },
        { 
          model: Document, 
          limit: 20, 
          include: [{ model: DocumentType, attributes: ['name', 'category'] }],
          order: [['expiry_date', 'ASC']] 
        },
        { 
          model: Invoice, 
          limit: 20, 
          order: [['created_at', 'DESC']] 
        },
        { 
          model: ServiceOrder, 
          limit: 20, 
          include: [
            { model: ServiceType, attributes: ['id', 'name'] },
            { model: Invoice, attributes: ['id', 'invoice_number', 'status'] }
          ],
          order: [['created_at', 'DESC']] 
        }
      ]
    });
    
    if (!customer) {
      return res.status(404).json({ success: false, message: 'Customer not found.' });
    }
    res.json({ success: true, data: customer });
  } catch (err) {
    console.error('Error fetching customer profile:', err);
    res.status(500).json({ success: false, message: 'Error fetching customer profile details.' });
  }
};

/**
 * Create a new customer
 */
exports.createCustomer = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ success: false, errors: errors.array() });
  }

  try {
    const { id, created_by, ...input } = req.body;
    const data = { ...input, tenant_id: req.user.tenant_id };
    data.assigned_user_id = await require('../utils/customerSalesperson').customerSalesperson(input.assigned_user_id, req.user);
    const customer = await Customer.create(data);
    res.status(201).json({ success: true, data: customer });
  } catch (err) {
    res.status(err.status || 500).json({ success: false, message: err.status ? err.message : 'Error creating customer.' });
  }
};

/**
 * Update an existing customer
 */
exports.updateCustomer = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ success: false, errors: errors.array() });
  }

  try {
    const customer = await Customer.findOne({ where: { id: req.params.id, tenant_id: req.user.tenant_id } });
    if (!customer) {
      return res.status(404).json({ success: false, message: 'Customer not found.' });
    }
    const { tenant_id, id, ...updateData } = req.body;
    if (Object.hasOwn(updateData, 'assigned_user_id')) updateData.assigned_user_id = await require('../utils/customerSalesperson').customerSalesperson(updateData.assigned_user_id, req.user);
    await customer.update(updateData);
    res.json({ success: true, data: customer });
  } catch (err) {
    res.status(err.status || 500).json({ success: false, message: err.status ? err.message : 'Error updating customer.' });
  }
};

/**
 * Soft delete a customer (toggle is_active)
 */
exports.deleteCustomer = async (req, res) => {
  try {
    const customer = await Customer.findOne({ where: { id: req.params.id, tenant_id: req.user.tenant_id } });
    if (!customer) {
      return res.status(404).json({ success: false, message: 'Customer not found.' });
    }

    // CHECK FOR ACTIVE SERVICE ORDERS
    const activeOrders = await ServiceOrder.count({
      where: {
        tenant_id: req.user.tenant_id,
        customer_id: customer.id,
        status: { [Op.notIn]: ['Completed', 'Cancelled'] }
      }
    });

    if (activeOrders > 0) {
      return res.status(400).json({ 
        success: false, 
        message: 'Cannot deactivate customer with active service orders. Complete or cancel them first.' 
      });
    }

    // CHECK FOR ACTIVE SALES ORDERS
    const activeSalesOrders = await SalesOrder.count({
      where: {
        tenant_id: req.user.tenant_id,
        customer_id: customer.id
      },
      include: [{
        model: require('../models').SalesOrderItem,
        where: {
          status: { [Op.notIn]: ['CompletedInvoiceCreated', 'Cancelled'] }
        },
        required: true
      }]
    });

    if (activeSalesOrders > 0) {
      return res.status(400).json({ 
        success: false, 
        message: 'Cannot deactivate customer with pending sales orders. Complete or cancel them first.' 
      });
    }

    // CHECK FOR UNPAID INVOICES
    const unpaidInvoices = await Invoice.count({
      where: {
        tenant_id: req.user.tenant_id,
        customer_id: customer.id,
        status: { [Op.notIn]: ['Paid', 'Cancelled'] }
      }
    });

    if (unpaidInvoices > 0) {
      return res.status(400).json({ 
        success: false, 
        message: 'Cannot deactivate customer with unpaid invoices. Pay or cancel them first.' 
      });
    }

    customer.is_active = false;
    await customer.save();

    res.json({ success: true, message: 'Customer deactivated successfully.' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Error deactivating customer.' });
  }
};

/**
 * Bulk Import Customers
 */
exports.importBulkCustomers = async (req, res) => {
  const customersData = req.body.customers;
  
  if (!customersData || !Array.isArray(customersData) || customersData.length === 0) {
    return res.status(400).json({ success: false, message: 'No customers provided for import.' });
  }

  // Basic validation on the data (at least name and phone are required for each)
  const validCustomers = [];
  const invalidRows = [];

  for (let i = 0; i < customersData.length; i++) {
    const cust = customersData[i];
    if (!cust.name || !cust.phone_whatsapp) {
      invalidRows.push({ row: i + 1, reason: 'Name and WhatsApp Phone are required' });
      continue;
    }
    let salesperson;
    try { salesperson = await require('../utils/customerSalesperson').customerSalesperson(cust.assigned_user_id, req.user); }
    catch (error) { invalidRows.push({ row: i + 1, reason: error.message }); continue; }
    // ensure optional fields are not undefined (set to null or string)
    validCustomers.push({
      assigned_user_id: salesperson,
      name: cust.name,
      email: cust.email || null,
      phone_whatsapp: cust.phone_whatsapp,
      address: cust.address || null,
      city: cust.city || null,
      country: cust.country || 'UAE',
      trade_license_no: cust.trade_license_no || null,
      notes: cust.notes || null,
      pricing_category: ['Normal', 'Prime', 'Prime+'].includes(cust.pricing_category) ? cust.pricing_category : 'Normal',
      is_active: true,
      tenant_id: req.user.tenant_id
    });
  }

  if (validCustomers.length === 0) {
    return res.status(400).json({ 
      success: false, 
      message: 'No valid customers found in the import file.',
      invalidRows 
    });
  }

  try {
    // Note: checkCustomerLimit middleware runs before this, 
    // ensuring we don't exceed the total tenant limit.
    const createdCustomers = await Customer.bulkCreate(validCustomers, { ignoreDuplicates: true });
    
    res.status(201).json({ 
      success: true, 
      message: `Successfully processed ${createdCustomers.length} records. (Any duplicates with the same email were skipped).`,
      importedCount: createdCustomers.length,
      invalidRows: invalidRows.length > 0 ? invalidRows : undefined
    });
  } catch (error) {
    console.error('[CustomerController] Error during bulk import:', error);
    res.status(500).json({ success: false, message: 'Database error during bulk import.', error: error.message });
  }
};
