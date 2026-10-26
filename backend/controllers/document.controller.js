const { Op } = require('sequelize');
const sequelize = require('../config/database');
const { Document, Customer, DocumentType, SystemConfig } = require('../models');
const { validationResult } = require('express-validator');

/**
 * Get all documents with pagination, filters and joined customer
 */
exports.getDocuments = async (req, res) => {
  let { page = 1, limit = 10, customer_id, type, expiry_status, search, category, sortBy, sortDesc } = req.query;
  limit = Math.min(parseInt(limit), 100);
  const offset = (page - 1) * limit;

  const where = { tenant_id: req.user.tenant_id };
  let customerIdsArray = [];
  if (customer_id) {
    customerIdsArray = String(customer_id).split(',').map(id => parseInt(id)).filter(id => !isNaN(id));
    where.customer_id = { [Op.in]: customerIdsArray };
  }
  if (type) where.type = type;

  if (search) {
    where[Op.or] = [
      { doc_number: { [Op.like]: `%${search}%` } },
      { staff_name: { [Op.like]: `%${search}%` } },
      { '$Customer.name$': { [Op.like]: `%${search}%` } },
      { '$DocumentType.name$': { [Op.like]: `%${search}%` } }
    ];
  }

  if (req.user?.Role?.type === 'CustomerPortal') {
    const userCustomerIds = req.user.LinkedCustomers?.map(c => c.id) || [];
    if (customerIdsArray.length > 0) {
      const allowedIds = customerIdsArray.filter(id => userCustomerIds.includes(id));
      where.customer_id = { [Op.in]: allowedIds };
    } else {
      where.customer_id = { [Op.in]: userCustomerIds };
    }
  }

  if (expiry_status && expiry_status !== 'all') {
    let config = await SystemConfig.findOne({ where: { key: 'document_stages', tenant_id: req.user.tenant_id } });
    if (!config) config = await SystemConfig.findOne({ where: { key: 'document_stages', tenant_id: null } });
    let stages = [
      { id: 'expired', title: 'Expired', minDays: null, maxDays: -1, color: 'error', icon: 'mdi-alert-circle' },
      { id: 'critical', title: 'Critical (0-7 Days)', minDays: 0, maxDays: 7, color: 'error-lighten-1', icon: 'mdi-clock-alert-outline' },
      { id: 'warning', title: 'Warning (8-14 Days)', minDays: 8, maxDays: 14, color: 'warning', icon: 'mdi-bell-alert-outline' },
      { id: 'due_soon', title: 'Due Soon (15-30 Days)', minDays: 15, maxDays: 30, color: 'info', icon: 'mdi-calendar-clock' },
      { id: 'active', title: 'Active (>30 Days)', minDays: 31, maxDays: null, color: 'success', icon: 'mdi-check-circle-outline' }
    ];

    if (config && config.value) {
      try { stages = JSON.parse(config.value); } catch(e) {}
    }

    const stage = stages.find(s => s.id === expiry_status);
    if (stage) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const minDays = stage.minDays !== null && stage.minDays !== '' ? parseInt(stage.minDays) : null;
      const maxDays = stage.maxDays !== null && stage.maxDays !== '' ? parseInt(stage.maxDays) : null;

      const whereDate = {};
      if (minDays !== null) {
        const minDate = new Date(today);
        minDate.setDate(today.getDate() + minDays);
        whereDate[Op.gte] = minDate;
      }
      if (maxDays !== null) {
        const maxDate = new Date(today);
        maxDate.setDate(today.getDate() + maxDays);
        whereDate[Op.lte] = maxDate; // use lte for exact day match? Yes.
      }

      if (Object.keys(whereDate).length > 0) {
        where.expiry_date = whereDate;
      }
    }
  }

  try {
    const docTypeInclude = {
      model: DocumentType,
      attributes: ['name', 'category']
    };
    if (category) {
      docTypeInclude.where = { category };
    }

    let order = [['expiry_date', 'ASC']];
    if (sortBy) {
      try {
        let parsedSortBy = sortBy;
        if (typeof sortBy === 'string') {
          try { parsedSortBy = JSON.parse(sortBy); } catch (e) { parsedSortBy = [{ key: sortBy, order: sortDesc === 'true' ? 'desc' : 'asc' }]; }
        }
        
        if (Array.isArray(parsedSortBy) && parsedSortBy.length > 0) {
          order = parsedSortBy.map(item => {
            let col = typeof item === 'string' ? item : item.key;
            let desc = typeof item === 'object' && item.order === 'desc';
            if (sortDesc === 'true') desc = true;
            
            if (col === 'Customer') return [Customer, 'name', desc ? 'DESC' : 'ASC'];
            if (col === 'type') return [DocumentType, 'name', desc ? 'DESC' : 'ASC'];
            return [col, desc ? 'DESC' : 'ASC'];
          });
        }
      } catch (e) {
        console.error('Error parsing sortBy', e);
      }
    }

    const { count, rows } = await Document.findAndCountAll({
      where,
      include: [
        {
          model: Customer,
          attributes: ['name', 'phone_whatsapp']
        },
        docTypeInclude
      ],
      limit: parseInt(limit),
      offset: parseInt(offset),
      order,
      subQuery: false
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
    res.status(500).json({ success: false, message: 'Error fetching documents.' });
  }
};

/**
 * Get single document by ID
 */
exports.getDocumentById = async (req, res) => {
  try {
    const document = await Document.findOne({
      where: { id: req.params.id, tenant_id: req.user.tenant_id },
      include: [
        {
          model: Customer,
          attributes: ['name', 'phone_whatsapp']
        },
        {
          model: DocumentType,
          attributes: ['id', 'name']
        }
      ]
    });
    if (!document) {
      return res.status(404).json({ success: false, message: 'Document not found.' });
    }
    if (req.user?.Role?.type === 'CustomerPortal') {
      const userCustomerIds = req.user.LinkedCustomers?.map(c => c.id) || [];
      if (!userCustomerIds.includes(document.customer_id)) {
        return res.status(403).json({ success: false, message: 'Access denied.' });
      }
    }
    res.json({ success: true, data: document });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Error fetching document.' });
  }
};

/**
 * Get expiring documents grouped by urgency
 */
exports.getExpiringDocuments = async (req, res) => {
  try {
    let config = await SystemConfig.findOne({ where: { key: 'document_stages', tenant_id: req.user.tenant_id } });
    if (!config) config = await SystemConfig.findOne({ where: { key: 'document_stages', tenant_id: null } });
    let stages = [
      { id: 'expired', title: 'Expired', minDays: null, maxDays: -1, color: 'error', icon: 'mdi-alert-circle' },
      { id: 'critical', title: 'Critical (0-7 Days)', minDays: 0, maxDays: 7, color: 'error-lighten-1', icon: 'mdi-clock-alert-outline' },
      { id: 'warning', title: 'Warning (8-14 Days)', minDays: 8, maxDays: 14, color: 'warning', icon: 'mdi-bell-alert-outline' },
      { id: 'due_soon', title: 'Due Soon (15-30 Days)', minDays: 15, maxDays: 30, color: 'info', icon: 'mdi-calendar-clock' },
      { id: 'active', title: 'Active (>30 Days)', minDays: 31, maxDays: null, color: 'success', icon: 'mdi-check-circle-outline' }
    ];

    if (config && config.value) {
      try { stages = JSON.parse(config.value); } catch(e) {}
    }

    const { customer_id } = req.query;
    const where = { tenant_id: req.user.tenant_id };
    let customerIdsArray = [];
    if (customer_id) {
      customerIdsArray = String(customer_id).split(',').map(id => parseInt(id)).filter(id => !isNaN(id));
      where.customer_id = { [Op.in]: customerIdsArray };
    }

    if (req.user?.Role?.type === 'CustomerPortal') {
      const userCustomerIds = req.user.LinkedCustomers?.map(c => c.id) || [];
      if (customerIdsArray.length > 0) {
        const allowedIds = customerIdsArray.filter(id => userCustomerIds.includes(id));
        where.customer_id = { [Op.in]: allowedIds };
      } else {
        where.customer_id = { [Op.in]: userCustomerIds };
      }
    }

    const documents = await Document.findAll({
      where,
      include: [
        { model: Customer, attributes: ['name', 'phone_whatsapp'] },
        { model: DocumentType, attributes: ['name'] }
      ],
      order: [['expiry_date', 'ASC']]
    });

    const grouped = {};
    stages.forEach(s => grouped[s.id] = []);
    grouped['uncategorized'] = [];

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    documents.forEach(doc => {
      const expiry = new Date(doc.expiry_date);
      const diffTime = expiry.getTime() - today.getTime();
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

      let matched = false;
      for (const stage of stages) {
        const min = stage.minDays !== null && stage.minDays !== '' ? parseInt(stage.minDays) : -Infinity;
        const max = stage.maxDays !== null && stage.maxDays !== '' ? parseInt(stage.maxDays) : Infinity;

        if (diffDays >= min && diffDays <= max) {
          grouped[stage.id].push(doc);
          matched = true;
          break;
        }
      }
      if (!matched) {
        grouped['uncategorized'].push(doc);
      }
    });

    res.json({ success: true, data: { stages, grouped } });
  } catch (err) {
    console.error('getExpiringDocuments Error:', err);
    res.status(500).json({ success: false, message: 'Error fetching expiring documents.' });
  }
};

/**
 * Create a new document
 */
const fs = require('fs');
const path = require('path');

exports.createDocument = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ success: false, errors: errors.array() });
  }

  try {
    const { id, tenant_id, file_path, ...data } = req.body;
    if (req.file) {
      data.file_path = `/uploads/documents/${req.file.filename}`;
    }
    
    // Explicitly set tenant_id to prevent AsyncLocalStorage context loss from multer
    if (req.user && req.user.tenant_id) {
        data.tenant_id = req.user.tenant_id;
    }

    if (req.user?.Role?.type === 'CustomerPortal') {
      const userCustomerIds = req.user.LinkedCustomers?.map(c => c.id) || [];
      // Ensure the provided customer_id is allowed, or default to their first linked customer
      if (data.customer_id && !userCustomerIds.includes(parseInt(data.customer_id))) {
        return res.status(403).json({ success: false, message: 'Cannot create document for this customer.' });
      }
      if (!data.customer_id && userCustomerIds.length > 0) {
        data.customer_id = userCustomerIds[0];
      }
    }

    const document = await Document.create(data);
    // Fetch with customer to return a completely populated object
    const populated = await Document.findOne({
      where: { id: document.id, tenant_id: req.user.tenant_id },
      include: [
        { model: Customer, attributes: ['name', 'phone_whatsapp'] },
        { model: DocumentType, attributes: ['name'] }
      ]
    });
    res.status(201).json({ success: true, data: populated });
  } catch (err) {
    console.error('Create Document Error:', err);
    res.status(500).json({ success: false, message: 'Error creating document.' });
  }
};

/**
 * Update an existing document
 */
exports.updateDocument = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ success: false, errors: errors.array() });
  }

  try {
    let document = await Document.findOne({ where: { id: req.params.id, tenant_id: req.user.tenant_id } });
    if (!document) {
      return res.status(404).json({ success: false, message: 'Document not found.' });
    }

    if (req.user?.Role?.type === 'CustomerPortal') {
      const userCustomerIds = req.user.LinkedCustomers?.map(c => c.id) || [];
      if (!userCustomerIds.includes(document.customer_id)) {
        return res.status(403).json({ success: false, message: 'Access denied.' });
      }
    }

    const { id: docId, tenant_id: dTenant, file_path, ...data } = req.body;
    if (req.user?.Role?.type === 'CustomerPortal') {
      const userCustomerIds = req.user.LinkedCustomers?.map(c => c.id) || [];
      if (data.customer_id && !userCustomerIds.includes(parseInt(data.customer_id))) {
        return res.status(403).json({ success: false, message: 'Cannot reassign to this customer.' });
      }
    }
    if (req.file) {
      // Delete old file if exists
      if (document.file_path) {
        const oldPath = path.join(__dirname, '..', document.file_path);
        if (fs.existsSync(oldPath)) {
          fs.unlinkSync(oldPath);
        }
      }
      data.file_path = `/uploads/documents/${req.file.filename}`;
    }

    await document.update(data);
    
    // Fetch populated
    document = await Document.findOne({
      where: { id: req.params.id, tenant_id: req.user.tenant_id },
      include: [
        { model: Customer, attributes: ['name', 'phone_whatsapp'] },
        { model: DocumentType, attributes: ['name'] }
      ]
    });

    res.json({ success: true, data: document });
  } catch (err) {
    console.error('Update Document Error:', err);
    res.status(500).json({ success: false, message: 'Error updating document.' });
  }
};

/**
 * Delete a document
 */
exports.deleteDocument = async (req, res) => {
  try {
    const document = await Document.findOne({ where: { id: req.params.id, tenant_id: req.user.tenant_id } });
    if (!document) {
      return res.status(404).json({ success: false, message: 'Document not found.' });
    }

    if (req.user?.Role?.type === 'CustomerPortal') {
      const userCustomerIds = req.user.LinkedCustomers?.map(c => c.id) || [];
      if (!userCustomerIds.includes(document.customer_id)) {
        return res.status(403).json({ success: false, message: 'Access denied.' });
      }
    }

    // Delete file if exists
    if (document.file_path) {
      const filePath = path.join(__dirname, '..', document.file_path);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    }

    await document.destroy();
    res.json({ success: true, message: 'Document deleted successfully.' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Error deleting document.' });
  }
};

exports.getStaffNames = async (req, res) => {
  try {
    const { customer_id } = req.query;
    
    const whereClause = {
      staff_name: {
        [Op.ne]: null
      },
      tenant_id: req.user.tenant_id
    };
    
    if (customer_id) {
      whereClause.customer_id = customer_id;
    }

    const docs = await Document.findAll({
      attributes: [[sequelize.fn('DISTINCT', sequelize.col('staff_name')), 'staff_name']],
      where: whereClause,
      raw: true
    });
    
    const namesSet = new Set();
    
    docs.forEach(d => {
      if (d.staff_name && d.staff_name.trim()) {
        namesSet.add(d.staff_name.trim());
      }
    });

    // Only include internal users if not filtering by a specific customer
    if (!customer_id) {
      const { User, Role } = require('../models');
      const users = await User.findAll({
        where: { is_active: true, tenant_id: req.user.tenant_id },
        include: [{
          model: Role,
          where: {
            type: 'Internal'
          }
        }],
        raw: true
      });

      users.forEach(u => {
        if (u.name && u.name.trim()) {
          namesSet.add(u.name.trim());
        }
      });
    }

    res.json({ success: true, data: Array.from(namesSet).sort() });
  } catch (err) {
    console.error('getStaffNames Error:', err);
    res.status(500).json({ success: false, message: 'Error fetching staff names.' });
  }
};

exports.incrementReminderCount = async (req, res) => {
  try {
    const { id } = req.params;
    const document = await Document.findOne({ where: { id, tenant_id: req.user.tenant_id } });
    if (!document) {
      return res.status(404).json({ success: false, message: 'Document not found' });
    }

    if (req.user?.Role?.type === 'CustomerPortal') {
      const userCustomerIds = req.user.LinkedCustomers?.map(c => c.id) || [];
      if (!userCustomerIds.includes(parseInt(document.customer_id))) {
        return res.status(403).json({ success: false, message: 'Access denied' });
      }
    }

    // Because we have a getter on reminder_count that returns 0 if over 90 days,
    // document.reminder_count evaluates to 0 automatically if it's expired.
    document.reminder_count = (document.reminder_count || 0) + 1;
    document.last_reminded_at = new Date();
    await document.save();

    res.json({ success: true, reminder_count: document.reminder_count });
  } catch (err) {
    console.error('incrementReminderCount Error:', err);
    res.status(500).json({ success: false, message: 'Error updating reminder count.' });
  }
};
